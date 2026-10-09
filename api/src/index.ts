import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { runMigrations } from "./database/migrate.js";
import { createPool } from "./database/pool.js";

const config = loadConfig();
const pool = createPool(config.databaseUrl);

async function main(): Promise<void> {
  await runMigrations(pool);
  const app = buildApp(config, pool);

  const shutdown = async () => {
    await app.close();
    await pool.end();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await app.listen({ host: config.host, port: config.port });
}

main().catch(async (error: unknown) => {
  console.error(error);
  await pool.end();
  process.exitCode = 1;
});
