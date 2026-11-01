import type { FastifyInstance } from "fastify";
import { PLANS } from "@fashionos/shared";
import { billingAvailable, createCheckout, createPortal, handleWebhook } from "../lib/billing.js";
import { currentUser, requireAuth } from "../lib/auth.js";
import { badRequest } from "../lib/errors.js";

export async function billingRoutes(app: FastifyInstance) {
  app.get("/plans", async () => ({ plans: PLANS, available: billingAvailable() }));

  app.post("/checkout", { preHandler: requireAuth }, async (req) => ({ url: await createCheckout(currentUser(req)) }));
  app.post("/portal", { preHandler: requireAuth }, async (req) => ({ url: await createPortal(currentUser(req)) }));

  // Webhook ham gövde ister → ayrı kapsamda JSON ayrıştırıcıyı değiştir
  await app.register(async (scope) => {
    scope.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => done(null, body));
    scope.post("/webhook", { config: { rateLimit: false } }, async (req, reply) => {
      try {
        const type = await handleWebhook(req.body as Buffer, req.headers["stripe-signature"] as string | undefined);
        return { received: true, type };
      } catch (e) {
        req.log.warn({ err: e }, "Stripe webhook doğrulanamadı");
        throw badRequest("Webhook doğrulanamadı");
      }
    });
  });
}
