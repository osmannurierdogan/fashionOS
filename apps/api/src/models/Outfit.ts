import mongoose, { Schema, type InferSchemaType } from "mongoose";

const outfitSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    itemIds: [{ type: Schema.Types.ObjectId, ref: "Item" }],
    signature: { type: String, required: true }, // sıralı parça ID'leri — tekrarları bulmak için
    name: { type: String, default: "" },
    occasion: { type: String, default: null },
    source: { type: String, enum: ["ai", "rules", "manual"], default: "manual" },
    explanation: { type: String, default: "" },
    score: { type: Number, default: null },
    rating: { type: Number, enum: [-1, 0, 1], default: 0 },
    saved: { type: Boolean, default: false },
    plannedFor: { type: String, default: null }, // YYYY-MM-DD
    wornCount: { type: Number, default: 0 },
    lastWornAt: { type: Date, default: null },
    weather: {
      tempC: Number,
      feelsC: Number,
      condition: String,
      precipitation: Number,
    },
  },
  { timestamps: true },
);
outfitSchema.index({ userId: 1, signature: 1 }, { unique: true });
outfitSchema.index({ userId: 1, plannedFor: 1 });

export type OutfitDoc = InferSchemaType<typeof outfitSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date };
export const Outfit = mongoose.model("Outfit", outfitSchema);
