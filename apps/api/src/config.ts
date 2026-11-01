// Tüm ayarlar ortam değişkenlerinden (.env) okunur.
const env = process.env;

const bool = (v: string | undefined, d = false) => (v === undefined ? d : ["1", "true", "yes"].includes(v.toLowerCase()));

export const config = {
  env: env.NODE_ENV ?? "development",
  isProd: env.NODE_ENV === "production",
  port: Number(env.PORT ?? 4000),
  host: env.HOST ?? "0.0.0.0",
  appUrl: (env.APP_URL ?? "http://localhost:5173").replace(/\/$/, ""),
  corsOrigins: (env.CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),

  mongoUri: env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/fashionos",

  sessionSecret: env.SESSION_SECRET ?? "dev-only-secret-change-me",
  sessionDays: Number(env.SESSION_DAYS ?? 30),
  cookieSecure: bool(env.COOKIE_SECURE, env.NODE_ENV === "production"),

  storage: {
    driver: (env.STORAGE_DRIVER ?? (env.S3_BUCKET ? "s3" : "local")) as "s3" | "local",
    localDir: env.STORAGE_DIR ?? "./uploads",
    s3: {
      bucket: env.S3_BUCKET ?? "",
      region: env.AWS_REGION ?? "eu-central-1",
      endpoint: env.S3_ENDPOINT || undefined, // MinIO vb. için opsiyonel
      forcePathStyle: bool(env.S3_FORCE_PATH_STYLE),
      signedUrlTtl: Number(env.S3_SIGNED_URL_TTL ?? 3600),
    },
  },

  // Açık kaynak model (Qwen) — OpenAI uyumlu herhangi bir sağlayıcı:
  // OpenRouter, Alibaba DashScope, Ollama, vLLM, Together...
  ai: {
    enabled: bool(env.AI_ENABLED, true),
    baseUrl: env.AI_BASE_URL ?? "https://openrouter.ai/api/v1",
    apiKey: env.AI_API_KEY ?? "",
    visionModel: env.AI_VISION_MODEL ?? "qwen/qwen3.8-27b",
    textModel: env.AI_TEXT_MODEL ?? env.AI_VISION_MODEL ?? "qwen/qwen3.8-27b",
    timeoutMs: Number(env.AI_TIMEOUT_MS ?? 60000),
    jsonMode: bool(env.AI_JSON_MODE, true),
  },

  mail: {
    smtpUrl: env.SMTP_URL ?? "", // smtp://user:pass@host:587
    from: env.MAIL_FROM ?? "fashionOS <no-reply@fashionos.app>",
  },

  stripe: {
    secretKey: env.STRIPE_SECRET_KEY ?? "",
    webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? "",
    pricePro: env.STRIPE_PRICE_PRO ?? "",
  },

  maxUploadMb: Number(env.MAX_UPLOAD_MB ?? 15),
};

export function assertProdConfig() {
  if (!config.isProd) return;
  const missing: string[] = [];
  if (!process.env.MONGODB_URI) missing.push("MONGODB_URI");
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) missing.push("SESSION_SECRET (>=32 karakter)");
  if (config.storage.driver === "s3" && !config.storage.s3.bucket) missing.push("S3_BUCKET");
  if (missing.length) throw new Error("Eksik ortam değişkenleri: " + missing.join(", "));
}
