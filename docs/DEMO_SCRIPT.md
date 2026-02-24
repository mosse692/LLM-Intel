# 90-Second Demo Script

## Setup
- Keep dashboard open at `http://localhost:8787/`.
- In a second terminal, run `npm run demo:flow`.

## Talk Track
1. "This is an LLM Cost and Reliability Copilot for small teams."
2. "Instead of only charting metrics, we run a resilient client layer with retries, backoff, timeouts, and fallback models."
3. "First we simulate healthy traffic, then we inject outage-style behavior: rate limits, provider failures, and slow responses."
4. "The dashboard immediately shows reliability degradation via p95 latency and error-related signals."
5. "Alerts identify likely outage conditions and recommendations suggest actions like reducing max tokens or routing low-risk paths to cheaper models."
6. "All telemetry is persisted, so teams can audit historical incidents and daily rollups, not just live snapshots."
7. "The result is lower LLM incident risk and more predictable spend without a heavy observability stack."

## Judge-Facing Close
- "Most tools stop at observability; this project adds runtime resilience and actionability."
- "You can plug in OpenAI via `provider: openai` or keep using simulation mode for testing and demos."
