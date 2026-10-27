/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  clearScreen: false,
  optimizeDeps: {
    entries: ["index.html"],
    include: [
      "react",
      "react-dom",
      "@tauri-apps/api/core",
      "motion/react",
      "lucide-react",
      "zustand",
      "react-markdown",
      "remark-gfm",
      "cmdk",
      "clsx",
      "tailwind-merge",
      "sonner",
      "class-variance-authority",
      "@tanstack/react-query",
      "@tanstack/react-form",
      "@tanstack/react-table",
      "pmtiles",
    ],
    exclude: ["maplibre-gl"],
  },
  server: {
    port: 1420,
    strictPort: true,
    host: "0.0.0.0",
    watch: {
      ignored: ["**/src-tauri/**", "**/resources/**", "**/scratch/**", "**/scratch_extracted/**", "**/*.zip", "**/*.tar.gz", "**/target/**"],
    },
  },
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-motion": ["motion"],
          "vendor-icons": ["lucide-react", "@remixicon/react"],
          "vendor-markdown": ["react-markdown", "remark-gfm"],
        },
      },
    },
  },
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/resources/**",
      "**/target/**",
      "**/scratch/**",
      "**/scratch_extracted/**",
      "**/dist/**",
      "**/bench/**",
    ],
  },
});

