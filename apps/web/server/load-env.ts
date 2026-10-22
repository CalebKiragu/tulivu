import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

/**
 * Load a local .env file for server processes. Node does not do this
 * automatically, and pnpm runs package scripts from the workspace directory.
 * Deployment platforms inject environment variables directly, so a missing file
 * is normal in production.
 *
 * Values already present in process.env always win. Files are loaded in
 * precedence order: repository root first, then the app directory.
 */
const repoRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const appRoot = path.resolve(fileURLToPath(new URL("../", import.meta.url)));

for (const file of [
  path.join(repoRoot, ".env.local"),
  path.join(repoRoot, ".env"),
  path.join(appRoot, ".env.local"),
  path.join(appRoot, ".env"),
]) {
  if (existsSync(file)) loadEnvFile(file);
}
