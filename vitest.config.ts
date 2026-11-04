import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests exercise server handlers with fake transports. Keep the application's
// server-function compiler out of this runner; Playwright has its own e2e scripts.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
