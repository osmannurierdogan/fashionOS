import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { currentUser, requireAuth } from "../lib/auth.js";
import { forbidden, notFound } from "../lib/errors.js";
import { storage, userPrefix } from "../lib/storage.js";

/** Yerel depolama sürücüsü için dosya servisi (S3'te imzalı URL kullanılır). */
export async function fileRoutes(app: FastifyInstance) {
  app.get("/*", { preHandler: requireAuth }, async (req, reply) => {
    if (config.storage.driver !== "local") throw notFound();
    const key = (req.params as { "*": string })["*"];
    const user = currentUser(req);
    if (!key.startsWith(userPrefix(String(user._id))) || key.includes("..")) throw forbidden();
    try {
      const buf = await storage().get(key);
      return reply
        .header("Content-Type", key.endsWith(".webp") ? "image/webp" : "application/octet-stream")
        .header("Cache-Control", "private, max-age=31536000, immutable")
        .send(buf);
    } catch {
      throw notFound();
    }
  });
}
