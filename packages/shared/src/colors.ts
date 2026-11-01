// Renk paleti ve renk uyumu hesapları.
// Parçalar serbest hex değeri taşır; isimlendirme ve uyum için en yakın palet rengine eşlenir.

export interface PaletteColor {
  key: string;
  name: string;
  hex: string;
  neutral: boolean;
}

export const PALETTE: PaletteColor[] = [
  { key: "black", name: "Siyah", hex: "#111111", neutral: true },
  { key: "charcoal", name: "Antrasit", hex: "#36454f", neutral: true },
  { key: "gray", name: "Gri", hex: "#8a8d91", neutral: true },
  { key: "lightgray", name: "Açık Gri", hex: "#c8c9cc", neutral: true },
  { key: "white", name: "Beyaz", hex: "#f7f7f5", neutral: true },
  { key: "cream", name: "Krem", hex: "#efe6d2", neutral: true },
  { key: "beige", name: "Bej", hex: "#d6c3a3", neutral: true },
  { key: "camel", name: "Camel", hex: "#b48a5a", neutral: true },
  { key: "brown", name: "Kahverengi", hex: "#6b4426", neutral: true },
  { key: "navy", name: "Lacivert", hex: "#1f2a44", neutral: true },
  { key: "denim", name: "Denim Mavi", hex: "#4a6a8f", neutral: true },
  { key: "khaki", name: "Haki", hex: "#7d7a4f", neutral: true },
  { key: "olive", name: "Zeytin Yeşili", hex: "#5b5f2e", neutral: false },
  { key: "green", name: "Yeşil", hex: "#2e7d4f", neutral: false },
  { key: "mint", name: "Mint", hex: "#a8dcc4", neutral: false },
  { key: "teal", name: "Petrol", hex: "#1f6f74", neutral: false },
  { key: "blue", name: "Mavi", hex: "#2f5fb3", neutral: false },
  { key: "lightblue", name: "Açık Mavi", hex: "#9cc3e6", neutral: false },
  { key: "purple", name: "Mor", hex: "#6a3d9a", neutral: false },
  { key: "lilac", name: "Lila", hex: "#c3a6d8", neutral: false },
  { key: "pink", name: "Pembe", hex: "#e89ab5", neutral: false },
  { key: "red", name: "Kırmızı", hex: "#c0282d", neutral: false },
  { key: "burgundy", name: "Bordo", hex: "#6d1a2b", neutral: false },
  { key: "orange", name: "Turuncu", hex: "#e2702a", neutral: false },
  { key: "terracotta", name: "Kiremit", hex: "#b6593a", neutral: false },
  { key: "mustard", name: "Hardal", hex: "#c9a227", neutral: false },
  { key: "yellow", name: "Sarı", hex: "#f2cf3a", neutral: false },
  { key: "gold", name: "Altın", hex: "#c8a85a", neutral: true },
  { key: "silver", name: "Gümüş", hex: "#b8bcc2", neutral: true },
];

export const PALETTE_BY_KEY: Record<string, PaletteColor> = Object.fromEntries(PALETTE.map((c) => [c.key, c]));

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h.padEnd(6, "0");
  const n = parseInt(full.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}

export function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

// sRGB → CIE Lab (algısal uzaklık için)
function rgbToLab([r, g, b]: [number, number, number]): [number, number, number] {
  const f = (c: number) => {
    c /= 255;
    return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
  };
  const R = f(r), G = f(g), B = f(b);
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const g3 = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = g3(x); y = g3(y); z = g3(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

export function colorDistance(a: string, b: string) {
  const A = rgbToLab(hexToRgb(a));
  const B = rgbToLab(hexToRgb(b));
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

const nearestCache = new Map<string, PaletteColor>();
export function nearestPaletteColor(hex: string): PaletteColor {
  const k = hex.toLowerCase();
  const hit = nearestCache.get(k);
  if (hit) return hit;
  const v = nearestUncached(hex);
  if (nearestCache.size > 5000) nearestCache.clear();
  nearestCache.set(k, v);
  return v;
}
function nearestUncached(hex: string): PaletteColor {
  let best = PALETTE[0]!;
  let bestD = Infinity;
  for (const c of PALETTE) {
    const d = colorDistance(hex, c.hex);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

const neutralCache = new Map<string, boolean>();
export function isNeutral(hex: string) {
  const k = hex.toLowerCase();
  const hit = neutralCache.get(k);
  if (hit !== undefined) return hit;
  const [, s, l] = hexToHsl(hex);
  const v = s < 0.18 || l < 0.12 || l > 0.93 ? true : nearestPaletteColor(hex).neutral;
  if (neutralCache.size > 5000) neutralCache.clear();
  neutralCache.set(k, v);
  return v;
}

function hueDiff(a: number, b: number) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * İki rengin uyum puanı: -1 (çatışır) … +1 (çok uyumlu).
 * Nötrler her şeyle uyumlu; ton-sür-ton, analog ve tamamlayıcı ilişkiler ödüllendirilir.
 */
export function pairHarmony(a: string, b: string): number {
  const na = isNeutral(a);
  const nb = isNeutral(b);
  if (na && nb) return 0.6;
  if (na || nb) return 0.7;
  const [ha, sa, la] = hexToHsl(a);
  const [hb, sb, lb] = hexToHsl(b);
  const d = hueDiff(ha, hb);
  if (d < 15) return Math.abs(la - lb) > 0.15 ? 0.8 : 0.5; // ton-sür-ton; aynı ton aynı açıklık biraz monoton
  if (d < 45) return 0.6; // analog
  if (d > 160) return sa > 0.6 && sb > 0.6 ? 0.2 : 0.5; // tamamlayıcı — iki doygun renk riskli
  if (d > 110 && d <= 160) return 0.2; // split / triadik — orta
  return -0.4; // 45–110 arası: çoğu zaman çatışır
}

/** Bir kombindeki ana renklerin toplam uyumu (0..1) */
export function outfitHarmony(hexes: string[]): number {
  const colors = hexes.filter(Boolean);
  if (colors.length < 2) return 0.7;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      sum += pairHarmony(colors[i]!, colors[j]!);
      n++;
    }
  }
  const avg = sum / n; // -1..1
  // Çok fazla doygun (nötr olmayan) renk varsa ceza
  const loud = colors.filter((c) => !isNeutral(c)).length;
  const loudPenalty = loud > 2 ? (loud - 2) * 0.15 : 0;
  return Math.max(0, Math.min(1, (avg + 1) / 2 - loudPenalty));
}
