/**
 * Yapay zekâ stilist (Qwen). Kural motorunun ürettiği adaylar arasından seçer,
 * aksesuar ekleyip çıkarabilir ve Türkçe açıklama yazar. Sadece verilen parça
 * kodlarını kullanabilir; gardıropta olmayan bir şey öneremez.
 */
import { z } from "zod";
import {
  CATEGORIES,
  MATERIALS,
  OCCASIONS,
  PATTERNS,
  STYLES,
  nearestPaletteColor,
  type Occasion,
  type Profile,
  type WeatherDTO,
} from "@fashionos/shared";
import { chatJson } from "../lib/ai.js";
import type { Candidate, EngineItem } from "./outfits.js";

const responseSchema = z.object({
  outfits: z
    .array(
      z.object({
        candidate: z.number().int(),
        add: z.array(z.string()).default([]),
        remove: z.array(z.string()).default([]),
        title: z.string().max(80),
        explanation: z.string().max(600),
      }),
    )
    .min(1),
});

function describeItem(code: string, i: EngineItem) {
  const cat = CATEGORIES[i.category as keyof typeof CATEGORIES];
  const colors = i.colors.map((c) => nearestPaletteColor(c.hex).name).join("/");
  return {
    kod: code,
    ad: i.name || undefined,
    tur: `${cat?.label ?? i.category} > ${(cat?.sub as Record<string, string>)?.[i.subcategory] ?? i.subcategory}`,
    renk: colors,
    desen: PATTERNS[i.pattern as keyof typeof PATTERNS] ?? i.pattern,
    kumas: MATERIALS[i.material as keyof typeof MATERIALS] ?? i.material,
    resmiyet: i.formality,
    kalinlik: i.warmth,
    stil: i.styles.map((s) => STYLES[s as keyof typeof STYLES] ?? s).join(", ") || undefined,
  };
}

export interface StylistResult {
  candidate: Candidate;
  items: EngineItem[];
  title: string;
  explanation: string;
}

export async function aiStylist(opts: {
  candidates: Candidate[];
  accessories: EngineItem[];
  count: number;
  occasion: Occasion;
  note: string;
  weather: WeatherDTO | null;
  profile: Profile;
}): Promise<StylistResult[]> {
  const { candidates, accessories, count } = opts;
  // Parçalara kısa kod ver (token tasarrufu + yalnızca bu kodlar kullanılabilir)
  const codes = new Map<string, string>(); // id -> kod
  const byCode = new Map<string, EngineItem>();
  const codeOf = (i: EngineItem) => {
    let c = codes.get(i.id);
    if (!c) {
      c = `P${codes.size + 1}`;
      codes.set(i.id, c);
      byCode.set(c, i);
    }
    return c;
  };
  const cands = candidates.map((c, idx) => ({ no: idx + 1, parcalar: c.items.map(codeOf), puan: +c.score.toFixed(2) }));
  accessories.forEach(codeOf);
  const items = [...byCode.entries()].map(([code, i]) => describeItem(code, i));

  const w = opts.weather;
  const p = opts.profile;
  const system = `Sen deneyimli, zevkli ve dürüst bir kişisel stilistsin. Kullanıcının kendi gardırobundaki parçalardan kombin öneriyorsun.
Kurallar:
- SADECE verilen parça kodlarını kullan. Listede olmayan hiçbir parça önerme.
- Kombin adaylarından ("adaylar") ${count} tanesini seç; birbirinden farklı olsunlar.
- "add" ile aksesuar listesinden en fazla 2 aksesuar ekleyebilir, "remove" ile adaydaki aksesuarları çıkarabilirsin. Ana parçaları değiştirme.
- Renk uyumu, resmiyet, hava durumu, etkinlik ve kullanıcının tarzını gözet.
- Başlık kısa ve çekici olsun (en fazla 6 kelime). Açıklama 1-3 cümle, samimi Türkçe, neden işe yaradığını ve küçük bir stil ipucu içersin.
- Yanıtı yalnızca şu JSON biçiminde ver: {"outfits":[{"candidate":<aday no>,"add":["P12"],"remove":[],"title":"...","explanation":"..."}]}`;

  const user = JSON.stringify({
    etkinlik: OCCASIONS[opts.occasion],
    not: opts.note || undefined,
    hava: w
      ? { sicaklik: w.tempC, hissedilen: w.feelsC, durum: w.condition, yagmur: w.isRainy, kar: w.isSnowy }
      : undefined,
    kullanici_tarzi: {
      stiller: p.styles.map((s) => STYLES[s as keyof typeof STYLES] ?? s),
      sevdigi_renkler: p.favoriteColors,
      kacindigi_renkler: p.avoidColors,
      notlar: p.fitNotes || undefined,
    },
    parcalar: items,
    adaylar: cands,
    aksesuarlar: accessories.map(codeOf),
  });

  const res = await chatJson({ system, user, schema: responseSchema, maxTokens: 1800, temperature: 0.6 });

  const out: StylistResult[] = [];
  const used = new Set<number>();
  for (const o of res.outfits) {
    const cand = candidates[o.candidate - 1];
    if (!cand || used.has(o.candidate)) continue;
    used.add(o.candidate);
    let items = [...cand.items];
    for (const code of o.remove) {
      const it = byCode.get(code);
      if (it && it.category === "accessory") items = items.filter((x) => x.id !== it.id);
    }
    for (const code of o.add.slice(0, 2)) {
      const it = byCode.get(code);
      if (it && it.category === "accessory" && !items.includes(it)) items.push(it);
    }
    out.push({ candidate: cand, items, title: o.title.trim(), explanation: o.explanation.trim() });
    if (out.length >= count) break;
  }
  return out;
}
