// server/src/store.js
import { createInitialGameState } from "./gameState.js";
import { randomCode, randomId } from "./utils.js";
import {
  loadPersistedQuizzes,
  loadPersistedSessions,
  savePersistedQuizzes,
  savePersistedSessions,
} from "./persistence.js";

const store = {
  sessions: new Map(), // sessionCode -> session object
  quizzes: new Map(), // quizId -> quiz object
};

function sanitizeSessionForPersistence(session) {
  return {
    sessionCode: session.sessionCode,
    hostKey: session.hostKey,
    quiz: session.quiz || null,
    gameState: session.gameState || null,
    players: (session.players || []).map((p) => ({
      id: p.id,
      pseudo: p.pseudo,
      teamId: p.teamId || null,
      teamName: p.teamName || null,
      reconnectToken: p.reconnectToken,
      connected: false, // on force hors ligne après redémarrage serveur
      socketId: null, // non persisté
      scoreTotal: p.scoreTotal || 0,
    })),
    teams: (session.teams || []).map((t) => ({
      id: t.id,
      name: t.name,
      scoreTotal: t.scoreTotal || 0,
    })),
  };
}

function hydrateSession(raw) {
  const sessionCode = String(raw?.sessionCode || "").toUpperCase();
  if (!sessionCode) return null;

  const quiz = raw.quiz || {
    id: `quiz_demo_${sessionCode}`,
    title: "Quiz Live",
    teamsConfig: {
      enabled: true,
      teamCount: 2,
      teamNames: ["Équipe 1", "Équipe 2"],
    },
    rounds: [],
  };

  const defaultTeams =
    quiz?.teamsConfig?.enabled !== false
      ? (quiz.teamsConfig?.teamNames || []).map((name, idx) => ({
          id: `team_${idx + 1}`,
          name: name || `Équipe ${idx + 1}`,
          scoreTotal: 0,
        }))
      : [];

  const session = {
    sessionCode,
    hostKey: raw.hostKey || "demo-host",
    quiz,
    gameState:
      raw.gameState ||
      createInitialGameState({
        quiz,
        sessionCode,
      }),
    players: Array.isArray(raw.players)
      ? raw.players.map((p) => ({
          id: p.id || randomId("player"),
          pseudo: p.pseudo || "Joueur",
          teamId: p.teamId || null,
          teamName: p.teamName || null,
          reconnectToken: p.reconnectToken || randomId("reco"),
          connected: false,
          socketId: null,
          scoreTotal: p.scoreTotal || 0,
        }))
      : [],
    teams: Array.isArray(raw.teams) ? raw.teams : defaultTeams,
    sockets: {
      host: new Set(),
      displays: new Set(),
    },
  };

  // sécurité : timer inactif au reboot (interval non restaurable)
  if (session.gameState?.phaseMeta) {
    session.gameState.phaseMeta.timer = null;
    session.gameState.phaseMeta.playerScreenLocked = true;
    session.gameState.phaseMeta.allowAnswer = false;
  }

  return session;
}

export function persistQuizzes() {
  const quizzes = [...store.quizzes.values()];
  return savePersistedQuizzes(quizzes);
}

export function persistSessions() {
  const sessions = [...store.sessions.values()].map(
    sanitizeSessionForPersistence,
  );
  return savePersistedSessions(sessions);
}

export function persistAll() {
  const q = persistQuizzes();
  const s = persistSessions();
  return { ok: q.ok && s.ok, quizzes: q, sessions: s };
}

/**
 * Migration : répare les questions burger dont le champ "items" a été supprimé par
 * l'ancienne version de normalizeQuiz. Si items est absent/vide, on recrée 10 slots vides.
 */
function migrateBurgerItems(quiz) {
  if (!quiz?.rounds) return quiz;
  const rounds = quiz.rounds.map((round) => {
    if (round.type !== 'burger') return round;
    const questions = (round.questions || []).map((q) => {
      if (q.type !== 'burger') return q;
      if (Array.isArray(q.items) && q.items.length > 0) return q;
      // Recréer 10 items vides (le contenu doit être ressaisi par l'admin)
      return {
        ...q,
        items: Array.from({ length: 10 }, (_, i) => ({
          id: `item_migrated_${i}`,
          text: `Élément ${i + 1}`,
          mediaUrl: '',
        })),
      };
    });
    return { ...round, questions };
  });
  return { ...quiz, rounds };
}

export function loadAllPersistedData() {
  // quizzes
  const quizzes = loadPersistedQuizzes();
  store.quizzes.clear();
  for (const q of quizzes) {
    if (q?.id) {
      // Migration des items burger supprimés par l'ancienne version
      store.quizzes.set(q.id, migrateBurgerItems(q));
    }
  }

  // sessions
  const sessions = loadPersistedSessions();
  store.sessions.clear();
  for (const raw of sessions) {
    const s = hydrateSession(raw);
    if (s?.sessionCode) store.sessions.set(s.sessionCode, s);
  }

  return {
    quizzesCount: store.quizzes.size,
    sessionsCount: store.sessions.size,
  };
}

/**
 * Session model (MVP):
 * {
 *   sessionCode,
 *   hostKey,
 *   quiz,
 *   gameState,
 *   players: [{ id, pseudo, teamId, teamName, reconnectToken, connected, socketId, scoreTotal }],
 *   teams: [{ id, name, scoreTotal }],
 *   sockets: { host: Set<socketId>, displays: Set<socketId> }
 * }
 */
export function createSession({
  sessionCode = randomCode(4),
  hostKey = "demo-host",
  quiz = null,
} = {}) {
  let normalizedCode = String(sessionCode).toUpperCase();

  // éviter collision
  while (store.sessions.has(normalizedCode)) {
    normalizedCode = randomCode(4);
  }

  const safeQuiz = quiz || {
    id: `quiz_demo_${normalizedCode}`,
    title: "Quiz Demo",
    teamsConfig: {
      enabled: true,
      teamCount: 2,
      teamNames: ["Équipe 1", "Équipe 2"],
    },
    rounds: [],
  };

  // Always create 20 generic teams (players choose among them)
  const teams = Array.from({ length: 20 }, (_, idx) => ({
    id: `team_${idx + 1}`,
    name: `Équipe ${idx + 1}`,
    scoreTotal: 0,
  }));

  const session = {
    sessionCode: normalizedCode,
    hostKey,
    quiz: safeQuiz,
    gameState: createInitialGameState({
      quiz: safeQuiz,
      sessionCode: normalizedCode,
    }),
    players: [],
    teams,
    sockets: {
      host: new Set(),
      displays: new Set(),
    },
  };

  store.sessions.set(normalizedCode, session);
  persistSessions();
  return session;
}

export function createSessionFromQuiz({
  quizId,
  sessionCode = randomCode(4),
  hostKey = "demo-host",
} = {}) {
  const quiz = getQuiz(quizId);
  if (!quiz) return { ok: false, error: "Quiz introuvable" };

  const session = createSession({ sessionCode, hostKey, quiz });
  return { ok: true, session };
}

export function getSession(sessionCode) {
  if (!sessionCode) return null;
  return store.sessions.get(String(sessionCode).toUpperCase()) || null;
}

export function getOrCreateDemoSession(sessionCode = "1234") {
  let session = getSession(sessionCode);
  if (!session) {
    session = createSession({
      sessionCode,
      hostKey: "demo-host",
      quiz: {
        id: "quiz_demo",
        title: "Quiz Live Démo",
        teamsConfig: {
          enabled: true,
          teamCount: 2,
          teamNames: ["Rouges", "Bleus"],
        },
        rounds: [],
      },
    });
  }
  return session;
}

/**
 * Normalise un quiz avant sauvegarde:
 * - items → questions (compat ancienne structure)
 * - questionType → type (compat ancienne structure)
 */
function normalizeQuiz(quiz) {
  if (!quiz || typeof quiz !== "object") return quiz;

  const rounds = (Array.isArray(quiz.rounds) ? quiz.rounds : []).map(
    (round) => {
      // Normalise items → questions
      const rawQuestions = Array.isArray(round.questions)
        ? round.questions
        : Array.isArray(round.items)
          ? round.items
          : [];

      const questions = rawQuestions.map((q) => {
        // On normalise uniquement questionType → type
        // IMPORTANT : on NE supprime PAS "items" car c'est le champ des éléments burger
        const { questionType, ...rest } = q;
        return {
          ...rest,
          // Normalise questionType → type
          type: rest.type || questionType || "text",
        };
      });

      const { items: _ri, ...roundRest } = round;
      return { ...roundRest, questions };
    },
  );

  return { ...quiz, rounds };
}

export function saveQuiz(quiz) {
  let next = normalizeQuiz(quiz);
  if (!next?.id) {
    next = { ...next, id: `quiz_${randomId("q")}` };
  }

  store.quizzes.set(next.id, next);
  persistQuizzes();
  return next;
}

export function deleteQuiz(quizId) {
  store.quizzes.delete(quizId);
  persistQuizzes();
}

export function listQuizzes() {
  return [...store.quizzes.values()];
}

export function getQuiz(quizId) {
  return store.quizzes.get(quizId) || null;
}

export function attachHostSocket(session, socketId) {
  session.sockets.host.add(socketId);
}

export function attachDisplaySocket(session, socketId) {
  session.sockets.displays.add(socketId);
}

export function removeSocketFromSessions(socketId) {
  let changed = false;

  for (const session of store.sessions.values()) {
    const beforeHost = session.sockets.host.size;
    const beforeDisp = session.sockets.displays.size;

    session.sockets.host.delete(socketId);
    session.sockets.displays.delete(socketId);

    if (
      session.sockets.host.size !== beforeHost ||
      session.sockets.displays.size !== beforeDisp
    ) {
      changed = true;
    }

    for (const player of session.players) {
      if (player.socketId === socketId) {
        player.connected = false;
        player.socketId = null;
        changed = true;
      }
    }
  }

  if (changed) persistSessions();
}

export function addOrReconnectPlayer({
  session,
  pseudo,
  teamId = null,
  reconnectToken = null,
  socketId,
  avatar = null,
}) {
  // Reconnexion par token
  if (reconnectToken) {
    const existing = session.players.find(
      (p) => p.reconnectToken === reconnectToken,
    );
    if (existing) {
      existing.connected = true;
      existing.socketId = socketId;
      if (avatar) existing.avatar = avatar;
      if (teamId) {
        existing.teamId = teamId;
        existing.teamName =
          session.teams.find((t) => t.id === teamId)?.name ||
          existing.teamName ||
          null;
      }
      persistSessions();
      return { player: existing, isReconnect: true };
    }
  }

  const trimmedPseudo = String(pseudo || "").trim();
  if (!trimmedPseudo) return { error: "Pseudo requis" };

  // Reconnexion par pseudo : si un joueur avec ce pseudo est déconnecté,
  // permettre la reprise de la partie sans bloquer (ex : éjection / perte de connexion)
  const existingByPseudo = session.players.find(
    (p) => p.pseudo.toLowerCase() === trimmedPseudo.toLowerCase(),
  );
  if (existingByPseudo) {
    if (!existingByPseudo.connected) {
      // Le joueur est déconnecté → on le reconnecte avec un nouveau token
      existingByPseudo.connected = true;
      existingByPseudo.socketId = socketId;
      existingByPseudo.reconnectToken = randomId("reco"); // nouveau token pour cette session
      if (avatar) existingByPseudo.avatar = avatar;
      if (teamId) {
        existingByPseudo.teamId = teamId;
        existingByPseudo.teamName =
          session.teams.find((t) => t.id === teamId)?.name ||
          existingByPseudo.teamName ||
          null;
      }
      persistSessions();
      return { player: existingByPseudo, isReconnect: true };
    }
    // Joueur connecté avec ce pseudo → conflit
    return { error: "Ce pseudo est déjà utilisé" };
  }

  let assignedTeam = null;
  if (teamId) {
    assignedTeam = session.teams.find((t) => t.id === teamId) || null;
    if (!assignedTeam) return { error: "Équipe introuvable" };
  }

  const player = {
    id: randomId("player"),
    pseudo: trimmedPseudo,
    avatar: avatar || null,
    teamId: assignedTeam?.id || null,
    teamName: assignedTeam?.name || null,
    reconnectToken: randomId("reco"),
    connected: true,
    socketId,
    scoreTotal: 0,
  };

  session.players.push(player);
  persistSessions();
  return { player, isReconnect: false };
}

export function getPublicTeams(session) {
  return session.teams.map((t) => ({
    id: t.id,
    name: t.name,
    scoreTotal: t.scoreTotal || 0,
    locked: false,
    slotsRemaining: undefined,
  }));
}

export function getPublicPlayers(session) {
  return session.players.map((p) => ({
    id: p.id,
    playerId: p.id,
    pseudo: p.pseudo,
    avatar: p.avatar || null,
    teamId: p.teamId,
    teamName: p.teamName,
    connected: !!p.connected,
    scoreTotal: p.scoreTotal || 0,
  }));
}

export function buildLeaderboards(session) {
  const leaderboardPlayers = [...session.players]
    .sort((a, b) => (b.scoreTotal || 0) - (a.scoreTotal || 0))
    .map((p, idx) => ({
      rank: idx + 1,
      playerId: p.id,
      pseudo: p.pseudo,
      avatar: p.avatar || null,
      teamId: p.teamId,
      teamName: p.teamName,
      scoreTotal: p.scoreTotal || 0,
      connected: !!p.connected,
    }));

  // Uniquement les équipes qui ont au moins un joueur
  const teamIdsWithPlayers = new Set(
    session.players.map((p) => p.teamId).filter(Boolean),
  );
  const teamsWithPlayers = session.teams.filter((t) =>
    teamIdsWithPlayers.has(t.id),
  );

  const leaderboardTeams = [...teamsWithPlayers]
    .sort((a, b) => (b.scoreTotal || 0) - (a.scoreTotal || 0))
    .map((t, idx) => ({
      rank: idx + 1,
      teamId: t.id,
      name: t.name,
      scoreTotal: t.scoreTotal || 0,
    }));

  return { leaderboardPlayers, leaderboardTeams };
}

export { store };
