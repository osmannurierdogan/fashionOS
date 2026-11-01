import nodemailer from "nodemailer";
import { config } from "../config.js";

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

/** E-posta gönderir. SMTP_URL yoksa e-postayı log'a yazar (geliştirme). */
export async function sendMail(to: string, subject: string, html: string, log?: (m: string) => void) {
  if (!config.mail.smtpUrl) {
    (log ?? console.log)(`[mail] ${to} | ${subject}\n${html.replace(/<[^>]+>/g, " ")}`);
    return;
  }
  transport ??= nodemailer.createTransport(config.mail.smtpUrl);
  await transport.sendMail({ from: config.mail.from, to, subject, html });
}

export const emailLayout = (title: string, body: string, cta?: { label: string; url: string }) => `
<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1c1917">
  <h2 style="margin:0 0 12px">fashionOS</h2>
  <h3 style="margin:0 0 12px">${title}</h3>
  <p style="line-height:1.5">${body}</p>
  ${cta ? `<p><a href="${cta.url}" style="display:inline-block;background:#1c1917;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${cta.label}</a></p><p style="font-size:12px;color:#78716c">Buton çalışmazsa: ${cta.url}</p>` : ""}
</div>`;
