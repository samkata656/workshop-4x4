import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    // .env supplies DATABASE_URL for the *.db.test.ts files.
    env: loadEnv(mode, process.cwd(), ""),
    fileParallelism: false,
  },
}));
