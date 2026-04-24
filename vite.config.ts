import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiPort =
  process.env.REGISTRY_API_PORT || process.env.PORT || "38471";
const apiTarget = `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    strictPort: false,
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
    },
  },
  preview: {
    port: 5173,
    strictPort: false,
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
    },
  },
});
