// server/src/gameState.js

function nowIso() {
  return new Date().toISOString();
}

function safeString(value, fallback = "") {
  const v = String(value ?? "").trim();
  return v || fallback;
}

function deepClone(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

/**
 * Crée l'état initial d'une session de jeu.
 * @param {Object} params
 * @param {Object|null} params.quiz
 * @param {string} params.sessionCode
 */
export function createInitialGameState({ quiz = null, sessionCode } = {}) {
  const safeQuiz = quiz && typeof quiz === "object" ? deepClone(quiz) : null;
  const safeSessionCode = safeString(sessionCode, "0000").toUpperCase();

  return {
    sessionCode: safeSessionCode,
    quizId: safeQuiz?.id || null,
    quizTitle: safeQuiz?.title || "Quiz Live",

    // lobby | intro_quiz | round_intro | question | waiting | answer_reveal | manual_scoring | results | end
    status: "lobby",

    phaseMeta: {
      playerScreenLocked: false,
      allowAnswer: false,
      answerMode: "none", // mcq | text | true_false | buzzer | none
      timer: null, // ex: { totalSec, remainingSec, startedAt }
    },

    currentRoundIndex: -1,
    currentQuestionIndex: -1,
    currentRound: null,
    currentQuestion: null,

    // { [questionId]: { [playerId]: { answer, answerType, answeredAt } } }
    answers: {},

    // arrays de pseudos pour affichage display
    trueFalseVotes: { yes: [], no: [] },

    // { firstPlayerId, firstPseudo, buzzedAt }
    buzzerState: null,

    // Liste des playerId ayant déjà buzzé sur la question courante (mode rapidité)
    buzzerQueue: [],

    // État burger : { questionId, currentItemIndex }
    burgerState: null,

    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

/**
 * Reset des états transitoires liés à une question (votes, buzzer, timer, etc.)
 * À appeler au changement de question.
 */
export function resetQuestionTransientState(gameState) {
  if (!gameState || typeof gameState !== "object") return gameState;

  if (!gameState.phaseMeta || typeof gameState.phaseMeta !== "object") {
    gameState.phaseMeta = {
      playerScreenLocked: false,
      allowAnswer: false,
      answerMode: "none",
      timer: null,
    };
  }

  gameState.trueFalseVotes = { yes: [], no: [] };
  gameState.buzzerState = null;
  gameState.buzzerQueue = [];
  gameState.burgerState = null;

  // important pour éviter qu'un timer précédent reste accroché
  gameState.phaseMeta.timer = null;

  // selon ton flux, on remet l'autorisation de réponse à false par défaut
  // (le host/engine l'active ensuite explicitement au bon moment)
  gameState.phaseMeta.allowAnswer = false;

  return touchGameState(gameState);
}

/**
 * Met à jour updatedAt de manière centralisée.
 */
export function touchGameState(gameState) {
  if (!gameState || typeof gameState !== "object") return gameState;
  gameState.updatedAt = nowIso();
  return gameState;
}

/**
 * Helper optionnel : reset complet de la phase de réponse pour une question donnée.
 * Utile si tu veux éviter les réponses résiduelles lors d'un relancement.
 */
export function clearAnswersForQuestion(gameState, questionId) {
  if (!gameState || typeof gameState !== "object") return gameState;
  if (!gameState.answers || typeof gameState.answers !== "object") {
    gameState.answers = Object.create(null);
  }

  const qid = String(questionId ?? "").trim();
  if (qid) {
    delete gameState.answers[qid];
    touchGameState(gameState);
  }

  return gameState;
}

/**
 * Helper optionnel : initialise le conteneur de réponses d'une question.
 */
export function ensureQuestionAnswersBucket(gameState, questionId) {
  if (!gameState || typeof gameState !== "object") return null;

  if (!gameState.answers || typeof gameState.answers !== "object") {
    gameState.answers = Object.create(null);
  }

  const qid = String(questionId ?? "").trim();
  if (!qid) return null;

  if (!gameState.answers[qid] || typeof gameState.answers[qid] !== "object") {
    gameState.answers[qid] = Object.create(null);
  }

  return gameState.answers[qid];
}
