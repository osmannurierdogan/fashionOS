import Fastify, { type FastifyError } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import mongoose from "mongoose";
import { config } from "./config.js";
import { HttpError } from "./lib/errors.js";
import { accountRoutes } from "./routes/account.js";
import { aiRoutes } from "./routes/ai.js";
import { authRoutes } from "./routes/auth.js";
import { billingRoutes } from "./routes/billing.js";
import { fileRoutes } from "./routes/files.js";
import { itemRoutes } from "./routes/items.js";
import { outfitRoutes } from "./routes/outfits.js";
import { profileRoutes } from "./routes/profile.js";
import { statsRoutes } from "./routes/stats.js";
import { wearRoutes } from "./routes/wear.js";
import { weatherRoutes } from "./routes/weather.js";
import { aiAvailable } from "./lib/ai.js";

export async function buildApp(opts: { logger?: boolean } = {}) {
  const app = Fastify({
    logger: opts.logger ?? { level: config.isProd ? "info" : "debug" },
    trustProxy: true, // Railway / Netlify proxy arkasında gerçek IP
    bodyLimit: 2 * 1024 * 1024,
  });

  await app.register(helmet, { contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } });
  await app.register(cors, {
    origin: config.corsOrigins.length ? config.corsOrigins : config.isProd ? false : true,
    credentials: true,
  });
  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 2, fields: 5 } });
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });

  app.decorateRequest("user", null);

  app.setErrorHandler((err: FastifyError | HttpError, req, reply) => {
    if (err instanceof HttpError) {
      return reply.status(err.statusCode).send({ error: err.code, message: err.message, details: err.details });
    }
    const status = (err as FastifyError).statusCode ?? 500;
    if (status === 429) return reply.status(429).send({ error: "rate_limited", message: "Çok fazla istek. Lütfen biraz bekleyin." });
    if (status === 413 || (err as FastifyError).code === "FST_REQ_FILE_TOO_LARGE")
      return reply.status(413).send({ error: "too_large", message: `Dosya en fazla ${config.maxUploadMb} MB olabilir.` });
    if (status >= 500) req.log.error(err);
    reply.status(status).send({ error: "error", message: status >= 500 ? "Beklenmeyen bir hata oluştu" : err.message });
  });

  app.get("/api/health", async () => ({
    ok: true,
    db: mongoose.connection.readyState === 1,
    ai: aiAvailable(),
    storage: config.storage.driver,
  }));

  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(profileRoutes, { prefix: "/api/profile" });
  await app.register(itemRoutes, { prefix: "/api/items" });
  await app.register(aiRoutes, { prefix: "/api/ai" });
  await app.register(outfitRoutes, { prefix: "/api/outfits" });
  await app.register(wearRoutes, { prefix: "/api/wear" });
  await app.register(weatherRoutes, { prefix: "/api" });
  await app.register(statsRoutes, { prefix: "/api/stats" });
  await app.register(accountRoutes, { prefix: "/api/account" });
  await app.register(billingRoutes, { prefix: "/api/billing" });
  await app.register(fileRoutes, { prefix: "/api/files" });

  return app;
}
