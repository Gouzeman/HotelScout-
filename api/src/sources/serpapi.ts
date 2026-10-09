import type {
  HotelOffer,
  HotelSearchInput,
  SourcePrice,
  SourceSearchResult,
} from "../types.js";

const SERPAPI_URL = "https://serpapi.com/search.json";

export class SourceError extends Error {
  constructor(message: string, readonly statusCode = 502) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function integerOrNull(value: unknown): number | null {
  return Number.isInteger(value) ? (value as number) : null;
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function nestedRecord(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = parent[key];
  return isRecord(value) ? value : {};
}

function normalizeSourcePrices(value: unknown): SourcePrice[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).map((item) => {
    const rate = nestedRecord(item, "rate_per_night");
    return {
      source: stringOrNull(item.source),
      nightlyPrice: numberOrNull(rate.extracted_lowest),
    };
  });
}

function normalizeOffer(value: unknown, currency: string): HotelOffer | null {
  if (!isRecord(value) || typeof value.name !== "string") {
    return null;
  }

  const coordinates = nestedRecord(value, "gps_coordinates");
  const nightlyRate = nestedRecord(value, "rate_per_night");
  const totalRate = nestedRecord(value, "total_rate");
  const sourcePrices = normalizeSourcePrices(value.prices);
  const nightlyPrice = numberOrNull(nightlyRate.extracted_lowest);

  return {
    propertyToken: stringOrNull(value.property_token),
    name: value.name,
    propertyType: stringOrNull(value.type),
    hotelClass: integerOrNull(value.hotel_class),
    rating: numberOrNull(value.overall_rating),
    reviews: integerOrNull(value.reviews),
    latitude: numberOrNull(coordinates.latitude),
    longitude: numberOrNull(coordinates.longitude),
    nightlyPrice,
    nightlyPriceBeforeTaxes: numberOrNull(
      nightlyRate.extracted_before_taxes_fees,
    ),
    totalPrice: numberOrNull(totalRate.extracted_lowest),
    currency,
    available: nightlyPrice !== null || sourcePrices.length > 0,
    freeCancellation: booleanOrNull(value.free_cancellation),
    sourcePrices,
  };
}

export async function searchSerpApi(
  input: HotelSearchInput,
  apiKey: string | undefined,
): Promise<SourceSearchResult> {
  if (!apiKey) {
    throw new SourceError(
      "SERPAPI_API_KEY is not configured on the server",
      503,
    );
  }

  const params = new URLSearchParams({
    engine: "google_hotels",
    q: input.query,
    check_in_date: input.checkIn,
    check_out_date: input.checkOut,
    adults: String(input.adults),
    children: String(input.children),
    currency: input.currency,
    gl: input.country,
    hl: input.language,
    api_key: apiKey,
  });

  let response: Response;
  try {
    response = await fetch(`${SERPAPI_URL}?${params}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown network error";
    throw new SourceError(`Unable to connect to SerpApi: ${message}`);
  }

  if (!response.ok) {
    throw new SourceError(`SerpApi returned HTTP ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload)) {
    throw new SourceError("SerpApi returned JSON of an unexpected shape");
  }
  if (typeof payload.error === "string") {
    throw new SourceError(`SerpApi error: ${payload.error}`);
  }
  if (!Array.isArray(payload.properties)) {
    throw new SourceError("SerpApi response does not contain a properties array");
  }

  const metadata = nestedRecord(payload, "search_metadata");
  const status = stringOrNull(metadata.status);
  if (status && status !== "Success") {
    throw new SourceError(`SerpApi search status is ${status}`);
  }

  return {
    searchId: stringOrNull(metadata.id),
    rawResponse: payload,
    offers: payload.properties
      .map((property) => normalizeOffer(property, input.currency))
      .filter((offer): offer is HotelOffer => offer !== null),
  };
}
