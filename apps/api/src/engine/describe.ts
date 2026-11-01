import { OCCASIONS, nearestPaletteColor, subcategoryLabel, type Occasion, type WeatherDTO } from "@fashionos/shared";
import type { Candidate, EngineItem } from "./outfits.js";

export const itemShortName = (i: EngineItem) => {
  const color = nearestPaletteColor(i.colors?.[0]?.hex ?? "#808080").name.toLocaleLowerCase("tr");
  return i.name?.trim() || `${color} ${subcategoryLabel(i.category, i.subcategory).toLocaleLowerCase("tr")}`;
};

const cap = (s: string) => s.charAt(0).toLocaleUpperCase("tr") + s.slice(1);

/** Yapay zekâ olmadan kısa başlık + açıklama üretir. */
export function describeCandidate(c: Candidate, occasion: Occasion, weather: Pick<WeatherDTO, "feelsC" | "isRainy" | "condition"> | null) {
  const core = c.core;
  const main = core.filter((i) => ["top", "bottom", "onepiece"].includes(i.category));
  const title = cap(main.map(itemShortName).join(" + "));
  const parts: string[] = [];
  const b = c.breakdown;
  if ((b.color ?? 0) >= 2.2) parts.push("renkler birbiriyle çok uyumlu");
  else if ((b.color ?? 0) >= 1.6) parts.push("dengeli bir renk paleti");
  if ((b.pattern ?? 0) > 0 && core.some((i) => !["solid", "textured"].includes(i.pattern)))
    parts.push("tek desenli parça kombini hareketlendiriyor");
  if ((b.formality ?? 0) >= 2.5) parts.push(`${OCCASIONS[occasion].toLocaleLowerCase("tr")} için doğru resmiyet seviyesinde`);
  if (weather) {
    const outer = core.find((i) => i.category === "outerwear");
    if (outer) parts.push(`${weather.feelsC}°C için ${itemShortName(outer)} ekledim`);
    else parts.push(`${weather.feelsC}°C havaya uygun`);
    if (weather.isRainy) parts.push("yağmura dayanıklı seçimler öne çıktı");
  }
  if ((b.feedback ?? 0) > 0.2) parts.push("daha önce beğendiğin eşleşmeleri içeriyor");
  const acc = c.items.filter((i) => i.category === "accessory");
  if (acc.length) parts.push(`${acc.map(itemShortName).join(", ")} ile tamamlanıyor`);
  return { title, explanation: cap(parts.join("; ")) + "." };
}
