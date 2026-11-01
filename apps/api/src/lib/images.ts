import sharp from "sharp";

export interface ProcessedImage {
  main: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
}

/**
 * Yüklenen görseli normalize eder: EXIF yönünü düzeltir, kenarlardaki boş (şeffaf) alanı kırpar,
 * en fazla 1200px'e küçültür ve WebP'ye çevirir (şeffaflık korunur). Ayrıca 400px önizleme üretir.
 */
export async function processImage(input: Buffer, { trim = false } = {}): Promise<ProcessedImage> {
  let img = sharp(input, { failOn: "none" }).rotate();
  if (trim) {
    try {
      const trimmed = await img.clone().trim({ threshold: 5 }).toBuffer();
      img = sharp(trimmed);
    } catch {
      /* kırpılacak alan yoksa olduğu gibi kalır */
    }
  }
  const main = await img
    .clone()
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85, alphaQuality: 90 })
    .toBuffer({ resolveWithObject: true });
  const thumb = await sharp(main.data).resize({ width: 400, height: 400, fit: "inside" }).webp({ quality: 78 }).toBuffer();
  return { main: main.data, thumb, width: main.info.width, height: main.info.height };
}

/** Yapay zekâya gönderilecek küçük JPEG (beyaz zemin) */
export async function toAiJpeg(input: Buffer, size = 768): Promise<Buffer> {
  return sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 82 })
    .toBuffer();
}

/** Görselin baskın renkleri (yapay zekâ yokken yedek) */
export async function dominantColors(input: Buffer, k = 3): Promise<{ hex: string; ratio: number }[]> {
  const { data, info } = await sharp(input, { failOn: "none" })
    .resize(64, 64, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
  let total = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const a = data[i + 3]!;
    if (a < 128) continue;
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const bk = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    bk.r += r; bk.g += g; bk.b += b; bk.n++;
    buckets.set(key, bk);
    total++;
  }
  const hex = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, k)
    .filter((b) => b.n / total > 0.08)
    .map((b) => ({ hex: `#${hex(b.r / b.n)}${hex(b.g / b.n)}${hex(b.b / b.n)}`, ratio: +(b.n / total).toFixed(2) }));
}
