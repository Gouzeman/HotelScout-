import assert from "node:assert/strict";
import test from "node:test";
import { SourceError, searchSerpApi } from "../src/sources/serpapi.js";

test("SerpApi source refuses to run without a key", async () => {
  await assert.rejects(
    searchSerpApi(
      {
        query: "Hotels in Novosibirsk, Russia",
        checkIn: "2026-11-10",
        checkOut: "2026-11-11",
        adults: 2,
        children: 0,
        currency: "RUB",
        country: "ru",
        language: "ru",
      },
      undefined,
    ),
    (error: unknown) =>
      error instanceof SourceError && error.statusCode === 503,
  );
});
