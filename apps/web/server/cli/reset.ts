import "../load-env.js";
import { eq } from "drizzle-orm";
import { loadConfig } from "../config.js";
import { createDatabase } from "../db/client.js";
import { users } from "../db/schema.js";

/**
 * Development helper: removes all demo workspaces. Destructive by design, so it
 * refuses to run against production unless the operator is explicit.
 */
async function main() {
  const config = loadConfig();
  if (config.isProduction && process.env.RESET_CONFIRM !== "delete demo workspaces") {
    throw new Error(
      "Refusing to delete production workspaces. Set RESET_CONFIRM=\"delete demo workspaces\" to proceed.",
    );
  }
  const handle = await createDatabase(config);
  try {
    const owner = process.env.DEMO_OWNER_ID;
    if (owner) {
      await handle.db.delete(users).where(eq(users.id, owner));
      console.log(`Deleted demo workspace ${owner}.`);
    } else {
      const removed = await handle.db.delete(users).returning({ id: users.id });
      console.log(`Deleted ${removed.length} demo workspace(s).`);
    }
    console.log("Restart the server or make a new request to reseed a workspace.");
  } finally {
    await handle.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
