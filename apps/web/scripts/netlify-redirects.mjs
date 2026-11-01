// Netlify derlemesinde çalışır: /api/* isteklerini Railway API'sine proxy'ler
// (aynı alan adı → oturum çerezleri iOS Safari dahil sorunsuz çalışır).
import { writeFileSync } from "node:fs";

const api = (process.env.API_ORIGIN ?? "").replace(/\/$/, "");
if (!api) {
  console.error("HATA: Netlify ortam değişkenlerinde API_ORIGIN tanımlı değil (ör. https://fashionos-api.up.railway.app)");
  process.exit(1);
}
const rules = [`/api/*  ${api}/api/:splat  200!`, `/*  /index.html  200`].join("\n") + "\n";
writeFileSync(new URL("../dist/_redirects", import.meta.url), rules);
console.log("_redirects yazıldı →", api);
