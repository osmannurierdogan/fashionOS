import type { ZodTypeAny, z } from "zod";
import { badRequest } from "./errors.js";

export function parse<T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const first = r.error.issues[0];
    throw badRequest(first?.message ?? "Geçersiz veri", r.error.flatten());
  }
  return r.data;
}
