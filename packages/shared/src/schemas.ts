import { z } from "zod";
import { CATEGORIES, CATEGORY_KEYS, MATERIALS, OCCASIONS, PATTERNS, SEASONS, STYLES, LAYERS } from "./taxonomy.js";

const keysOf = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

export const categoryEnum = z.enum(CATEGORY_KEYS as [string, ...string[]]);
export const patternEnum = z.enum(keysOf(PATTERNS));
export const materialEnum = z.enum(keysOf(MATERIALS));
export const seasonEnum = z.enum(keysOf(SEASONS));
export const styleEnum = z.enum(keysOf(STYLES));
export const layerEnum = z.enum(keysOf(LAYERS));
export const occasionEnum = z.enum(keysOf(OCCASIONS));

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Geçersiz renk");

// ---------- Auth ----------
export const registerSchema = z.object({
  name: z.string().trim().min(1, "Ad gerekli").max(80),
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin"),
  password: z.string().min(8, "Şifre en az 8 karakter olmalı").max(200),
});
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});
export const forgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().email() });
export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Şifre en az 8 karakter olmalı").max(200),
});
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Şifre en az 8 karakter olmalı").max(200),
});

// ---------- Profile ----------
export const profileSchema = z.object({
  gender: z.enum(["female", "male", "unisex", "unspecified"]).default("unspecified"),
  styles: z.array(styleEnum).max(11).default([]),
  favoriteColors: z.array(z.string()).max(30).default([]), // palet anahtarları
  avoidColors: z.array(z.string()).max(30).default([]),
  fitNotes: z.string().max(500).default(""),
  city: z.string().max(80).default(""),
  lat: z.number().min(-90).max(90).nullable().default(null),
  lon: z.number().min(-180).max(180).nullable().default(null),
  runsCold: z.boolean().default(false), // "üşüyen biriyim"
});
export type Profile = z.infer<typeof profileSchema>;
export const profileUpdateSchema = profileSchema.partial().extend({ name: z.string().trim().min(1).max(80).optional() });

/** Yeni kullanıcılar için varsayılan stil profili (Profil ekranından değiştirilebilir). */
export const DEFAULT_PROFILE: Profile = {
  gender: "unspecified",
  styles: ["smart_casual", "minimal", "classic"],
  favoriteColors: ["navy", "white", "gray", "black", "beige", "denim", "camel"],
  avoidColors: [],
  fitNotes: "Sade, kaliteli görünen, iş toplantısından akşam yemeğine geçebilen kombinleri severim.",
  city: "İstanbul",
  lat: 41.0082,
  lon: 28.9784,
  runsCold: false,
};

// ---------- Items ----------
export const itemColorSchema = z.object({
  hex,
  name: z.string().max(40).optional(),
  ratio: z.number().min(0).max(1).optional(),
});

export const itemFieldsSchema = z
  .object({
    name: z.string().trim().max(120).default(""),
    category: categoryEnum,
    subcategory: z.string().max(40),
    colors: z.array(itemColorSchema).min(1, "En az bir renk seçin").max(5),
    pattern: patternEnum.default("solid"),
    material: materialEnum.default("cotton"),
    seasons: z.array(seasonEnum).min(1, "En az bir mevsim seçin").default(["spring", "summer", "autumn", "winter"]),
    warmth: z.number().int().min(1).max(5).default(3),
    formality: z.number().int().min(1).max(5).default(2),
    styles: z.array(styleEnum).max(6).default([]),
    layer: layerEnum.default("none"),
    waterproof: z.boolean().default(false),
    brand: z.string().trim().max(80).default(""),
    size: z.string().trim().max(20).default(""),
    price: z.number().min(0).max(10_000_000).nullable().default(null),
    notes: z.string().max(1000).default(""),
    favorite: z.boolean().default(false),
    aiTagged: z.boolean().default(false),
  })
  .refine((v) => Object.keys(CATEGORIES[v.category as keyof typeof CATEGORIES].sub).includes(v.subcategory), {
    message: "Alt kategori kategoriyle uyumlu değil",
    path: ["subcategory"],
  });
export type ItemFields = z.infer<typeof itemFieldsSchema>;

export const itemUpdateSchema = z
  .object({
    name: z.string().trim().max(120),
    category: categoryEnum,
    subcategory: z.string().max(40),
    colors: z.array(itemColorSchema).min(1).max(5),
    pattern: patternEnum,
    material: materialEnum,
    seasons: z.array(seasonEnum).min(1),
    warmth: z.number().int().min(1).max(5),
    formality: z.number().int().min(1).max(5),
    styles: z.array(styleEnum).max(6),
    layer: layerEnum,
    waterproof: z.boolean(),
    brand: z.string().trim().max(80),
    size: z.string().trim().max(20),
    price: z.number().min(0).nullable(),
    notes: z.string().max(1000),
    favorite: z.boolean(),
    archived: z.boolean(),
  })
  .partial();

/** Yapay zekânın fotoğraftan önerdiği etiketler */
export const aiTagSchema = z.object({
  name: z.string().max(120).default(""),
  category: categoryEnum,
  subcategory: z.string(),
  colors: z.array(z.object({ hex, name: z.string().optional() })).min(1).max(4),
  pattern: patternEnum,
  material: materialEnum,
  seasons: z.array(seasonEnum).min(1),
  warmth: z.number().int().min(1).max(5),
  formality: z.number().int().min(1).max(5),
  styles: z.array(styleEnum).max(4),
  layer: layerEnum,
  waterproof: z.boolean().default(false),
});
export type AiTag = z.infer<typeof aiTagSchema>;

// ---------- Outfits ----------
export const suggestRequestSchema = z.object({
  occasion: occasionEnum.default("daily"),
  note: z.string().max(300).default(""),
  mustIncludeItemId: z.string().optional(),
  date: z.string().optional(), // YYYY-MM-DD — takvim/plan için
  useAi: z.boolean().default(true),
  count: z.number().int().min(1).max(5).default(3),
  excludeItemIds: z.array(z.string()).max(100).default([]),
});
export type SuggestRequest = z.infer<typeof suggestRequestSchema>;

export const outfitCreateSchema = z.object({
  itemIds: z.array(z.string()).min(1).max(12),
  name: z.string().max(80).default(""),
  occasion: occasionEnum.optional(),
  source: z.enum(["ai", "rules", "manual"]).default("manual"),
  explanation: z.string().max(1000).default(""),
  score: z.number().optional(),
  weather: z
    .object({ tempC: z.number(), feelsC: z.number(), condition: z.string(), precipitation: z.number() })
    .partial()
    .optional(),
  saved: z.boolean().default(true),
  plannedFor: z.string().nullable().optional(),
});

export const outfitUpdateSchema = z
  .object({
    name: z.string().max(80),
    rating: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
    saved: z.boolean(),
    plannedFor: z.string().nullable(),
  })
  .partial();

export const wearSchema = z.object({
  itemIds: z.array(z.string()).min(1).max(12),
  outfitId: z.string().optional(),
  date: z.string().optional(),
});

export const packingRequestSchema = z.object({
  destination: z.string().max(80).default(""),
  lat: z.number().nullable().default(null),
  lon: z.number().nullable().default(null),
  startDate: z.string(),
  days: z.number().int().min(1).max(30),
  occasions: z.array(occasionEnum).max(6).default(["daily"]),
});

// ---------- Plans ----------
export const PLANS = {
  free: { label: "Ücretsiz", maxItems: 150, aiTagsPerMonth: 60, aiOutfitsPerMonth: 60, priceTry: 0 },
  pro: { label: "Pro", maxItems: 5000, aiTagsPerMonth: 2000, aiOutfitsPerMonth: 1500, priceTry: 99 },
} as const;
export type PlanKey = keyof typeof PLANS;
