import type { FastifyRequest } from "fastify";
import { badRequest } from "../lib/errors.js";

export interface UploadParts {
  files: Record<string, { buffer: Buffer; mimetype: string; filename: string }>;
  fields: Record<string, string>;
}

const ALLOWED = /^image\/(jpeg|png|webp|heic|heif|avif|gif)$/;

/** multipart/form-data isteğini belleğe okur (dosyalar en fazla MAX_UPLOAD_MB). */
export async function readUpload(req: FastifyRequest): Promise<UploadParts> {
  if (!req.isMultipart()) throw badRequest("multipart/form-data bekleniyor");
  const out: UploadParts = { files: {}, fields: {} };
  for await (const part of req.parts()) {
    if (part.type === "file") {
      if (!ALLOWED.test(part.mimetype)) throw badRequest("Desteklenmeyen dosya türü: " + part.mimetype);
      out.files[part.fieldname] = { buffer: await part.toBuffer(), mimetype: part.mimetype, filename: part.filename };
    } else {
      out.fields[part.fieldname] = String(part.value ?? "");
    }
  }
  return out;
}
