import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import { setStorage, storage } from "../src/lib/storage.js";

// Gerçek S3 sürücüsünü S3 uyumlu yerel sunucuda (adobe/s3mock) dener.
// Çalıştırmak için: S3_TEST_ENDPOINT=http://127.0.0.1:9090 npx vitest run test/s3.test.ts
const endpoint = process.env.S3_TEST_ENDPOINT;

describe.skipIf(!endpoint)("S3 depolama sürücüsü", () => {
  it("yükler, imzalı URL ile sunar, siler", async () => {
    process.env.AWS_ACCESS_KEY_ID = "test";
    process.env.AWS_SECRET_ACCESS_KEY = "test";
    Object.assign(config.storage, { driver: "s3" });
    Object.assign(config.storage.s3, { bucket: "fashionos", endpoint, forcePathStyle: true, region: "eu-central-1" });
    setStorage(null as never);
    const s = storage();
    const key = "users/u1/items/i1/main-test.webp";
    await s.put(key, Buffer.from("merhaba"), "image/webp");
    await s.put("users/u1/items/i2/x.webp", Buffer.from("2"), "image/webp");
    expect((await s.get(key)).toString()).toBe("merhaba");

    const url = await s.url(key);
    expect(url).toContain("X-Amz-Signature");
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("merhaba");

    await s.deletePrefix("users/u1/");
    await expect(s.get(key)).rejects.toBeTruthy();
  });
});
