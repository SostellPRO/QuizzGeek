import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4000),
  clientOrigin:
    process.env.CLIENT_ORIGIN || "https://quizzwegeek.havelsoftware.fr",
  databaseUrl: process.env.DATABASE_URL || "",
  hostSecret: process.env.HOST_SECRET || "host-secret",
  adminSecret: process.env.ADMIN_SECRET || "admin-secret",
  uploadDir: process.env.UPLOAD_DIR || "uploads",
  databaseSsl: process.env.DATABASE_SSL === "true",
  publicBaseUrl:
    process.env.PUBLIC_BASE_URL || "https://quizzwegeek.havelsoftware.fr",
};
