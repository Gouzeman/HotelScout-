export interface HotelSearchRequest {
  query: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  currency: string;
  country: string;
  language: string;
}

export interface SourcePrice {
  source: string | null;
  nightlyPrice: number | null;
}

export interface HotelOffer {
  propertyToken: string | null;
  name: string;
  hotelClass: number | null;
  rating: number | null;
  reviews: number | null;
  nightlyPrice: number | null;
  currency: string;
  freeCancellation: boolean | null;
  sourcePrices: SourcePrice[];
}

export interface HotelSearchResponse {
  runId: number;
  offers: HotelOffer[];
}

export interface HotelHistoryPoint {
  runId: number;
  observedAt: string;
  nightlyPrice: number;
  totalPrice: number | null;
  currency: string;
}

export interface HotelHistoryResponse {
  hotel: {
    propertyToken: string | null;
    name: string;
  };
  points: HotelHistoryPoint[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export async function searchHotels(
  request: HotelSearchRequest,
): Promise<HotelSearchResponse> {
  const response = await fetch(`${API_BASE_URL}/api/hotels/search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });

  const payload: unknown = await response.json();
  if (!response.ok) {
    const error =
      typeof payload === "object" && payload !== null && "error" in payload
        ? String(payload.error)
        : `Сервер вернул HTTP ${response.status}`;
    throw new Error(error);
  }

  return payload as HotelSearchResponse;
}

export async function getHotelHistory(
  hotel: Pick<HotelOffer, "propertyToken" | "name">,
  search: HotelSearchRequest,
): Promise<HotelHistoryResponse> {
  const params = new URLSearchParams({
    name: hotel.name,
    checkIn: search.checkIn,
    checkOut: search.checkOut,
    adults: String(search.adults),
    children: String(search.children),
    currency: search.currency,
  });
  if (hotel.propertyToken) {
    params.set("propertyToken", hotel.propertyToken);
  }

  const response = await fetch(`${API_BASE_URL}/api/hotels/history?${params}`);
  const payload: unknown = await response.json();
  if (!response.ok) {
    const error =
      typeof payload === "object" && payload !== null && "error" in payload
        ? String(payload.error)
        : `Сервер вернул HTTP ${response.status}`;
    throw new Error(error);
  }

  return payload as HotelHistoryResponse;
}
