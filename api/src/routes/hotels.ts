import type { FastifyInstance } from "fastify";
import type pg from "pg";
import type { HotelSearchInput } from "../types.js";
import { collectHotels } from "../services/collect-hotels.js";
import { SourceError } from "../sources/serpapi.js";

const searchBodySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "query",
    "checkIn",
    "checkOut",
    "adults",
    "children",
    "currency",
    "country",
    "language",
  ],
  properties: {
    query: { type: "string", minLength: 2, maxLength: 200 },
    checkIn: { type: "string", format: "date" },
    checkOut: { type: "string", format: "date" },
    adults: { type: "integer", minimum: 1, maximum: 6 },
    children: { type: "integer", minimum: 0, maximum: 4 },
    currency: { type: "string", pattern: "^[A-Z]{3}$" },
    country: { type: "string", pattern: "^[a-z]{2}$" },
    language: { type: "string", minLength: 2, maxLength: 10 },
  },
} as const;

export async function hotelRoutes(
  app: FastifyInstance,
  options: { pool: pg.Pool; serpApiKey: string | undefined },
) {
  app.post<{ Body: HotelSearchInput }>(
    "/api/hotels/search",
    { schema: { body: searchBodySchema } },
    async (request, reply) => {
      if (request.body.checkOut <= request.body.checkIn) {
        return reply.code(400).send({ error: "checkOut must be after checkIn" });
      }

      try {
        return await collectHotels(options.pool, request.body, options.serpApiKey);
      } catch (error) {
        request.log.error({ error }, "Hotel collection failed");
        if (error instanceof SourceError) {
          return reply.code(error.statusCode).send({ error: error.message });
        }
        return reply.code(500).send({ error: "Internal server error" });
      }
    },
  );
}
