CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  endpoint TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  status_code INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  attempt_count INTEGER NOT NULL,
  total_retry_delay_ms INTEGER NOT NULL,
  used_fallback_model BOOLEAN NOT NULL,
  metadata JSONB NOT NULL,
  cost_usd NUMERIC(12, 6) NOT NULL,
  error TEXT
);

ALTER TABLE events
ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'mock';

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL,
  resolved BOOLEAN NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  estimated_savings_pct NUMERIC(8, 2) NOT NULL,
  confidence TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_rollups (
  date DATE NOT NULL,
  model TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  total_requests INTEGER NOT NULL,
  error_requests INTEGER NOT NULL,
  total_cost_usd NUMERIC(12, 6) NOT NULL,
  sum_latency_ms BIGINT NOT NULL,
  sum_retries BIGINT NOT NULL,
  fallback_requests INTEGER NOT NULL,
  PRIMARY KEY (date, model, endpoint)
);
