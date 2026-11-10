/**
 * Applies pending migrations, seeds starter data, then prepares n8n's own
 * database. Safe to run on every start.
 *
 *   npm run db:init          (local, needs DATABASE_URL)
 *   node db-init.cjs         (inside the container, runs before the server starts)
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { seed } from "../src/db/seed";

type Sql = ReturnType<typeof postgres>;

/** Builds a statement with identifiers (%I) and literals (%L) quoted by Postgres itself. */
async function run(sql: Sql, template: string, ...args: string[]) {
  const [{ statement }] = await sql.unsafe<{ statement: string }[]>(
    `select format($1, ${args.map((_, i) => `$${i + 2}::text`).join(", ")}) as statement`,
    [template, ...args],
  );
  await sql.unsafe(statement);
}

/**
 * n8n keeps its workflows and chat memory in a SEPARATE database in the same
 * Postgres, under its own login. That login owns only that database, so n8n
 * can never read customers or bookings directly — it has to go through the
 * agent API like everyone else.
 *
 * Done here rather than in a Postgres init script because those only run on an
 * empty data volume; this also works when n8n is added to an existing install.
 * Skipped when the N8N_DB_* variables are not set (e.g. plain `npm run db:init`).
 */
async function prepareN8nDatabase(sql: Sql) {
  const { N8N_DB_NAME: name, N8N_DB_USER: user, N8N_DB_PASSWORD: password } = process.env;
  if (!name || !user || !password) {
    console.log("[db-init] N8N_DB_NAME / N8N_DB_USER / N8N_DB_PASSWORD not set — n8n database skipped");
    return;
  }

  const [{ appDb, appUser }] = await sql`select current_database() as "appDb", current_user as "appUser"`;
  if (name === appDb) throw new Error("N8N_DB_NAME must not be the app's own database");
  if (user === appUser) throw new Error("N8N_DB_USER must not be the app's own database user");

  const [role] = await sql`select 1 from pg_roles where rolname = ${user}`;
  // "alter" on every start keeps the password in step with .env.
  await run(sql, `${role ? "alter" : "create"} role %I login password %L`, user, password);

  const [database] = await sql`select 1 from pg_database where datname = ${name}`;
  if (!database) await run(sql, "create database %I owner %I", name, user);

  // By default any login may connect to any database. Close the app's.
  await run(sql, "revoke connect on database %I from public", appDb);

  console.log(`[db-init] n8n database "${name}" ready (owner "${user}")`);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const db = drizzle(sql, { schema });
    await migrate(db, { migrationsFolder: process.env.MIGRATIONS_DIR ?? "./drizzle" });
    console.log("[db-init] migrations applied");
    await seed(db);
    console.log("[db-init] seed data present");
    await prepareN8nDatabase(sql);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("[db-init] failed:", err);
  process.exit(1);
});
