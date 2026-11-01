// Gardırop sözlüğü: tüm kategoriler, desenler, kumaşlar vb.
// Değerler (key) İngilizce ve sabit; etiketler (label) Türkçe arayüz için.

export const CATEGORIES = {
  top: {
    label: "Üst",
    sub: {
      tshirt: "Tişört",
      shirt: "Gömlek",
      polo: "Polo",
      blouse: "Bluz",
      sweater: "Kazak",
      cardigan: "Hırka",
      sweatshirt: "Sweatshirt",
      hoodie: "Kapüşonlu",
      tank: "Atlet / Askılı",
      turtleneck: "Balıkçı Yaka",
      crop: "Crop",
      vest: "Yelek",
      other: "Diğer",
    },
  },
  bottom: {
    label: "Alt",
    sub: {
      jeans: "Jean",
      chino: "Chino",
      trousers: "Kumaş Pantolon",
      joggers: "Eşofman Altı",
      cargo: "Kargo",
      shorts: "Şort",
      skirt: "Etek",
      leggings: "Tayt",
      other: "Diğer",
    },
  },
  onepiece: {
    label: "Elbise / Tulum",
    sub: {
      dress: "Elbise",
      jumpsuit: "Tulum",
      suit: "Takım Elbise",
      other: "Diğer",
    },
  },
  outerwear: {
    label: "Dış Giyim",
    sub: {
      blazer: "Blazer / Ceket",
      jacket: "Mont",
      denim_jacket: "Kot Ceket",
      leather_jacket: "Deri Ceket",
      bomber: "Bomber",
      coat: "Kaban / Palto",
      trench: "Trençkot",
      puffer: "Şişme Mont",
      raincoat: "Yağmurluk",
      overshirt: "Gömlek Ceket",
      other: "Diğer",
    },
  },
  shoes: {
    label: "Ayakkabı",
    sub: {
      sneakers: "Spor Ayakkabı",
      loafers: "Loafer",
      oxford: "Klasik Ayakkabı",
      boots: "Bot",
      chelsea: "Chelsea Bot",
      sandals: "Sandalet",
      heels: "Topuklu",
      flats: "Babet",
      slippers: "Terlik",
      other: "Diğer",
    },
  },
  accessory: {
    label: "Aksesuar",
    sub: {
      bag: "Çanta",
      backpack: "Sırt Çantası",
      belt: "Kemer",
      watch: "Saat",
      jewelry: "Takı",
      bracelet: "Bileklik",
      necklace: "Kolye",
      ring: "Yüzük",
      earrings: "Küpe",
      hat: "Şapka",
      cap: "Kep",
      beanie: "Bere",
      scarf: "Atkı / Şal",
      sunglasses: "Güneş Gözlüğü",
      tie: "Kravat",
      socks: "Çorap",
      gloves: "Eldiven",
      other: "Diğer",
    },
  },
} as const;

export type Category = keyof typeof CATEGORIES;
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];
export const ALL_SUBCATEGORIES = Object.values(CATEGORIES).flatMap((c) => Object.keys(c.sub));

export const PATTERNS = {
  solid: "Düz",
  striped: "Çizgili",
  checked: "Ekose / Kareli",
  dotted: "Puantiyeli",
  floral: "Çiçekli",
  graphic: "Baskılı / Grafik",
  camo: "Kamuflaj",
  animal: "Hayvan Deseni",
  geometric: "Geometrik",
  textured: "Dokulu",
  other: "Diğer",
} as const;
export type Pattern = keyof typeof PATTERNS;

export const MATERIALS = {
  cotton: "Pamuk",
  linen: "Keten",
  wool: "Yün",
  cashmere: "Kaşmir",
  knit: "Triko",
  denim: "Denim",
  leather: "Deri",
  suede: "Süet",
  silk: "İpek",
  polyester: "Polyester",
  nylon: "Naylon",
  viscose: "Viskon",
  fleece: "Polar",
  corduroy: "Kadife",
  canvas: "Kanvas",
  metal: "Metal",
  other: "Diğer",
} as const;
export type Material = keyof typeof MATERIALS;

export const SEASONS = {
  spring: "İlkbahar",
  summer: "Yaz",
  autumn: "Sonbahar",
  winter: "Kış",
} as const;
export type Season = keyof typeof SEASONS;

export const STYLES = {
  casual: "Günlük",
  smart_casual: "Smart Casual",
  business: "İş / Ofis",
  formal: "Resmi",
  sporty: "Spor",
  streetwear: "Sokak",
  minimal: "Minimal",
  classic: "Klasik",
  bohemian: "Bohem",
  vintage: "Vintage",
  outdoor: "Outdoor",
} as const;
export type Style = keyof typeof STYLES;

export const LAYERS = {
  base: "İç katman",
  mid: "Orta katman",
  outer: "Dış katman",
  none: "—",
} as const;
export type Layer = keyof typeof LAYERS;

export const FORMALITY_LABELS = ["", "Çok rahat", "Rahat", "Smart casual", "Şık", "Çok resmi"] as const;
export const WARMTH_LABELS = ["", "Çok ince", "İnce", "Orta", "Kalın", "Çok kalın"] as const;

export const OCCASIONS = {
  daily: "Günlük",
  work: "İş / Ofis",
  meeting: "Önemli Toplantı",
  dinner: "Akşam Yemeği",
  date: "Randevu",
  party: "Parti / Gece",
  wedding: "Düğün / Davet",
  sport: "Spor",
  travel: "Seyahat",
  weekend: "Hafta Sonu",
  home: "Evde",
} as const;
export type Occasion = keyof typeof OCCASIONS;

// Etkinlik → hedef resmiyet aralığı ve uygun stiller
export const OCCASION_RULES: Record<Occasion, { formality: [number, number]; styles: Style[] }> = {
  daily: { formality: [1, 3], styles: ["casual", "smart_casual", "minimal", "streetwear"] },
  work: { formality: [3, 4], styles: ["smart_casual", "business", "classic", "minimal"] },
  meeting: { formality: [4, 5], styles: ["business", "formal", "classic"] },
  dinner: { formality: [3, 4], styles: ["smart_casual", "classic", "minimal"] },
  date: { formality: [2, 4], styles: ["smart_casual", "minimal", "classic", "casual"] },
  party: { formality: [2, 4], styles: ["streetwear", "smart_casual", "minimal"] },
  wedding: { formality: [4, 5], styles: ["formal", "classic", "business"] },
  sport: { formality: [1, 1], styles: ["sporty", "outdoor"] },
  travel: { formality: [1, 3], styles: ["casual", "sporty", "smart_casual", "minimal"] },
  weekend: { formality: [1, 3], styles: ["casual", "streetwear", "minimal", "outdoor"] },
  home: { formality: [1, 1], styles: ["casual", "sporty"] },
};

export const label = <T extends Record<string, string>>(dict: T, key: string | undefined | null) =>
  (key && (dict as Record<string, string>)[key]) || key || "";

export function subcategoryLabel(category: string, sub: string) {
  const c = CATEGORIES[category as Category];
  return (c && (c.sub as Record<string, string>)[sub]) || sub;
}
