import type { FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { config } from "../config.js";
import { Session } from "../models/Session.js";
import { User } from "../models/User.js";
import { hashToken, randomToken } from "./crypto.js";
import { unauthorized } from "./errors.js";

export const SESSION_COOKIE = "fos_session";

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export async function createSession(reply: FastifyReply, userId: Types.ObjectId | string, userAgent = "") {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + config.sessionDays * 86400_000);
  await Session.create({ userId, tokenHash: hashToken(token), userAgent: userAgent.slice(0, 200), expiresAt });
  reply.setCookie(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
    expires: expiresAt,
  });
}

export async function destroySession(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies[SESSION_COOKIE];
  if (token) await Session.deleteOne({ tokenHash: hashToken(token) });
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

/** İsteği yapan kullanıcıyı çözer; yoksa null. */
export async function resolveUser(req: FastifyRequest) {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) return null;
  const session = await Session.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }).lean();
  if (!session) return null;
  const user = await User.findById(session.userId);
  return user;
}

declare module "fastify" {
  interface FastifyRequest {
    user: Awaited<ReturnType<typeof resolveUser>>;
  }
}

/** Korunan rotalar için preHandler */
export async function requireAuth(req: FastifyRequest) {
  const user = await resolveUser(req);
  if (!user) throw unauthorized();
  req.user = user;
}

/** Kullanıcı nesnesini kesin tipiyle döner (requireAuth sonrası) */
export function currentUser(req: FastifyRequest) {
  if (!req.user) throw unauthorized();
  return req.user;
}
