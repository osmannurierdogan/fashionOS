import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { DEFAULT_PROFILE } from "@fashionos/shared";

const profileSchema = new Schema(
  {
    gender: { type: String, default: DEFAULT_PROFILE.gender },
    styles: { type: [String], default: () => [...DEFAULT_PROFILE.styles] },
    favoriteColors: { type: [String], default: () => [...DEFAULT_PROFILE.favoriteColors] },
    avoidColors: { type: [String], default: () => [...DEFAULT_PROFILE.avoidColors] },
    fitNotes: { type: String, default: DEFAULT_PROFILE.fitNotes },
    city: { type: String, default: DEFAULT_PROFILE.city },
    lat: { type: Number, default: DEFAULT_PROFILE.lat },
    lon: { type: Number, default: DEFAULT_PROFILE.lon },
    runsCold: { type: Boolean, default: DEFAULT_PROFILE.runsCold },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    emailVerified: { type: Boolean, default: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    plan: { type: String, enum: ["free", "pro"], default: "free" },
    planRenewsAt: { type: Date, default: null },
    stripeCustomerId: { type: String, default: null, index: true },
    stripeSubscriptionId: { type: String, default: null },
    profile: { type: profileSchema, default: () => ({}) },
    usage: {
      aiTags: { type: Number, default: 0 },
      aiOutfits: { type: Number, default: 0 },
      periodStart: { type: Date, default: () => new Date() },
    },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };
export const User = mongoose.model("User", userSchema);
