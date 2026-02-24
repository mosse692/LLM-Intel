# LLM Cost & Reliability Copilot (MVP)

A hackathon starter that implements a resilient LLM runtime plus dashboard for cost and outage visibility.

## What it includes

- retries + exponential backoff + jitter
- timeout handling
- fallback model routing
- OpenAI provider support
- Groq provider support
- mock provider with chaos controls (outages, rate-limit spikes, slow responses)
- alerts and action recommendations
- Postgres persistence with daily rollups (memory fallback when DB is not configured)

## Install and run

```bash
npm install
npm start
```

Open:
- `http://localhost:8787/`

## Environment variables

- `PORT` (default `8787`)
- `DEFAULT_PROVIDER` (`mock`, `openai`, or `groq`; default `mock`)
- `OPENAI_API_KEY` (required when using `openai` provider)
- `OPENAI_BASE_URL` (default `https://api.openai.com/v1`)
- `GROQ_API_KEY` (required when using `groq` provider)
- `GROQ_BASE_URL` (default `https://api.groq.com/openai/v1`)
- `GROQ_PRIMARY_MODEL` (default `llama-3.1-8b-instant`)
- `GROQ_FALLBACK_MODEL` (default `llama-3.3-70b-versatile`)
- `DATABASE_URL` (optional, enables Postgres)
- `DATABASE_SSL` (`true` or `false`, default `false`)
- `REQUEST_TIMEOUT_MS` (default `10000`)
- `MAX_RETRIES` (default `4`)
- `BACKOFF_BASE_MS` (default `250`)
- `MAX_BACKOFF_MS` (default `8000`)
- `BUDGET_DAILY_USD` (default `25`)

Note: `.env` is auto-loaded via `dotenv`.

## API

- `POST /api/v1/infer`
- `POST /api/v1/simulate`
- `GET /api/v1/dashboard/summary`
- `GET /api/v1/events?limit=25`
- `GET /api/v1/alerts`
- `GET /api/v1/recommendations`
- `GET /api/v1/health`

## Example requests

### Inference (mock provider)

```bash
curl -X POST http://localhost:8787/api/v1/infer \
  -H "content-type: application/json" \
  -d '{
    "prompt":"Explain fallback models in one sentence",
    "endpoint":"/assistant",
    "model":"gpt-4.1",
    "provider":"mock",
    "chaos":{"rateLimitSpike":true}
  }'
```

### Inference (OpenAI provider)

```bash
curl -X POST http://localhost:8787/api/v1/infer \
  -H "content-type: application/json" \
  -d '{
    "prompt":"Explain fallback models in one sentence",
    "endpoint":"/assistant",
    "model":"gpt-4.1-mini",
    "provider":"openai",
    "maxOutputTokens":300
  }'
```

### Inference (Groq provider)

```bash
curl -X POST http://localhost:8787/api/v1/infer \
  -H "content-type: application/json" \
  -d '{
    "prompt":"Explain fallback models in one sentence",
    "endpoint":"/assistant",
    "model":"llama-3.1-8b-instant",
    "provider":"groq",
    "maxOutputTokens":300
  }'
```

### Incident simulation

```bash
curl -X POST http://localhost:8787/api/v1/simulate \
  -H "content-type: application/json" \
  -d '{"count":45}'
```

### Health / backend mode

```bash
curl -s http://localhost:8787/api/v1/health
```

## Postgres notes

- SQL schema is in `db/schema.sql`.
- When `DATABASE_URL` is set, tables are created on boot.
- Events, alerts, recommendations, and daily rollups are persisted.

## Demo flow

Run:

```bash
npm run demo:flow
```

Narrative script:
- `docs/DEMO_SCRIPT.md`

## Key files

- `src/resilient-client.js`: runtime resilience logic
- `src/providers/openai-provider.js`: OpenAI adapter
- `src/providers/groq-provider.js`: Groq adapter
- `src/providers/mock-provider.js`: chaos simulator
- `src/metrics-store.js`: Postgres-backed telemetry store
- `src/rules.js`: alerting and recommendation rules
- `src/server.js`: API + dashboard server
- `public/index.html`: dashboard UI
