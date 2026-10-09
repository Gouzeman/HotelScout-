export interface HotelSearchInput {
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
  propertyType: string | null;
  hotelClass: number | null;
  rating: number | null;
  reviews: number | null;
  latitude: number | null;
  longitude: number | null;
  nightlyPrice: number | null;
  nightlyPriceBeforeTaxes: number | null;
  totalPrice: number | null;
  currency: string;
  available: boolean;
  freeCancellation: boolean | null;
  sourcePrices: SourcePrice[];
}

export interface SourceSearchResult {
  searchId: string | null;
  rawResponse: Record<string, unknown>;
  offers: HotelOffer[];
}
