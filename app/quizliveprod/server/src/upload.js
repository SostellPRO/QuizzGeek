// server/src/upload.js
import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";
import { config } from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Répertoire uploads (absolu)
const uploadDirAbs = path.isAbsolute(config.uploadDir)
  ? config.uploadDir
  : path.join(__dirname, "..", config.uploadDir);

fs.mkdirSync(uploadDirAbs, { recursive: true });

function sanitizeFilename(name = "file") {
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Liste blanche stricte
 * SVG exclu (risque XSS si servi tel quel)
 */
const MIME_TO_EXT = {
  // images
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",

  // audio
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/ogg": ".ogg",
  "audio/webm": ".webm",

  // video
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "video/ogg": ".ogv",
};

const ALLOWED_MIME_TYPES = new Set(Object.keys(MIME_TO_EXT));

function buildStoredFilename(file) {
  const originalname = String(file?.originalname || "file");
  const mimetype = String(file?.mimetype || "").toLowerCase();

  const extClient = path.extname(originalname);
  const base = path.basename(originalname, extClient);

  const safeBase = sanitizeFilename(base).slice(0, 80) || "file";
  const ext = MIME_TO_EXT[mimetype] || "";
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);

  // 1700000000000_ab12cd34_filename.ext
  return `${ts}_${rand}_${safeBase}${ext}`;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDirAbs),
  filename: (_req, file, cb) => {
    try {
      cb(null, buildStoredFilename(file));
    } catch (e) {
      cb(e);
    }
  },
});

function fileFilter(_req, file, cb) {
  try {
    const mime = String(file?.mimetype || "").toLowerCase();
    if (!mime) return cb(new Error("Type MIME manquant"));

    if (!ALLOWED_MIME_TYPES.has(mime)) {
      return cb(
        new Error(
          `Type de fichier non autorisé: ${mime} (images/audio/vidéo autorisés uniquement)`,
        ),
      );
    }

    cb(null, true);
  } catch (e) {
    cb(new Error(e?.message || "Erreur de validation du fichier"));
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
    files: 1,
  },
});

/* -------------------------------------------------------------------------- */
/* Helpers exportés                                                            */
/* -------------------------------------------------------------------------- */

export function getUploadsDir() {
  return uploadDirAbs;
}

/**
 * URL absolue (pour partager / prévisualiser)
 */
export function buildPublicUrl(filename) {
  const base = String(
    config.publicBaseUrl || "https://quizzwegeek.havelsoftware.fr",
  ).replace(/\/+$/, "");
  return `${base}/uploads/${encodeURIComponent(filename)}`;
}

/**
 * Chemin relatif (recommandé à stocker dans tes quiz)
 */
export function buildPublicMediaPath(filename) {
  return `/uploads/${encodeURIComponent(filename)}`;
}

/**
 * URL absolue depuis la requête (prend en compte reverse proxy)
 */
export function buildPublicMediaUrl(req, filename) {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.get("host");
  return `${proto}://${host}/uploads/${encodeURIComponent(filename)}`;
}

/**
 * Alias (si tu l’utilisais ailleurs)
 */
export function getUploadPublicUrl(filename) {
  return buildPublicUrl(filename);
}

export function toUploadRecord(file) {
  if (!file) return null;

  const mime = String(file.mimetype || "").toLowerCase();

  let kind = "doc";
  if (mime.startsWith("audio/")) kind = "audio";
  else if (mime.startsWith("image/")) kind = "image";
  else if (mime.startsWith("video/")) kind = "video";

  return {
    kind,
    originalName: file.originalname,
    mimeType: file.mimetype,
    filePath: file.path,
    filename: file.filename,
    publicUrl: buildPublicUrl(file.filename), // absolu
    mediaUrl: buildPublicMediaPath(file.filename), // relatif
    sizeBytes: Number(file.size || 0),
  };
}
