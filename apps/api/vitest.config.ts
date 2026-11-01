import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      MONGODB_URI: process.env.TEST_MONGODB_URI ?? "mongodb://127.0.0.1:27017/fashionos_test",
      STORAGE_DRIVER: "local",
      STORAGE_DIR: "/tmp/fashionos-test-uploads",
      AI_API_KEY: "",
      AI_BASE_URL: "http://127.0.0.1:4999/v1",
      AI_ENABLED: "false",
      SESSION_SECRET: "test-secret-test-secret-test-secret",
    },
  },
});
