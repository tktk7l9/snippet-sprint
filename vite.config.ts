import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: "es2022",
    // Avoid the inline module-preload polyfill script so the CSP needs no
    // 'unsafe-inline' for scripts (es2022 targets support modulepreload natively).
    modulePreload: { polyfill: false },
  },
});
