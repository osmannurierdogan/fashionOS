import type { FastifyInstance } from "fastify";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@fashionos/shared";
import { config } from "../config.js";
import {
  createSession,
  currentUser,
  destroySession,
  hashPassword,
  requireAuth,
  resolveUser,
  verifyPassword,
} from "../lib/auth.js";
import { hashToken, randomToken } from "../lib/crypto.js";
import { badRequest, HttpError, unauthorized } from "../lib/errors.js";
import { emailLayout, sendMail } from "../lib/mailer.js";
import { userToDTO } from "../lib/serialize.js";
import { parse } from "../lib/validate.js";
import { Session } from "../models/Session.js";
import { Token } from "../models/Token.js";
import { User } from "../models/User.js";

const strict = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

async function issueToken(userId: unknown, kind: "verify_email" | "reset_password", hours: number) {
  await Token.deleteMany({ userId, kind });
  const token = randomToken();
  await Token.create({ userId, kind, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + hours * 3600_000) });
  return token;
}

async function consumeToken(token: string, kind: "verify_email" | "reset_password") {
  const t = await Token.findOneAndDelete({ tokenHash: hashToken(token), kind, expiresAt: { $gt: new Date() } });
  if (!t) throw badRequest("Bağlantı geçersiz veya süresi dolmuş");
  return t;
}

async function sendVerification(user: any, log: (m: string) => void) {
  const token = await issueToken(user._id, "verify_email", 48);
  const url = `${config.appUrl}/verify-email?token=${token}`;
  await sendMail(user.email, "E-postanı doğrula", emailLayout("Hoş geldin " + user.name + "!", "Hesabını etkinleştirmek için e-posta adresini doğrula.", { label: "E-postamı doğrula", url }), log);
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/register", strict, async (req, reply) => {
    const body = parse(registerSchema, req.body);
    if (await User.exists({ email: body.email })) throw new HttpError(409, "Bu e-posta ile kayıtlı bir hesap var", "email_taken");
    const user = await User.create({ email: body.email, name: body.name, passwordHash: await hashPassword(body.password) });
    await createSession(reply, user._id, req.headers["user-agent"]);
    sendVerification(user, (m) => req.log.info(m)).catch((e) => req.log.error(e));
    return reply.status(201).send({ user: await userToDTO(user) });
  });

  app.post("/login", strict, async (req, reply) => {
    const body = parse(loginSchema, req.body);
    const user = await User.findOne({ email: body.email });
    // Zamanlama saldırılarına karşı kullanıcı yoksa da hash karşılaştır
    const ok = await verifyPassword(body.password, user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinval");
    if (!user || !ok) throw unauthorized("E-posta veya şifre hatalı");
    await createSession(reply, user._id, req.headers["user-agent"]);
    return { user: await userToDTO(user) };
  });

  app.post("/logout", async (req, reply) => {
    await destroySession(req, reply);
    return { ok: true };
  });

  app.post("/logout-all", { preHandler: requireAuth }, async (req, reply) => {
    const user = currentUser(req);
    await Session.deleteMany({ userId: user._id });
    reply.clearCookie("fos_session", { path: "/" });
    return { ok: true };
  });

  app.get("/me", async (req) => {
    const user = await resolveUser(req);
    return { user: user ? await userToDTO(user) : null };
  });

  app.post("/verify-email/send", { preHandler: requireAuth, ...strict }, async (req) => {
    const user = currentUser(req);
    if (user.emailVerified) return { ok: true };
    await sendVerification(user, (m) => req.log.info(m));
    return { ok: true };
  });

  app.post("/verify-email", strict, async (req) => {
    const { token } = req.body as { token?: string };
    if (!token) throw badRequest("Token gerekli");
    const t = await consumeToken(token, "verify_email");
    await User.updateOne({ _id: t.userId }, { emailVerified: true });
    return { ok: true };
  });

  app.post("/forgot-password", strict, async (req) => {
    const { email } = parse(forgotPasswordSchema, req.body);
    const user = await User.findOne({ email });
    // Hesap var mı yok mu belli etme
    if (user) {
      const token = await issueToken(user._id, "reset_password", 1);
      const url = `${config.appUrl}/reset-password?token=${token}`;
      await sendMail(
        user.email,
        "Şifre sıfırlama",
        emailLayout("Şifreni sıfırla", "Şifre sıfırlama talebinde bulundun. Bağlantı 1 saat geçerlidir. Talep sana ait değilse bu e-postayı yok sayabilirsin.", { label: "Yeni şifre belirle", url }),
        (m) => req.log.info(m),
      );
    }
    return { ok: true };
  });

  app.post("/reset-password", strict, async (req, reply) => {
    const body = parse(resetPasswordSchema, req.body);
    const t = await consumeToken(body.token, "reset_password");
    await User.updateOne({ _id: t.userId }, { passwordHash: await hashPassword(body.password), emailVerified: true });
    await Session.deleteMany({ userId: t.userId });
    await createSession(reply, t.userId, req.headers["user-agent"]);
    return { ok: true };
  });

  app.post("/change-password", { preHandler: requireAuth, ...strict }, async (req) => {
    const user = currentUser(req);
    const body = parse(changePasswordSchema, req.body);
    if (!(await verifyPassword(body.currentPassword, user.passwordHash))) throw badRequest("Mevcut şifre hatalı");
    user.passwordHash = await hashPassword(body.newPassword);
    await user.save();
    return { ok: true };
  });
}
