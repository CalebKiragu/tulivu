import path from "node:path";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import type { AppConfig } from "../config.js";
import * as schema from "./schema.js";

export type Database = NodePgDatabase<typeof schema>;

export interface DbHandle {
  db: Database;
  kind: "postgres" | "pglite";
  close: () => Promise<void>;
}

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

export async function createDatabase(config: AppConfig): Promise<DbHandle> {
  if (config.databaseUrl) {
    const pool = new Pool({
      connectionString: config.databaseUrl,
      max: config.isProduction ? 10 : 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
    });
    const db = drizzlePg(pool, { schema });
    await pool.query("select 1");
    await migratePg(db, { migrationsFolder });
    return { db, kind: "postgres", close: async () => pool.end() };
  }

  const isMemory = config.pgliteDir === "memory";
  const pglitePath = path.resolve(config.pgliteDir);
  // PGlite creates its own directory but not missing parents. Ensure DATA_DIR
  // exists before the first local boot.
  if (!isMemory) await mkdir(path.dirname(pglitePath), { recursive: true });
  const client = new PGlite(isMemory ? "memory://" : pglitePath);
  await client.waitReady;
  const db = drizzlePglite(client, { schema }) as unknown as Database;
  await migratePglite(db as never, { migrationsFolder });
  return {
    db,
    kind: "pglite",
    close: async () => {
      await client.close();
    },
  };
}

export async function checkDatabase(db: Database): Promise<boolean> {
  try {
    await db.execute("select 1");
    return true;
  } catch {
    return false;
  }
}
