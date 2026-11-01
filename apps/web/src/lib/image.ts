import { colorDistance, nearestPaletteColor, rgbToHex } from "@fashionos/shared";

/** Görseli tarayıcıda küçültür (EXIF yönü düzeltilir) → JPEG Blob */
export async function downscale(file: Blob, max = 1600, type = "image/jpeg", quality = 0.9): Promise<Blob> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file; // HEIC vb. desteklenmiyorsa olduğu gibi gönder; sunucu dönüştürür
  }
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return canvas.convertToBlob({ type, quality });
}

let bgModule: Promise<typeof import("@imgly/background-removal")> | null = null;

/** Arka planı tarayıcıda siler (ilk kullanımda model indirilir, sonra önbellekte). */
export async function removeBg(blob: Blob, onProgress?: (pct: number, stage: string) => void): Promise<Blob> {
  bgModule ??= import("@imgly/background-removal");
  const { removeBackground } = await bgModule;
  return removeBackground(blob, {
    model: "isnet_quint8",
    output: { format: "image/png", quality: 0.9 },
    progress: (key: string, current: number, total: number) => {
      const stage = key.startsWith("fetch") ? "Model indiriliyor" : "Arka plan siliniyor";
      onProgress?.(total ? Math.round((current / total) * 100) : 0, stage);
    },
  });
}

/** Model dosyalarını önceden indir (ekleme ekranı açılınca) */
export function preloadBgModel() {
  bgModule ??= import("@imgly/background-removal");
  bgModule.then((m) => m.preload?.({ model: "isnet_quint8" })).catch(() => {});
}

/** Şeffaf olmayan piksellerden baskın renkleri çıkarır (k-means). */
export async function extractColors(blob: Blob, k = 4): Promise<{ hex: string; ratio: number; name: string }[]> {
  const bmp = await createImageBitmap(blob);
  const size = 80;
  const scale = Math.min(1, size / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const { data } = ctx.getImageData(0, 0, w, h);
  const px: [number, number, number][] = [];
  // Opak görselde kenarlardaki arka planı atlamak için merkez bölgeye odaklan
  const opaque = data[3] === 255 && data[data.length - 1] === 255;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3]! < 160) continue;
      if (opaque && (x < w * 0.2 || x > w * 0.8 || y < h * 0.15 || y > h * 0.85)) continue;
      px.push([data[i]!, data[i + 1]!, data[i + 2]!]);
    }
  if (!px.length) return [];
  let centers = Array.from({ length: k }, (_, j) => px[Math.floor(((j + 0.5) / k) * px.length)]!.slice() as [number, number, number]);
  let assign = new Array(px.length).fill(0);
  for (let it = 0; it < 8; it++) {
    assign = px.map((p) => {
      let best = 0, bd = Infinity;
      centers.forEach((c, j) => {
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < bd) { bd = d; best = j; }
      });
      return best;
    });
    centers = centers.map((c, j) => {
      const mem = px.filter((_, i) => assign[i] === j);
      if (!mem.length) return c;
      return [0, 1, 2].map((ch) => mem.reduce((a, m) => a + m[ch]!, 0) / mem.length) as [number, number, number];
    });
  }
  let clusters = centers.map((c, j) => ({ hex: rgbToHex(...c), ratio: assign.filter((a) => a === j).length / px.length }));
  // Birbirine çok yakın kümeleri birleştir
  clusters.sort((a, b) => b.ratio - a.ratio);
  const merged: typeof clusters = [];
  for (const c of clusters) {
    const m = merged.find((x) => colorDistance(x.hex, c.hex) < 14);
    if (m) m.ratio += c.ratio;
    else merged.push({ ...c });
  }
  return merged
    .filter((c) => c.ratio > 0.1)
    .slice(0, 3)
    .map((c) => ({ ...c, ratio: +c.ratio.toFixed(2), name: nearestPaletteColor(c.hex).name }));
}

/**
 * Yedek arka plan silme (model yüklenemezse): düz/tek renk zeminli fotoğraflarda
 * kenarlardan başlayarak zemin rengine benzeyen pikselleri şeffaf yapar (flood fill).
 * Zemin düz değilse null döner.
 */
export async function floodRemoveBg(blob: Blob, tolerance = 34): Promise<Blob | null> {
  const bmp = await createImageBitmap(blob);
  const w = bmp.width, h = bmp.height;
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  // Kenar piksellerinden zemin rengini bul
  const border: number[][] = [];
  const step = Math.max(1, Math.floor((w + h) / 400));
  for (let x = 0; x < w; x += step) border.push([x, 0], [x, h - 1]);
  for (let y = 0; y < h; y += step) border.push([0, y], [w - 1, y]);
  const cols = border.map(([x, y]) => { const i = (y! * w + x!) * 4; return [d[i]!, d[i + 1]!, d[i + 2]!]; });
  const med = [0, 1, 2].map((c) => cols.map((p) => p[c]!).sort((a, b) => a - b)[cols.length >> 1]!);
  const dist = (i: number) => Math.hypot(d[i]! - med[0]!, d[i + 1]! - med[1]!, d[i + 2]! - med[2]!);
  // Kenarların çoğu zemine benzemiyorsa (karışık zemin) vazgeç
  const similar = cols.filter((p) => Math.hypot(p[0]! - med[0]!, p[1]! - med[1]!, p[2]! - med[2]!) < tolerance).length;
  if (similar / cols.length < 0.7) return null;

  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (const [x, y] of border) stack.push(y! * w + x!);
  let removed = 0;
  while (stack.length) {
    const p = stack.pop()!;
    if (seen[p]) continue;
    seen[p] = 1;
    if (dist(p * 4) >= tolerance) continue;
    d[p * 4 + 3] = 0;
    removed++;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
  // Neredeyse her şey silindiyse (parça zeminle aynı renk) güvenme
  if (removed / (w * h) > 0.97 || removed / (w * h) < 0.05) return null;
  // Kenar yumuşatma: şeffaf komşusu olan opak pikselleri yarı saydam yap
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (d[p * 4 + 3] === 0) continue;
      if (d[(p - 1) * 4 + 3] === 0 || d[(p + 1) * 4 + 3] === 0 || d[(p - w) * 4 + 3] === 0 || d[(p + w) * 4 + 3] === 0) d[p * 4 + 3] = 170;
    }
  ctx.putImageData(img, 0, 0);
  return canvas.convertToBlob({ type: "image/png" });
}

/** Önce yapay zekâ modeli, olmazsa düz zemin silme. */
export async function cutout(blob: Blob, onProgress?: (pct: number, stage: string) => void): Promise<Blob | null> {
  try {
    return await removeBg(blob, onProgress);
  } catch {
    onProgress?.(90, "Basit arka plan silme deneniyor");
    return floodRemoveBg(blob).catch(() => null);
  }
}
