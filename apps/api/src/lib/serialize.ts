import type { ItemDTO, OutfitDTO, UserDTO } from "@fashionos/shared";
import { DEFAULT_PROFILE } from "@fashionos/shared";
import { Item } from "../models/Item.js";
import { planLimits } from "./quota.js";
import { storage } from "./storage.js";

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

export async function itemToDTO(it: any): Promise<ItemDTO> {
  const s = storage();
  const [url, thumbUrl, originalUrl] = await Promise.all([
    s.url(it.images.main),
    s.url(it.images.thumb),
    it.images.original ? s.url(it.images.original) : Promise.resolve(null),
  ]);
  return {
    id: String(it._id),
    name: it.name ?? "",
    category: it.category,
    subcategory: it.subcategory,
    colors: (it.colors ?? []).map((c: any) => ({ hex: c.hex, name: c.name, ratio: c.ratio })),
    pattern: it.pattern,
    material: it.material,
    seasons: it.seasons ?? [],
    warmth: it.warmth,
    formality: it.formality,
    styles: it.styles ?? [],
    layer: it.layer,
    waterproof: !!it.waterproof,
    brand: it.brand ?? "",
    size: it.size ?? "",
    price: it.price ?? null,
    notes: it.notes ?? "",
    favorite: !!it.favorite,
    archived: !!it.archived,
    aiTagged: !!it.aiTagged,
    wearCount: it.wearCount ?? 0,
    lastWornAt: iso(it.lastWornAt),
    image: { url, thumbUrl, originalUrl, width: it.images.width ?? 0, height: it.images.height ?? 0 },
    createdAt: iso(it.createdAt)!,
    updatedAt: iso(it.updatedAt)!,
  };
}

export const itemsToDTO = (items: any[]) => Promise.all(items.map(itemToDTO));

export async function outfitToDTO(o: any, itemMap?: Map<string, ItemDTO>): Promise<OutfitDTO> {
  const ids = (o.itemIds ?? []).map(String);
  let items: ItemDTO[];
  if (itemMap) items = ids.map((id: string) => itemMap.get(id)).filter(Boolean) as ItemDTO[];
  else items = await itemsToDTO(await Item.find({ _id: { $in: ids }, userId: o.userId }).lean());
  return {
    id: String(o._id),
    name: o.name ?? "",
    itemIds: ids,
    items,
    occasion: o.occasion ?? null,
    source: o.source,
    explanation: o.explanation ?? "",
    score: o.score ?? null,
    rating: o.rating ?? 0,
    saved: !!o.saved,
    plannedFor: o.plannedFor ?? null,
    wornCount: o.wornCount ?? 0,
    lastWornAt: iso(o.lastWornAt),
    weather: o.weather?.condition ? o.weather : null,
    createdAt: iso(o.createdAt)!,
  };
}

/** Birden çok kombini, parçaları tek sorguda çekerek serileştirir */
export async function outfitsToDTO(outfits: any[], userId: unknown) {
  const ids = [...new Set(outfits.flatMap((o) => (o.itemIds ?? []).map(String)))];
  const items = await itemsToDTO(await Item.find({ _id: { $in: ids }, userId }).lean());
  const map = new Map(items.map((i) => [i.id, i]));
  return Promise.all(outfits.map((o) => outfitToDTO(o, map)));
}

export async function userToDTO(u: any): Promise<UserDTO> {
  const itemCount = await Item.countDocuments({ userId: u._id, archived: false });
  const p = u.profile ?? {};
  const limits = planLimits(u.plan);
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    emailVerified: !!u.emailVerified,
    plan: u.plan,
    planRenewsAt: iso(u.planRenewsAt),
    profile: {
      gender: p.gender ?? DEFAULT_PROFILE.gender,
      styles: p.styles ?? [],
      favoriteColors: p.favoriteColors ?? [],
      avoidColors: p.avoidColors ?? [],
      fitNotes: p.fitNotes ?? "",
      city: p.city ?? "",
      lat: p.lat ?? null,
      lon: p.lon ?? null,
      runsCold: !!p.runsCold,
    },
    usage: {
      aiTags: u.usage?.aiTags ?? 0,
      aiOutfits: u.usage?.aiOutfits ?? 0,
      periodStart: iso(u.usage?.periodStart) ?? new Date().toISOString(),
    },
    limits: { maxItems: limits.maxItems, aiTagsPerMonth: limits.aiTagsPerMonth, aiOutfitsPerMonth: limits.aiOutfitsPerMonth },
    itemCount,
    createdAt: iso(u.createdAt)!,
  };
}

/** Mongoose alt belgesini düz Profile nesnesine çevirir (yayma / kopyalama güvenli). */
export function plainProfile(u: any) {
  const p = u.profile?.toObject?.() ?? u.profile ?? {};
  return {
    gender: p.gender ?? DEFAULT_PROFILE.gender,
    styles: [...(p.styles ?? [])],
    favoriteColors: [...(p.favoriteColors ?? [])],
    avoidColors: [...(p.avoidColors ?? [])],
    fitNotes: p.fitNotes ?? "",
    city: p.city ?? "",
    lat: p.lat ?? null,
    lon: p.lon ?? null,
    runsCold: !!p.runsCold,
  };
}
