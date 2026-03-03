// server/src/index.js
import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { config } from "./config.js";

import { setupSocketHandlers as registerSocketHandlers } from "./socket.js";
import {
  createSession,
  createSessionFromQuiz,
  getQuiz,
  getSession,
  listQuizzes,
  loadAllPersistedData,
  saveQuiz,
  deleteQuiz,
} from "./store.js";

import {
  upload,
  buildPublicMediaPath,
  buildPublicMediaUrl,
  getUploadsDir,
} from "./upload.js";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function normalizeSessionCode(code) {
  return String(code ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function safeString(v, fallback = "") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/* -------------------------------------------------------------------------- */
/* Boot                                                                        */
/* -------------------------------------------------------------------------- */

const app = express();

// IMPORTANT derrière Nginx / CloudPanel (x-forwarded-proto / host)
app.set("trust proxy", true);

const server = http.createServer(app);

// CORS : supporte plusieurs origines via ALLOWED_ORIGINS="https://a.fr,https://b.fr"
// Si vide, repli sur CLIENT_ORIGIN (comportement d'origine)
const allowedOrigins = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOrigin = (origin, cb) => {
  // curl / server-to-server (pas d'Origin header)
  if (!origin) return cb(null, true);
  if (allowedOrigins.length > 0) {
    return cb(null, allowedOrigins.includes(origin));
  }
  // fallback : une seule origine autorisée
  return cb(null, origin === config.clientOrigin);
};

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    credentials: true,
  },
});

let isShuttingDown = false;

// Middlewares
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);

app.use(express.json({ limit: "20mb" }));

// Fichiers uploadés + headers de sécurité
app.use(
  "/uploads",
  express.static(getUploadsDir(), {
    setHeaders(res) {
      res.setHeader("X-Content-Type-Options", "nosniff");
      // sandbox minimal pour réduire risques sur contenus servis
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    },
  }),
);

// Serve the frontend app
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, "..", "public");

app.use(express.static(publicDir));

// Healthcheck
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "quiz-live-server" });
});

app.post("/api/uploads/media", (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        ok: false,
        error: err.message || "Erreur upload",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: "Aucun fichier reçu (champ attendu: file)",
      });
    }

    const filename = req.file.filename;

    // ✅ mediaUrl RELATIF (recommandé pour stocker dans tes quiz)
    const mediaUrl = buildPublicMediaPath(filename);
    // ✅ url ABSOLU (pratique pour prévisualiser)
    const url = buildPublicMediaUrl(req, filename);

    return res.json({
      ok: true,
      file: {
        originalName: req.file.originalname,
        filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        mediaUrl, // "/uploads/xxx"
        url, // "https://.../uploads/xxx"
      },
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Quizzes                                                                     */
/* -------------------------------------------------------------------------- */

app.get("/api/quizzes", (_req, res) => {
  try {
    res.json({ ok: true, quizzes: listQuizzes() });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "Erreur serveur" });
  }
});

app.get("/api/quizzes/:quizId", (req, res) => {
  try {
    const quiz = getQuiz(req.params.quizId);
    if (!quiz) {
      return res.status(404).json({ ok: false, error: "Quiz introuvable" });
    }
    res.json({ ok: true, quiz });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "Erreur serveur" });
  }
});

app.post("/api/quizzes", (req, res) => {
  try {
    const body = isObject(req.body) ? req.body : {};
    const quiz = body.quiz || body;
    if (!quiz || !safeString(quiz.title)) {
      return res.status(400).json({ ok: false, error: "title requis" });
    }
    const saved = saveQuiz(quiz);
    res.json({ ok: true, quiz: saved });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "Erreur serveur" });
  }
});

app.put("/api/quizzes/:quizId", (req, res) => {
  try {
    const body = isObject(req.body) ? req.body : {};
    const quiz = { ...(body.quiz || body), id: req.params.quizId };
    if (!safeString(quiz.title)) {
      return res.status(400).json({ ok: false, error: "title requis" });
    }
    const saved = saveQuiz(quiz);
    res.json({ ok: true, quiz: saved });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "Erreur serveur" });
  }
});

app.delete("/api/quizzes/:quizId", (req, res) => {
  try {
    deleteQuiz(req.params.quizId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "Erreur serveur" });
  }
});

/* -------------------------------------------------------------------------- */
/* Sessions                                                                    */
/* -------------------------------------------------------------------------- */

app.post("/api/sessions", (req, res) => {
  try {
    const body = isObject(req.body) ? req.body : {};
    const sessionCode = normalizeSessionCode(body.sessionCode);
    const hostKey = safeString(body.hostKey);
    const quiz = body.quiz;

    if (!sessionCode) {
      return res.status(400).json({ ok: false, error: "sessionCode requis" });
    }

    const existing = getSession(sessionCode);
    if (existing) {
      return res.json({
        ok: true,
        existing: true,
        session: {
          sessionCode: existing.sessionCode,
          hostKey: existing.hostKey,
        },
      });
    }

    const session = createSession({ sessionCode, hostKey, quiz });

    return res.json({
      ok: true,
      session: {
        sessionCode: session.sessionCode,
        hostKey: session.hostKey,
      },
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message || "Création de session impossible",
    });
  }
});

app.post("/api/sessions/from-quiz", (req, res) => {
  try {
    const body = isObject(req.body) ? req.body : {};
    const quizId = safeString(body.quizId);
    const sessionCode = normalizeSessionCode(body.sessionCode);
    const hostKey = safeString(body.hostKey);

    if (!quizId) {
      return res.status(400).json({ ok: false, error: "quizId requis" });
    }

    const created = createSessionFromQuiz({ quizId, sessionCode, hostKey });

    if (!created?.ok) {
      return res.status(400).json(created || { ok: false, error: "Erreur" });
    }

    return res.json({
      ok: true,
      session: {
        sessionCode: created.session.sessionCode,
        hostKey: created.session.hostKey,
        quizId: created.session.quiz?.id || null,
        quizTitle: created.session.quiz?.title || null,
      },
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message || "Création de session depuis quiz impossible",
    });
  }
});

app.get("/api/sessions/:sessionCode", (req, res) => {
  try {
    const sessionCode = normalizeSessionCode(req.params.sessionCode);
    const session = getSession(sessionCode);

    if (!session) {
      return res.status(404).json({ ok: false, error: "Session introuvable" });
    }

    return res.json({
      ok: true,
      session: {
        sessionCode: session.sessionCode,
        hostKey: session.hostKey,
        quizTitle: session.quiz?.title || null,
        playersCount: Array.isArray(session.players)
          ? session.players.length
          : 0,
        teamsCount: Array.isArray(session.teams) ? session.teams.length : 0,
        status: session.gameState?.status || "lobby",
      },
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message || "Lecture session impossible",
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Socket.IO                                                                   */
/* -------------------------------------------------------------------------- */

registerSocketHandlers(io);

/* -------------------------------------------------------------------------- */
/* SPA Fallback — doit être EN DERNIER, après toutes les routes /api/*        */
/* -------------------------------------------------------------------------- */

// Toutes les routes non-API renvoient l'index.html (client-side routing)
app.get("/*", (req, res, next) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) {
    return next();
  }
  res.sendFile(join(publicDir, "index.html"));
});

/* -------------------------------------------------------------------------- */
/* Restore store                                                               */
/* -------------------------------------------------------------------------- */

let restoredStore = { quizzesCount: 0, sessionsCount: 0 };
try {
  restoredStore = loadAllPersistedData();
} catch (e) {
  console.error("[store] restore failed:", e.message);
}

/* -------------------------------------------------------------------------- */
/* Graceful shutdown                                                           */
/* -------------------------------------------------------------------------- */

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[server] shutdown requested (${signal})`);

  try {
    await new Promise((resolve) => {
      try {
        io.close(() => resolve());
      } catch {
        resolve();
      }
    });

    await new Promise((resolve) => {
      try {
        server.close(() => resolve());
      } catch {
        resolve();
      }
    });

    console.log("[server] shutdown complete");
    process.exit(0);
  } catch (e) {
    console.error("[server] shutdown error:", e.message);
    process.exit(1);
  }
}

process.on("SIGINT", () => void gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));

process.on("uncaughtException", (err) => {
  console.error("[fatal] uncaughtException:", err);
  void gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  console.error("[fatal] unhandledRejection:", reason);
  void gracefulShutdown("unhandledRejection");
});

/* -------------------------------------------------------------------------- */
/* Start                                                                       */
/* -------------------------------------------------------------------------- */

const PORT = Number(process.env.PORT || 4000);

// ⚠️ Sur VPS tu écoutes en 127.0.0.1 et Nginx reverse-proxy dessus (OK)
server.listen(PORT, "127.0.0.1", () => {
  console.log(
    `Quiz Live server running on https://quizzwegeek.havelsoftware.fr`,
  );
  console.log(
    `Persisted data loaded: ${restoredStore.quizzesCount} quizzes, ${restoredStore.sessionsCount} sessions`,
  );
  console.log(`Uploads dir: ${getUploadsDir()}`);
  console.log(`Demo session: 1234 | hostKey: demo-host`);
});
