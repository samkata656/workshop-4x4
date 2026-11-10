import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * One shared connection pool per server process.
 * Created lazily so `next build` never needs a database.
 */
const globalForDb = globalThis as unknown as { __workshopSql?: ReturnType<typeof postgres> };

function client() {
  if (!globalForDb.__workshopSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalForDb.__workshopSql = postgres(url, { max: 10 });
  }
  return globalForDb.__workshopSql;
}

export function getDb() {
  return drizzle(client(), { schema });
}

export { schema };

/** Closes the pool (tests and scripts; the web server keeps it open). */
export async function closeDb() {
  await globalForDb.__workshopSql?.end();
  globalForDb.__workshopSql = undefined;
}
