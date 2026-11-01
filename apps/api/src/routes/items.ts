import type { FastifyInstance } from "fastify";
import { Types } from "mongoose";
import { PALETTE_BY_KEY, colorDistance, itemFieldsSchema, itemUpdateSchema, nearestPaletteColor } from "@fashionos/shared";
import { currentUser, requireAuth } from "../lib/auth.js";
import { badRequest, notFound, paymentRequired } from "../lib/errors.js";
import { processImage } from "../lib/images.js";
import { planLimits } from "../lib/quota.js";
import { itemToDTO, itemsToDTO } from "../lib/serialize.js";
import { itemPrefix, storage } from "../lib/storage.js";
import { parse } from "../lib/validate.js";
import { Item } from "../models/Item.js";
import { Outfit } from "../models/Outfit.js";
import { readUpload } from "./upload.js";

const oid = (id: string) => {
  if (!Types.ObjectId.isValid(id)) throw notFound("Parça bulunamadı");
  return new Types.ObjectId(id);
};

function normalizeColors(colors: { hex: string; name?: string; ratio?: number }[]) {
  return colors.map((c) => ({ ...c, hex: c.hex.toLowerCase(), name: c.name || nearestPaletteColor(c.hex).name }));
}

async function storeImages(userId: string, itemId: string, main: Buffer, original?: Buffer, isCutout = false) {
  const s = storage();
  const prefix = itemPrefix(userId, itemId);
  const stamp = Date.now().toString(36);
  const p = await processImage(main, { trim: isCutout });
  const keys = { main: `${prefix}main-${stamp}.webp`, thumb: `${prefix}thumb-${stamp}.webp`, original: null as string | null };
  await s.put(keys.main, p.main, "image/webp");
  await s.put(keys.thumb, p.thumb, "image/webp");
  if (original) {
    const o = await processImage(original);
    keys.original = `${prefix}original-${stamp}.webp`;
    await s.put(keys.original, o.main, "image/webp");
  }
  return { ...keys, width: p.width, height: p.height };
}

export async function itemRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // Liste + filtreler
  app.get("/", async (req) => {
    const user = currentUser(req);
    const q = req.query as Record<string, string | undefined>;
    const filter: Record<string, unknown> = { userId: user._id, archived: q.archived === "true" };
    if (q.category) filter.category = q.category;
    if (q.subcategory) filter.subcategory = q.subcategory;
    if (q.season) filter.seasons = q.season;
    if (q.style) filter.styles = q.style;
    if (q.favorite === "true") filter.favorite = true;
    if (q.q) {
      const rx = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: rx }, { brand: rx }, { notes: rx }];
    }
    const sort: Record<string, 1 | -1> =
      q.sort === "most_worn" ? { wearCount: -1 } : q.sort === "least_worn" ? { wearCount: 1, createdAt: -1 } : q.sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };
    let docs = await Item.find(filter).sort(sort).limit(2000).lean();
    if (q.color && PALETTE_BY_KEY[q.color]) {
      const target = PALETTE_BY_KEY[q.color]!.hex;
      docs = docs.filter((d) => (d.colors ?? []).some((c: any) => nearestPaletteColor(c.hex).key === q.color || colorDistance(c.hex, target) < 12));
    }
    return { items: await itemsToDTO(docs) };
  });

  app.get("/:id", async (req) => {
    const user = currentUser(req);
    const it = await Item.findOne({ _id: oid((req.params as any).id), userId: user._id }).lean();
    if (!it) throw notFound("Parça bulunamadı");
    return { item: await itemToDTO(it) };
  });

  // Yeni parça: multipart (image + opsiyonel original + data JSON)
  app.post("/", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (req, reply) => {
    const user = currentUser(req);
    const limit = planLimits(user.plan).maxItems;
    if ((await Item.countDocuments({ userId: user._id, archived: false })) >= limit)
      throw paymentRequired(`Planınızdaki parça sınırına ulaştınız (${limit}).`);

    const up = await readUpload(req);
    const image = up.files.image;
    if (!image) throw badRequest("Fotoğraf gerekli");
    let data: unknown;
    try {
      data = JSON.parse(up.fields.data ?? "{}");
    } catch {
      throw badRequest("Geçersiz veri");
    }
    const fields = parse(itemFieldsSchema, data);
    const itemId = new Types.ObjectId();
    const isCutout = up.fields.cutout === "true";
    const images = await storeImages(String(user._id), String(itemId), image.buffer, up.files.original?.buffer, isCutout);
    const item = await Item.create({ ...fields, colors: normalizeColors(fields.colors), _id: itemId, userId: user._id, images });
    return reply.status(201).send({ item: await itemToDTO(item.toObject()) });
  });

  app.patch("/:id", async (req) => {
    const user = currentUser(req);
    const body = parse(itemUpdateSchema, req.body);
    const it = await Item.findOne({ _id: oid((req.params as any).id), userId: user._id });
    if (!it) throw notFound("Parça bulunamadı");
    if (body.colors) body.colors = normalizeColors(body.colors);
    it.set(body);
    await it.save();
    return { item: await itemToDTO(it.toObject()) };
  });

  // Fotoğrafı değiştir
  app.put("/:id/image", async (req) => {
    const user = currentUser(req);
    const it = await Item.findOne({ _id: oid((req.params as any).id), userId: user._id });
    if (!it) throw notFound("Parça bulunamadı");
    const up = await readUpload(req);
    if (!up.files.image) throw badRequest("Fotoğraf gerekli");
    const old = [it.images!.main, it.images!.thumb, it.images!.original].filter(Boolean) as string[];
    const images = await storeImages(String(user._id), String(it._id), up.files.image.buffer, up.files.original?.buffer, up.fields.cutout === "true");
    if (!up.files.original && it.images!.original) images.original = it.images!.original as string;
    it.set({ images });
    await it.save();
    await storage().delete(old.filter((k) => k !== images.original));
    return { item: await itemToDTO(it.toObject()) };
  });

  app.delete("/:id", async (req) => {
    const user = currentUser(req);
    const id = oid((req.params as any).id);
    const it = await Item.findOneAndDelete({ _id: id, userId: user._id });
    if (!it) throw notFound("Parça bulunamadı");
    await storage().deletePrefix(itemPrefix(String(user._id), String(id)));
    // Bu parçayı içeren kombinlerden çıkar; boş kalan kombinleri sil
    await Outfit.updateMany({ userId: user._id, itemIds: id }, { $pull: { itemIds: id } });
    await Outfit.deleteMany({ userId: user._id, itemIds: { $size: 0 } });
    return { ok: true };
  });
}
