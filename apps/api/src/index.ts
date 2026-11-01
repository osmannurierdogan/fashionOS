import { buildApp } from "./app.js";
import { assertProdConfig, config } from "./config.js";
import { connectDb } from "./db.js";

async function main() {
  assertProdConfig();
  const app = await buildApp();
  await connectDb();
  app.log.info(`MongoDB bağlandı; depolama: ${config.storage.driver}`);
  await app.listen({ port: config.port, host: config.host });

  const close = async () => {
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", close);
  process.on("SIGINT", close);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
