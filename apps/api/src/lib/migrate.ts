import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "@ice/core";
import { logger } from "./logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "../../db/migrations");

/**
 * Run all pending SQL migration files in lexicographic order.
 *
 * Migration state is tracked in schema_migrations. Each file is applied
 * exactly once — idempotent for already-applied migrations.
 *
 * Called at API startup before the HTTP server begins accepting requests.
 */
export async function runMigrations(): Promise<void> {
  const db = getDb();

  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          SERIAL PRIMARY KEY,
      filename    TEXT NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort(); // lexicographic order — filenames must be zero-padded (001_, 002_, …)

  for (const file of files) {
    const { rows } = await db.query(
      "SELECT 1 FROM schema_migrations WHERE filename = $1",
      [file]
    );
    if (rows.length > 0) continue; // already applied

    const sql = await readFile(join(MIGRATIONS_DIR, file), "utf-8");

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (filename) VALUES ($1)",
        [file]
      );
      await client.query("COMMIT");
      logger.info({ migration: file }, "Migration applied");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
