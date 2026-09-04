/// <reference types="vitest/config" />

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { VitePWA } from "vite-plugin-pwa";
import tailwindcss from "@tailwindcss/vite";
import { PRELUDE_PWA_GLOB_PATTERNS } from "./src/pwa-assets";
import {
  PRELUDE_BASE_PATH,
  PRELUDE_PWA_MANIFEST_PATHS,
  PRELUDE_PWA_NAVIGATION_FALLBACK,
  PRELUDE_PWA_REGISTER_TYPE,
} from "./src/pwa-config";

export default defineConfig({
  base: PRELUDE_BASE_PATH,

  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: PRELUDE_PWA_REGISTER_TYPE,

      includeAssets: [
        "favicon.ico",
        "apple-touch-icon.png",
        "pwa-192x192.png",
        "pwa-512x512.png",
      ],

      manifest: {
        name: "Prelude: MIDI Mentor",
        short_name: "Prelude",
        description:
          "Practice reading musical notation using a connected MIDI keyboard.",

        theme_color: "#111827",
        background_color: "#111827",

        display: "standalone",
        orientation: "any",

        scope: PRELUDE_PWA_MANIFEST_PATHS.scope,
        start_url: PRELUDE_PWA_MANIFEST_PATHS.startUrl,

        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },

      workbox: {
        navigateFallback: PRELUDE_PWA_NAVIGATION_FALLBACK,
        globPatterns: PRELUDE_PWA_GLOB_PATTERNS,
      },

      devOptions: {
        enabled: true,
      },
    }),
  ],

  test: {
    environment: "jsdom",
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
