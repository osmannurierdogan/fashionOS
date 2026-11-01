import type { FastifyInstance } from "fastify";
import { Types } from "mongoose";
import { outfitCreateSchema, outfitUpdateSchema, packingRequestSchema, suggestRequestSchema } from "@fashionos/shared";
import { currentUser, requireAuth } from "../lib/auth.js";
import { badRequest, notFound } from "../lib/errors.js";
import { outfitToDTO, outfitsToDTO } from "../lib/serialize.js";
import { parse } from "../lib/validate.js";
import { Item } from "../models/Item.js";
import { Outfit } from "../models/Outfit.js";
import { buildPackingList } from "../engine/packing.js";
import { signatureOf } from "../engine/outfits.js";
import { suggestOutfits } from "../engine/suggest.js";

const oid = (id: string) => {
  if (!Types.ObjectId.isValid(id)) throw notFound("Kombin bulunamadı");
  return new Types.ObjectId(id);
};

export async function outfitRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.post("/suggest", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req) => {
    const user = currentUser(req);
    const body = parse(suggestRequestSchema, req.body ?? {});
    return suggestOutfits({ user, ...body, log: req.log });
  });

  app.post("/packing", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req) => {
    const user = currentUser(req);
    const body = parse(packingRequestSchema, req.body);
    return buildPackingList({ user, ...body });
  });

  // Kaydedilen / planlanan / geçmiş kombinler
  app.get("/", async (req) => {
    const user = currentUser(req);
    const q = req.query as Record<string, string | undefined>;
    const filter: Record<string, unknown> = { userId: user._id };
    if (q.saved === "true") filter.saved = true;
    if (q.from || q.to) filter.plannedFor = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
    if (q.rated === "true") filter.rating = { $ne: 0 };
    const docs = await Outfit.find(filter).sort({ updatedAt: -1 }).limit(Number(q.limit ?? 200)).lean();
    return { outfits: await outfitsToDTO(docs, user._id) };
  });

  app.get("/:id", async (req) => {
    const user = currentUser(req);
    const o = await Outfit.findOne({ _id: oid((req.params as any).id), userId: user._id }).lean();
    if (!o) throw notFound("Kombin bulunamadı");
    return { outfit: await outfitToDTO(o) };
  });

  /** Kombin kaydet / planla / puanla. Aynı parça seti varsa günceller (upsert). */
  app.post("/", async (req) => {
    const user = currentUser(req);
    const body = parse(outfitCreateSchema, req.body);
    const ids = [...new Set(body.itemIds)];
    if (ids.some((id) => !Types.ObjectId.isValid(id))) throw badRequest("Geçersiz parça");
    const owned = await Item.countDocuments({ _id: { $in: ids }, userId: user._id });
    if (owned !== ids.length) throw badRequest("Kombindeki parçalar size ait değil");
    const signature = signatureOf(ids);
    const set: Record<string, unknown> = {
      itemIds: ids,
      source: body.source,
      ...(body.name ? { name: body.name } : {}),
      ...(body.occasion ? { occasion: body.occasion } : {}),
      ...(body.explanation ? { explanation: body.explanation } : {}),
      ...(body.score !== undefined ? { score: body.score } : {}),
      ...(body.weather ? { weather: body.weather } : {}),
      ...(body.plannedFor !== undefined ? { plannedFor: body.plannedFor } : {}),
    };
    if (body.saved) set.saved = true;
    const o = await Outfit.findOneAndUpdate(
      { userId: user._id, signature },
      { $set: set, $setOnInsert: { userId: user._id, signature, ...(body.saved ? {} : { saved: false }) } },
      { upsert: true, new: true },
    ).lean();
    return { outfit: await outfitToDTO(o) };
  });

  app.patch("/:id", async (req) => {
    const user = currentUser(req);
    const body = parse(outfitUpdateSchema, req.body);
    const o = await Outfit.findOneAndUpdate({ _id: oid((req.params as any).id), userId: user._id }, { $set: body }, { new: true }).lean();
    if (!o) throw notFound("Kombin bulunamadı");
    return { outfit: await outfitToDTO(o) };
  });

  app.delete("/:id", async (req) => {
    const user = currentUser(req);
    const r = await Outfit.deleteOne({ _id: oid((req.params as any).id), userId: user._id });
    if (!r.deletedCount) throw notFound("Kombin bulunamadı");
    return { ok: true };
  });
}
