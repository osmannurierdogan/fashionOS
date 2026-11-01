import { CATEGORIES, FORMALITY_LABELS, LAYERS, MATERIALS, PATTERNS, SEASONS, STYLES, WARMTH_LABELS, type Category, type ItemColor } from "@fashionos/shared";
import { ColorEditor } from "./ColorEditor";
import { Chips, Field, Scale } from "./ui";

export interface ItemFormValue {
  name: string;
  category: Category;
  subcategory: string;
  colors: ItemColor[];
  pattern: string;
  material: string;
  seasons: string[];
  warmth: number;
  formality: number;
  styles: string[];
  layer: string;
  waterproof: boolean;
  brand: string;
  size: string;
  price: number | null;
  notes: string;
  favorite: boolean;
}

export const emptyItem = (): ItemFormValue => ({
  name: "",
  category: "top",
  subcategory: "tshirt",
  colors: [],
  pattern: "solid",
  material: "cotton",
  seasons: ["spring", "summer", "autumn", "winter"],
  warmth: 3,
  formality: 2,
  styles: [],
  layer: "base",
  waterproof: false,
  brand: "",
  size: "",
  price: null,
  notes: "",
  favorite: false,
});

const defaultLayer = (cat: string, sub: string) =>
  cat === "outerwear" ? "outer" : cat === "top" ? (["sweater", "cardigan", "sweatshirt", "hoodie", "vest"].includes(sub) ? "mid" : "base") : "none";

export function ItemForm({ value, onChange }: { value: ItemFormValue; onChange: (v: ItemFormValue) => void }) {
  const set = <K extends keyof ItemFormValue>(k: K, v: ItemFormValue[K]) => onChange({ ...value, [k]: v });
  const subs = CATEGORIES[value.category].sub as Record<string, string>;
  return (
    <div className="space-y-5">
      <Field label="Ad (isteğe bağlı)">
        <input className="input" value={value.name} onChange={(e) => set("name", e.target.value)} placeholder="ör. Lacivert keten gömlek" />
      </Field>
      <div>
        <span className="label">Kategori</span>
        <Chips
          options={Object.fromEntries(Object.entries(CATEGORIES).map(([k, c]) => [k, c.label])) as Record<Category, string>}
          value={value.category}
          onChange={(c: Category) => {
            const sub = Object.keys(CATEGORIES[c].sub)[0]!;
            onChange({ ...value, category: c, subcategory: sub, layer: defaultLayer(c, sub) });
          }}
        />
      </div>
      <div>
        <span className="label">Tür</span>
        <Chips options={subs} value={value.subcategory} onChange={(s: string) => onChange({ ...value, subcategory: s, layer: defaultLayer(value.category, s) })} />
      </div>
      <div>
        <span className="label">Renkler</span>
        <ColorEditor value={value.colors} onChange={(c) => set("colors", c)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Desen">
          <select className="input" value={value.pattern} onChange={(e) => set("pattern", e.target.value)}>
            {Object.entries(PATTERNS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Kumaş">
          <select className="input" value={value.material} onChange={(e) => set("material", e.target.value)}>
            {Object.entries(MATERIALS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
      </div>
      <div>
        <span className="label">Mevsim</span>
        <Chips multi options={SEASONS} value={value.seasons} onChange={(v: string[]) => set("seasons", v)} />
      </div>
      <div>
        <span className="label">Kalınlık / sıcak tutma</span>
        <Scale value={value.warmth} onChange={(n) => set("warmth", n)} labels={WARMTH_LABELS} />
      </div>
      <div>
        <span className="label">Resmiyet</span>
        <Scale value={value.formality} onChange={(n) => set("formality", n)} labels={FORMALITY_LABELS} />
      </div>
      <div>
        <span className="label">Stil</span>
        <Chips multi options={STYLES} value={value.styles} onChange={(v: string[]) => set("styles", v.slice(0, 6))} />
      </div>
      {(value.category === "top" || value.category === "outerwear") && (
        <div>
          <span className="label">Katman</span>
          <Chips options={LAYERS} value={value.layer} onChange={(v: string) => set("layer", v)} />
        </div>
      )}
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={value.waterproof} onChange={(e) => set("waterproof", e.target.checked)} className="h-4 w-4 accent-ink" />
        Su geçirmez / yağmura dayanıklı
      </label>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Marka">
          <input className="input" value={value.brand} onChange={(e) => set("brand", e.target.value)} />
        </Field>
        <Field label="Beden">
          <input className="input" value={value.size} onChange={(e) => set("size", e.target.value)} />
        </Field>
        <Field label="Fiyat (₺)">
          <input
            className="input"
            inputMode="decimal"
            value={value.price ?? ""}
            onChange={(e) => {
              const n = parseFloat(e.target.value.replace(",", "."));
              set("price", Number.isFinite(n) ? n : null);
            }}
          />
        </Field>
      </div>
      <Field label="Notlar">
        <textarea className="input min-h-20" value={value.notes} onChange={(e) => set("notes", e.target.value)} placeholder="ör. Ütü ister, dar kesim" />
      </Field>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={value.favorite} onChange={(e) => set("favorite", e.target.checked)} className="h-4 w-4 accent-ink" />
        Favorilerime ekle
      </label>
    </div>
  );
}
