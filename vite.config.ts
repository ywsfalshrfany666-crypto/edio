import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const pwaEnabled = process.env.EDIO_ENABLE_PWA === "1";
  return {
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: process.env.VITE_API_BASE_URL || "http://127.0.0.1:8787",
        changeOrigin: true,
      },
      "/media/imports": {
        target: process.env.VITE_API_BASE_URL || "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    pwaEnabled &&
      VitePWA({
      registerType: "prompt",
      injectRegister: null, // we register manually in src/sw/register.ts
      // Disable in dev to avoid stale content inside Lovable preview iframe
      devOptions: { enabled: false },
      includeAssets: ["favicon.svg", "robots.txt"],
      manifest: {
        name: "EDIO Sound Studio",
        short_name: "EDIO",
        description:
          "EDIO Sound Studio — premium ecommerce platform for curated audio gear and audiophile products.",
        theme_color: "#0a0a0a",
        background_color: "#0a0a0a",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
      },
      workbox: {
        // Precache the app shell — JS/CSS/HTML/fonts/icons.
        // Product images are NOT precached (would be ~100 MB on first visit);
        // they are cached on demand via the runtime "images" cache below.
        globPatterns: ["**/*.{js,css,html,svg,woff2,ico}"],
        // Skip oversized files from precache
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/auth/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // Activate updates immediately so the storefront does not stay pinned
        // to an old product/card bundle after a production build.
        skipWaiting: true,
        runtimeCaching: [
          {
            // Google Fonts stylesheets
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-stylesheets" },
          },
          {
            // Google Fonts files
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // All images (bundled product images + remote OG/R2 images)
            urlPattern: ({ request }) => request.destination === "image",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  build: {
    modulePreload: {
      resolveDependencies(filename, deps) {
        if (filename.includes("supabase")) return deps;
        return deps.filter(
          (dep) => !dep.includes("vendor-supabase") && !dep.includes("supabase-"),
        );
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("react/jsx-runtime")) {
            return "vendor-react";
          }
          if (id.includes("react-router-dom") || id.includes("@remix-run/router")) {
            return "vendor-router";
          }
          if (id.includes("i18next") || id.includes("react-i18next")) {
            return "vendor-i18n";
          }
          if (id.includes("@radix-ui/")) {
            return "vendor-radix";
          }
          if (id.includes("lucide-react")) {
            return "vendor-icons";
          }
          if (id.includes("@tanstack/")) {
            return "vendor-query";
          }
        },
      },
    },
  },
  };
});
