import type pg from "pg";
import type { HotelOffer, HotelSearchInput } from "../types.js";

export interface HotelHistoryFilters {
  propertyToken: string | null;
  name: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  currency: string;
}

export interface HotelHistoryPoint {
  runId: number;
  observedAt: string;
  nightlyPrice: number;
  totalPrice: number | null;
  currency: string;
}

export async function startRun(
  pool: pg.Pool,
  input: HotelSearchInput,
): Promise<number> {
  const result = await pool.query<{ id: string }>(
    `
      INSERT INTO collection_runs (
        query, check_in, check_out, adults, children, currency,
        country, language, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'running')
      RETURNING id
    `,
    [
      input.query,
      input.checkIn,
      input.checkOut,
      input.adults,
      input.children,
      input.currency,
      input.country,
      input.language,
    ],
  );
  return Number(result.rows[0]?.id);
}

export async function completeRun(
  pool: pg.Pool,
  runId: number,
  searchId: string | null,
  rawResponse: Record<string, unknown>,
  offers: HotelOffer[],
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `
        UPDATE collection_runs
        SET status = 'success', serpapi_search_id = $2, raw_response = $3
        WHERE id = $1
      `,
      [runId, searchId, rawResponse],
    );

    for (const offer of offers) {
      await client.query(
        `
          INSERT INTO hotel_offers (
            run_id, property_token, name, property_type, hotel_class,
            rating, reviews, latitude, longitude, nightly_price,
            nightly_price_before_taxes, total_price, currency, available,
            free_cancellation, source_prices
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14, $15, $16
          )
        `,
        [
          runId,
          offer.propertyToken,
          offer.name,
          offer.propertyType,
          offer.hotelClass,
          offer.rating,
          offer.reviews,
          offer.latitude,
          offer.longitude,
          offer.nightlyPrice,
          offer.nightlyPriceBeforeTaxes,
          offer.totalPrice,
          offer.currency,
          offer.available,
          offer.freeCancellation,
          JSON.stringify(offer.sourcePrices),
        ],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function failRun(
  pool: pg.Pool,
  runId: number,
  message: string,
): Promise<void> {
  await pool.query(
    `
      UPDATE collection_runs
      SET status = 'error', error_message = $2
      WHERE id = $1
    `,
    [runId, message.slice(0, 4_000)],
  );
}

export async function getHotelHistory(
  pool: pg.Pool,
  filters: HotelHistoryFilters,
): Promise<HotelHistoryPoint[]> {
  const result = await pool.query<{
    run_id: string;
    observed_at: Date;
    nightly_price: string;
    total_price: string | null;
    currency: string;
  }>(
    `
      SELECT
        r.id AS run_id,
        r.observed_at,
        o.nightly_price,
        o.total_price,
        o.currency
      FROM hotel_offers o
      JOIN collection_runs r ON r.id = o.run_id
      WHERE r.status = 'success'
        AND o.nightly_price IS NOT NULL
        AND (
          ($1::text IS NOT NULL AND o.property_token = $1)
          OR ($1::text IS NULL AND o.name = $2)
        )
        AND r.check_in = $3
        AND r.check_out = $4
        AND r.adults = $5
        AND r.children = $6
        AND r.currency = $7
      ORDER BY r.observed_at ASC
      LIMIT 500
    `,
    [
      filters.propertyToken,
      filters.name,
      filters.checkIn,
      filters.checkOut,
      filters.adults,
      filters.children,
      filters.currency,
    ],
  );

  return result.rows.map((row) => ({
    runId: Number(row.run_id),
    observedAt: row.observed_at.toISOString(),
    nightlyPrice: Number(row.nightly_price),
    totalPrice: row.total_price === null ? null : Number(row.total_price),
    currency: row.currency,
  }));
}
