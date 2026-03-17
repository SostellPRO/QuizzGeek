// server/src/engine.js
// Moteur de jeu (compatible avec server/src/socket.js + server/src/store.js)
// Version sécurisée et défensive

import { touchGameState, resetQuestionTransientState } from "./gameState.js";

function nowIso() {
  return new Date().toISOString();
}

function asUpper(v) {
  return String(v || "").toUpperCase();
}

function normalizeText(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function ensureSessionRuntime(session) {
  if (!session || typeof session !== "object") {
    throw new Error("Session invalide");
  }

  if (!session._runtime || typeof session._runtime !== "object") {
    session._runtime = {
      timerInterval: null,
      autoRevealTimeout: null,
      timerQuestionId: null,
      timerStartedAt: null,
    };
  }

  if (!session.gameState?.phaseMeta) {
    session.gameState.phaseMeta = {
      playerScreenLocked: false,
      allowAnswer: false,
      answerMode: "none",
      timer: null,
    };
  }

  if (
    !session.gameState.answers ||
    typeof session.gameState.answers !== "object"
  ) {
    session.gameState.answers = {};
  }

  if (!session.gameState.trueFalseVotes) {
    session.gameState.trueFalseVotes = { yes: [], no: [] };
  }

  if (session.gameState.buzzerState === undefined) {
    session.gameState.buzzerState = null;
  }

  if (!session.gameState.voteState) {
    session.gameState.voteState = null;
  }

  return session._runtime;
}

function clearTimer(session) {
  const rt = ensureSessionRuntime(session);

  if (rt.timerInterval) {
    clearInterval(rt.timerInterval);
    rt.timerInterval = null;
  }

  rt.timerQuestionId = null;
  rt.timerStartedAt = null;

  if (session?.gameState?.phaseMeta) {
    session.gameState.phaseMeta.timer = null;
  }
}

function clearAutoRevealTimeout(session) {
  const rt = ensureSessionRuntime(session);

  if (rt.autoRevealTimeout) {
    clearTimeout(rt.autoRevealTimeout);
    rt.autoRevealTimeout = null;
  }
}

function touch(session) {
  if (!session?.gameState) return;
  touchGameState(session.gameState);
}

function getRounds(session) {
  return Array.isArray(session?.quiz?.rounds) ? session.quiz.rounds : [];
}

// Supporte les deux formats: round.questions (nouveau) et round.items (ancien)
function getRoundQuestions(round) {
  if (Array.isArray(round?.questions)) return round.questions;
  if (Array.isArray(round?.items)) return round.items;
  return [];
}

// Normalise le type d'une question (supporte type et questionType)
function getQuestionType(question) {
  return question?.type || question?.questionType || "text";
}

function getCurrentRound(session) {
  const rounds = getRounds(session);
  const idx = Number(session?.gameState?.currentRoundIndex ?? -1);
  return rounds[idx] || null;
}

function getCurrentQuestion(session) {
  const round = getCurrentRound(session);
  if (!round) return null;

  const questions = getRoundQuestions(round);
  const qIdx = Number(session?.gameState?.currentQuestionIndex ?? -1);
  return questions[qIdx] || null;
}

function setCurrentRoundAndQuestionSnapshots(session) {
  if (!session?.gameState) return;

  session.gameState.currentRound = getCurrentRound(session);
  session.gameState.currentQuestion = getCurrentQuestion(session);
}

function setStatus(session, status) {
  session.gameState.status = status;
  touch(session);
}

function setPhaseMeta(session, patch = {}) {
  ensureSessionRuntime(session);
  session.gameState.phaseMeta = {
    ...session.gameState.phaseMeta,
    ...patch,
  };
  touch(session);
}

function setAnswerModeFromQuestion(session) {
  const round = getCurrentRound(session);
  const question = getCurrentQuestion(session);

  let answerMode = "none";

  if (!round || !question) {
    answerMode = "none";
  } else {
    const qType = getQuestionType(question);
    if (
      qType === "rapidite" ||
      qType === "speed" ||
      qType === "buzzer" ||
      round.type === "rapidite" ||
      round.type === "speed"
    ) {
      answerMode = "buzzer";
    } else if (
      qType === "true_false" ||
      round.type === "true_false"
    ) {
      answerMode = "true_false";
    } else if (
      qType === "vote" ||
      round.type === "vote"
    ) {
      answerMode = "vote_input";
    } else if (
      qType === "qcm" ||
      qType === "mcq" ||
      round.type === "qcm" ||
      round.type === "questionnaire"
    ) {
      answerMode = "mcq";
    } else if (qType === "burger" || round.type === "burger") {
      answerMode = "burger";
    } else {
      answerMode = "text";
    }
  }

  setPhaseMeta(session, { answerMode });
}

function ensureQuestionAnswersBucket(session, questionId) {
  if (!questionId) return null;

  if (
    !session.gameState.answers[questionId] ||
    typeof session.gameState.answers[questionId] !== "object"
  ) {
    session.gameState.answers[questionId] = {};
  }

  return session.gameState.answers[questionId];
}

function getQuestionAnswersMap(session, questionId) {
  if (!questionId) return {};
  return session.gameState.answers?.[questionId] || {};
}

function getCurrentQuestionAnswers(session) {
  const q = getCurrentQuestion(session);
  if (!q) return {};
  return getQuestionAnswersMap(session, q.id);
}

function recomputeTrueFalseVotes(session) {
  const q = getCurrentQuestion(session);
  if (!q) {
    session.gameState.trueFalseVotes = { yes: [], no: [] };
    return;
  }

  const answers = getQuestionAnswersMap(session, q.id);
  const yes = [];
  const no = [];

  for (const player of session.players || []) {
    const a = answers[player.id];
    if (!a) continue;

    const n = normalizeText(a.answer);
    if (["vrai", "true", "oui", "yes"].includes(n)) yes.push(player.pseudo);
    if (["faux", "false", "non", "no"].includes(n)) no.push(player.pseudo);
  }

  session.gameState.trueFalseVotes = { yes, no };
  touch(session);
}

function resetQuestionTransient(session) {
  resetQuestionTransientState(session.gameState);

  // Réinitialiser l'état de vote pour la nouvelle question
  session.gameState.voteState = null;

  // Réinitialiser l'état burger lié à la question précédente
  session.gameState.burgerSelectedPlayerId = null;
  session.gameState.burgerSelectedTeamId = null;
  session.gameState.burgerSelectedPseudo = null;
  session.gameState.burgerFinalScore = null;

  // on conserve answers globaux par question, mais on réinitialise le timer + écrans
  setPhaseMeta(session, {
    timer: null,
  });

  clearTimer(session);
  clearAutoRevealTimeout(session);
}

function getConnectedPlayers(session) {
  return (session.players || []).filter((p) => !!p.connected);
}

function getAnsweredPlayerIdsForCurrentQuestion(session) {
  const answers = getCurrentQuestionAnswers(session);
  return new Set(Object.keys(answers));
}

function allConnectedPlayersAnswered(session) {
  const connected = getConnectedPlayers(session);
  if (!connected.length) return false;

  const answeredIds = getAnsweredPlayerIdsForCurrentQuestion(session);
  return connected.every((p) => answeredIds.has(p.id));
}

function isAutoScoringRound(round) {
  return String(round?.scoringMode || "").toLowerCase() === "auto";
}

function isArbitreRound(round) {
  return String(round?.scoringMode || "").toLowerCase() === "arbitre";
}

function syncTeamScoresFromPlayers(session) {
  const teamTotals = new Map();

  for (const t of session.teams || []) {
    teamTotals.set(t.id, 0);
  }

  for (const p of session.players || []) {
    if (p.teamId && teamTotals.has(p.teamId)) {
      teamTotals.set(
        p.teamId,
        (teamTotals.get(p.teamId) || 0) + Number(p.scoreTotal || 0),
      );
    }
  }

  for (const t of session.teams || []) {
    t.scoreTotal = teamTotals.get(t.id) || 0;
  }
}

function awardPointsToPlayer(session, playerId, points) {
  const p = (session.players || []).find((x) => x.id === playerId);
  if (!p) return { ok: false, error: "Joueur introuvable" };

  const n = Number(points);
  if (!Number.isFinite(n)) return { ok: false, error: "Points invalides" };

  p.scoreTotal = Number(p.scoreTotal || 0) + n;
  syncTeamScoresFromPlayers(session);
  touch(session);

  return { ok: true, player: p };
}

function detectCorrectAnswer(question, answer) {
  if (!question) return false;

  const qType = getQuestionType(question);

  // true/false
  if (qType === "true_false") {
    const expected = normalizeText(
      question.correctAnswer ??
        question.solution ??
        (question.isTrue === true
          ? "vrai"
          : question.isTrue === false
            ? "faux"
            : ""),
    );
    const actual = normalizeText(answer);
    return !!expected && actual === expected;
  }

  // MCQ / text / generic
  const expected = normalizeText(
    question.correctAnswer ?? question.solution ?? "",
  );
  const actual = normalizeText(answer);

  return !!expected && actual === expected;
}

function autoScoreCurrentQuestion(session) {
  const round = getCurrentRound(session);
  const q = getCurrentQuestion(session);

  if (!round || !q) return { ok: false, error: "Aucune question active" };
  if (!isAutoScoringRound(round)) return { ok: true, skipped: true };

  const bucket = getQuestionAnswersMap(session, q.id);
  const answers = Object.values(bucket);

  if (!answers.length) return { ok: true, applied: 0 };

  let applied = 0;

  // rapidité: seul le premier bon répondant marque 1 point
  if (round.type === "rapidite" || round.type === "speed") {
    const sorted = answers
      .filter((a) => detectCorrectAnswer(q, a.answer))
      .sort((a, b) => Number(a.answeredAt || 0) - Number(b.answeredAt || 0));

    const winner = sorted[0];
    if (winner) {
      const res = awardPointsToPlayer(session, winner.playerId, 1);
      if (res.ok) applied += 1;
    }

    return { ok: true, applied };
  }

  // auto classique: 1 point par bonne réponse
  for (const a of answers) {
    if (detectCorrectAnswer(q, a.answer)) {
      const res = awardPointsToPlayer(session, a.playerId, 1);
      if (res.ok) applied += 1;
    }
  }

  return { ok: true, applied };
}

function buildRevealPayloadForCurrentQuestion(session) {
  const q = getCurrentQuestion(session);
  if (!q) return null;

  const revealMode = q.revealMode || "pseudo_and_answer";
  const bucket = getQuestionAnswersMap(session, q.id);

  const answers = Object.values(bucket)
    .sort((a, b) => Number(a.answeredAt || 0) - Number(b.answeredAt || 0))
    .map((a) => ({
      playerId: a.playerId,
      pseudo: a.pseudo,
      answer: a.answer,
      answerType: a.answerType || null,
      answeredAt: a.answeredAt || null,
    }));

  return {
    questionId: q.id,
    revealMode,
    correctAnswer: q.correctAnswer ?? q.solution ?? null,
    answers,
  };
}

function isQuestionPhaseOpen(session) {
  const status = session?.gameState?.status;
  const locked = !!session?.gameState?.phaseMeta?.playerScreenLocked;
  const allowAnswer = !!session?.gameState?.phaseMeta?.allowAnswer;

  return (
    (status === "question" || status === "waiting") && !locked && allowAnswer
  );
}

function safeSeconds(raw, fallback = 15) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(3600, Math.floor(n)));
}

function canHostMutateDuringTimer(session) {
  // réservé si besoin futur
  return !!session;
}

/* ------------------------------------------------------------------ */
/* Exports utilisés par socket.js                                      */
/* ------------------------------------------------------------------ */

export function startQuiz(session) {
  ensureSessionRuntime(session);

  clearTimer(session);
  clearAutoRevealTimeout(session);

  // Reset progression
  session.gameState.currentRoundIndex = -1;
  session.gameState.currentQuestionIndex = -1;
  session.gameState.currentRound = null;
  session.gameState.currentQuestion = null;

  // Reset phase meta
  session.gameState.phaseMeta = {
    ...session.gameState.phaseMeta,
    playerScreenLocked: true,
    allowAnswer: false,
    answerMode: "none",
    timer: null,
  };

  // Reset transients
  session.gameState.trueFalseVotes = { yes: [], no: [] };
  session.gameState.buzzerState = null;
  session.gameState.burgerState = null;
  session.gameState.buzzerQueue = [];
  session.gameState.buzzerCooldowns = {};
  session.gameState.burgerFinalScore = null;

  // Aller directement à round_intro si des manches existent
  const rounds = getRounds(session);
  if (rounds.length > 0) {
    session.gameState.currentRoundIndex = 0;
    setCurrentRoundAndQuestionSnapshots(session);
    setStatus(session, "round_intro");
  } else {
    setStatus(session, "lobby");
  }
  return { ok: true };
}

export function startRound(session) {
  ensureSessionRuntime(session);

  clearTimer(session);
  clearAutoRevealTimeout(session);

  const rounds = getRounds(session);
  if (!rounds.length) return { ok: false, error: "Aucune manche disponible" };

  // Si aucune manche en cours => 0, sinon on garde l’index courant
  let idx = Number(session.gameState.currentRoundIndex ?? -1);
  if (idx < 0) idx = 0;

  if (!rounds[idx]) return { ok: false, error: "Manche introuvable" };

  session.gameState.currentRoundIndex = idx;
  session.gameState.currentQuestionIndex = -1;
  setCurrentRoundAndQuestionSnapshots(session);

  resetQuestionTransient(session);

  setPhaseMeta(session, {
    playerScreenLocked: true,
    allowAnswer: false,
    answerMode: "none",
    timer: null,
  });

  setStatus(session, "round_intro");
  return { ok: true };
}

export function nextQuestion(session) {
  ensureSessionRuntime(session);

  clearTimer(session);
  clearAutoRevealTimeout(session);

  const round = getCurrentRound(session);
  if (!round) return { ok: false, error: "Lancez d'abord une manche" };

  const questions = getRoundQuestions(round);
  if (!questions.length) {
    setPhaseMeta(session, {
      playerScreenLocked: true,
      allowAnswer: false,
      answerMode: "none",
      timer: null,
    });
    setStatus(session, "round_end");
    return { ok: true };
  }

  const nextIdx = Number(session.gameState.currentQuestionIndex ?? -1) + 1;

  if (!questions[nextIdx]) {
    // fin de manche → afficher l'écran de fin de manche (pas les scores directement)
    session.gameState.currentQuestionIndex = -1;
    setCurrentRoundAndQuestionSnapshots(session);

    setPhaseMeta(session, {
      playerScreenLocked: true,
      allowAnswer: false,
      answerMode: "none",
      timer: null,
    });

    resetQuestionTransientState(session.gameState);
    setStatus(session, "round_end");
    return { ok: true };
  }

  session.gameState.currentQuestionIndex = nextIdx;
  setCurrentRoundAndQuestionSnapshots(session);

  resetQuestionTransient(session);

  setPhaseMeta(session, {
    playerScreenLocked: false,
    allowAnswer: true,
    timer: null,
  });
  setAnswerModeFromQuestion(session);

  // Buzzer : en mode rapidité les buzzers sont déjà actifs dès le début.
  // Pour les autres modes buzzer (non utilisés pour l'instant), on verrouille
  // et le host doit cliquer "Activer les buzzers".
  const newAnswerMode = session.gameState.phaseMeta?.answerMode;
  const currentRoundForBuzzer = getCurrentRound(session);
  const isRapiditRound =
    currentRoundForBuzzer?.type === "rapidite" ||
    currentRoundForBuzzer?.type === "speed";
  if (newAnswerMode === "buzzer" && !isRapiditRound) {
    setPhaseMeta(session, { playerScreenLocked: true, allowAnswer: false });
  }

  // Réinitialiser le dernier résultat buzzer et les cooldowns
  session.gameState.buzzerLastResult = null;
  session.gameState.buzzerCooldowns = {};

  setStatus(session, "question");
  return { ok: true };
}

export function prevQuestion(session) {
  ensureSessionRuntime(session);
  clearTimer(session);
  clearAutoRevealTimeout(session);

  const round = getCurrentRound(session);
  if (!round) return { ok: false, error: "Aucune manche active" };

  const curIdx = Number(session.gameState.currentQuestionIndex ?? -1);
  if (curIdx <= 0) return { ok: false, error: "Déjà à la première question" };

  const prevIdx = curIdx - 1;
  const questions = getRoundQuestions(round);
  if (!questions[prevIdx]) return { ok: false, error: "Question précédente introuvable" };

  session.gameState.currentQuestionIndex = prevIdx;
  setCurrentRoundAndQuestionSnapshots(session);
  resetQuestionTransient(session);
  setPhaseMeta(session, { playerScreenLocked: false, allowAnswer: true, timer: null });
  setAnswerModeFromQuestion(session);
  setStatus(session, "question");
  return { ok: true };
}

export function pauseGame(session) {
  ensureSessionRuntime(session);
  const timerNow = session.gameState?.phaseMeta?.timer;
  const remainingSec = timerNow?.remainingSec ?? null;
  const totalSec = timerNow?.totalSec ?? null;
  clearTimer(session);
  clearAutoRevealTimeout(session);
  setPhaseMeta(session, {
    paused: true,
    pausedRemainingSec: remainingSec,
    pausedTotalSec: totalSec,
    playerScreenLocked: true,
    allowAnswer: false,
    timer: remainingSec !== null ? {
      totalSec: totalSec || remainingSec,
      remainingSec,
      startedAt: timerNow?.startedAt || new Date().toISOString(),
      paused: true,
    } : null,
  });
  touch(session);
  return { ok: true, pausedRemainingSec: remainingSec };
}

export function resumeGame(session, hooks = {}) {
  ensureSessionRuntime(session);
  const pm = session.gameState?.phaseMeta || {};
  const pausedSec = pm.pausedRemainingSec ?? null;
  const pausedTotal = pm.pausedTotalSec ?? null;
  setPhaseMeta(session, {
    paused: false,
    pausedRemainingSec: undefined,
    pausedTotalSec: undefined,
    playerScreenLocked: false,
    allowAnswer: true,
    timer: null,
  });
  setStatus(session, "question");
  touch(session);
  if (pausedSec != null && pausedSec > 0) {
    return startTimer(session, pausedSec, hooks);
  }
  return { ok: true };
}

export function startTimer(session, seconds, hooks = {}) {
  ensureSessionRuntime(session);

  const q = getCurrentQuestion(session);
  if (!q) return { ok: false, error: "Aucune question en cours" };
  if (!canHostMutateDuringTimer(session))
    return { ok: false, error: "Session invalide" };

  clearTimer(session);

  const totalSec = safeSeconds(seconds, q.timeLimitSec ?? 15);
  const rt = ensureSessionRuntime(session);

  rt.timerQuestionId = q.id;
  rt.timerStartedAt = Date.now();

  session.gameState.phaseMeta.timer = {
    totalSec,
    remainingSec: totalSec,
    startedAt: nowIso(),
  };

  touch(session);

  const emitNow = typeof hooks.emitNow === "function" ? hooks.emitNow : null;
  const onAutoReveal =
    typeof hooks.onAutoReveal === "function" ? hooks.onAutoReveal : null;

  rt.timerInterval = setInterval(() => {
    const currentQ = getCurrentQuestion(session);

    // sécurité: si la question a changé, on stoppe
    if (!currentQ || currentQ.id !== rt.timerQuestionId) {
      clearTimer(session);
      return;
    }

    const timer = session.gameState?.phaseMeta?.timer;
    if (!timer) {
      clearTimer(session);
      return;
    }

    // BUG FIX: Calcul basé sur le temps écoulé réel (plus précis que le décrément cumulatif)
    // Évite la dérive de setInterval qui allonge la dernière seconde
    const elapsedSec = Math.floor((Date.now() - rt.timerStartedAt) / 1000);
    timer.remainingSec = Math.max(0, totalSec - elapsedSec);
    touch(session);

    if (emitNow) {
      try {
        emitNow(session);
      } catch {
        // noop
      }
    }

    if (timer.remainingSec <= 0) {
      clearTimer(session);

      // Fin du temps: verrouiller + waiting (ou manual_scoring selon round)
      const round = getCurrentRound(session);
      const isArbitre = isArbitreRound(round);

      setPhaseMeta(session, {
        playerScreenLocked: true,
        allowAnswer: false,
      });

      if (isArbitre) {
        setStatus(session, "manual_scoring");
        if (emitNow) {
          try {
            emitNow(session);
          } catch {
            // noop
          }
        }
        return;
      }

      setStatus(session, "waiting");

      if (emitNow) {
        try {
          emitNow(session);
        } catch {
          // noop
        }
      }

      // reveal auto après 5s
      clearAutoRevealTimeout(session);
      rt.autoRevealTimeout = setTimeout(() => {
        rt.autoRevealTimeout = null;

        // vérifier que la question n'a pas changé
        const qAgain = getCurrentQuestion(session);
        if (!qAgain || qAgain.id !== rt.timerQuestionId) return;

        // seulement si on est encore sur une phase compatible
        if (!["question", "waiting"].includes(session.gameState.status)) return;

        if (onAutoReveal) {
          try {
            onAutoReveal(session, "timer_end");
          } catch {
            // fallback local
            revealAnswer(session);
          }
        } else {
          revealAnswer(session);
        }
      }, 5000);
    }
  }, 1000);

  return { ok: true };
}

export function lockPlayers(session) {
  ensureSessionRuntime(session);

  setPhaseMeta(session, {
    playerScreenLocked: true,
    allowAnswer: false,
  });

  return { ok: true };
}

export function unlockPlayers(session) {
  ensureSessionRuntime(session);

  const q = getCurrentQuestion(session);
  if (!q) return { ok: false, error: "Aucune question en cours" };

  // En mode rapidité, reset le buzzerState pour permettre au prochain joueur de buzzer
  const round = getCurrentRound(session);
  const isSpeed =
    round?.type === "rapidite" ||
    round?.type === "speed" ||
    getQuestionType(q) === "rapidite" ||
    getQuestionType(q) === "buzzer";
  if (isSpeed) {
    session.gameState.buzzerState = null;
  }

  setPhaseMeta(session, {
    playerScreenLocked: false,
    allowAnswer: ["question", "waiting", "manual_scoring"].includes(
      session.gameState.status,
    ),
  });

  if (isSpeed) {
    setStatus(session, "question");
  }

  return { ok: true };
}

export function revealAnswer(session) {
  ensureSessionRuntime(session);

  const q = getCurrentQuestion(session);
  if (!q) return { ok: false, error: "Aucune question en cours" };

  clearTimer(session);
  clearAutoRevealTimeout(session);

  // score auto si manche auto et si on n'est pas déjà en reveal/scoring
  const round = getCurrentRound(session);
  if (round && isAutoScoringRound(round)) {
    autoScoreCurrentQuestion(session);
  }

  setPhaseMeta(session, {
    playerScreenLocked: true,
    allowAnswer: false,
    timer: null,
  });

  setStatus(session, "answer_reveal");

  // On stocke un objet "revealedAnswer" directement dans gameState si le front le lit
  session.gameState.revealedAnswer =
    buildRevealPayloadForCurrentQuestion(session);

  // true/false votes à jour pour l’écran
  recomputeTrueFalseVotes(session);

  touch(session);
  return { ok: true };
}

export function showResults(session) {
  ensureSessionRuntime(session);

  clearTimer(session);
  clearAutoRevealTimeout(session);

  setPhaseMeta(session, {
    playerScreenLocked: true,
    allowAnswer: false,
    timer: null,
    answerMode: "none",
  });

  setStatus(session, "results");
  return { ok: true };
}

export function finishQuiz(session) {
  ensureSessionRuntime(session);

  clearTimer(session);
  clearAutoRevealTimeout(session);

  setPhaseMeta(session, {
    playerScreenLocked: true,
    allowAnswer: false,
    timer: null,
    answerMode: "none",
  });

  setStatus(session, "end");
  return { ok: true };
}

export function awardManualPoints(session, { playerId, points, reason } = {}) {
  ensureSessionRuntime(session);

  if (!playerId) return { ok: false, error: "playerId requis" };

  const n = Number(points);
  if (!Number.isFinite(n)) return { ok: false, error: "Points invalides" };
  if (n < -100 || n > 100) return { ok: false, error: "Points hors limite" };

  const res = awardPointsToPlayer(session, playerId, n);
  if (!res.ok) return res;

  // On peut passer / rester en scoring manuel
  if (!["results", "end"].includes(session.gameState.status)) {
    setStatus(session, "manual_scoring");
  }

  session.gameState.lastManualAward = {
    playerId,
    points: n,
    reason: reason || null,
    at: nowIso(),
  };

  touch(session);
  return { ok: true };
}

export function recordPlayerAnswer(
  session,
  { player, playerId, answer, answerType } = {},
) {
  ensureSessionRuntime(session);

  if (!player && playerId) {
    player = (session.players || []).find((p) => p.id === playerId) || null;
  }

  if (!player) return { ok: false, error: "Joueur introuvable" };
  if (!player.connected) return { ok: false, error: "Joueur hors ligne" };

  const q = getCurrentQuestion(session);
  if (!q) return { ok: false, error: "Aucune question active" };

  if (!isQuestionPhaseOpen(session)) {
    return { ok: false, error: "Phase de réponse fermée" };
  }

  const bucket = ensureQuestionAnswersBucket(session, q.id);

  const payload = {
    playerId: player.id,
    pseudo: player.pseudo,
    answer:
      typeof answer === "string"
        ? answer.trim()
        : answer === null || answer === undefined
          ? ""
          : String(answer),
    answerType: answerType || null,
    answeredAt: Date.now(),
  };

  // overwrite autorisé (utile pour vrai/faux)
  bucket[player.id] = payload;

  // buzzer + vrai/faux états de display
  if (
    session.gameState.phaseMeta.answerMode === "true_false" ||
    getQuestionType(q) === "true_false"
  ) {
    recomputeTrueFalseVotes(session);
  }

  touch(session);

  // mode rapidité: si bon answer => auto reveal immédiat possible
  const round = getCurrentRound(session);
  const isSpeed =
    round?.type === "rapidite" ||
    round?.type === "speed" ||
    getQuestionType(q) === "buzzer";
  if (isSpeed && detectCorrectAnswer(q, payload.answer)) {
    // lock + waiting/reveal via socket (res.autoReveal = true)
    setPhaseMeta(session, { playerScreenLocked: true, allowAnswer: false });
    setStatus(session, "waiting");
    return { ok: true, autoReveal: true, mode: "speed_first_correct" };
  }

  return { ok: true };
}

export function recordBuzzer(session, { player } = {}) {
  ensureSessionRuntime(session);

  if (!player) return { ok: false, error: "Joueur introuvable" };
  if (!player.connected) return { ok: false, error: "Joueur hors ligne" };

  const q = getCurrentQuestion(session);
  if (!q) return { ok: false, error: "Aucune question active" };

  const round = getCurrentRound(session);
  const buzzerAllowed =
    session.gameState.phaseMeta.answerMode === "buzzer" ||
    round?.type === "rapidite" ||
    round?.type === "speed";

  if (!buzzerAllowed) {
    return { ok: false, error: "Buzzer non disponible sur cette question" };
  }

  if (!isQuestionPhaseOpen(session)) {
    return { ok: false, error: "Buzzer fermé" };
  }

  // Vérifier le cooldown (rapidité : après mauvaise réponse, 5s de pénalité)
  const nowMs = Date.now();
  if (!session.gameState.buzzerCooldowns) session.gameState.buzzerCooldowns = {};
  const cooldownExpiry = session.gameState.buzzerCooldowns[player.id] || 0;
  if (cooldownExpiry > nowMs) {
    const remainingSec = Math.ceil((cooldownExpiry - nowMs) / 1000);
    return { ok: false, error: `Buzzer bloqué encore ${remainingSec}s` };
  }
  // Nettoyer les cooldowns expirés
  for (const pid of Object.keys(session.gameState.buzzerCooldowns)) {
    if (session.gameState.buzzerCooldowns[pid] <= nowMs) {
      delete session.gameState.buzzerCooldowns[pid];
    }
  }

  // Gestion rotation buzzerQueue : un joueur ne peut rebuzzer que si tous ont participé
  if (!Array.isArray(session.gameState.buzzerQueue)) {
    session.gameState.buzzerQueue = [];
  }
  const connectedIds = getConnectedPlayers(session).map((p) => p.id);
  // Si tous ont participé, reset la queue
  if (connectedIds.every((id) => session.gameState.buzzerQueue.includes(id))) {
    session.gameState.buzzerQueue = [];
  }
  if (session.gameState.buzzerQueue.includes(player.id)) {
    return {
      ok: false,
      error: "Vous avez déjà participé, attendez les autres joueurs",
    };
  }

  if (session.gameState.buzzerState?.firstPlayerId) {
    return { ok: false, error: "Buzzer déjà pris" };
  }

  session.gameState.buzzerQueue.push(player.id);
  session.gameState.buzzerState = {
    firstPlayerId: player.id,
    firstPseudo: player.pseudo,
    buzzedAt: nowIso(),
  };

  // Verrouille les joueurs et passe en scoring manuel
  setPhaseMeta(session, {
    playerScreenLocked: true,
    allowAnswer: false,
  });
  setStatus(session, "manual_scoring");

  touch(session);
  return { ok: true };
}

export function burgerNextItem(session) {
  ensureSessionRuntime(session);

  const q = getCurrentQuestion(session);
  if (!q) return { ok: false, error: "Aucune question active" };

  const qType = getQuestionType(q);
  if (qType !== "burger") {
    return { ok: false, error: "Question de type burger uniquement" };
  }

  if (!session.gameState.burgerState) {
    session.gameState.burgerState = {
      questionId: q.id,
      currentItemIndex: -1,
    };
  }

  const bs = session.gameState.burgerState;
  const totalItems = Array.isArray(q.items) ? q.items.length : 0;

  if (bs.currentItemIndex < totalItems - 1) {
    bs.currentItemIndex++;
    touch(session);
    return { ok: true, currentItemIndex: bs.currentItemIndex, totalItems };
  }

  // Tous les items sont passés → scoring manuel
  setPhaseMeta(session, {
    playerScreenLocked: true,
    allowAnswer: false,
  });
  setStatus(session, "manual_scoring");
  touch(session);
  return { ok: true, finished: true, currentItemIndex: bs.currentItemIndex, totalItems };
}

export function shouldAutoRevealNow(session) {
  ensureSessionRuntime(session);

  const q = getCurrentQuestion(session);
  const round = getCurrentRound(session);

  if (!q || !round) return { ok: false, error: "Aucune question active" };

  // Seulement pendant question/waiting
  if (!["question", "waiting"].includes(session.gameState.status)) {
    return { ok: false, error: "Phase incompatible" };
  }

  // Si déjà verrouillé manuellement, pas d'auto reveal
  if (session.gameState.phaseMeta.playerScreenLocked) {
    return { ok: false, error: "Écrans verrouillés" };
  }

  // auto uniquement pour scoring auto
  if (!isAutoScoringRound(round)) {
    return { ok: false, error: "Manche en arbitrage manuel" };
  }

  // cas rapidité: géré dans recordPlayerAnswer (premier bon)
  if (round.type === "rapidite" || round.type === "speed") {
    return { ok: false, error: "Gestion rapidité séparée" };
  }

  if (!allConnectedPlayersAnswered(session)) {
    return { ok: false, error: "Tous les joueurs n'ont pas répondu" };
  }

  return { ok: true, mode: "delay_5s" };
}

export function scheduleAutoRevealAfterAllAnswered(session, hooks = {}) {
  ensureSessionRuntime(session);

  const q = getCurrentQuestion(session);
  if (!q) return { ok: false, error: "Aucune question active" };

  const rt = ensureSessionRuntime(session);
  clearAutoRevealTimeout(session);

  // Passe en waiting + verrouille les réponses
  setPhaseMeta(session, {
    playerScreenLocked: true,
    allowAnswer: false,
  });
  setStatus(session, "waiting");

  const emitNow = typeof hooks.emitNow === "function" ? hooks.emitNow : null;
  const onAutoReveal =
    typeof hooks.onAutoReveal === "function" ? hooks.onAutoReveal : null;
  const expectedQuestionId = q.id;

  rt.autoRevealTimeout = setTimeout(() => {
    rt.autoRevealTimeout = null;

    const qNow = getCurrentQuestion(session);
    if (!qNow || qNow.id !== expectedQuestionId) return;
    if (!["question", "waiting"].includes(session.gameState.status)) return;

    if (onAutoReveal) {
      try {
        onAutoReveal(session, "all_answered");
      } catch {
        revealAnswer(session);
      }
    } else {
      revealAnswer(session);
    }
  }, 5000);

  if (emitNow) {
    try {
      emitNow(session);
    } catch {
      // noop
    }
  }

  return { ok: true, mode: "delay_5s" };
}

export function cancelPendingAutoReveal(session) {
  ensureSessionRuntime(session);
  clearAutoRevealTimeout(session);
  clearTimer(session);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Nouvelles actions de navigation & jeu                               */
/* ------------------------------------------------------------------ */

/**
 * Retour à la manche précédente (round_intro de cette manche)
 */
export function prevRound(session) {
  ensureSessionRuntime(session);
  clearTimer(session);
  clearAutoRevealTimeout(session);

  const curIdx = Number(session?.gameState?.currentRoundIndex ?? -1);
  if (curIdx <= 0) return { ok: false, error: "Déjà à la première manche" };

  const rounds = getRounds(session);
  const prevIdx = curIdx - 1;
  if (!rounds[prevIdx]) return { ok: false, error: "Manche précédente introuvable" };

  session.gameState.currentRoundIndex = prevIdx;
  session.gameState.currentQuestionIndex = -1;
  setCurrentRoundAndQuestionSnapshots(session);
  resetQuestionTransient(session);
  setPhaseMeta(session, {
    playerScreenLocked: true,
    allowAnswer: false,
    answerMode: "none",
    timer: null,
  });
  setStatus(session, "round_intro");
  return { ok: true };
}

/**
 * Rafraîchit la question courante : remet à zéro réponses et transients,
 * repart sur la même question sans changer d'index.
 */
export function refreshQuestion(session) {
  ensureSessionRuntime(session);
  clearTimer(session);
  clearAutoRevealTimeout(session);

  const q = getCurrentQuestion(session);
  if (!q) return { ok: false, error: "Aucune question active" };

  // Effacer les réponses enregistrées pour cette question
  if (session.gameState.answers && q.id) {
    delete session.gameState.answers[q.id];
  }

  resetQuestionTransient(session);
  setPhaseMeta(session, {
    playerScreenLocked: false,
    allowAnswer: true,
    timer: null,
  });
  setAnswerModeFromQuestion(session);
  setStatus(session, "question");
  return { ok: true };
}

/**
 * Sélectionne le joueur actif pour l'épreuve Burger.
 * Les autres joueurs verront un écran d'attente.
 */
export function setBurgerPlayer(session, playerId) {
  ensureSessionRuntime(session);

  if (!playerId) {
    // Désélectionner
    session.gameState.burgerSelectedPlayerId = null;
    session.gameState.burgerSelectedTeamId = null;
    session.gameState.burgerSelectedPseudo = null;
    touch(session);
    return { ok: true };
  }

  const player = (session.players || []).find((p) => p.id === playerId);
  if (!player) return { ok: false, error: "Joueur introuvable" };

  session.gameState.burgerSelectedPlayerId = playerId;
  session.gameState.burgerSelectedTeamId = null;
  session.gameState.burgerSelectedPseudo = player.pseudo;
  touch(session);
  return { ok: true };
}

/**
 * Passe au joueur suivant dans la file buzzer (mode rapidité).
 * Appelé par l'hôte après une mauvaise réponse.
 */
export function buzzerNextPlayer(session) {
  ensureSessionRuntime(session);

  const gs = session.gameState;
  // Supprimer le premier de la queue (celui qui vient de rater)
  if (Array.isArray(gs.buzzerQueue) && gs.buzzerQueue.length > 0) {
    gs.buzzerQueue.shift();
  }

  // Si plus personne dans la queue : reset complet (permettre de re-buzzer)
  if (!gs.buzzerQueue || gs.buzzerQueue.length === 0) {
    gs.buzzerState = null;
    gs.buzzerQueue = [];
    setPhaseMeta(session, {
      playerScreenLocked: false,
      allowAnswer: true,
    });
    setStatus(session, "question");
    touch(session);
    return { ok: true, queueEmpty: true };
  }

  // Il reste des joueurs dans la queue : proposer au suivant
  const nextId = gs.buzzerQueue[0];
  const nextPlayer = (session.players || []).find((p) => p.id === nextId);
  gs.buzzerState = {
    firstPlayerId: nextId,
    firstPseudo: nextPlayer?.pseudo || nextId,
    buzzedAt: new Date().toISOString(),
  };

  setPhaseMeta(session, {
    playerScreenLocked: true,
    allowAnswer: false,
  });
  setStatus(session, "manual_scoring");
  touch(session);
  return { ok: true, nextPseudo: nextPlayer?.pseudo || nextId };
}

/* ------------------------------------------------------------------ */
/* Stop timer : arrête le chrono et verrouille les joueurs             */
/* ------------------------------------------------------------------ */

export function stopTimer(session) {
  ensureSessionRuntime(session);
  clearTimer(session);
  clearAutoRevealTimeout(session);
  setPhaseMeta(session, {
    timer: null,
    playerScreenLocked: true,
    allowAnswer: false,
  });
  touch(session);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Helpers optionnels (non importés par socket.js, mais utiles)        */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Retour à la question courante depuis answer_reveal / results        */
/* ------------------------------------------------------------------ */

export function returnToQuestion(session) {
  ensureSessionRuntime(session);

  const q = getCurrentQuestion(session);
  if (!q) return { ok: false, error: "Aucune question active" };

  // On ne remet PAS à zéro les réponses, on revient juste à l'affichage de la question
  clearTimer(session);
  clearAutoRevealTimeout(session);

  setPhaseMeta(session, {
    playerScreenLocked: true,
    allowAnswer: false,
    timer: null,
  });

  setStatus(session, "question");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Type de question VOTE                                               */
/* ------------------------------------------------------------------ */

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Lance la phase de vote :
 * - Réunit les réponses des joueurs + les fausses réponses pré-configurées
 * - Mélange le tout
 * - Passe en mode vote_voting
 */
export function startVotePhase(session) {
  ensureSessionRuntime(session);

  const q = getCurrentQuestion(session);
  if (!q) return { ok: false, error: "Aucune question active" };
  const currentRound = getCurrentRound(session);
  // Accepter si la question OU la manche est de type "vote"
  if ((q.type || "") !== "vote" && (currentRound?.type || "") !== "vote") {
    return { ok: false, error: "Question non de type vote" };
  }

  const answerMap = getQuestionAnswersMap(session, q.id);
  const playerAnswers = Object.values(answerMap)
    .filter((a) => a.answer && a.answer.trim())
    .map((a) => ({ text: a.answer.trim(), isDecoy: false, playerId: a.playerId }));

  const fakeAnswers = Array.isArray(q.fakeAnswers)
    ? q.fakeAnswers.filter((f) => f && f.trim()).map((f) => ({ text: f.trim(), isDecoy: true, playerId: null }))
    : [];

  const allOptions = shuffleArray([...playerAnswers, ...fakeAnswers]);

  // Initialiser ou réinitialiser le voteState
  session.gameState.voteState = {
    questionId: q.id,
    phase: "voting",
    options: allOptions.map((o, idx) => ({ ...o, idx })),
    votes: {}, // playerId → voteIndex
    revealed: false,
  };

  setPhaseMeta(session, {
    playerScreenLocked: false,
    allowAnswer: true,
    answerMode: "vote_voting",
  });

  setStatus(session, "question");
  touch(session);
  return { ok: true };
}

/**
 * Enregistre le vote d'un joueur
 */
export function recordVoteCast(session, { player, voteIndex } = {}) {
  ensureSessionRuntime(session);

  if (!player) return { ok: false, error: "Joueur introuvable" };
  if (!player.connected) return { ok: false, error: "Joueur hors ligne" };

  const vs = session.gameState.voteState;
  if (!vs || vs.phase !== "voting") return { ok: false, error: "Phase de vote non active" };

  const idx = Number(voteIndex);
  if (!Number.isFinite(idx) || idx < 0 || idx >= vs.options.length) {
    return { ok: false, error: "Index de vote invalide" };
  }

  // Un joueur ne peut pas voter pour sa propre réponse
  const option = vs.options[idx];
  if (option.playerId === player.id) {
    return { ok: false, error: "Vous ne pouvez pas voter pour votre propre réponse" };
  }

  // Overwrite autorisé (peut changer d'avis)
  vs.votes[player.id] = idx;

  touch(session);
  return { ok: true };
}

/**
 * Révèle les résultats du vote et attribue les points
 */
export function revealVoteResults(session) {
  ensureSessionRuntime(session);

  const q = getCurrentQuestion(session);
  if (!q) return { ok: false, error: "Aucune question active" };

  const vs = session.gameState.voteState;
  if (!vs) return { ok: false, error: "Aucun état de vote" };

  // Compter les votes par option
  const voteCounts = new Array(vs.options.length).fill(0);
  for (const voteIdx of Object.values(vs.votes)) {
    if (Number.isFinite(voteIdx) && voteIdx >= 0 && voteIdx < voteCounts.length) {
      voteCounts[voteIdx]++;
    }
  }

  // Attribuer les points :
  // - Chaque joueur dont la réponse a reçu des votes gagne autant de points qu'il a reçu de votes
  // - Chaque joueur qui a voté pour un leurre (isDecoy) perd 1 point
  for (const [playerId, voteIdx] of Object.entries(vs.votes)) {
    const chosenOption = vs.options[voteIdx];
    if (chosenOption?.isDecoy) {
      // Voter pour un leurre : -1 point
      awardPointsToPlayer(session, playerId, -1);
    }
    // Points pour avoir reçu des votes : attribués ci-dessous
  }

  // Attribuer les points aux auteurs des réponses
  for (let idx = 0; idx < vs.options.length; idx++) {
    const option = vs.options[idx];
    if (!option.isDecoy && option.playerId && voteCounts[idx] > 0) {
      awardPointsToPlayer(session, option.playerId, voteCounts[idx]);
    }
  }

  // Marquer les options avec les données de vote (pour l'affichage)
  vs.options = vs.options.map((o, idx) => ({
    ...o,
    voteCount: voteCounts[idx],
  }));
  vs.phase = "revealed";
  vs.revealed = true;

  setPhaseMeta(session, {
    playerScreenLocked: true,
    allowAnswer: false,
    timer: null,
    answerMode: "vote_revealed",
  });

  setStatus(session, "answer_reveal");
  touch(session);
  return { ok: true };
}

export function resetEngineRuntime(session) {
  clearTimer(session);
  clearAutoRevealTimeout(session);
  if (session?._runtime) {
    session._runtime.timerQuestionId = null;
    session._runtime.timerStartedAt = null;
  }
  return { ok: true };
}

/**
 * Rapidité : après une mauvaise réponse, rouvre les buzzers pour tous
 * et applique un cooldown de 5s au joueur fautif.
 */
export function resetBuzzerRapidite(session, wrongPlayerId, cooldownMs = 5000) {
  ensureSessionRuntime(session);
  const gs = session.gameState;

  // Enregistrer le résultat
  gs.buzzerLastResult = {
    result: "wrong",
    playerId: wrongPlayerId || null,
    pseudo: gs.buzzerState?.firstPseudo || null,
    at: new Date().toISOString(),
  };

  // Mettre le joueur fautif en cooldown
  if (wrongPlayerId) {
    if (!gs.buzzerCooldowns) gs.buzzerCooldowns = {};
    gs.buzzerCooldowns[wrongPlayerId] = Date.now() + cooldownMs;
  }

  // Réinitialiser le buzzer → tout le monde peut re-buzzer
  gs.buzzerState = null;
  // Retirer le joueur fautif de la queue mais garder les autres
  if (Array.isArray(gs.buzzerQueue)) {
    gs.buzzerQueue = gs.buzzerQueue.filter((id) => id !== wrongPlayerId);
  }

  // Rouvrir les buzzers
  setPhaseMeta(session, { playerScreenLocked: false, allowAnswer: true });
  setStatus(session, "question");
  touch(session);
  return { ok: true, cooldownMs };
}

/**
 * Burger : sélectionne une équipe comme participante (toute l'équipe reçoit les points).
 */
export function setBurgerTeam(session, teamId) {
  ensureSessionRuntime(session);

  if (!teamId) {
    session.gameState.burgerSelectedPlayerId = null;
    session.gameState.burgerSelectedTeamId = null;
    session.gameState.burgerSelectedPseudo = null;
    touch(session);
    return { ok: true };
  }

  const team = (session.teams || []).find((t) => t.id === teamId);
  if (!team) return { ok: false, error: "Équipe introuvable" };

  session.gameState.burgerSelectedPlayerId = null;
  session.gameState.burgerSelectedTeamId = teamId;
  session.gameState.burgerSelectedPseudo = team.name;
  touch(session);
  return { ok: true };
}

/**
 * Burger : l'admin "passe" le dernier élément affiché — efface le TV et montre "[pseudo] répond".
 */
export function burgerPass(session) {
  ensureSessionRuntime(session);
  const hasPlayer = !!session.gameState.burgerSelectedPlayerId;
  const hasTeam = !!session.gameState.burgerSelectedTeamId;
  if (!hasPlayer && !hasTeam) {
    return { ok: false, error: "Aucun joueur/équipe sélectionné pour l'épreuve burger" };
  }
  setPhaseMeta(session, { playerScreenLocked: true, allowAnswer: false });
  setStatus(session, "manual_scoring");
  touch(session);
  return { ok: true };
}

/**
 * Burger : l'admin saisit le score final du joueur/équipe (0-10).
 */
export function setBurgerScore(session, score) {
  ensureSessionRuntime(session);
  const n = Number(score);
  if (!Number.isFinite(n) || n < 0 || n > 10) {
    return { ok: false, error: "Le score doit être entre 0 et 10" };
  }

  const selectedId = session.gameState.burgerSelectedPlayerId;
  const selectedTeamId = session.gameState.burgerSelectedTeamId;
  const selectedPseudo = session.gameState.burgerSelectedPseudo || selectedId || selectedTeamId;

  if (!selectedId && !selectedTeamId) {
    return { ok: false, error: "Aucun joueur/équipe sélectionné pour l'épreuve burger" };
  }

  if (selectedTeamId) {
    // Attribuer les points à chaque membre de l'équipe
    for (const p of (session.players || [])) {
      if (p.teamId === selectedTeamId) {
        awardPointsToPlayer(session, p.id, n);
      }
    }
    // Mettre à jour le score de l'équipe aussi
    const team = (session.teams || []).find((t) => t.id === selectedTeamId);
    if (team) {
      team.scoreTotal = (team.scoreTotal || 0) + n;
    }
  } else {
    awardPointsToPlayer(session, selectedId, n);
  }

  session.gameState.burgerFinalScore = {
    playerId: selectedId || null,
    teamId: selectedTeamId || null,
    pseudo: selectedPseudo,
    score: n,
  };

  // Rester en manual_scoring pour afficher le résultat sur la TV (le score s'affiche dans cette phase)
  if (session.gameState.status !== "manual_scoring") {
    setStatus(session, "manual_scoring");
  }
  touch(session);
  return { ok: true, score: n, pseudo: selectedPseudo };
}

export function getEngineDebugState(session) {
  const rt = ensureSessionRuntime(session);
  return {
    ok: true,
    runtime: {
      hasTimerInterval: !!rt.timerInterval,
      hasAutoRevealTimeout: !!rt.autoRevealTimeout,
      timerQuestionId: rt.timerQuestionId || null,
      timerStartedAt: rt.timerStartedAt || null,
    },
    game: {
      status: session?.gameState?.status,
      currentRoundIndex: session?.gameState?.currentRoundIndex,
      currentQuestionIndex: session?.gameState?.currentQuestionIndex,
      timer: session?.gameState?.phaseMeta?.timer || null,
      locked: !!session?.gameState?.phaseMeta?.playerScreenLocked,
      allowAnswer: !!session?.gameState?.phaseMeta?.allowAnswer,
      answerMode: session?.gameState?.phaseMeta?.answerMode || "none",
    },
  };
}
