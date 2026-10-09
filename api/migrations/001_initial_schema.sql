CREATE TABLE collection_runs (
    id BIGSERIAL PRIMARY KEY,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    query TEXT NOT NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    adults INTEGER NOT NULL CHECK (adults > 0),
    children INTEGER NOT NULL CHECK (children >= 0),
    currency VARCHAR(3) NOT NULL,
    country VARCHAR(2) NOT NULL,
    language VARCHAR(10) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'error')),
    serpapi_search_id TEXT,
    error_message TEXT,
    raw_response JSONB
);

CREATE TABLE hotel_offers (
    id BIGSERIAL PRIMARY KEY,
    run_id BIGINT NOT NULL REFERENCES collection_runs(id) ON DELETE CASCADE,
    property_token TEXT,
    name TEXT NOT NULL,
    property_type TEXT,
    hotel_class INTEGER,
    rating NUMERIC(3, 2),
    reviews INTEGER,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    nightly_price NUMERIC(14, 2),
    nightly_price_before_taxes NUMERIC(14, 2),
    total_price NUMERIC(14, 2),
    currency VARCHAR(3) NOT NULL,
    available BOOLEAN NOT NULL,
    free_cancellation BOOLEAN,
    source_prices JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX hotel_offers_run_id_idx ON hotel_offers (run_id);
CREATE INDEX hotel_offers_property_token_idx ON hotel_offers (property_token);
CREATE INDEX collection_runs_observed_at_idx ON collection_runs (observed_at DESC);
