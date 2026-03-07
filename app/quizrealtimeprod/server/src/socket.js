// server/src/socket.js
// Complete WebSocket handler with proper imports and all game actions

import {
  addOrReconnectPlayer,
  attachDisplaySocket,
  attachHostSocket,
  buildLeaderboards,
  getOrCreateDemoSession,
  getPublicPlayers,
  getPublicTeams,
  getSession,
  persistSessions,
  saveQuiz,
  store,
  removeSocketFromSessions,
} from "./store.js";

import {
  awardManualPoints,
  burgerNextItem,
  buzzerNextPlayer,
  cancelPendingAutoReveal,
  finishQuiz,
  lockPlayers,
  nextQuestion,
  pauseGame,
  prevQuestion,
  prevRound,
  recordBuzzer,
  recordPlayerAnswer,
  refreshQuestion,
  resumeGame,
  revealAnswer,
  scheduleAutoRevealAfterAllAnswered,
  setBurgerPlayer,
  showResults,
  shouldAutoRevealNow,
  startQuiz,
  startRound,
  startTimer,
  stopTimer,
  unlockPlayers,
} from "./engine.js";

function sessionRoom(code) {
  return `session:${String(code).toUpperCase()}`;
}

function safeAck(ack, payload) {
  try {
    if (typeof ack === "function") ack(payload);
  } catch {}
}

function getNickname(rank, total) {
  if (rank === 1) return "🏆 Champion Absolu";
  if (rank === 2) return "🥈 Vice-Champion";
  if (rank === 3) return "🥉 Bronze Mérité";
  const third = Math.ceil(total / 3);
  if (rank <= third) return "⭐ Bon Joueur";
  if (rank <= 2 * third) return "😅 Dans la Moyenne";
  if (rank === total) return "🥔 Grand Maître des Nuls";
  if (rank > total - Math.ceil(total * 0.2)) return "😬 Apprenti(e) Cancre";
  return "🐢 Peut Mieux Faire";
}

function buildFinalCeremonyData(session) {
  const { leaderboardPlayers, leaderboardTeams } = buildLeaderboards(session);
  const total = leaderboardPlayers.length;
  const revealOrder = [...leaderboardPlayers].reverse().map((p, idx) => ({
    revealIndex: idx,
    rank: p.rank,
    pseudo: p.pseudo,
    playerId: p.playerId,
    teamId: p.teamId || null,
    teamName: p.teamName || null,
    scoreTotal: p.scoreTotal || 0,
    nickname: getNickname(p.rank, total),
    revealed: false,
  }));
  return {
    initializedAt: new Date().toISOString(),
    stage: "players",
    revealCursor: 0,
    revealOrder,
    winnerTeam: leaderboardTeams[0] || null,
    confettiSeed: Math.floor(Math.random() * 100000),
  };
}

function emitSessionState(io, session) {
  if (!session?.gameState?.phaseMeta) {
    if (session?.gameState)
      session.gameState.phaseMeta = {
        playerScreenLocked: false,
        allowAnswer: false,
        answerMode: "none",
        timer: null,
      };
  }
  if (session?.gameState?.phaseMeta?.finalCeremony === undefined) {
    session.gameState.phaseMeta.finalCeremony = null;
  }
  const { leaderboardPlayers, leaderboardTeams } = buildLeaderboards(session);
  io.to(sessionRoom(session.sessionCode)).emit("game:state", {
    gameState: session.gameState,
    players: getPublicPlayers(session),
    teams: getPublicTeams(session),
    leaderboardPlayers,
    leaderboardTeams,
  });
}

function persistAndEmit(io, session) {
  persistSessions();
  emitSessionState(io, session);
}

function handleFinalCeremonyAction(session, action) {
  const gs = session.gameState;
  if (!gs.phaseMeta)
    gs.phaseMeta = {
      playerScreenLocked: true,
      allowAnswer: false,
      answerMode: "none",
      timer: null,
    };
  const pm = gs.phaseMeta;

  if (action === "final_ceremony_init") {
    pm.playerScreenLocked = true;
    pm.allowAnswer = false;
    pm.finalCeremony = buildFinalCeremonyData(session);
    gs.status = "end";
    gs.updatedAt = new Date().toISOString();
    return { ok: true };
  }
  if (action === "final_ceremony_reveal_next") {
    const fc = pm.finalCeremony;
    if (!fc) return { ok: false, error: "Cérémonie non initialisée" };
    if (fc.revealCursor < fc.revealOrder.length) {
      fc.revealOrder[fc.revealCursor].revealed = true;
      fc.revealCursor++;
    }
    if (fc.revealCursor >= fc.revealOrder.length) fc.stage = "team_winner";
    gs.updatedAt = new Date().toISOString();
    return { ok: true };
  }
  if (action === "final_ceremony_show_team_winner") {
    if (pm.finalCeremony) pm.finalCeremony.stage = "team_winner";
    gs.updatedAt = new Date().toISOString();
    return { ok: true };
  }
  if (action === "final_ceremony_reset") {
    pm.finalCeremony = null;
    gs.updatedAt = new Date().toISOString();
    return { ok: true };
  }
  return { ok: false, error: `Action finale inconnue: ${action}` };
}

export function setupSocketHandlers(io) {
  io.on("connection", (socket) => {
    getOrCreateDemoSession("1234");

    // --- ADMIN ---
    socket.on("admin:quiz:save", ({ quiz } = {}, ack) => {
      try {
        if (!quiz) {
          safeAck(ack, { ok: false, error: "Quiz invalide" });
          return;
        }
        const saved = saveQuiz(quiz);
        safeAck(ack, { ok: true, quiz: saved });
      } catch (e) {
        safeAck(ack, { ok: false, error: e.message });
      }
    });

    // --- HOST ---
    socket.on("join:host", ({ sessionCode, hostKey } = {}, ack) => {
      try {
        const session = getSession(sessionCode);
        if (!session) {
          safeAck(ack, { ok: false, error: "Session introuvable" });
          return;
        }
        if (String(hostKey || "") !== String(session.hostKey || "")) {
          safeAck(ack, { ok: false, error: "Clé host invalide" });
          return;
        }
        socket.join(sessionRoom(session.sessionCode));
        socket.data = {
          ...socket.data,
          role: "host",
          sessionCode: session.sessionCode,
        };
        attachHostSocket(session, socket.id);
        safeAck(ack, { ok: true });
        persistAndEmit(io, session);
      } catch (e) {
        safeAck(ack, { ok: false, error: e.message });
      }
    });

    // --- DISPLAY ---
    socket.on("join:display", ({ sessionCode } = {}, ack) => {
      try {
        const session = getSession(sessionCode);
        if (!session) {
          safeAck(ack, { ok: false, error: "Session introuvable" });
          return;
        }
        socket.join(sessionRoom(session.sessionCode));
        socket.data = {
          ...socket.data,
          role: "display",
          sessionCode: session.sessionCode,
        };
        attachDisplaySocket(session, socket.id);
        safeAck(ack, { ok: true });
        emitSessionState(io, session);
      } catch (e) {
        safeAck(ack, { ok: false, error: e.message });
      }
    });

    // --- PLAYER JOIN ---
    socket.on("join:player", ({ sessionCode, pseudo, teamId } = {}, ack) => {
      try {
        const session = getSession(sessionCode);
        if (!session) {
          safeAck(ack, { ok: false, error: "Session introuvable" });
          return;
        }
        const result = addOrReconnectPlayer({
          session,
          pseudo,
          teamId: teamId || null,
          socketId: socket.id,
        });
        if (result.error) {
          safeAck(ack, { ok: false, error: result.error });
          return;
        }
        socket.join(sessionRoom(session.sessionCode));
        socket.data = {
          ...socket.data,
          role: "player",
          sessionCode: session.sessionCode,
          playerId: result.player.id,
        };
        safeAck(ack, {
          ok: true,
          player: {
            id: result.player.id,
            pseudo: result.player.pseudo,
            reconnectToken: result.player.reconnectToken,
            teamId: result.player.teamId,
            teamName: result.player.teamName,
          },
        });
        persistAndEmit(io, session);
      } catch (e) {
        safeAck(ack, { ok: false, error: e.message });
      }
    });

    // --- PLAYER RECONNECT ---
    socket.on(
      "player:reconnect",
      ({ sessionCode, reconnectToken } = {}, ack) => {
        try {
          const session = getSession(sessionCode);
          if (!session) {
            safeAck(ack, { ok: false, error: "Session introuvable" });
            return;
          }
          const result = addOrReconnectPlayer({
            session,
            pseudo: "",
            reconnectToken,
            socketId: socket.id,
          });
          if (result.error) {
            safeAck(ack, { ok: false, error: result.error });
            return;
          }
          socket.join(sessionRoom(session.sessionCode));
          socket.data = {
            ...socket.data,
            role: "player",
            sessionCode: session.sessionCode,
            playerId: result.player.id,
          };
          safeAck(ack, {
            ok: true,
            player: {
              id: result.player.id,
              pseudo: result.player.pseudo,
              reconnectToken: result.player.reconnectToken,
              teamId: result.player.teamId,
              teamName: result.player.teamName,
            },
          });
          persistAndEmit(io, session);
        } catch (e) {
          safeAck(ack, { ok: false, error: e.message });
        }
      },
    );

    // --- PLAYER ANSWER ---
    socket.on("player:answer", (payload = {}, ack) => {
      try {
        const { sessionCode, playerId, answer, answerType } = payload;
        const session = getSession(sessionCode || socket.data?.sessionCode);
        if (!session) {
          safeAck(ack, { ok: false, error: "Session introuvable" });
          return;
        }
        const effectivePlayerId = socket.data?.playerId || playerId;
        const player = session.players?.find((p) => p.id === effectivePlayerId);
        if (!player) {
          safeAck(ack, { ok: false, error: "Joueur introuvable" });
          return;
        }
        const res = recordPlayerAnswer(session, {
          player,
          playerId: player.id,
          answer,
          answerType,
        });
        safeAck(ack, res);
        if (!res.ok) return;

        persistAndEmit(io, session);

        if (res.autoReveal) {
          revealAnswer(session);
          persistAndEmit(io, session);
          return;
        }

        const auto = shouldAutoRevealNow(session);
        if (auto.ok && auto.mode === "delay_5s") {
          scheduleAutoRevealAfterAllAnswered(session, {
            emitNow: (s) => persistAndEmit(io, s),
            onAutoReveal: (s) => {
              revealAnswer(s);
              persistAndEmit(io, s);
            },
          });
        }
      } catch (e) {
        safeAck(ack, { ok: false, error: e.message });
      }
    });

    // --- PLAYER BUZZER ---
    socket.on("player:buzzer", (payload = {}, ack) => {
      try {
        const { sessionCode, playerId } = payload;
        const session = getSession(sessionCode || socket.data?.sessionCode);
        if (!session) {
          safeAck(ack, { ok: false, error: "Session introuvable" });
          return;
        }
        const effectivePlayerId = socket.data?.playerId || playerId;
        const player = session.players?.find((p) => p.id === effectivePlayerId);
        if (!player) {
          safeAck(ack, { ok: false, error: "Joueur introuvable" });
          return;
        }
        const res = recordBuzzer(session, { player });
        safeAck(ack, res);
        if (res.ok) persistAndEmit(io, session);
      } catch (e) {
        safeAck(ack, { ok: false, error: e.message });
      }
    });

    // --- HOST ACTIONS ---
    socket.on("host:action", (payload = {}, ack) => {
      try {
        const { sessionCode, hostKey, action } = payload;
        const session = getSession(sessionCode || socket.data?.sessionCode);
        if (!session) {
          safeAck(ack, { ok: false, error: "Session introuvable" });
          return;
        }
        const authorized =
          socket.data?.role === "host" ||
          String(hostKey || "") === String(session.hostKey || "");
        if (!authorized) {
          safeAck(ack, { ok: false, error: "Non autorisé" });
          return;
        }

        let res = { ok: false, error: "Action inconnue" };
        cancelPendingAutoReveal(session);

        switch (action) {
          case "start_quiz":
            res = startQuiz(session);
            break;
          case "start_round":
            res = startRound(session);
            break;
          case "next_question": {
            res = nextQuestion(session);
            if (res.ok) {
              const nextQ = session.gameState.currentQuestion;
              const nextQType = nextQ?.type || "";
              // Auto-start 45s timer for MCQ and True/False — host reveals manually (no auto-reveal)
              if (
                (nextQType === "qcm" || nextQType === "true_false") &&
                session.gameState.status === "question"
              ) {
                startTimer(session, 45, {
                  emitNow: (s) => emitSessionState(io, s),
                  onAutoReveal: () => {}, // noop: pas de reveal auto, le host décide
                });
              }
            }
            break;
          }

          case "prev_question":
            res = prevQuestion(session);
            break;

          case "pause_game":
            res = pauseGame(session);
            break;

          case "resume_game":
            res = resumeGame(session, {
              emitNow: (s) => emitSessionState(io, s),
              onAutoReveal: () => {},
            });
            break;
          case "next_round": {
            const rounds = session?.quiz?.rounds || [];
            const cur = Number(session?.gameState?.currentRoundIndex ?? -1);
            const next = cur + 1;
            if (!rounds[next]) {
              res = finishQuiz(session);
            } else {
              session.gameState.currentRoundIndex = next;
              session.gameState.currentQuestionIndex = -1;
              session.gameState.currentRound = rounds[next];
              session.gameState.currentQuestion = null;
              if (session.gameState.phaseMeta) {
                session.gameState.phaseMeta.playerScreenLocked = true;
                session.gameState.phaseMeta.allowAnswer = false;
                session.gameState.phaseMeta.answerMode = "none";
                session.gameState.phaseMeta.timer = null;
              }
              session.gameState.trueFalseVotes = { yes: [], no: [] };
              session.gameState.buzzerState = null;
              session.gameState.buzzerQueue = [];
              session.gameState.burgerState = null;
              session.gameState.status = "round_intro";
              session.gameState.updatedAt = new Date().toISOString();
              res = { ok: true };
            }
            break;
          }
          case "start_timer":
            res = startTimer(session, payload.seconds, {
              emitNow: (s) => emitSessionState(io, s),
              // Quand le timer expire : verrouiller les joueurs (écran d'attente)
              // Le host choisit ensuite de révéler ou passer à la question suivante
              onAutoReveal: () => {},
            });
            break;

          case "stop_timer":
            res = stopTimer(session);
            break;
          case "lock_players":
            res = lockPlayers(session);
            break;
          case "unlock_players":
            res = unlockPlayers(session);
            break;
          case "reveal_answer":
            res = revealAnswer(session);
            break;
          case "show_results":
            res = showResults(session);
            break;
          case "finish_quiz":
            res = finishQuiz(session);
            break;
          case "award_points_manual":
          case "award_manual_points":
            res = awardManualPoints(session, {
              playerId: payload.playerId,
              points: payload.points,
              reason: payload.reason,
            });
            break;

          case "rename_team": {
            const t = (session.teams || []).find(
              (t) => t.id === payload.teamId,
            );
            if (!t) {
              res = { ok: false, error: "Équipe introuvable" };
              break;
            }
            t.name = String(payload.newName || t.name).trim();
            for (const p of session.players || []) {
              if (p.teamId === payload.teamId) p.teamName = t.name;
            }
            res = { ok: true };
            break;
          }

          case "final_ceremony_init":
          case "final_ceremony_reveal_next":
          case "final_ceremony_show_team_winner":
          case "final_ceremony_reset":
            res = handleFinalCeremonyAction(session, action);
            break;

          // --- TEST / ADMIN ACTIONS ---
          case "add_bot": {
            const botPseudo = String(
              payload.pseudo || `Bot_${Math.random().toString(36).slice(2, 6)}`,
            ).trim();
            const botTeamId = payload.teamId || null;
            const existingPseudo = session.players.some(
              (p) => p.pseudo.toLowerCase() === botPseudo.toLowerCase(),
            );
            if (existingPseudo) {
              res = { ok: false, error: "Ce pseudo est déjà utilisé" };
              break;
            }
            const assignedTeam = botTeamId
              ? (session.teams || []).find((t) => t.id === botTeamId)
              : null;

            const bot = {
              id: `bot_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`,
              pseudo: botPseudo,
              teamId: assignedTeam?.id || null,
              teamName: assignedTeam?.name || null,
              reconnectToken: `reco_bot_${Math.random().toString(36).slice(2, 9)}`,
              connected: true,
              socketId: null,
              scoreTotal: 0,
              isBot: true,
            };
            session.players.push(bot);
            res = { ok: true, player: bot };
            break;
          }

          case "remove_player": {
            const pidx = (session.players || []).findIndex(
              (p) => p.id === payload.playerId,
            );
            if (pidx < 0) {
              res = { ok: false, error: "Joueur introuvable" };
              break;
            }
            session.players.splice(pidx, 1);
            res = { ok: true };
            break;
          }

          case "clear_players": {
            session.players = [];
            res = { ok: true };
            break;
          }

          case "reset_scores": {
            for (const p of session.players || []) p.scoreTotal = 0;
            for (const t of session.teams || []) t.scoreTotal = 0;
            res = { ok: true };
            break;
          }

          case "prev_round":
            res = prevRound(session);
            break;

          case "refresh_question":
            res = refreshQuestion(session);
            break;

          case "burger_next_item":
            res = burgerNextItem(session);
            break;

          case "activate_buzzer":
            // Activer les buzzers (passer de gris à rouge)
            res = unlockPlayers(session);
            break;

          case "buzzer_mark_correct": {
            // Marquer le buzzer courant comme correct (avec son sur le display)
            const buzzerCorrectId = session.gameState.buzzerState?.firstPlayerId;
            if (!buzzerCorrectId) {
              res = { ok: false, error: "Aucun joueur n'a buzzé" };
              break;
            }
            awardManualPoints(session, { playerId: buzzerCorrectId, points: 1, reason: "buzzer_correct" });
            session.gameState.buzzerLastResult = {
              result: "correct",
              playerId: buzzerCorrectId,
              pseudo: session.gameState.buzzerState.firstPseudo,
              at: new Date().toISOString(),
            };
            res = { ok: true };
            break;
          }

          case "buzzer_mark_wrong": {
            // Marquer le buzzer courant comme incorrect (avec son sur le display)
            const buzzerWrongId = session.gameState.buzzerState?.firstPlayerId;
            session.gameState.buzzerLastResult = {
              result: "wrong",
              playerId: buzzerWrongId || null,
              pseudo: session.gameState.buzzerState?.firstPseudo || null,
              at: new Date().toISOString(),
            };
            res = { ok: true };
            break;
          }

          case "stop_session": {
            // Stopper la partie en cours → retour au lobby
            if (session.gameState) {
              cancelPendingAutoReveal(session);
              session.gameState.status = "lobby";
              session.gameState.currentRoundIndex = -1;
              session.gameState.currentQuestionIndex = -1;
              session.gameState.currentRound = null;
              session.gameState.currentQuestion = null;
              session.gameState.phaseMeta = {
                playerScreenLocked: false,
                allowAnswer: false,
                answerMode: "none",
                timer: null,
                finalCeremony: null,
              };
              session.gameState.trueFalseVotes = { yes: [], no: [] };
              session.gameState.buzzerState = null;
              session.gameState.buzzerQueue = [];
              session.gameState.buzzerLastResult = null;
              session.gameState.burgerState = null;
              session.gameState.updatedAt = new Date().toISOString();
            }
            res = { ok: true };
            break;
          }

          case "reset_all": {
            // Reset complet : joueurs, scores, progression (garde les quiz)
            cancelPendingAutoReveal(session);
            session.players = [];
            session.gameState.status = "lobby";
            session.gameState.currentRoundIndex = -1;
            session.gameState.currentQuestionIndex = -1;
            session.gameState.currentRound = null;
            session.gameState.currentQuestion = null;
            session.gameState.answers = {};
            session.gameState.phaseMeta = {
              playerScreenLocked: false,
              allowAnswer: false,
              answerMode: "none",
              timer: null,
              finalCeremony: null,
            };
            session.gameState.trueFalseVotes = { yes: [], no: [] };
            session.gameState.buzzerState = null;
            session.gameState.buzzerQueue = [];
            session.gameState.buzzerLastResult = null;
            session.gameState.burgerState = null;
            session.gameState.revealedAnswer = null;
            session.gameState.updatedAt = new Date().toISOString();
            for (const t of session.teams || []) t.scoreTotal = 0;
            res = { ok: true };
            break;
          }

          case "burger_select_player":
            res = setBurgerPlayer(session, payload.playerId || null);
            break;

          case "buzzer_next":
            res = buzzerNextPlayer(session);
            break;

          case "award_team": {
            // Attribuer N points à toute une équipe
            const teamId = payload.teamId;
            const pts = Number(payload.points || 1);
            if (!teamId) { res = { ok: false, error: "teamId requis" }; break; }
            let awarded = 0;
            for (const p of (session.players || [])) {
              if (p.teamId === teamId) {
                const r = awardManualPoints(session, { playerId: p.id, points: pts, reason: "award_team" });
                if (r.ok) awarded++;
              }
            }
            res = { ok: true, awarded };
            break;
          }

          case "award_all": {
            // Attribuer N points à tous les joueurs connectés
            const pts2 = Number(payload.points || 1);
            let awarded2 = 0;
            for (const p of (session.players || [])) {
              if (p.connected) {
                const r = awardManualPoints(session, { playerId: p.id, points: pts2, reason: "award_all" });
                if (r.ok) awarded2++;
              }
            }
            res = { ok: true, awarded: awarded2 };
            break;
          }

          case "broadcast_message": {
            // Diffuse un message texte/image à tous les joueurs (ou une cible)
            const bm = {
              text: payload.text || '',
              imageUrl: payload.imageUrl || '',
              target: payload.target || 'all',
              sentAt: new Date().toISOString(),
            };
            if (!session.gameState.phaseMeta) session.gameState.phaseMeta = {};
            session.gameState.phaseMeta.broadcastMessage = bm;
            res = { ok: true };
            break;
          }

          case "broadcast_clear": {
            // Efface le message de diffusion en cours
            if (session.gameState?.phaseMeta) {
              session.gameState.phaseMeta.broadcastMessage = null;
            }
            res = { ok: true };
            break;
          }

          case "assign_team": {
            const player = (session.players || []).find(
              (p) => p.id === payload.playerId,
            );
            if (!player) {
              res = { ok: false, error: "Joueur introuvable" };
              break;
            }
            const team = payload.teamId
              ? (session.teams || []).find((t) => t.id === payload.teamId)
              : null;
            player.teamId = team?.id || null;
            player.teamName = team?.name || null;
            res = { ok: true };
            break;
          }

          case "reset_game": {
            // Resets game to lobby while keeping players
            if (session.gameState) {
              session.gameState.status = "lobby";
              session.gameState.currentRoundIndex = -1;
              session.gameState.currentQuestionIndex = -1;
              session.gameState.currentRound = null;
              session.gameState.currentQuestion = null;
              session.gameState.phaseMeta = {
                playerScreenLocked: false,
                allowAnswer: false,
                answerMode: "none",
                timer: null,
                finalCeremony: null,
              };
              session.gameState.trueFalseVotes = { yes: [], no: [] };
              session.gameState.buzzerState = null;
              session.gameState.buzzerQueue = [];
              session.gameState.burgerState = null;
              session.gameState.updatedAt = new Date().toISOString();
            }
            res = { ok: true };
            break;
          }
        }

        safeAck(ack, res);
        if (res.ok) persistAndEmit(io, session);
      } catch (e) {
        safeAck(ack, { ok: false, error: e.message });
      }
    });

    // --- SESSION STATE ---
    socket.on("session:get_state", ({ sessionCode } = {}, ack) => {
      try {
        const session = getSession(sessionCode || socket.data?.sessionCode);
        if (!session) {
          safeAck(ack, { ok: false, error: "Session introuvable" });
          return;
        }
        const { leaderboardPlayers, leaderboardTeams } =
          buildLeaderboards(session);
        safeAck(ack, {
          ok: true,
          gameState: session.gameState,
          players: getPublicPlayers(session),
          teams: getPublicTeams(session),
          leaderboardPlayers,
          leaderboardTeams,
        });
      } catch (e) {
        safeAck(ack, { ok: false, error: e.message });
      }
    });

    // --- DISCONNECT ---
    socket.on("disconnect", () => {
      try {
        removeSocketFromSessions(socket.id);
        for (const session of store.sessions.values()) {
          emitSessionState(io, session);
        }
      } catch {}
    });
  });
}
