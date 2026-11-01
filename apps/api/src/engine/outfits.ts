/**
 * Kural tabanlı kombin motoru.
 *  1) Parçaları hava, mevsim ve etkinliğe göre eler / puanlar
 *  2) Geçerli kombin adayları üretir (üst+alt veya tek parça, ayakkabı, gerekirse katman ve dış giyim)
 *  3) Renk uyumu, resmiyet tutarlılığı, desen, stil, tazelik ve geçmiş geri bildirimle puanlar
 *  4) Birbirinden farklı en iyi kombinleri seçer ve aksesuar ekler
 * Yapay zekâ stilist, bu motorun ürettiği adaylar arasından seçim yapar.
 */
import {
  OCCASION_RULES,
  nearestPaletteColor,
  outfitHarmony,
  pairHarmony,
  isNeutral,
  type Occasion,
  type Profile,
  type WeatherDTO,
} from "@fashionos/shared";

export interface EngineItem {
  id: string;
  name?: string;
  category: string;
  subcategory: string;
  colors: { hex: string; ratio?: number }[];
  pattern: string;
  material: string;
  seasons: string[];
  warmth: number;
  formality: number;
  styles: string[];
  layer: string;
  waterproof?: boolean;
  favorite?: boolean;
  wearCount?: number;
  lastWornAt?: Date | string | null;
}

export interface EngineContext {
  occasion: Occasion;
  weather: Pick<WeatherDTO, "feelsC" | "isRainy" | "isSnowy"> & Partial<WeatherDTO> | null;
  profile: Pick<Profile, "styles" | "favoriteColors" | "avoidColors" | "runsCold"> & { lat?: number | null };
  date?: Date;
  mustIncludeItemId?: string;
  excludeItemIds?: string[];
  /** Parça çifti → geri bildirim toplamı ("a|b" sıralı) */
  pairFeedback?: Map<string, number>;
  /** Beğenilmeyen kombin imzaları (tamamen dışlanır) */
  dislikedSignatures?: Set<string>;
  /** Son günlerde giyilen kombin imzaları */
  recentSignatures?: Set<string>;
  /** Çeşitlilik için rastgelelik (0 = deterministik) */
  jitter?: number;
  random?: () => number;
  /** Bu parçaları tercih et (valiz listesi: zaten valizde olanlar) */
  preferItemIds?: Set<string>;
}

export interface Candidate {
  items: EngineItem[];
  core: EngineItem[]; // aksesuarsız
  signature: string;
  score: number;
  breakdown: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

export const signatureOf = (ids: string[]) => [...ids].sort().join("-");
export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const primary = (it: EngineItem) => it.colors?.[0]?.hex ?? "#808080";
const daysSince = (d: Date | string | null | undefined, now: Date) =>
  d ? (now.getTime() - new Date(d).getTime()) / 86400_000 : Infinity;

const MID_LAYER_SUBS = new Set(["sweater", "cardigan", "sweatshirt", "hoodie", "vest", "turtleneck"]);
const LAYERABLE_BASE_SUBS = new Set(["tshirt", "shirt", "polo", "blouse", "tank", "turtleneck"]);
const RAIN_BAD_SHOES = new Set(["sandals", "slippers"]);
const RAIN_BAD_MATERIALS = new Set(["suede", "canvas", "silk"]);
const SPORT_SUBS = new Set(["joggers", "leggings", "hoodie", "sweatshirt", "tshirt", "tank", "sneakers", "shorts", "cap"]);

export function seasonOf(date: Date, lat?: number | null) {
  const m = date.getMonth(); // 0-11
  let s: string = m <= 1 || m === 11 ? "winter" : m <= 4 ? "spring" : m <= 7 ? "summer" : "autumn";
  if (lat != null && lat < 0) s = ({ winter: "summer", summer: "winter", spring: "autumn", autumn: "spring" } as const)[s as "winter"];
  return s;
}

/** Hissedilen sıcaklık → üst/alt için ideal "warmth" (1-5) */
export function idealWarmth(feelsC: number) {
  if (feelsC >= 26) return 1;
  if (feelsC >= 20) return 2;
  if (feelsC >= 13) return 3;
  if (feelsC >= 5) return 4;
  return 5;
}

/** Dış giyim gerekli mi, ne kalınlıkta? */
export function outerNeed(feelsC: number): { required: boolean; allowed: boolean; minWarmth: number; maxWarmth: number } {
  if (feelsC >= 24) return { required: false, allowed: false, minWarmth: 0, maxWarmth: 0 };
  if (feelsC >= 18) return { required: false, allowed: true, minWarmth: 1, maxWarmth: 2 };
  if (feelsC >= 12) return { required: true, allowed: true, minWarmth: 1, maxWarmth: 3 };
  if (feelsC >= 5) return { required: true, allowed: true, minWarmth: 3, maxWarmth: 4 };
  return { required: true, allowed: true, minWarmth: 4, maxWarmth: 5 };
}

function effectiveFeels(ctx: EngineContext) {
  const f = ctx.weather?.feelsC ?? defaultTempFor(ctx);
  return ctx.profile.runsCold ? f - 3 : f;
}

function defaultTempFor(ctx: EngineContext) {
  const s = seasonOf(ctx.date ?? new Date(), ctx.profile.lat);
  return { winter: 6, spring: 16, summer: 28, autumn: 15 }[s as "winter"];
}

// ---------------------------------------------------------------------------
// Parça uygunluğu
// ---------------------------------------------------------------------------

/** Parçanın bu bağlama uygunluğu: null = elenir, sayı = 0..1 puan */
export function itemFit(it: EngineItem, ctx: EngineContext): number | null {
  const feels = effectiveFeels(ctx);
  const rule = OCCASION_RULES[ctx.occasion];
  const [lo, hi] = rule.formality;
  let score = 1;

  // Resmiyet
  const fd = it.formality < lo ? lo - it.formality : it.formality > hi ? it.formality - hi : 0;
  if (it.category !== "accessory") {
    if (fd >= 2) return null;
    if (fd === 1) score -= 0.35;
  } else if (fd >= 3) return null;

  // Spor etkinliği: sadece spor parçalar
  if (ctx.occasion === "sport" && it.category !== "accessory") {
    if (!it.styles.includes("sporty") && !SPORT_SUBS.has(it.subcategory)) return null;
  }

  // Sıcaklık (üst / alt / tek parça)
  if (["top", "bottom", "onepiece"].includes(it.category)) {
    let ideal = idealWarmth(feels);
    const need = outerNeed(feels);
    // Soğukta iç katmanlar (tişört, gömlek) kazak/mont altına giyilir → ince olmaları sorun değil
    if (it.category === "top" && LAYERABLE_BASE_SUBS.has(it.subcategory)) ideal = Math.min(ideal, 2.5);
    // Dış giyim zaten ısıtacağı için üst/alt ideali bir kademe düşer
    else if (need.required) ideal = Math.min(ideal - 1, 4);
    const d = Math.abs(it.warmth - ideal);
    if (d >= 3) return null;
    if (it.category === "bottom" && it.subcategory === "shorts" && feels < 18) return null;
    if (it.category === "top" && it.subcategory === "tank" && feels < 20 && ctx.occasion !== "sport") return null;
    score -= d * 0.25;
  }
  if (it.category === "outerwear") {
    const need = outerNeed(feels);
    if (!need.allowed) return null;
    // Soğukta ince dış giyime tolerans yok; sıcakta kalın olana bir kademe tolerans
    const lowTol = need.minWarmth >= 3 ? 0 : 1;
    if (it.warmth < need.minWarmth - lowTol || it.warmth > need.maxWarmth + 1) return null;
    if (it.warmth < need.minWarmth || it.warmth > need.maxWarmth) score -= 0.3;
    if (ctx.weather?.isRainy && it.waterproof) score += 0.2;
  }
  if (it.category === "shoes") {
    if (ctx.weather?.isRainy || ctx.weather?.isSnowy) {
      if (RAIN_BAD_SHOES.has(it.subcategory)) return null;
      if (RAIN_BAD_MATERIALS.has(it.material)) score -= 0.5;
      if (it.subcategory === "boots" || it.subcategory === "chelsea" || it.waterproof) score += 0.3;
      else score -= 0.2;
    }
    if (feels < 8 && (it.subcategory === "sandals" || it.subcategory === "slippers")) return null;
    if (feels > 26 && (it.subcategory === "boots" || it.subcategory === "chelsea")) score -= 0.5;
  }

  // Mevsim etiketi
  const season = seasonOf(ctx.date ?? new Date(), ctx.profile.lat);
  if (it.seasons?.length && !it.seasons.includes(season)) score -= 0.25;

  // Stil uyumu
  if (it.styles?.length) {
    const occ = it.styles.some((s) => rule.styles.includes(s as never));
    const pref = it.styles.some((s) => ctx.profile.styles.includes(s as never));
    score += (occ ? 0.15 : -0.1) + (pref ? 0.1 : 0);
  }

  // Renk tercihleri
  const pk = nearestPaletteColor(primary(it)).key;
  if (ctx.profile.avoidColors.includes(pk)) score -= 0.5;
  if (ctx.profile.favoriteColors.includes(pk)) score += 0.1;

  if (it.favorite) score += 0.1;
  if (ctx.preferItemIds?.has(it.id)) score += 0.4;

  // Tazelik: yakın zamanda giyildiyse ceza
  const ds = daysSince(it.lastWornAt, ctx.date ?? new Date());
  if (ds < 2) score -= 0.5;
  else if (ds < 5) score -= 0.2;
  else if (ds === Infinity && it.category !== "accessory") score += 0.05;

  return Math.max(0.01, score);
}

// ---------------------------------------------------------------------------
// Kombin puanlama
// ---------------------------------------------------------------------------

export function scoreOutfit(core: EngineItem[], fits: Map<string, number>, ctx: EngineContext) {
  const rule = OCCASION_RULES[ctx.occasion];
  const b: Record<string, number> = {};

  // Renk uyumu — dış giyim ve ayakkabı dahil ana renkler
  const colors = core.map(primary);
  b.color = outfitHarmony(colors) * 3;

  // Aynı renk (nötr değilse) üst ve altta → monoton olabilir; tamamen aynı ton ceza
  const top = core.find((i) => i.category === "top");
  const bottom = core.find((i) => i.category === "bottom");
  if (top && bottom && !isNeutral(primary(top)) && pairHarmony(primary(top), primary(bottom)) < 0.6) b.color -= 0.3;

  // Resmiyet tutarlılığı ve hedefe yakınlık
  const forms = core.map((i) => i.formality);
  const spread = Math.max(...forms) - Math.min(...forms);
  b.formality = (1 - spread / 4) * 1.5;
  const avg = forms.reduce((a, c) => a + c, 0) / forms.length;
  const target = (rule.formality[0] + rule.formality[1]) / 2;
  b.formality += (1 - Math.min(1, Math.abs(avg - target) / 2)) * 1.5;

  // Isı dengesi: soğukta tek ince üstle (orta katman / kalın üst olmadan) çıkılmaz
  const feels = effectiveFeels(ctx);
  const tops = core.filter((i) => i.category === "top");
  if (feels < 12 && tops.length && Math.max(...tops.map((t) => t.warmth)) <= 2) b.warmth = -0.8;
  else if (feels < 12 && tops.length >= 2) b.warmth = 0.4;

  // Desenler: en fazla bir baskın desen
  const loud = core.filter((i) => !["solid", "textured"].includes(i.pattern)).length;
  b.pattern = loud <= 1 ? 0.5 : -1.2 * (loud - 1);

  // Parça uygunluk ortalaması (hava, stil, tazelik, tercih)
  b.fit = (core.reduce((a, i) => a + (fits.get(i.id) ?? 0.5), 0) / core.length) * 2.5;

  // Geri bildirimden öğrenme: beğenilen ikililer bonus, beğenilmeyenler ceza
  let fb = 0;
  if (ctx.pairFeedback?.size) {
    for (let i = 0; i < core.length; i++)
      for (let j = i + 1; j < core.length; j++) fb += ctx.pairFeedback.get(pairKey(core[i]!.id, core[j]!.id)) ?? 0;
  }
  b.feedback = Math.max(-1.5, Math.min(1.5, fb * 0.3));

  // Aynı kombin yakın zamanda giyildi mi?
  const sig = signatureOf(core.map((i) => i.id));
  b.repeat = ctx.recentSignatures?.has(sig) ? -1.5 : 0;

  // Çeşitlilik için küçük rastgelelik
  b.jitter = ctx.jitter ? (ctx.random ?? Math.random)() * ctx.jitter : 0;

  const score = Object.values(b).reduce((a, c) => a + c, 0);
  return { score, breakdown: b };
}

// ---------------------------------------------------------------------------
// Aday üretimi
// ---------------------------------------------------------------------------

function topN<T>(arr: T[], n: number, key: (t: T) => number) {
  return [...arr].sort((a, b) => key(b) - key(a)).slice(0, n);
}

export interface GenerateResult {
  candidates: Candidate[];
  missing: string[];
}

export function generateCandidates(allItems: EngineItem[], ctx: EngineContext, limit = 400): GenerateResult {
  const exclude = new Set(ctx.excludeItemIds ?? []);
  const fits = new Map<string, number>();
  const usable: EngineItem[] = [];
  for (const it of allItems) {
    if (exclude.has(it.id) && it.id !== ctx.mustIncludeItemId) continue;
    let f = itemFit(it, ctx);
    if (f === null && it.id === ctx.mustIncludeItemId) f = 0.2; // zorunlu parça elenmez
    if (f === null) continue;
    fits.set(it.id, f);
    usable.push(it);
  }
  const by = (cat: string) => usable.filter((i) => i.category === cat);
  const fitOf = (i: EngineItem) => fits.get(i.id) ?? 0;
  const must = ctx.mustIncludeItemId ? usable.find((i) => i.id === ctx.mustIncludeItemId) : undefined;

  const feels = effectiveFeels(ctx);
  const need = outerNeed(feels);

  const ensure = (list: EngineItem[], n: number) => {
    const picked = topN(list, n, fitOf);
    if (must && list.includes(must) && !picked.includes(must)) picked.push(must);
    return picked;
  };

  const tops = by("top");
  const baseTops = ensure(tops.filter((t) => !MID_LAYER_SUBS.has(t.subcategory) || t.subcategory === "turtleneck"), 12);
  const midTops = ensure(tops.filter((t) => MID_LAYER_SUBS.has(t.subcategory)), 8);
  const allTops = ensure(tops, 14);
  const bottoms = ensure(by("bottom"), 12);
  const ones = ensure(by("onepiece"), 8);
  const shoes = ensure(by("shoes"), 6);
  const outers = ensure(by("outerwear"), 5);

  const missing: string[] = [];
  const allByCat = (c: string) => allItems.filter((i) => i.category === c).length;
  if (!allByCat("top") && !allByCat("onepiece")) missing.push("top");
  if (!allByCat("bottom") && !allByCat("onepiece")) missing.push("bottom");
  if (!allByCat("shoes")) missing.push("shoes");
  if (need.required && !allByCat("outerwear")) missing.push("outerwear");

  // Temel gövdeler
  const bodies: EngineItem[][] = [];
  for (const t of allTops) for (const b of bottoms) bodies.push([t, b]);
  // Katmanlı: iç + orta katman (serin/soğuk havada)
  if (feels < 18) {
    const lb = baseTops.filter((x) => LAYERABLE_BASE_SUBS.has(x.subcategory)).slice(0, 6);
    if (must && LAYERABLE_BASE_SUBS.has(must.subcategory) && must.category === "top" && !lb.includes(must)) lb.push(must);
    for (const t of lb) for (const m of midTops.slice(0, 6)) if (m.id !== t.id) for (const b of bottoms.slice(0, 8)) bodies.push([t, m, b]);
  }
  for (const o of ones) bodies.push([o]);

  const shoeOpts: (EngineItem | null)[] = shoes.length ? shoes : [null];
  let outerOpts: (EngineItem | null)[] = [];
  if (!need.allowed) outerOpts = [null];
  else if (need.required && outers.length) outerOpts = outers;
  else outerOpts = [null, ...outers];
  if (must?.category === "outerwear") outerOpts = [must];

  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const body of bodies) {
    for (const s of shoeOpts) {
      for (const o of outerOpts) {
        const core = [...body, ...(o ? [o] : []), ...(s ? [s] : [])];
        if (must && must.category !== "accessory" && !core.includes(must)) continue;
        const sig = signatureOf(core.map((i) => i.id));
        if (seen.has(sig) || ctx.dislikedSignatures?.has(sig)) continue;
        seen.add(sig);
        const { score, breakdown } = scoreOutfit(core, fits, ctx);
        out.push({ items: core, core, signature: sig, score, breakdown });
      }
    }
  }
  out.sort((a, b) => b.score - a.score);
  const candidates = out.slice(0, limit);

  // Aksesuarlar
  const accessories = usable.filter((i) => i.category === "accessory");
  for (const c of candidates.slice(0, 60)) c.items = [...c.core, ...pickAccessories(c.core, accessories, fits, ctx, must)];
  return { candidates, missing };
}

// ---------------------------------------------------------------------------
// Aksesuar seçimi
// ---------------------------------------------------------------------------

const ACC_GROUPS: Record<string, string[]> = {
  bag: ["bag", "backpack"],
  belt: ["belt"],
  wrist: ["watch", "bracelet"],
  neck: ["necklace", "tie", "scarf"],
  head: ["hat", "cap", "beanie"],
  eyes: ["sunglasses"],
  hands: ["gloves"],
  jewelry: ["ring", "earrings", "jewelry"],
};

export function pickAccessories(
  core: EngineItem[],
  accessories: EngineItem[],
  fits: Map<string, number>,
  ctx: EngineContext,
  must?: EngineItem,
): EngineItem[] {
  if (!accessories.length && !must) return [];
  const feels = effectiveFeels(ctx);
  const avgForm = core.reduce((a, i) => a + i.formality, 0) / core.length;
  const coreColors = core.map(primary);
  const picked: EngineItem[] = [];
  if (must?.category === "accessory") picked.push(must);

  const scoreAcc = (a: EngineItem) => {
    const harm = coreColors.reduce((s, c) => s + pairHarmony(primary(a), c), 0) / coreColors.length;
    const form = 1 - Math.min(1, Math.abs(a.formality - avgForm) / 3);
    return harm + form + (fits.get(a.id) ?? 0.5);
  };

  const hasBelted = core.some((i) => ["jeans", "chino", "trousers", "cargo"].includes(i.subcategory));
  const wantGroup: Record<string, boolean> = {
    bag: true,
    belt: hasBelted && avgForm >= 2,
    wrist: true,
    neck: feels < 10 || avgForm >= 4.5,
    head: feels < 5 || (feels > 24 && !ctx.weather?.isRainy),
    eyes: feels > 18 && !ctx.weather?.isRainy && !ctx.weather?.isSnowy,
    hands: feels < 3,
    jewelry: true,
  };

  for (const [group, subs] of Object.entries(ACC_GROUPS)) {
    if (picked.length >= 4) break;
    if (!wantGroup[group]) continue;
    if (picked.some((p) => subs.includes(p.subcategory))) continue;
    // Kravat sadece çok resmi kombinlerde
    const opts = accessories.filter(
      (a) => subs.includes(a.subcategory) && (a.subcategory !== "tie" || avgForm >= 4) && !picked.includes(a),
    );
    if (!opts.length) continue;
    const best = topN(opts, 1, scoreAcc)[0]!;
    if (scoreAcc(best) > 1.6) picked.push(best);
  }
  return picked;
}

// ---------------------------------------------------------------------------
// Çeşitli seçim
// ---------------------------------------------------------------------------

/** En iyi adaylardan birbirine benzemeyen n tanesini seçer. */
export function pickDiverse(cands: Candidate[], n: number, maxShared = 1): Candidate[] {
  const chosen: Candidate[] = [];
  for (const c of cands) {
    const ids = new Set(c.core.map((i) => i.id));
    const tooSimilar = chosen.some((x) => x.core.filter((i) => ids.has(i.id) && i.category !== "shoes").length > maxShared);
    if (!tooSimilar) chosen.push(c);
    if (chosen.length >= n) break;
  }
  // Yeterince farklı aday yoksa kalanları skor sırasıyla doldur
  for (const c of cands) {
    if (chosen.length >= n) break;
    if (!chosen.includes(c)) chosen.push(c);
  }
  return chosen;
}
