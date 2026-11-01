import type { FastifyInstance } from "fastify";
import { profileUpdateSchema } from "@fashionos/shared";
import { currentUser, requireAuth } from "../lib/auth.js";
import { userToDTO } from "../lib/serialize.js";
import { parse } from "../lib/validate.js";

export async function profileRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/", async (req) => ({ user: await userToDTO(currentUser(req)) }));

  app.patch("/", async (req) => {
    const user = currentUser(req);
    const { name, ...profile } = parse(profileUpdateSchema, req.body);
    if (name) user.name = name;
    for (const [k, v] of Object.entries(profile)) if (v !== undefined) (user.profile as any)[k] = v;
    user.markModified("profile");
    await user.save();
    return { user: await userToDTO(user) };
  });
}
