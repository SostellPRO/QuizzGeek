// server/src/utils.js
import crypto from "crypto";

export function randomCode(length = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans O/0/I/1
  const n = Math.max(1, Math.min(12, Number(length) || 4)); // limite raisonnable

  // bytes -> index dans chars
  const bytes = crypto.randomBytes(n);
  let out = "";
  for (let i = 0; i < n; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

export function randomId(prefix = "id") {
  const p =
    String(prefix || "id")
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 24) || "id";

  // 12 bytes -> 24 hex chars
  const rand = crypto.randomBytes(12).toString("hex");
  return `${p}_${rand}`;
}

export function nowIso() {
  return new Date().toISOString();
}
