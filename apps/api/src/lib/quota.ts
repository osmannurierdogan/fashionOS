import { PLANS, type PlanKey } from "@fashionos/shared";
import { User } from "../models/User.js";
import { paymentRequired } from "./errors.js";

type Kind = "aiTags" | "aiOutfits";
const limitKey = { aiTags: "aiTagsPerMonth", aiOutfits: "aiOutfitsPerMonth" } as const;

export const planLimits = (plan: string) => PLANS[(plan in PLANS ? plan : "free") as PlanKey];

function samePeriod(start: Date) {
  const now = new Date();
  return start.getUTCFullYear() === now.getUTCFullYear() && start.getUTCMonth() === now.getUTCMonth();
}

/** Aylık sayaç; ay değiştiyse sıfırlanır. Limit aşıldıysa 402 fırlatır. */
export async function consumeQuota(userId: unknown, plan: string, kind: Kind, amount = 1) {
  const limit = planLimits(plan)[limitKey[kind]];
  const user = await User.findById(userId).select("usage");
  if (!user) return;
  if (!user.usage?.periodStart || !samePeriod(user.usage.periodStart)) {
    user.usage = { aiTags: 0, aiOutfits: 0, periodStart: new Date() } as any;
  }
  const used = (user.usage as any)[kind] as number;
  if (used + amount > limit) {
    throw paymentRequired(
      kind === "aiTags"
        ? `Bu ayki yapay zekâ etiketleme hakkınız doldu (${limit}). Pro plana geçebilirsiniz.`
        : `Bu ayki yapay zekâ kombin hakkınız doldu (${limit}). Pro plana geçebilirsiniz.`,
    );
  }
  (user.usage as any)[kind] = used + amount;
  user.markModified("usage");
  await user.save();
}
