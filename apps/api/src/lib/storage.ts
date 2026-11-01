import { promises as fs } from "node:fs";
import path from "node:path";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config.js";

/**
 * Depolama soyutlaması. Üretimde AWS S3 (özel bucket + imzalı URL),
 * geliştirmede yerel disk. Anahtar yapısı: users/{userId}/items/{itemId}/{variant}.webp
 */
export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  url(key: string): Promise<string>;
  deletePrefix(prefix: string): Promise<void>;
  delete(keys: string[]): Promise<void>;
}

class LocalStorage implements Storage {
  constructor(private dir: string) {}
  private p(key: string) {
    const full = path.resolve(this.dir, key);
    if (!full.startsWith(path.resolve(this.dir))) throw new Error("Geçersiz anahtar");
    return full;
  }
  async put(key: string, body: Buffer) {
    const f = this.p(key);
    await fs.mkdir(path.dirname(f), { recursive: true });
    await fs.writeFile(f, body);
  }
  get(key: string) {
    return fs.readFile(this.p(key));
  }
  async url(key: string) {
    return `/api/files/${key}`;
  }
  async delete(keys: string[]) {
    await Promise.all(keys.map((k) => fs.rm(this.p(k), { force: true })));
  }
  async deletePrefix(prefix: string) {
    await fs.rm(this.p(prefix), { recursive: true, force: true });
  }
}

class S3Storage implements Storage {
  private client: S3Client;
  private bucket: string;
  private cache = new Map<string, { url: string; exp: number }>();
  constructor() {
    const s3 = config.storage.s3;
    this.bucket = s3.bucket;
    // Kimlik bilgileri AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY ortam değişkenlerinden okunur.
    this.client = new S3Client({ region: s3.region, endpoint: s3.endpoint, forcePathStyle: s3.forcePathStyle });
  }
  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "private, max-age=31536000, immutable",
      }),
    );
  }
  async get(key: string) {
    const r = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await r.Body!.transformToByteArray());
  }
  async url(key: string) {
    const now = Date.now();
    const hit = this.cache.get(key);
    if (hit && hit.exp > now + 5 * 60_000) return hit.url;
    const ttl = config.storage.s3.signedUrlTtl;
    const url = await getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: ttl });
    this.cache.set(key, { url, exp: now + ttl * 1000 });
    if (this.cache.size > 5000) this.cache.clear();
    return url;
  }
  async delete(keys: string[]) {
    if (!keys.length) return;
    await this.client.send(
      new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys.map((Key) => ({ Key })) } }),
    );
    keys.forEach((k) => this.cache.delete(k));
  }
  async deletePrefix(prefix: string) {
    let token: string | undefined;
    do {
      const list = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      const keys = (list.Contents ?? []).map((o) => o.Key!).filter(Boolean);
      await this.delete(keys);
      token = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (token);
  }
}

let instance: Storage | null = null;
export function storage(): Storage {
  if (!instance) instance = config.storage.driver === "s3" ? new S3Storage() : new LocalStorage(config.storage.localDir);
  return instance;
}
export function setStorage(s: Storage) {
  instance = s;
}

export const userPrefix = (userId: string) => `users/${userId}/`;
export const itemPrefix = (userId: string, itemId: string) => `users/${userId}/items/${itemId}/`;
