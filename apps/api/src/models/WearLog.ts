import mongoose, { Schema } from "mongoose";

const wearLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    itemIds: [{ type: Schema.Types.ObjectId, ref: "Item" }],
    outfitId: { type: Schema.Types.ObjectId, ref: "Outfit", default: null },
    date: { type: Date, required: true },
  },
  { timestamps: true },
);
wearLogSchema.index({ userId: 1, date: -1 });

export const WearLog = mongoose.model("WearLog", wearLogSchema);
