import mongoose, { Schema, type InferSchemaType } from "mongoose";

const itemSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, default: "" },
    category: { type: String, required: true },
    subcategory: { type: String, required: true },
    colors: [{ _id: false, hex: String, name: String, ratio: Number }],
    pattern: { type: String, default: "solid" },
    material: { type: String, default: "cotton" },
    seasons: { type: [String], default: ["spring", "summer", "autumn", "winter"] },
    warmth: { type: Number, default: 3 },
    formality: { type: Number, default: 2 },
    styles: { type: [String], default: [] },
    layer: { type: String, default: "none" },
    waterproof: { type: Boolean, default: false },
    brand: { type: String, default: "" },
    size: { type: String, default: "" },
    price: { type: Number, default: null },
    notes: { type: String, default: "" },
    favorite: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
    aiTagged: { type: Boolean, default: false },
    wearCount: { type: Number, default: 0 },
    lastWornAt: { type: Date, default: null },
    images: {
      main: { type: String, required: true }, // depolama anahtarı (arka plansız veya orijinal)
      thumb: { type: String, required: true },
      original: { type: String, default: null },
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);
itemSchema.index({ userId: 1, category: 1, archived: 1 });
itemSchema.index({ userId: 1, createdAt: -1 });

export type ItemDoc = InferSchemaType<typeof itemSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date; updatedAt: Date };
export const Item = mongoose.model("Item", itemSchema);
