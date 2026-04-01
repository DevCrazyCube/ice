import pg from "pg";

let pool: pg.Pool | null = null;

/**
 * Initialise the Postgres connection pool. Must be called once at startup
 * before any call to getDb(). Calling initDb() twice is a programming error.
 */
export function initDb(connectionString: string): void {
  if (pool) throw new Error("DB already initialised");
  pool = new pg.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  pool.on("error", (err) => {
    // Pool errors must not crash the process — the logger is unavailable here
    // because core has no logger dependency. The caller should handle this.
    process.stderr.write(`[db] pool error: ${err.message}\n`);
  });
}

/**
 * Returns the initialised pool. Throws if initDb() has not been called.
 * All repository functions must call this — never cache the return value.
 */
export function getDb(): pg.Pool {
  if (!pool) throw new Error("DB not initialised. Call initDb() first.");
  return pool;
}

/**
 * Gracefully close the pool. Called on process shutdown.
 */
export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = null;
}
