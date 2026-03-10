import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : {
          // Keep HMR connection alive through sleep/wake cycles
          timeout: 120000,   // 2 min before giving up on reconnect
          overlay: false,    // Don't show the scary connection-lost overlay
        },
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
