import type { FastifyInstance } from "fastify";
import { Types } from "mongoose";
import { wearSchema } from "@fashionos/shared";
import { currentUser, requireAuth } from "../lib/auth.js";
import { badRequest, notFound } from "../lib/errors.js";
import { itemsToDTO } from "../lib/serialize.js";
import { parse } from "../lib/validate.js";
import { Item } from "../models/Item.js";
import { Outfit } from "../models/Outfit.js";
import { WearLog } from "../models/WearLog.js";
import { signatureOf } from "../engine/outfits.js";

/** Bir parçanın giyim istatistiğini kayıtlardan yeniden hesaplar (geri alma için). */
async function recomputeItems(userId: unknown, ids: Types.ObjectId[]) {
  for (const id of ids) {
    const logs = await WearLog.find({ userId, itemIds: id }).sort({ date: -1 }).select("date").lean();
    await Item.updateOne({ _id: id, userId }, { wearCount: logs.length, lastWornAt: logs[0]?.date ?? null });
  }
}

async function recomputeOutfit(userId: unknown, outfitId: unknown) {
  if (!outfitId) return;
  const logs = await WearLog.find({ userId, outfitId }).sort({ date: -1 }).select("date").lean();
  await Outfit.updateOne({ _id: outfitId, userId }, { wornCount: logs.length, lastWornAt: logs[0]?.date ?? null });
}

export async function wearRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  /** "Bugün bunu giydim" */
  app.post("/", async (req) => {
    const user = currentUser(req);
    const body = parse(wearSchema, req.body);
    const ids = [...new Set(body.itemIds)];
    if (ids.some((id) => !Types.ObjectId.isValid(id))) throw badRequest("Geçersiz parça");
    const oids = ids.map((id) => new Types.ObjectId(id));
    if ((await Item.countDocuments({ _id: { $in: oids }, userId: user._id })) !== ids.length) throw badRequest("Parçalar size ait değil");
    const date = body.date ? new Date(body.date + "T12:00:00") : new Date();

    // Kombin kaydı yoksa oluştur (geçmiş ve öğrenme için)
    let outfitId = body.outfitId && Types.ObjectId.isValid(body.outfitId) ? new Types.ObjectId(body.outfitId) : null;
    if (!outfitId) {
      const signature = signatureOf(ids);
      const o = await Outfit.findOneAndUpdate(
        { userId: user._id, signature },
        { $setOnInsert: { userId: user._id, signature, itemIds: oids, source: "manual" } },
        { upsert: true, new: true },
      );
      outfitId = o!._id;
    }
    const log = await WearLog.create({ userId: user._id, itemIds: oids, outfitId, date });
    await recomputeItems(user._id, oids);
    await recomputeOutfit(user._id, outfitId);
    return { ok: true, id: String(log._id), outfitId: String(outfitId) };
  });

  /** Giyim geçmişi (takvim) */
  app.get("/", async (req) => {
    const user = currentUser(req);
    const q = req.query as Record<string, string | undefined>;
    const filter: Record<string, unknown> = { userId: user._id };
    if (q.from || q.to)
      filter.date = { ...(q.from ? { $gte: new Date(q.from + "T00:00:00") } : {}), ...(q.to ? { $lte: new Date(q.to + "T23:59:59") } : {}) };
    const logs = await WearLog.find(filter).sort({ date: -1 }).limit(500).lean();
    const ids = [...new Set(logs.flatMap((l) => l.itemIds.map(String)))];
    const items = await itemsToDTO(await Item.find({ _id: { $in: ids }, userId: user._id }).lean());
    const map = new Map(items.map((i) => [i.id, i]));
    return {
      logs: logs.map((l) => ({
        id: String(l._id),
        date: l.date.toISOString(),
        outfitId: l.outfitId ? String(l.outfitId) : null,
        items: l.itemIds.map((i) => map.get(String(i))).filter(Boolean),
      })),
    };
  });

  /** Geri al */
  app.delete("/:id", async (req) => {
    const user = currentUser(req);
    const id = (req.params as any).id;
    if (!Types.ObjectId.isValid(id)) throw notFound();
    const log = await WearLog.findOneAndDelete({ _id: id, userId: user._id });
    if (!log) throw notFound("Kayıt bulunamadı");
    await recomputeItems(user._id, log.itemIds);
    await recomputeOutfit(user._id, log.outfitId);
    return { ok: true };
  });
}
