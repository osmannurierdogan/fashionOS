import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import mongoose from "mongoose";
import sharp from "sharp";
import { buildApp } from "../src/app.js";
import { config } from "../src/config.js";
import { connectDb } from "../src/db.js";

let app: FastifyInstance;
let fakeAi: FastifyInstance;
const aiCalls: any[] = [];

async function png(color: string, w = 300, h = 400) {
  return sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp({ create: { width: w - 100, height: h - 100, channels: 4, background: color } }).png().toBuffer(), top: 50, left: 50 }])
    .png()
    .toBuffer();
}

function multipart(fields: Record<string, string>, files: Record<string, Buffer>) {
  const boundary = "----fos" + Math.random().toString(16).slice(2);
  const chunks: Buffer[] = [];
  for (const [k, v] of Object.entries(fields))
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  for (const [k, v] of Object.entries(files)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"; filename="${k}.png"\r\nContent-Type: image/png\r\n\r\n`));
    chunks.push(v, Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(chunks), headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}

class Client {
  cookie = "";
  async req(method: string, url: string, body?: unknown, extra?: { payload: Buffer; headers: Record<string, string> }) {
    const res = await app.inject({
      method: method as any,
      url,
      headers: { ...(this.cookie ? { cookie: this.cookie } : {}), ...(extra?.headers ?? {}) },
      ...(extra ? { payload: extra.payload } : body !== undefined ? { payload: body as any } : {}),
    });
    const set = res.headers["set-cookie"];
    const c = (Array.isArray(set) ? set : set ? [set] : []).find((x) => x.startsWith("fos_session="));
    if (c) this.cookie = c.split(";")[0]!;
    let json: any = null;
    try {
      json = res.json();
    } catch {
      /* binary */
    }
    return { status: res.statusCode, json, raw: res };
  }
  async addItem(data: Record<string, unknown>, color = "#1f2a44") {
    const r = await this.req("POST", "/api/items", undefined, multipart({ data: JSON.stringify(data), cutout: "true" }, { image: await png(color) }));
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    return r.json.item;
  }
}

beforeAll(async () => {
  // Sahte OpenAI uyumlu sunucu (Qwen yerine)
  fakeAi = Fastify({ bodyLimit: 20 * 1024 * 1024 });
  fakeAi.post("/v1/chat/completions", async (req) => {
    const body = req.body as any;
    aiCalls.push(body);
    const user = body.messages.find((m: any) => m.role === "user").content;
    let content: string;
    if (Array.isArray(user)) {
      // Görsel etiketleme — düşünme bloğu + kod çiti ile (ayıklama testi)
      content =
        "<think>lacivert bir gömlek görüyorum</think>\n```json\n" +
        JSON.stringify({
          name: "Lacivert keten gömlek",
          category: "top",
          subcategory: "shirt",
          colors: [{ hex: "#1F2A44", name: "Lacivert" }],
          pattern: "solid",
          material: "linen",
          seasons: ["spring", "summer"],
          warmth: 2,
          formality: 3,
          styles: ["smart_casual"],
          layer: "base",
          waterproof: false,
        }) +
        "\n```";
    } else {
      const ctx = JSON.parse(user);
      const acc = ctx.aksesuarlar[0];
      content = JSON.stringify({
        outfits: [
          { candidate: 1, add: acc ? [acc] : [], remove: [], title: "Sade ve şık", explanation: "Nötr tonlar birbirini tamamlıyor." },
          { candidate: 999, add: ["P999"], remove: [], title: "Geçersiz", explanation: "Olmayan aday" },
          { candidate: 2, add: ["UYDURMA"], remove: [], title: "Rahat gün", explanation: "Hafif ve rahat." },
        ],
      });
    }
    return { id: "x", object: "chat.completion", created: 0, model: body.model, choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] };
  });
  await fakeAi.listen({ port: 4999, host: "127.0.0.1" });

  await connectDb();
  await mongoose.connection.dropDatabase();
  app = await buildApp({ logger: process.env.TEST_LOG === "1" });
  await app.ready();
});

afterAll(async () => {
  await app?.close();
  await fakeAi?.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe("API", () => {
  const a = new Client();
  const b = new Client();
  const items: Record<string, any> = {};

  it("sağlık kontrolü", async () => {
    const r = await a.req("GET", "/api/health");
    expect(r.json).toMatchObject({ ok: true, db: true, storage: "local" });
  });

  it("kayıt, oturum, varsayılan stil profili", async () => {
    let r = await a.req("POST", "/api/auth/register", { name: "Osman", email: "osman@test.com", password: "kısa" });
    expect(r.status).toBe(400);
    r = await a.req("POST", "/api/auth/register", { name: "Osman", email: "Osman@Test.com", password: "gizli-sifre-123" });
    expect(r.status).toBe(201);
    expect(r.json.user.email).toBe("osman@test.com");
    expect(r.json.user.profile.styles).toContain("smart_casual");
    expect(r.json.user.plan).toBe("free");
    r = await a.req("POST", "/api/auth/register", { name: "X", email: "osman@test.com", password: "gizli-sifre-123" });
    expect(r.status).toBe(409);
    r = await a.req("GET", "/api/auth/me");
    expect(r.json.user.name).toBe("Osman");

    await b.req("POST", "/api/auth/register", { name: "Başka", email: "b@test.com", password: "baska-sifre-123" });
  });

  it("giriş / çıkış", async () => {
    const c = new Client();
    let r = await c.req("POST", "/api/auth/login", { email: "osman@test.com", password: "yanlis-sifre" });
    expect(r.status).toBe(401);
    r = await c.req("POST", "/api/auth/login", { email: "osman@test.com", password: "gizli-sifre-123" });
    expect(r.status).toBe(200);
    r = await c.req("POST", "/api/auth/logout");
    c.cookie = c.cookie; // çerez temizlendi ama oturum DB'den silindi
    r = await c.req("GET", "/api/items");
    expect(r.status).toBe(401);
  });

  it("profil güncelleme", async () => {
    const r = await a.req("PATCH", "/api/profile", { name: "Osman N.", runsCold: true, avoidColors: ["yellow"] });
    expect(r.status).toBe(200);
    expect(r.json.user.name).toBe("Osman N.");
    expect(r.json.user.profile.runsCold).toBe(true);
    expect(r.json.user.profile.favoriteColors).toContain("navy"); // diğer alanlar korunur
  });

  it("parça ekleme (fotoğraf + bilgiler), doğrulama hataları", async () => {
    const bad = await a.req("POST", "/api/items", undefined, multipart({ data: JSON.stringify({ category: "top", subcategory: "jeans", colors: [{ hex: "#000000" }] }) }, { image: await png("#000") }));
    expect(bad.status).toBe(400);

    items.tee = await a.addItem({ category: "top", subcategory: "tshirt", colors: [{ hex: "#F7F7F5" }], warmth: 2, formality: 2 }, "#f7f7f5");
    items.shirt = await a.addItem({ name: "Mavi oxford", category: "top", subcategory: "shirt", colors: [{ hex: "#9cc3e6" }], warmth: 2, formality: 3, favorite: true }, "#9cc3e6");
    items.sweater = await a.addItem({ category: "top", subcategory: "sweater", colors: [{ hex: "#8a8d91" }], warmth: 4, formality: 3 }, "#8a8d91");
    items.jeans = await a.addItem({ category: "bottom", subcategory: "jeans", colors: [{ hex: "#4a6a8f" }], formality: 2, brand: "Levi's", price: 1500 }, "#4a6a8f");
    items.chino = await a.addItem({ category: "bottom", subcategory: "chino", colors: [{ hex: "#d6c3a3" }], formality: 3 }, "#d6c3a3");
    items.sneakers = await a.addItem({ category: "shoes", subcategory: "sneakers", colors: [{ hex: "#f7f7f5" }], formality: 2 }, "#f7f7f5");
    items.boots = await a.addItem({ category: "shoes", subcategory: "chelsea", colors: [{ hex: "#111111" }], formality: 3, waterproof: true }, "#111111");
    items.coat = await a.addItem({ category: "outerwear", subcategory: "coat", colors: [{ hex: "#b48a5a" }], warmth: 4, formality: 4 }, "#b48a5a");
    items.jacket = await a.addItem({ category: "outerwear", subcategory: "denim_jacket", colors: [{ hex: "#4a6a8f" }], warmth: 2, formality: 2 }, "#4a6a8f");
    items.watch = await a.addItem({ category: "accessory", subcategory: "watch", colors: [{ hex: "#b8bcc2" }], formality: 3 }, "#b8bcc2");
    items.belt = await a.addItem({ category: "accessory", subcategory: "belt", colors: [{ hex: "#6b4426" }], formality: 3 }, "#6b4426");

    expect(items.tee.colors[0]).toMatchObject({ hex: "#f7f7f5", name: "Beyaz" });
    expect(items.tee.image.url).toMatch(/^\/api\/files\/users\//);
    expect(items.jeans.price).toBe(1500);
  });

  it("görseller işlenir ve sadece sahibine sunulur", async () => {
    const r = await a.req("GET", items.tee.image.url);
    expect(r.status).toBe(200);
    expect(r.raw.headers["content-type"]).toBe("image/webp");
    const meta = await sharp(r.raw.rawPayload).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(200); // boş kenarlar kırpıldı (300 → 200)
    const thumb = await a.req("GET", items.tee.image.thumbUrl);
    expect(thumb.status).toBe(200);

    expect((await b.req("GET", items.tee.image.url)).status).toBe(403);
    expect((await new Client().req("GET", items.tee.image.url)).status).toBe(401);
    expect((await a.req("GET", "/api/files/../../etc/passwd")).status).toBeGreaterThanOrEqual(400);
  });

  it("kullanıcılar birbirinin verisini göremez", async () => {
    expect((await b.req("GET", "/api/items")).json.items).toHaveLength(0);
    expect((await b.req("GET", `/api/items/${items.tee.id}`)).status).toBe(404);
    expect((await b.req("PATCH", `/api/items/${items.tee.id}`, { favorite: true })).status).toBe(404);
    expect((await b.req("DELETE", `/api/items/${items.tee.id}`)).status).toBe(404);
    expect((await b.req("POST", "/api/outfits", { itemIds: [items.tee.id, items.jeans.id] })).status).toBe(400);
    expect((await b.req("POST", "/api/wear", { itemIds: [items.tee.id] })).status).toBe(400);
  });

  it("listeleme ve filtreler", async () => {
    expect((await a.req("GET", "/api/items")).json.items).toHaveLength(11);
    expect((await a.req("GET", "/api/items?category=top")).json.items).toHaveLength(3);
    expect((await a.req("GET", "/api/items?favorite=true")).json.items.map((i: any) => i.id)).toEqual([items.shirt.id]);
    expect((await a.req("GET", "/api/items?q=levi")).json.items).toHaveLength(1);
    const navyish = (await a.req("GET", "/api/items?color=denim")).json.items.map((i: any) => i.id);
    expect(navyish).toEqual(expect.arrayContaining([items.jeans.id, items.jacket.id]));
  });

  it("parça güncelleme", async () => {
    const r = await a.req("PATCH", `/api/items/${items.chino.id}`, { notes: "Ütü ister", formality: 4 });
    expect(r.json.item).toMatchObject({ notes: "Ütü ister", formality: 4 });
  });

  it("kombin önerisi (kural motoru, yapay zekâ kapalı)", async () => {
    const r = await a.req("POST", "/api/outfits/suggest", { occasion: "daily", useAi: true });
    expect(r.status).toBe(200);
    expect(r.json.aiUsed).toBe(false);
    expect(r.json.suggestions.length).toBeGreaterThanOrEqual(2);
    for (const s of r.json.suggestions) {
      const cats = s.items.map((i: any) => i.category);
      expect(cats).toContain("top");
      expect(cats).toContain("bottom");
      expect(cats).toContain("shoes");
      expect(s.source).toBe("rules");
      expect(s.explanation.length).toBeGreaterThan(5);
    }
    const must = await a.req("POST", "/api/outfits/suggest", { occasion: "daily", mustIncludeItemId: items.sweater.id });
    for (const s of must.json.suggestions) expect(s.itemIds).toContain(items.sweater.id);
  });

  it("yapay zekâ etiketleme ve stilist (Qwen uyumlu sahte sunucu)", async () => {
    config.ai.enabled = true;
    config.ai.apiKey = "test";
    try {
      let r = await a.req("POST", "/api/ai/tag", undefined, multipart({}, { image: await png("#1f2a44") }));
      expect(r.status).toBe(200);
      expect(r.json.ai).toBe(true);
      expect(r.json.tag).toMatchObject({ category: "top", subcategory: "shirt", material: "linen" });
      expect(r.json.tag.colors[0].hex).toBe("#1f2a44");
      expect(r.json.colors.length).toBeGreaterThan(0);
      const visionCall = aiCalls.at(-1);
      expect(visionCall.model).toBe(config.ai.visionModel);
      expect(visionCall.messages[1].content[0].image_url.url).toMatch(/^data:image\/jpeg;base64,/);

      r = await a.req("POST", "/api/outfits/suggest", { occasion: "work", count: 3 });
      expect(r.status).toBe(200);
      expect(r.json.aiUsed).toBe(true);
      const ai = r.json.suggestions.filter((s: any) => s.source === "ai");
      expect(ai.map((s: any) => s.title)).toEqual(["Sade ve şık", "Rahat gün"]); // geçersiz aday atlandı
      expect(ai[0].items.some((i: any) => i.category === "accessory")).toBe(true);
      // Uydurma parça eklenmedi: tüm parçalar kullanıcının gardırobunda
      const owned = new Set(Object.values(items).map((i: any) => i.id));
      for (const s of r.json.suggestions) for (const id of s.itemIds) expect(owned.has(id)).toBe(true);
      expect(r.json.suggestions).toHaveLength(3); // eksik kalan kural motorundan tamamlandı

      const me = await a.req("GET", "/api/auth/me");
      expect(me.json.user.usage).toMatchObject({ aiTags: 1, aiOutfits: 1 });
    } finally {
      config.ai.enabled = false;
      config.ai.apiKey = "";
    }
  });

  let outfitId = "";
  it("kombin kaydet, puanla, planla", async () => {
    let r = await a.req("POST", "/api/outfits", { itemIds: [items.shirt.id, items.chino.id, items.boots.id], name: "Ofis", occasion: "work", saved: true });
    expect(r.status).toBe(200);
    outfitId = r.json.outfit.id;
    // Aynı parça seti → aynı kayıt (upsert)
    r = await a.req("POST", "/api/outfits", { itemIds: [items.boots.id, items.chino.id, items.shirt.id], plannedFor: "2026-11-05" });
    expect(r.json.outfit.id).toBe(outfitId);
    expect(r.json.outfit.saved).toBe(true);
    r = await a.req("PATCH", `/api/outfits/${outfitId}`, { rating: 1 });
    expect(r.json.outfit.rating).toBe(1);
    r = await a.req("GET", "/api/outfits?saved=true");
    expect(r.json.outfits).toHaveLength(1);
    expect(r.json.outfits[0].items).toHaveLength(3);
    r = await a.req("GET", "/api/outfits?from=2026-11-01&to=2026-11-30");
    expect(r.json.outfits[0].plannedFor).toBe("2026-11-05");
  });

  it("beğenilmeyen kombin bir daha önerilmez", async () => {
    const r1 = await a.req("POST", "/api/outfits/suggest", { occasion: "daily", count: 5 });
    const first = r1.json.suggestions[0];
    const core = first.items.filter((i: any) => i.category !== "accessory").map((i: any) => i.id);
    const saved = await a.req("POST", "/api/outfits", { itemIds: core, saved: false });
    await a.req("PATCH", `/api/outfits/${saved.json.outfit.id}`, { rating: -1 });
    for (let k = 0; k < 3; k++) {
      const r = await a.req("POST", "/api/outfits/suggest", { occasion: "daily", count: 5 });
      for (const s of r.json.suggestions) {
        const c = s.items.filter((i: any) => i.category !== "accessory").map((i: any) => i.id).sort();
        expect(c).not.toEqual([...core].sort());
      }
    }
  });

  it("giydim kaydı, geçmiş ve geri alma", async () => {
    let r = await a.req("POST", "/api/wear", { itemIds: [items.shirt.id, items.chino.id, items.boots.id], outfitId });
    expect(r.status).toBe(200);
    const logId = r.json.id;
    r = await a.req("GET", `/api/items/${items.shirt.id}`);
    expect(r.json.item.wearCount).toBe(1);
    expect(r.json.item.lastWornAt).not.toBeNull();
    r = await a.req("GET", `/api/outfits/${outfitId}`);
    expect(r.json.outfit.wornCount).toBe(1);
    r = await a.req("GET", "/api/wear");
    expect(r.json.logs[0].items).toHaveLength(3);
    r = await a.req("DELETE", `/api/wear/${logId}`);
    r = await a.req("GET", `/api/items/${items.shirt.id}`);
    expect(r.json.item.wearCount).toBe(0);
    expect(r.json.item.lastWornAt).toBeNull();
    // Kombin kaydı olmadan giyme → otomatik kombin oluşur
    r = await a.req("POST", "/api/wear", { itemIds: [items.tee.id, items.jeans.id, items.sneakers.id], date: "2026-10-30" });
    expect(r.json.outfitId).toBeTruthy();
  });

  it("istatistikler ve eksik parça önerileri", async () => {
    const r = await a.req("GET", "/api/stats");
    expect(r.status).toBe(200);
    expect(r.json.totalItems).toBe(11);
    expect(r.json.byCategory.top).toBe(3);
    expect(r.json.totalValue).toBe(1500);
    expect(r.json.mostWorn.length).toBeGreaterThan(0);
    expect(r.json.gaps.some((g: string) => g.includes("su geçirmez"))).toBe(true); // su geçirmez dış giyim yok
    expect(Array.isArray(r.json.byColor)).toBe(true);
  });

  it("valiz listesi", async () => {
    const r = await a.req("POST", "/api/outfits/packing", { startDate: "2026-11-10", days: 4, occasions: ["daily", "work"] });
    if (r.status !== 200) console.log("PACKING", r.raw.body);
    expect(r.status).toBe(200);
    expect(r.json.days).toHaveLength(4);
    expect(r.json.items.length).toBeGreaterThan(2);
    // Valizdeki parça sayısı gün × parça sayısından az olmalı (tekrar kullanım)
    const total = r.json.days.reduce((a: number, d: any) => a + d.itemIds.length, 0);
    expect(r.json.items.length).toBeLessThan(total);
  });

  it("parça silme kombinlerden de çıkarır", async () => {
    const r = await a.req("DELETE", `/api/items/${items.boots.id}`);
    expect(r.status).toBe(200);
    const o = await a.req("GET", `/api/outfits/${outfitId}`);
    expect(o.json.outfit.itemIds).not.toContain(items.boots.id);
    expect((await a.req("GET", items.boots.image.url)).status).toBe(404);
  });

  it("plan sınırı ve kota", async () => {
    const { User } = await import("../src/models/User.js");
    await User.updateOne({ email: "b@test.com" }, { "usage.aiOutfits": 60, "usage.periodStart": new Date() });
    config.ai.enabled = true;
    config.ai.apiKey = "test";
    try {
      // B'nin parçası yok → öneri boş ama hata yok
      const r = await b.req("POST", "/api/outfits/suggest", { occasion: "daily" });
      expect(r.status).toBe(200);
      expect(r.json.missing).toEqual(expect.arrayContaining(["top", "bottom", "shoes"]));
    } finally {
      config.ai.enabled = false;
      config.ai.apiKey = "";
    }
  });

  it("şifre sıfırlama akışı", async () => {
    const { Token } = await import("../src/models/Token.js");
    let r = await a.req("POST", "/api/auth/forgot-password", { email: "yok@test.com" });
    expect(r.status).toBe(200);
    r = await a.req("POST", "/api/auth/forgot-password", { email: "osman@test.com" });
    expect(r.status).toBe(200);
    expect(await Token.countDocuments({ kind: "reset_password" })).toBe(1);
    r = await a.req("POST", "/api/auth/reset-password", { token: "gecersiz-token-123", password: "yeni-sifre-123" });
    expect(r.status).toBe(400);
  });

  it("veri dışa aktarma ve hesap silme (KVKK)", async () => {
    let r = await a.req("GET", "/api/account/export");
    expect(r.status).toBe(200);
    const data = JSON.parse(r.raw.body);
    expect(data.items).toHaveLength(10);
    expect(data.user.email).toBe("osman@test.com");

    r = await a.req("DELETE", "/api/account", { password: "yanlis" });
    expect(r.status).toBe(400);
    r = await a.req("DELETE", "/api/account", { password: "gizli-sifre-123" });
    expect(r.status).toBe(200);
    const { Item } = await import("../src/models/Item.js");
    expect(await Item.countDocuments({})).toBe(0);
    expect((await a.req("GET", "/api/auth/me")).json.user).toBeNull();
  });
});

describe("doğrulama", () => {
  it("bozuk tarih 400 döner", async () => {
    const c = new Client();
    await c.req("POST", "/api/auth/register", { name: "T", email: "t@test.com", password: "test-sifre-123" });
    expect((await c.req("POST", "/api/outfits/suggest", { date: "yarın" })).status).toBe(400);
    expect((await c.req("POST", "/api/outfits/packing", { startDate: "2026-13-45", days: 2 })).status).toBe(400);
    expect((await c.req("POST", "/api/wear", { itemIds: ["507f1f77bcf86cd799439011"], date: "x" })).status).toBe(400);
  });
});
