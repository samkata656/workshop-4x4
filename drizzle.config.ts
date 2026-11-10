import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Only needed for `drizzle-kit studio` / `push`. `generate` never connects.
    url: process.env.DATABASE_URL ?? "postgres://workshop:workshop@localhost:5432/workshop",
  },
});
