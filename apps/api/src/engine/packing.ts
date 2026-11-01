/** Valiz listesi: seyahat günlerinin hava tahminine göre günlük kombin + toplam parça listesi. */
import type { Occasion, Profile, WeatherDTO } from "@fashionos/shared";
import { Item } from "../models/Item.js";
import { itemsToDTO, plainProfile } from "../lib/serialize.js";
import { getForecast } from "../lib/weather.js";
import { describeCandidate } from "./describe.js";
import { generateCandidates, type EngineContext } from "./outfits.js";
import { loadFeedback, toEngineItem } from "./suggest.js";

export async function buildPackingList(opts: {
  user: any;
  lat: number | null;
  lon: number | null;
  startDate: string;
  days: number;
  occasions: Occasion[];
}) {
  const profile = plainProfile(opts.user) as Profile;
  const docs = await Item.find({ userId: opts.user._id, archived: false }).lean();
  const items = docs.map(toEngineItem);
  const fb = await loadFeedback(opts.user._id, items);
  const lat = opts.lat ?? profile.lat;
  const lon = opts.lon ?? profile.lon;

  let forecast: WeatherDTO[] = [];
  if (lat != null && lon != null) {
    try {
      forecast = await getForecast(lat, lon, 16);
    } catch {
      /* tahmin yoksa mevsim varsayılanı kullanılır */
    }
  }

  const packed = new Set<string>();
  const usedTops = new Map<string, number>();
  const days: { date: string; occasion: Occasion; weather: WeatherDTO | null; itemIds: string[]; title: string; explanation: string }[] = [];
  const start = new Date(opts.startDate + "T12:00:00");
  for (let d = 0; d < opts.days; d++) {
    const date = new Date(start.getTime() + d * 86400_000);
    const ds = date.toISOString().slice(0, 10);
    const occasion = opts.occasions[d % opts.occasions.length] ?? "daily";
    const weather = forecast.find((w) => w.date === ds) ?? null;
    // Üstleri en fazla 2 kez, altları sınırsız tekrar et → az parça, çok kombin
    const exclude = [...usedTops.entries()].filter(([, n]) => n >= 2).map(([id]) => id);
    const ctx: EngineContext = {
      occasion,
      weather,
      profile: { ...profile, lat },
      date,
      excludeItemIds: exclude,
      preferItemIds: packed,
      ...fb,
    };
    const { candidates } = generateCandidates(items, ctx, 50);
    const best = candidates[0];
    if (!best) {
      days.push({ date: ds, occasion, weather, itemIds: [], title: "Uygun kombin bulunamadı", explanation: "" });
      continue;
    }
    best.items.forEach((i) => packed.add(i.id));
    best.core.filter((i) => i.category === "top" || i.category === "onepiece").forEach((i) => usedTops.set(i.id, (usedTops.get(i.id) ?? 0) + 1));
    const desc = describeCandidate(best, occasion, weather);
    days.push({ date: ds, occasion, weather, itemIds: best.items.map((i) => i.id), ...desc });
  }
  const packedDocs = docs.filter((d) => packed.has(String(d._id)));
  return { days, items: await itemsToDTO(packedDocs) };
}
