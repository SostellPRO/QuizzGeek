// server/src/persistence.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, "..", "data");
const quizzesFile = path.join(dataDir, "quizzes.json");
const sessionsFile = path.join(dataDir, "sessions.json");

function ensureDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;

    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw || !raw.trim()) return fallback;

    const parsed = JSON.parse(raw);
    return parsed;
  } catch (e) {
    console.error(`[persistence] read error ${filePath}:`, e.message);
    return fallback;
  }
}

/**
 * Écriture atomique:
 * - écrit dans un fichier temporaire
 * - rename vers la cible
 * => réduit le risque de JSON tronqué si arrêt brutal
 */
function writeJsonSafe(filePath, value) {
  try {
    ensureDir();

    const tmpPath = `${filePath}.tmp`;
    const payload = JSON.stringify(value, null, 2);

    fs.writeFileSync(tmpPath, payload, "utf8");
    fs.renameSync(tmpPath, filePath);

    return { ok: true };
  } catch (e) {
    console.error(`[persistence] write error ${filePath}:`, e.message);
    return { ok: false, error: e.message };
  }
}

/* -------------------------------------------------------------------------- */
/* Quizzes                                                                     */
/* -------------------------------------------------------------------------- */

export function loadPersistedQuizzes() {
  ensureDir();

  const data = readJsonSafe(quizzesFile, { quizzes: [] });
  if (!isPlainObject(data)) return [];

  const quizzes = Array.isArray(data.quizzes) ? data.quizzes : [];
  return quizzes;
}

export function savePersistedQuizzes(quizzesArray) {
  const quizzes = Array.isArray(quizzesArray) ? quizzesArray : [];

  return writeJsonSafe(quizzesFile, {
    version: 1,
    savedAt: new Date().toISOString(),
    quizzes,
  });
}

/* -------------------------------------------------------------------------- */
/* Sessions                                                                    */
/* -------------------------------------------------------------------------- */

export function loadPersistedSessions() {
  ensureDir();

  const data = readJsonSafe(sessionsFile, { sessions: [] });
  if (!isPlainObject(data)) return [];

  const sessions = Array.isArray(data.sessions) ? data.sessions : [];
  return sessions;
}

export function savePersistedSessions(sessionsArray) {
  const sessions = Array.isArray(sessionsArray) ? sessionsArray : [];

  return writeJsonSafe(sessionsFile, {
    version: 1,
    savedAt: new Date().toISOString(),
    sessions,
  });
}

/* -------------------------------------------------------------------------- */
/* (Optionnel) utilitaires debug                                               */
/* -------------------------------------------------------------------------- */

export function getPersistencePaths() {
  return {
    dataDir,
    quizzesFile,
    sessionsFile,
  };
}
