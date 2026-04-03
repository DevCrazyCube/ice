import { config as dotenvConfig } from "dotenv";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import pg from "pg";

dotenvConfig({ path: resolve(import.meta.dirname, "../../../.env") });

const sql = readFileSync(resolve(import.meta.dirname, "../db/seed.sql"), "utf-8");
const client = new pg.Client(process.env["DATABASE_URL"]);
await client.connect();
await client.query(sql);
await client.end();
console.log("Seed applied.");
