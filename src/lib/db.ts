/**
 * @deprecated LEGACY — Neon Postgres connection for legacy admin registry.
 * New hubs use on-chain Safe multisig. This is only needed for
 * legacy hubs without a Safe address.
 */
import postgres from "postgres";

let sql: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (sql) return sql;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Missing DATABASE_URL environment variable. " +
        "Add your Neon connection string to .env.local"
    );
  }

  sql = postgres(url, { ssl: "require" });
  return sql;
}

export default getDb;
