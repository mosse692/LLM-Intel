# LLM Copilot - Integration Guide

## 🚀 Quick Start

### For End Users (Dashboard Only)

```bash
# 1. Clone the repository
git clone https://github.com/mosse692/LLM-Intel.git
cd LLM-Intel

# 2. Install dependencies
npm install

# 3. Start the server
npm start

# 4. Open your browser
open http://localhost:8787
```

**That's it!** Your dashboard is now running at `http://localhost:8787`.

---

## 🛠️ For Developers (Integrate into Your App)

### Installation

```bash
npm install llm-copilot
# or
yarn add llm-copilot
```

### Basic Usage

#### Option 1: Using the HTTP API (Recommended)

Start the LLM Copilot server separately, then make API calls from your application:

```javascript
// Your application code
async function callLLM(prompt) {
  const response = await fetch('http://localhost:8787/api/v1/infer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: prompt,
      endpoint: '/your-endpoint',
      model: 'gpt-4.1',
      provider: 'openai',  // or 'groq', 'mock'
      maxOutputTokens: 500
    })
  });

  const data = await response.json();

  if (data.ok) {
    return data.text;
  } else {
    throw new Error(data.error.message);
  }
}

// Use it
const result = await callLLM('Explain quantum computing in simple terms');
console.log(result);
```

**Benefits:**
- ✅ Zero code changes in your app
- ✅ Automatic retry + fallback
- ✅ Full telemetry and monitoring
- ✅ Cost tracking
- ✅ Dashboard access

#### Option 2: Import as Module

```javascript
import { invokeWithResilience } from 'llm-copilot';

const result = await invokeWithResilience({
  prompt: 'Your prompt here',
  endpoint: '/summarize',
  preferredModel: 'gpt-4.1',
  provider: 'openai'
});

if (result.ok) {
  console.log(result.text);
}
```

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file:

```bash
# Server Configuration
PORT=8787

# Provider API Keys
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...

# Retry Configuration
MAX_RETRIES=3
REQUEST_TIMEOUT_MS=10000
BACKOFF_BASE_MS=200
MAX_BACKOFF_MS=5000

# Cost Controls
BUDGET_DAILY_USD=10.0

# Database (Optional - uses in-memory by default)
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

### Model Routing Configuration

Edit `src/config.js`:

```javascript
export const defaultRoutingByProvider = {
  openai: {
    primary: "gpt-4.1",
    fallback: "gpt-4.1-mini"
  },
  groq: {
    primary: "llama-3.2-90b",
    fallback: "llama-3.2-11b"
  }
};
```

---

## 📊 API Endpoints

### POST /api/v1/infer
Make a resilient LLM inference call.

**Request:**
```json
{
  "prompt": "Your prompt here",
  "endpoint": "/classify",
  "model": "gpt-4.1",
  "provider": "openai",
  "maxOutputTokens": 500,
  "chaos": {
    "rateLimitSpike": false,
    "providerOutage": false
  }
}
```

**Response:**
```json
{
  "ok": true,
  "text": "The response text",
  "model": "gpt-4.1",
  "provider": "openai",
  "event": {
    "id": "uuid",
    "latencyMs": 1234,
    "costUsd": 0.0015,
    "attemptCount": 1,
    "usedFallbackModel": false
  }
}
```

### POST /api/v1/simulate
Generate synthetic traffic for testing.

**Request:**
```json
{
  "count": 50,
  "chaos": {
    "providerOutage": true,
    "rateLimitSpike": true,
    "slowResponses": true
  }
}
```

### POST /api/v1/ingest/csv
Import historical data from CSV.

**Request:**
```json
{
  "csv": "timestamp,model,endpoint,input_tokens,output_tokens,cost_usd,latency_ms,status_code\n2024-01-01T12:00:00Z,gpt-4,/classify,100,50,0.0015,1200,200"
}
```

**CSV Format:**
```csv
timestamp,model,endpoint,input_tokens,output_tokens,cost_usd,latency_ms,status_code
2024-01-01T12:00:00Z,gpt-4,/classify,100,50,0.0015,1200,200
2024-01-01T12:05:00Z,gpt-4-mini,/summarize,80,120,0.0008,800,200
```

### GET /api/v1/dashboard/summary
Get aggregated metrics.

**Response:**
```json
{
  "ok": true,
  "summary": {
    "totalRequests": 150,
    "totalCostUsd": 0.25,
    "errorRate": 0.02,
    "p95LatencyMs": 1500,
    "fallbackRate": 0.05,
    "avgRetries": 0.3,
    "byModel": [
      {
        "model": "gpt-4",
        "requests": 50,
        "costUsd": 0.20,
        "errors": 1,
        "errorRate": 0.02
      }
    ]
  }
}
```

### GET /api/v1/alerts
Get active alerts.

### GET /api/v1/recommendations
Get cost optimization recommendations.

### GET /api/v1/events?limit=50
Get recent events.

---

## 🎯 Use Cases

### 1. Drop-in Monitoring

Add monitoring to existing LLM calls without changing your code:

```javascript
// Before
const completion = await openai.chat.completions.create({...});

// After - just change the endpoint
const response = await fetch('http://localhost:8787/api/v1/infer', {
  method: 'POST',
  body: JSON.stringify({ prompt: '...', model: 'gpt-4' })
});
```

### 2. Cost Tracking by Feature

Track costs per feature/endpoint:

```javascript
// Signup flow
await callLLM('Generate welcome email', { endpoint: '/signup/email' });

// Support bot
await callLLM('Answer support question', { endpoint: '/support/bot' });

// View costs in dashboard grouped by endpoint
```

### 3. A/B Testing Models

Compare costs and quality:

```javascript
const userGroup = getUserGroup(userId);
const model = userGroup === 'A' ? 'gpt-4' : 'gpt-4-mini';

await callLLM(prompt, {
  endpoint: '/experiment/ab-test',
  model: model
});

// Dashboard shows cost/performance by model
```

### 4. Chaos Engineering

Test your app's resilience:

```javascript
await callLLM(prompt, {
  chaos: {
    rateLimitSpike: true,
    providerOutage: true,
    slowResponses: true
  }
});

// See how your app handles retries and fallbacks
```

---

## 🔧 Advanced Configuration

### Custom Retry Logic

```javascript
// src/config.js
export const config = {
  maxRetries: 3,              // Retry up to 3 times
  requestTimeoutMs: 10000,    // 10s timeout
  backoffBaseMs: 200,         // Start with 200ms backoff
  maxBackoffMs: 5000,         // Max 5s backoff
};
```

### Custom Cost Calculations

```javascript
// src/config.js
export const costPerMillion = {
  "gpt-4.1": { input: 10.0, output: 30.0 },
  "gpt-4.1-mini": { input: 0.6, output: 2.4 },
  "llama-3.2-90b": { input: 0.9, output: 0.9 }
};
```

### Alert Thresholds

```javascript
// src/rules.js
const COST_SPIKE_THRESHOLD = 1.4;  // 40% above baseline
const ERROR_RATE_THRESHOLD = 0.08; // 8% error rate
const P95_LATENCY_THRESHOLD = 2500; // 2500ms
```

---

## 🎨 Customizing the Dashboard

The dashboard is a single HTML file at `public/index.html`. Customize it freely:

```javascript
// Change colors
:root {
  --bg: #000;
  --accent: #0066ff;
  --text: #fff;
}

// Modify charts
createChart('chart-cost', {
  type: 'line',
  data: {...},
  options: {...}
});
```

---

## 📦 Deployment

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 8787
CMD ["npm", "start"]
```

```bash
docker build -t llm-copilot .
docker run -p 8787:8787 -e OPENAI_API_KEY=$OPENAI_API_KEY llm-copilot
```

### Vercel / Railway / Fly.io

Deploy as a standard Node.js app. The server is just Express/Node HTTP.

```bash
# Deploy to Railway
railway init
railway up

# Deploy to Fly.io
fly launch
fly deploy
```

---

## 🧪 Testing

Run the test suite:

```bash
npm test
```

Simulate traffic:

```bash
curl -X POST http://localhost:8787/api/v1/simulate \
  -H "Content-Type: application/json" \
  -d '{"count": 100}'
```

---

## 🤝 Contributing

Contributions welcome! Areas of focus:

1. **New providers**: Azure OpenAI, Anthropic, Cohere
2. **Database backends**: Redis, MongoDB, ClickHouse
3. **Export formats**: Prometheus metrics, DataDog integration
4. **Auto-remediation**: Actually apply recommendations
5. **Prompt caching**: Detect and cache repeated prefixes

---

## 📄 License

MIT - Do whatever you want with this code.

---

## 💬 Support

- **GitHub Issues**: Report bugs
- **Docs**: See `/docs` folder
- **Dashboard**: http://localhost:8787
- **Landing Page**: http://localhost:8787/landing.html

---

## 🎯 Roadmap

- [ ] Auto-apply recommendations
- [ ] Anthropic Claude support
- [ ] Real prompt caching (detect + cache)
- [ ] Multi-tenant support
- [ ] Prometheus exporter
- [ ] Slack/Discord alerts
- [ ] Budget enforcement (hard stops)
- [ ] Token-level debugging
