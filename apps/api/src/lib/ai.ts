import OpenAI from "openai";
import type { ZodTypeAny, z } from "zod";
import { config } from "../config.js";

/**
 * Açık kaynak model istemcisi. Varsayılan model Qwen (görsel destekli).
 * OpenAI uyumlu her sağlayıcıyla çalışır: OpenRouter, Alibaba DashScope,
 * Ollama (http://localhost:11434/v1), vLLM, Together, Groq...
 */
let client: OpenAI | null = null;

export function aiAvailable() {
  // Ollama gibi yerel sunucular anahtar istemez; base URL localhost ise anahtarsız da çalışır.
  const local = /localhost|127\.0\.0\.1|ollama|host\.docker/.test(config.ai.baseUrl);
  return config.ai.enabled && (Boolean(config.ai.apiKey) || local);
}

function getClient() {
  if (!client) {
    client = new OpenAI({
      baseURL: config.ai.baseUrl,
      apiKey: config.ai.apiKey || "not-needed",
      timeout: config.ai.timeoutMs,
      maxRetries: 1,
      defaultHeaders: {
        // OpenRouter uygulama tanımı (diğer sağlayıcılar yok sayar)
        "HTTP-Referer": config.appUrl,
        "X-Title": "fashionOS",
      },
    });
  }
  return client;
}

export class AiError extends Error {}

/** Model çıktısından JSON nesnesini ayıklar (<think> blokları, ``` çitleri vb. temizlenir). */
export function extractJson(text: string): unknown {
  let t = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1]!.trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end <= start) throw new AiError("Modelden JSON alınamadı");
  return JSON.parse(t.slice(start, end + 1));
}

type Content = OpenAI.Chat.Completions.ChatCompletionContentPart[] | string;

/**
 * Modele JSON döndürmesini söyler, zod ile doğrular; geçersizse hatayı modele gösterip bir kez daha dener.
 */
export async function chatJson<T extends ZodTypeAny>(opts: {
  system: string;
  user: Content;
  schema: T;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<z.infer<T>> {
  if (!aiAvailable()) throw new AiError("Yapay zekâ yapılandırılmamış (AI_API_KEY)");
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: opts.system },
    { role: "user", content: opts.user },
  ];
  let useJsonMode = config.ai.jsonMode;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    let text = "";
    try {
      const res = await getClient().chat.completions.create({
        model: opts.model ?? config.ai.textModel,
        messages,
        max_tokens: opts.maxTokens ?? 2000,
        temperature: opts.temperature ?? 0.4,
        ...(useJsonMode ? { response_format: { type: "json_object" as const } } : {}),
      });
      text = res.choices[0]?.message?.content ?? "";
    } catch (e) {
      // Bazı sağlayıcılar JSON modunu desteklemez → kapatıp yeniden dene
      if (useJsonMode && e instanceof OpenAI.BadRequestError) {
        useJsonMode = false;
        lastErr = e;
        continue;
      }
      if (e instanceof OpenAI.APIError) throw new AiError(`Yapay zekâ servisi hatası (${e.status ?? "?"})`);
      throw new AiError("Yapay zekâ servisine ulaşılamadı");
    }
    try {
      const parsed = opts.schema.safeParse(extractJson(text));
      if (parsed.success) return parsed.data;
      lastErr = parsed.error;
      messages.push({ role: "assistant", content: text });
      messages.push({
        role: "user",
        content:
          "Yanıtın şemaya uymuyor. Hatalar: " +
          JSON.stringify(parsed.error.issues.slice(0, 5)) +
          ". Sadece düzeltilmiş JSON nesnesini döndür.",
      });
    } catch (e) {
      lastErr = e;
      messages.push({ role: "assistant", content: text });
      messages.push({ role: "user", content: "Sadece geçerli bir JSON nesnesi döndür, başka metin yazma." });
    }
  }
  throw new AiError("Yapay zekâ geçerli yanıt üretemedi: " + String((lastErr as Error)?.message ?? lastErr).slice(0, 200));
}

export const imagePart = (jpeg: Buffer): OpenAI.Chat.Completions.ChatCompletionContentPart => ({
  type: "image_url",
  image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` },
});
