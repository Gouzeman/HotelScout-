import type pg from "pg";
import type { HotelSearchInput } from "../types.js";
import { completeRun, failRun, startRun } from "../database/runs.js";
import { searchSerpApi } from "../sources/serpapi.js";

export async function collectHotels(
  pool: pg.Pool,
  input: HotelSearchInput,
  apiKey: string | undefined,
) {
  const runId = await startRun(pool, input);
  try {
    const result = await searchSerpApi(input, apiKey);
    await completeRun(
      pool,
      runId,
      result.searchId,
      result.rawResponse,
      result.offers,
    );
    return { runId, offers: result.offers };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown collection error";
    await failRun(pool, runId, message);
    throw error;
  }
}
