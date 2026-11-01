import type { EngineItem } from "../src/engine/outfits.js";

let n = 0;
export function item(p: Partial<EngineItem> & Pick<EngineItem, "category" | "subcategory">): EngineItem {
  return {
    id: p.id ?? `it${++n}`,
    colors: [{ hex: "#1f2a44" }],
    pattern: "solid",
    material: "cotton",
    seasons: ["spring", "summer", "autumn", "winter"],
    warmth: 3,
    formality: 2,
    styles: [],
    layer: "none",
    ...p,
  };
}

export function wardrobe() {
  return {
    whiteTee: item({ id: "whiteTee", category: "top", subcategory: "tshirt", colors: [{ hex: "#f7f7f5" }], warmth: 2, formality: 2, styles: ["casual", "minimal"] }),
    oxford: item({ id: "oxford", category: "top", subcategory: "shirt", colors: [{ hex: "#9cc3e6" }], warmth: 2, formality: 4, styles: ["business", "smart_casual"] }),
    sweater: item({ id: "sweater", category: "top", subcategory: "sweater", colors: [{ hex: "#8a8d91" }], warmth: 4, formality: 3, material: "wool", styles: ["smart_casual"] }),
    hoodie: item({ id: "hoodie", category: "top", subcategory: "hoodie", colors: [{ hex: "#111111" }], warmth: 3, formality: 1, styles: ["sporty", "streetwear"] }),
    floral: item({ id: "floral", category: "top", subcategory: "shirt", colors: [{ hex: "#e2702a" }], pattern: "floral", warmth: 2, formality: 2 }),
    jeans: item({ id: "jeans", category: "bottom", subcategory: "jeans", colors: [{ hex: "#4a6a8f" }], warmth: 3, formality: 2, material: "denim", styles: ["casual"] }),
    chino: item({ id: "chino", category: "bottom", subcategory: "chino", colors: [{ hex: "#d6c3a3" }], warmth: 3, formality: 3, styles: ["smart_casual"] }),
    trousers: item({ id: "trousers", category: "bottom", subcategory: "trousers", colors: [{ hex: "#36454f" }], warmth: 3, formality: 4, styles: ["business"] }),
    joggers: item({ id: "joggers", category: "bottom", subcategory: "joggers", colors: [{ hex: "#8a8d91" }], warmth: 3, formality: 1, styles: ["sporty"] }),
    shorts: item({ id: "shorts", category: "bottom", subcategory: "shorts", colors: [{ hex: "#d6c3a3" }], warmth: 1, formality: 1, seasons: ["summer"] }),
    checkPants: item({ id: "checkPants", category: "bottom", subcategory: "trousers", colors: [{ hex: "#c0282d" }], pattern: "checked", warmth: 3, formality: 3 }),
    sneakers: item({ id: "sneakers", category: "shoes", subcategory: "sneakers", colors: [{ hex: "#f7f7f5" }], formality: 2, styles: ["casual", "sporty"] }),
    loafers: item({ id: "loafers", category: "shoes", subcategory: "loafers", colors: [{ hex: "#6b4426" }], formality: 4, material: "suede" }),
    boots: item({ id: "boots", category: "shoes", subcategory: "chelsea", colors: [{ hex: "#111111" }], formality: 3, material: "leather", waterproof: true }),
    sandals: item({ id: "sandals", category: "shoes", subcategory: "sandals", colors: [{ hex: "#b48a5a" }], formality: 1, seasons: ["summer"] }),
    coat: item({ id: "coat", category: "outerwear", subcategory: "coat", colors: [{ hex: "#b48a5a" }], warmth: 5, formality: 4, material: "wool" }),
    jacket: item({ id: "jacket", category: "outerwear", subcategory: "denim_jacket", colors: [{ hex: "#4a6a8f" }], warmth: 2, formality: 2 }),
    raincoat: item({ id: "raincoat", category: "outerwear", subcategory: "trench", colors: [{ hex: "#d6c3a3" }], warmth: 3, formality: 3, waterproof: true }),
    watch: item({ id: "watch", category: "accessory", subcategory: "watch", colors: [{ hex: "#b8bcc2" }], formality: 3 }),
    belt: item({ id: "belt", category: "accessory", subcategory: "belt", colors: [{ hex: "#6b4426" }], formality: 3 }),
    beanie: item({ id: "beanie", category: "accessory", subcategory: "beanie", colors: [{ hex: "#36454f" }], formality: 1, warmth: 4 }),
    sunglasses: item({ id: "sunglasses", category: "accessory", subcategory: "sunglasses", colors: [{ hex: "#111111" }], formality: 2 }),
  };
}
