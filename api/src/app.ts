import cors from "@fastify/cors";
import Fastify from "fastify";
import type pg from "pg";
import type { AppConfig } from "./config.js";
import { hotelRoutes } from "./routes/hotels.js";

export function buildApp(config: AppConfig, pool: pg.Pool) {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: config.corsOrigin });

  app.get("/health", async (_request, reply) => {
    await pool.query("SELECT 1");
    return reply.send({ status: "ok", database: "connected" });
  });

  app.register(hotelRoutes, { pool, serpApiKey: config.serpApiKey });

  return app;
}
