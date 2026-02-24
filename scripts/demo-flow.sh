#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8787}"

echo "== LLM Copilot Demo Flow =="
echo "Base URL: ${BASE_URL}"

printf "\n1) Health check (shows memory vs postgres backend)\n"
curl -s "${BASE_URL}/api/v1/health"

printf "\n2) Baseline traffic (low chaos)\n"
curl -s -X POST "${BASE_URL}/api/v1/simulate" \
  -H "content-type: application/json" \
  -d '{"count":20,"chaos":{"providerOutage":false,"rateLimitSpike":false,"slowResponses":false}}'

printf "\n3) Incident traffic (outage + rate limit + latency spikes)\n"
curl -s -X POST "${BASE_URL}/api/v1/simulate" \
  -H "content-type: application/json" \
  -d '{"count":45,"chaos":{"providerOutage":true,"rateLimitSpike":true,"slowResponses":true}}'

printf "\n4) One resilient inference through runtime\n"
curl -s -X POST "${BASE_URL}/api/v1/infer" \
  -H "content-type: application/json" \
  -d '{
    "prompt":"Explain why exponential backoff matters in one sentence.",
    "endpoint":"/assistant",
    "model":"gpt-4.1",
    "provider":"mock",
    "chaos":{"rateLimitSpike":true}
  }'

printf "\n5) Snapshot summary + alerts + recommendations\n"
curl -s "${BASE_URL}/api/v1/dashboard/summary"
echo
curl -s "${BASE_URL}/api/v1/alerts"
echo
curl -s "${BASE_URL}/api/v1/recommendations"
echo

printf "\nDemo flow complete. Open %s/ in browser for the visual dashboard.\n" "${BASE_URL}"
