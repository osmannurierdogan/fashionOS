import type { FastifyInstance } from "fastify";
import { aiAvailable, AiError } from "../lib/ai.js";
import { currentUser, requireAuth } from "../lib/auth.js";
import { badRequest, unavailable } from "../lib/errors.js";
import { dominantColors, toAiJpeg } from "../lib/images.js";
import { consumeQuota } from "../lib/quota.js";
import { tagImage } from "../engine/tagger.js";
import { readUpload } from "./upload.js";

export async function aiRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/status", async () => ({ available: aiAvailable() }));

  /** Fotoğraftan etiket önerisi. Yapay zekâ yoksa sadece baskın renkleri döner. */
  app.post("/tag", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req) => {
    const user = currentUser(req);
    const up = await readUpload(req);
    const image = up.files.image;
    if (!image) throw badRequest("Fotoğraf gerekli");
    const colors = await dominantColors(image.buffer).catch(() => []);
    if (!aiAvailable()) return { tag: null, colors, ai: false };
    await consumeQuota(user._id, user.plan, "aiTags");
    try {
      const tag = await tagImage(await toAiJpeg(image.buffer));
      return { tag, colors, ai: true };
    } catch (e) {
      if (e instanceof AiError) {
        req.log.warn({ err: e }, "AI etiketleme başarısız");
        return { tag: null, colors, ai: false, error: e.message };
      }
      throw unavailable("Yapay zekâ şu an kullanılamıyor");
    }
  });
}
