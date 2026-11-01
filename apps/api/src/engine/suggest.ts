import type { Occasion, Profile, SuggestResponse, SuggestionDTO, WeatherDTO } from "@fashionos/shared";
import { Item } from "../models/Item.js";
import { Outfit } from "../models/Outfit.js";
import { aiAvailable, AiError } from "../lib/ai.js";
import { consumeQuota } from "../lib/quota.js";
import { itemsToDTO, plainProfile } from "../lib/serialize.js";
import { getWeatherFor } from "../lib/weather.js";
import { describeCandidate } from "./describe.js";
import {
  generateCandidates,
  pairKey,
  pickDiverse,
  signatureOf,
  type EngineContext,
  type EngineItem,
} from "./outfits.js";
import { aiStylist } from "./stylist.js";

export function toEngineItem(d: any): EngineItem {
  return {
    id: String(d._id),
    name: d.name,
    category: d.category,
    subcategory: d.subcategory,
    colors: d.colors ?? [],
    pattern: d.pattern,
    material: d.material,
    seasons: d.seasons ?? [],
    warmth: d.warmth,
    formality: d.formality,
    styles: d.styles ?? [],
    layer: d.layer,
    waterproof: d.waterproof,
    favorite: d.favorite,
    wearCount: d.wearCount,
    lastWornAt: d.lastWornAt,
  };
}

/** Kullanıcının geçmiş puanlarından öğrenme verisi */
export async function loadFeedback(userId: unknown, items: EngineItem[], now = new Date()) {
  const cat = new Map(items.map((i) => [i.id, i.category]));
  const outfits = await Outfit.find({ userId, $or: [{ rating: { $ne: 0 } }, { lastWornAt: { $ne: null } }, { saved: true }] })
    .select("itemIds rating lastWornAt saved")
    .lean();
  const pairFeedback = new Map<string, number>();
  const dislikedSignatures = new Set<string>();
  const recentSignatures = new Set<string>();
  for (const o of outfits) {
    const ids = (o.itemIds ?? []).map(String).filter((id) => cat.has(id) && cat.get(id) !== "accessory");
    const sig = signatureOf(ids);
    // Kaydetmek hafif, beğenmek güçlü, giymek orta düzey olumlu sinyal
    const weight = (o.rating ?? 0) + (o.saved ? 0.3 : 0) + (o.lastWornAt ? 0.3 : 0);
    if (o.rating === -1) dislikedSignatures.add(sig);
    if (o.lastWornAt && (now.getTime() - new Date(o.lastWornAt).getTime()) / 86400_000 < 7) recentSignatures.add(sig);
    if (!weight) continue;
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const k = pairKey(ids[i]!, ids[j]!);
        pairFeedback.set(k, (pairFeedback.get(k) ?? 0) + weight);
      }
  }
  return { pairFeedback, dislikedSignatures, recentSignatures };
}

export async function suggestOutfits(opts: {
  user: any;
  occasion: Occasion;
  note?: string;
  mustIncludeItemId?: string;
  excludeItemIds?: string[];
  date?: string;
  useAi?: boolean;
  count?: number;
  log?: { warn: (o: unknown, m?: string) => void };
}): Promise<SuggestResponse> {
  const { user } = opts;
  const count = opts.count ?? 3;
  const profile = plainProfile(user) as Profile;
  const docs = await Item.find({ userId: user._id, archived: false }).lean();
  const items = docs.map(toEngineItem);
  const weather: WeatherDTO | null = await getWeatherFor(profile.lat, profile.lon, opts.date);
  const fb = await loadFeedback(user._id, items);
  const date = opts.date ? new Date(opts.date + "T12:00:00") : new Date();

  const ctx: EngineContext = {
    occasion: opts.occasion,
    weather,
    profile,
    date,
    mustIncludeItemId: opts.mustIncludeItemId,
    excludeItemIds: opts.excludeItemIds,
    ...fb,
    jitter: 0.6, // "başka öner" her seferinde biraz farklı sonuç versin
  };
  const { candidates, missing } = generateCandidates(items, ctx);
  if (!candidates.length) return { suggestions: [], weather, aiUsed: false, missing };

  const pool = pickDiverse(candidates, Math.max(12, count * 4));
  let aiUsed = false;
  let aiError: string | undefined;
  let chosen: { cand: (typeof pool)[number]; items: EngineItem[]; title: string; explanation: string; source: "ai" | "rules" }[] = [];

  if (opts.useAi !== false && aiAvailable()) {
    try {
      await consumeQuota(user._id, user.plan, "aiOutfits");
      const accessories = items.filter((i) => i.category === "accessory").slice(0, 40);
      const res = await aiStylist({ candidates: pool, accessories, count, occasion: opts.occasion, note: opts.note ?? "", weather, profile });
      chosen = res.map((r) => ({ cand: r.candidate, items: r.items, title: r.title, explanation: r.explanation, source: "ai" as const }));
      aiUsed = chosen.length > 0;
    } catch (e) {
      aiError = e instanceof AiError ? e.message : (e as Error).message;
      if ((e as any)?.statusCode !== 402) opts.log?.warn({ err: e }, "AI stilist başarısız, kural motoruna dönülüyor");
    }
  }
  // Yapay zekâ yoksa / yetersizse kural motoru sonuçlarıyla tamamla
  for (const c of pickDiverse(pool, count)) {
    if (chosen.length >= count) break;
    if (chosen.some((x) => x.cand === c)) continue;
    const d = describeCandidate(c, opts.occasion, weather);
    chosen.push({ cand: c, items: c.items, title: d.title, explanation: d.explanation, source: "rules" });
  }

  const allIds = [...new Set(chosen.flatMap((c) => c.items.map((i) => i.id)))];
  const dtos = await itemsToDTO(docs.filter((d) => allIds.includes(String(d._id))));
  const map = new Map(dtos.map((d) => [d.id, d]));
  const suggestions: SuggestionDTO[] = chosen.map((c) => ({
    itemIds: c.items.map((i) => i.id),
    items: c.items.map((i) => map.get(i.id)!).filter(Boolean),
    score: +c.cand.score.toFixed(2),
    title: c.title,
    explanation: c.explanation,
    source: c.source,
    breakdown: Object.fromEntries(Object.entries(c.cand.breakdown).map(([k, v]) => [k, +v.toFixed(2)])),
  }));
  return { suggestions, weather, aiUsed, aiError, missing };
}
