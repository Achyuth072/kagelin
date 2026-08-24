import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    clearMocks: true,
    setupFiles: ["./tests/unit/setup.ts"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Vitest resolves without Next's "react-server" condition, so the real
      // entry point throws on import. Point at the same no-op file that
      // condition would have selected.
      "server-only": path.resolve(
        __dirname,
        "./node_modules/server-only/empty.js",
      ),
    },
    include: ["./tests/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
  },
});
