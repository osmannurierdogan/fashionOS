/**
 * Abonelik ödemeleri (Stripe). Sağlayıcıya özgü kod bu dosyada toplanır;
 * ileride iyzico / Paddle'a geçmek için sadece burası değişir.
 * Gerekli: STRIPE_SECRET_KEY, STRIPE_PRICE_PRO, STRIPE_WEBHOOK_SECRET
 */
import Stripe from "stripe";
import { config } from "../config.js";
import { User } from "../models/User.js";
import { unavailable } from "./errors.js";

let stripe: Stripe | null = null;
export const billingAvailable = () => Boolean(config.stripe.secretKey && config.stripe.pricePro);

function client() {
  if (!config.stripe.secretKey) throw unavailable("Ödeme sistemi yapılandırılmamış");
  stripe ??= new Stripe(config.stripe.secretKey);
  return stripe;
}

async function ensureCustomer(user: any) {
  if (user.stripeCustomerId) return user.stripeCustomerId as string;
  const c = await client().customers.create({ email: user.email, name: user.name, metadata: { userId: String(user._id) } });
  user.stripeCustomerId = c.id;
  await user.save();
  return c.id;
}

export async function createCheckout(user: any) {
  if (!billingAvailable()) throw unavailable("Ödeme sistemi yapılandırılmamış");
  const customer = await ensureCustomer(user);
  const session = await client().checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: config.stripe.pricePro, quantity: 1 }],
    success_url: `${config.appUrl}/settings/billing?status=success`,
    cancel_url: `${config.appUrl}/settings/billing?status=cancel`,
    client_reference_id: String(user._id),
    allow_promotion_codes: true,
    locale: "tr",
  });
  return session.url!;
}

export async function createPortal(user: any) {
  const customer = await ensureCustomer(user);
  const s = await client().billingPortal.sessions.create({ customer, return_url: `${config.appUrl}/settings/billing` });
  return s.url;
}

export async function cancelSubscription(user: any) {
  if (!user.stripeSubscriptionId || !config.stripe.secretKey) return;
  await client().subscriptions.cancel(user.stripeSubscriptionId);
}

async function syncSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const active = ["active", "trialing", "past_due"].includes(sub.status);
  const periodEnd = (sub as any).current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  await User.updateOne(
    { stripeCustomerId: customerId },
    {
      plan: active ? "pro" : "free",
      stripeSubscriptionId: active ? sub.id : null,
      planRenewsAt: active && periodEnd ? new Date(periodEnd * 1000) : null,
    },
  );
}

/** Stripe webhook: imzayı doğrular ve aboneliği kullanıcıya yansıtır. */
export async function handleWebhook(raw: Buffer, signature: string | undefined) {
  const event = client().webhooks.constructEvent(raw, signature ?? "", config.stripe.webhookSecret);
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.subscription) {
        const sub = await client().subscriptions.retrieve(typeof s.subscription === "string" ? s.subscription : s.subscription.id);
        await syncSubscription(sub);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
  }
  return event.type;
}
