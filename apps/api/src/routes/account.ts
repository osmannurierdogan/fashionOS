import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { currentUser, requireAuth, verifyPassword } from "../lib/auth.js";
import { badRequest } from "../lib/errors.js";
import { itemsToDTO, userToDTO } from "../lib/serialize.js";
import { storage, userPrefix } from "../lib/storage.js";
import { cancelSubscription } from "../lib/billing.js";
import { Item } from "../models/Item.js";
import { Outfit } from "../models/Outfit.js";
import { Session } from "../models/Session.js";
import { Token } from "../models/Token.js";
import { User } from "../models/User.js";
import { WearLog } from "../models/WearLog.js";

export async function accountRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  /** KVKK: tüm verilerimi indir (JSON) */
  app.get("/export", async (req, reply) => {
    const user = currentUser(req);
    const [items, outfits, wears] = await Promise.all([
      Item.find({ userId: user._id }).lean(),
      Outfit.find({ userId: user._id }).lean(),
      WearLog.find({ userId: user._id }).lean(),
    ]);
    const data = {
      exportedAt: new Date().toISOString(),
      user: await userToDTO(user),
      items: await itemsToDTO(items),
      outfits: outfits.map((o) => ({ ...o, _id: String(o._id), userId: undefined, itemIds: o.itemIds.map(String) })),
      wearLogs: wears.map((w) => ({ id: String(w._id), date: w.date, itemIds: w.itemIds.map(String), outfitId: w.outfitId ? String(w.outfitId) : null })),
      note:
        config.storage.driver === "s3"
          ? "Görsel bağlantıları geçicidir (1 saat). Görselleri hemen indirin."
          : "Görsel bağlantıları oturum açıkken çalışır.",
    };
    return reply
      .header("Content-Type", "application/json; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="fashionos-verilerim.json"`)
      .send(JSON.stringify(data, null, 2));
  });

  /** KVKK: hesabımı ve tüm verilerimi sil */
  app.delete("/", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (req, reply) => {
    const user = currentUser(req);
    const { password } = (req.body ?? {}) as { password?: string };
    if (!password || !(await verifyPassword(password, user.passwordHash))) throw badRequest("Şifre hatalı");
    await cancelSubscription(user).catch((e) => req.log.error(e, "abonelik iptal edilemedi"));
    await storage().deletePrefix(userPrefix(String(user._id)));
    await Promise.all([
      Item.deleteMany({ userId: user._id }),
      Outfit.deleteMany({ userId: user._id }),
      WearLog.deleteMany({ userId: user._id }),
      Session.deleteMany({ userId: user._id }),
      Token.deleteMany({ userId: user._id }),
    ]);
    await User.deleteOne({ _id: user._id });
    reply.clearCookie("fos_session", { path: "/" });
    return { ok: true };
  });
}
