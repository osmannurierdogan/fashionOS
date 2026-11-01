/** Fotoğraftan parça etiketleme (Qwen görsel model). */
import {
  CATEGORIES,
  LAYERS,
  MATERIALS,
  PATTERNS,
  SEASONS,
  STYLES,
  aiTagSchema,
  type AiTag,
} from "@fashionos/shared";
import { config } from "../config.js";
import { chatJson, imagePart } from "../lib/ai.js";

const list = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `${k} (${v})`).join(", ");

const categoryText = Object.entries(CATEGORIES)
  .map(([k, c]) => `- ${k} (${c.label}): ${Object.keys(c.sub).join(", ")}`)
  .join("\n");

const SYSTEM = `Sen bir moda uzmanısın. Fotoğraftaki TEK giysi veya aksesuarı analiz edip etiketliyorsun.
Sadece aşağıdaki anahtar değerlerini kullan (parantez içleri açıklamadır, değer olarak anahtarı yaz).

category ve subcategory:
${categoryText}

pattern: ${list(PATTERNS)}
material: ${list(MATERIALS)}
seasons (1-4 adet): ${list(SEASONS)}
styles (0-4 adet): ${list(STYLES)}
layer: ${list(LAYERS)}  (tişört/gömlek=base, kazak/hırka/sweatshirt=mid, mont/ceket/kaban=outer, alt/ayakkabı/aksesuar=none)
warmth: 1-5 (1 çok ince yazlık, 3 orta, 5 çok kalın kışlık)
formality: 1-5 (1 eşofman/çok rahat, 2 günlük, 3 smart casual, 4 şık/iş, 5 takım/gece)
colors: parçanın gerçek renkleri, en baskın renk ilk sırada, 1-3 adet, #rrggbb hex ve Türkçe ad. Arka planı ve mankeni yok say.
name: kısa Türkçe ürün adı (ör. "Lacivert keten gömlek"). Marka logosu net görünüyorsa adı içerebilir.
waterproof: su geçirmez mi (true/false)

Yalnızca JSON döndür:
{"name":"","category":"","subcategory":"","colors":[{"hex":"#","name":""}],"pattern":"","material":"","seasons":[],"warmth":3,"formality":2,"styles":[],"layer":"none","waterproof":false}`;

export async function tagImage(jpeg: Buffer): Promise<AiTag> {
  const tag = await chatJson({
    model: config.ai.visionModel,
    system: SYSTEM,
    user: [imagePart(jpeg), { type: "text", text: "Bu parçayı etiketle." }],
    schema: aiTagSchema,
    maxTokens: 700,
    temperature: 0.1,
  });
  // Alt kategori kategoriyle uyumsuzsa "other"a düşür
  const subs = Object.keys(CATEGORIES[tag.category as keyof typeof CATEGORIES].sub);
  if (!subs.includes(tag.subcategory)) tag.subcategory = "other";
  tag.colors = tag.colors.map((c) => ({ ...c, hex: c.hex.toLowerCase() }));
  return tag;
}
