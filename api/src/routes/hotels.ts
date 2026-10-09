import type { FastifyInstance } from "fastify";
import type pg from "pg";
import type { HotelSearchInput } from "../types.js";
import { getHotelHistory } from "../database/runs.js";
import { collectHotels } from "../services/collect-hotels.js";
import { SourceError } from "../sources/serpapi.js";

interface HistoryQuery {
  propertyToken?: string;
  name: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  currency: string;
}

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

const historyQuerySchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "checkIn", "checkOut", "adults", "children", "currency"],
  properties: {
    propertyToken: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1, maxLength: 300 },
    checkIn: { type: "string", format: "date" },
    checkOut: { type: "string", format: "date" },
    adults: { type: "integer", minimum: 1, maximum: 6 },
    children: { type: "integer", minimum: 0, maximum: 4 },
    currency: { type: "string", pattern: "^[A-Z]{3}$" },
  },
} as const;

export async function hotelRoutes(
  app: FastifyInstance,
  options: { pool: pg.Pool; serpApiKey: string | undefined },
) {
  app.get<{ Querystring: HistoryQuery }>(
    "/api/hotels/history",
    { schema: { querystring: historyQuerySchema } },
    async (request) => {
      const points = await getHotelHistory(options.pool, {
        propertyToken: request.query.propertyToken ?? null,
        name: request.query.name,
        checkIn: request.query.checkIn,
        checkOut: request.query.checkOut,
        adults: request.query.adults,
        children: request.query.children,
        currency: request.query.currency,
      });

      return {
        hotel: {
          propertyToken: request.query.propertyToken ?? null,
          name: request.query.name,
        },
        points,
      };
    },
  );

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
