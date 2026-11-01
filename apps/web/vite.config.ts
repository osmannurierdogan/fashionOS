import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "fashionOS — Akıllı Gardırop",
        short_name: "fashionOS",
        description: "Gardırobunu dijitalleştir, her gün sana özel kombin önerisi al.",
        lang: "tr",
        theme_color: "#1c1917",
        background_color: "#fafaf9",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Arka plan silme modeli/çalışma zamanı çok büyük; ilk kullanımda indirilir, ön belleğe alınmaz
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        globIgnores: ["**/ort*.js", "**/*.wasm"],
        runtimeCaching: [
          {
            // Kullanıcı görselleri (yerel sürücü) — S3 imzalı URL'ler zaten tarayıcı önbelleğinde
            urlPattern: ({ url }) => url.pathname.startsWith("/api/files/"),
            handler: "CacheFirst",
            options: { cacheName: "fos-images", expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: { "/api": { target: process.env.API_URL ?? "http://localhost:4000", changeOrigin: true } },
  },
  build: { chunkSizeWarningLimit: 1500 },
});
