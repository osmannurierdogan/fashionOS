import { describe, expect, it } from "vitest";
import { outfitHarmony, pairHarmony } from "@fashionos/shared";
import { generateCandidates, itemFit, pickDiverse, signatureOf, type EngineContext } from "../src/engine/outfits.js";
import { describeCandidate } from "../src/engine/describe.js";
import { wardrobe } from "./fixtures.js";

const profile = { styles: ["smart_casual", "minimal"] as any, favoriteColors: ["navy"], avoidColors: [], runsCold: false, lat: 41 };
const ctx = (p: Partial<EngineContext>): EngineContext => ({
  occasion: "daily",
  weather: { feelsC: 18, isRainy: false, isSnowy: false },
  profile,
  date: new Date("2026-10-15T12:00:00"),
  ...p,
});
const all = () => Object.values(wardrobe());
const ids = (c: { items: { id: string }[] }) => c.items.map((i) => i.id);

describe("renk uyumu", () => {
  it("nötrler her şeyle uyumlu, çatışan renkler düşük puan alır", () => {
    expect(pairHarmony("#1f2a44", "#e2702a")).toBeGreaterThan(0.5); // lacivert + turuncu
    expect(pairHarmony("#2e7d4f", "#c0282d")).toBeLessThan(0.5); // yeşil + kırmızı (doygun tamamlayıcı)
    expect(outfitHarmony(["#f7f7f5", "#1f2a44", "#6b4426"])).toBeGreaterThan(outfitHarmony(["#c0282d", "#2e7d4f", "#f2cf3a", "#6a3d9a"]));
  });
});

describe("kombin motoru", () => {
  it("her kombin üst+alt veya tek parça ve ayakkabı içerir", () => {
    const { candidates } = generateCandidates(all(), ctx({}));
    expect(candidates.length).toBeGreaterThan(10);
    for (const c of candidates.slice(0, 30)) {
      const cats = c.core.map((i) => i.category);
      expect(cats).toContain("shoes");
      expect(cats.includes("onepiece") || (cats.includes("top") && cats.includes("bottom"))).toBe(true);
    }
  });

  it("soğuk havada kalın dış giyim zorunlu, şort ve sandalet yok", () => {
    const { candidates } = generateCandidates(all(), ctx({ weather: { feelsC: 2, isRainy: false, isSnowy: false } }));
    for (const c of candidates.slice(0, 20)) {
      expect(c.core.some((i) => i.id === "coat")).toBe(true);
      expect(ids(c)).not.toContain("shorts");
      expect(ids(c)).not.toContain("sandals");
    }
  });

  it("sıcak havada dış giyim eklenmez", () => {
    const { candidates } = generateCandidates(all(), ctx({ weather: { feelsC: 30, isRainy: false, isSnowy: false } }));
    for (const c of candidates.slice(0, 20)) expect(c.core.some((i) => i.category === "outerwear")).toBe(false);
  });

  it("iş toplantısında eşofman / kapüşonlu önerilmez", () => {
    const { candidates } = generateCandidates(all(), ctx({ occasion: "meeting" }));
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect(ids(c)).not.toContain("joggers");
      expect(ids(c)).not.toContain("hoodie");
    }
    expect(candidates[0]!.core.map((i) => i.id)).toContain("trousers");
  });

  it("yağmurda sandalet elenir, su geçirmez bot öne çıkar", () => {
    const w = { feelsC: 14, isRainy: true, isSnowy: false };
    expect(itemFit(wardrobe().sandals, ctx({ weather: w }))).toBeNull();
    const { candidates } = generateCandidates(all(), ctx({ weather: w }));
    const top5Shoes = candidates.slice(0, 5).map((c) => c.core.find((i) => i.category === "shoes")!.id);
    expect(top5Shoes).toContain("boots");
  });

  it("zorunlu parça her adayda bulunur", () => {
    const { candidates } = generateCandidates(all(), ctx({ mustIncludeItemId: "floral" }));
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) expect(ids(c)).toContain("floral");
  });

  it("iki desenli parça cezalandırılır", () => {
    const { candidates } = generateCandidates(all(), ctx({}));
    const both = candidates.find((c) => ids(c).includes("floral") && ids(c).includes("checkPants"));
    const best = candidates[0]!;
    if (both) expect(both.score).toBeLessThan(best.score);
    if (both) expect(both.breakdown.pattern).toBeLessThan(0);
  });

  it("beğenilmeyen kombin tekrar önerilmez, beğenilen ikili yukarı çıkar", () => {
    const base = generateCandidates(all(), ctx({}));
    const top = base.candidates[0]!;
    const disliked = new Set([top.signature]);
    const after = generateCandidates(all(), ctx({ dislikedSignatures: disliked }));
    expect(after.candidates.some((c) => c.signature === top.signature)).toBe(false);

    const pair = new Map([["chino|whiteTee", 3]]);
    const boosted = generateCandidates(all(), ctx({ pairFeedback: pair }));
    expect(ids(boosted.candidates[0]!)).toEqual(expect.arrayContaining(["whiteTee", "chino"]));
  });

  it("soğukta katmanlı kombinler üretir ve aksesuar ekler", () => {
    const { candidates } = generateCandidates(all(), ctx({ weather: { feelsC: 3, isRainy: false, isSnowy: false } }));
    expect(candidates.some((c) => c.core.filter((i) => i.category === "top").length === 2)).toBe(true);
    expect(candidates.slice(0, 10).some((c) => c.items.some((i) => i.id === "beanie"))).toBe(true);
  });

  it("eksik kategorileri bildirir", () => {
    const w = wardrobe();
    const { missing } = generateCandidates([w.whiteTee, w.jeans], ctx({ weather: { feelsC: 5, isRainy: false, isSnowy: false } }));
    expect(missing).toEqual(expect.arrayContaining(["shoes", "outerwear"]));
  });

  it("çeşitli seçim aynı üst+altı tekrarlamaz ve açıklama üretir", () => {
    const { candidates } = generateCandidates(all(), ctx({}));
    const picked = pickDiverse(candidates, 3);
    expect(picked).toHaveLength(3);
    const bodies = picked.map((c) => signatureOf(c.core.filter((i) => i.category !== "shoes" && i.category !== "outerwear").map((i) => i.id)));
    expect(new Set(bodies).size).toBe(3);
    const d = describeCandidate(picked[0]!, "daily", { feelsC: 18, isRainy: false, condition: "Açık" });
    expect(d.title.length).toBeGreaterThan(3);
    expect(d.explanation).toMatch(/\.$/);
  });

  it("büyük gardıropta hızlı çalışır", () => {
    const many = Array.from({ length: 6 }, (_, k) => all().map((i) => ({ ...i, id: i.id + k }))).flat();
    const t = performance.now();
    const { candidates } = generateCandidates(many, ctx({ weather: { feelsC: 10, isRainy: false, isSnowy: false } }));
    expect(candidates.length).toBeGreaterThan(0);
    expect(performance.now() - t).toBeLessThan(3000);
  });
});
