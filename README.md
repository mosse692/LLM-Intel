# LLM Cost & Reliability Copilot

**Self-hosted monitoring and resilience for LLM applications.**

Track costs, handle outages, and optimize your LLM spend—all running locally on your infrastructure.

## 🎯 Deployment Model

**100% Self-Hosted** — Your data never leaves your machine:
- ✅ Download and install the full stack in your project
- ✅ Run `npm start` to launch server + dashboard
- ✅ All data stays local (in-memory or your own PostgreSQL)
- ✅ No accounts, no sign-ups, no external servers
- ✅ Works offline and in air-gapped environments
- ✅ **Zero monthly fees**

## What it includes

- retries + exponential backoff + jitter
- timeout handling
- fallback model routing
- OpenAI provider support
- Groq provider support
- mock provider with chaos controls (outages, rate-limit spikes, slow responses)
- alerts and action recommendations
- Postgres persistence with daily rollups (memory fallback when DB is not configured)

## 🚀 Quick Start

```bash
# 1. Clone and install
git clone https://github.com/mosse692/LLM-Intel.git
cd LLM-Intel
npm install

# 2. Start the server (includes API + Dashboard)
npm start

# 3. Open the dashboard
open http://localhost:8787
```

**That's it!** No configuration needed. The dashboard will run with mock data by default.

### Optional: Connect Real Providers

Create a `.env` file:
```bash
# Use OpenAI
OPENAI_API_KEY=sk-your-key-here
DEFAULT_PROVIDER=openai

# Or use Groq
GROQ_API_KEY=gsk-your-key-here
DEFAULT_PROVIDER=groq
```

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
