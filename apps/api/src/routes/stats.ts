import type { FastifyInstance } from "fastify";
import { PALETTE_BY_KEY, nearestPaletteColor, type StatsDTO } from "@fashionos/shared";
import { currentUser, requireAuth } from "../lib/auth.js";
import { itemsToDTO } from "../lib/serialize.js";
import { Item } from "../models/Item.js";
import { WearLog } from "../models/WearLog.js";

/** Gardırop analizi: dağılımlar, hiç giyilmeyenler, giyim başı maliyet, eksikler. */
export async function statsRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: requireAuth }, async (req): Promise<StatsDTO> => {
    const user = currentUser(req);
    const docs = await Item.find({ userId: user._id, archived: false }).lean();
    const byCategory: Record<string, number> = {};
    const colorCount = new Map<string, number>();
    for (const d of docs) {
      byCategory[d.category] = (byCategory[d.category] ?? 0) + 1;
      const c = d.colors?.[0]?.hex;
      if (c) {
        const k = nearestPaletteColor(c).key;
        colorCount.set(k, (colorCount.get(k) ?? 0) + 1);
      }
    }
    const now = Date.now();
    const old = (d: any) => now - new Date(d.createdAt).getTime() > 30 * 86400_000;
    const neverWorn = docs.filter((d) => !d.wearCount && d.category !== "accessory").slice(0, 24);
    const mostWorn = [...docs].filter((d) => d.wearCount).sort((a, b) => b.wearCount - a.wearCount).slice(0, 8);
    const leastWornLongTime = docs
      .filter((d) => d.wearCount && d.lastWornAt && now - new Date(d.lastWornAt).getTime() > 60 * 86400_000)
      .slice(0, 12);
    const withPrice = docs.filter((d) => d.price);
    const costPerWearDocs = withPrice
      .map((d) => ({ d, cpw: d.price! / Math.max(1, d.wearCount) }))
      .sort((a, b) => b.cpw - a.cpw)
      .slice(0, 8);
    const wearsLast30Days = await WearLog.countDocuments({ userId: user._id, date: { $gte: new Date(now - 30 * 86400_000) } });

    // Eksik temel parçalar
    const gaps: string[] = [];
    const has = (f: (d: any) => boolean) => docs.some(f);
    if (!has((d) => d.category === "shoes")) gaps.push("Henüz ayakkabı eklemedin.");
    if (!has((d) => d.category === "outerwear" && d.warmth >= 4)) gaps.push("Kış için kalın bir mont veya kaban yok.");
    if (!has((d) => d.category === "outerwear" && d.waterproof)) gaps.push("Yağmurlu günler için su geçirmez bir dış giyim yok.");
    if (!has((d) => d.formality >= 4 && ["top", "onepiece", "outerwear"].includes(d.category)))
      gaps.push("Resmi davetler / önemli toplantılar için şık bir parça (blazer, takım, elbise) yok.");
    if (!has((d) => d.category === "shoes" && d.formality >= 3)) gaps.push("Smart casual veya şık bir ayakkabı (loafer, klasik, chelsea) yok.");
    if (!has((d) => d.category === "bottom" && d.warmth <= 2) && !has((d) => d.category === "onepiece" && d.warmth <= 2))
      gaps.push("Sıcak günler için ince bir alt (şort, keten pantolon, etek) yok.");
    const neutralTops = docs.filter((d) => d.category === "top" && nearestPaletteColor(d.colors?.[0]?.hex ?? "#888").neutral).length;
    if (docs.filter((d) => d.category === "top").length >= 4 && neutralTops < 2)
      gaps.push("Nötr renkli (beyaz, gri, lacivert, siyah) temel üstler kombin sayını çok artırır.");

    const [neverWornDto, mostWornDto, leastDto, cpwItems] = await Promise.all([
      itemsToDTO(neverWorn.filter(old).length ? neverWorn.filter(old) : neverWorn),
      itemsToDTO(mostWorn),
      itemsToDTO(leastWornLongTime),
      itemsToDTO(costPerWearDocs.map((x) => x.d)),
    ]);
    return {
      totalItems: docs.length,
      byCategory,
      byColor: [...colorCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([key, count]) => ({ key, name: PALETTE_BY_KEY[key]!.name, hex: PALETTE_BY_KEY[key]!.hex, count })),
      neverWorn: neverWornDto,
      mostWorn: mostWornDto,
      leastWornLongTime: leastDto,
      totalValue: withPrice.reduce((a, d) => a + (d.price ?? 0), 0),
      costPerWear: cpwItems.map((item, i) => ({ item, cpw: +costPerWearDocs[i]!.cpw.toFixed(2) })),
      wearsLast30Days,
      gaps,
    };
  });
}
