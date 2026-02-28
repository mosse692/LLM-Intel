import { config } from "./config.js";
import {
  addAlert,
  addRecommendation,
  getDailySpend,
  getRecentEvents,
  getSummary
} from "./metrics-store.js";

let lastCostAlertAt = 0;
let lastReliabilityAlertAt = 0;
let lastBudgetAlertAt = 0;
let lastRecommendationAt = 0;

const ALERT_COOLDOWN_MS = 5 * 60 * 1000;
const REC_COOLDOWN_MS = 3 * 60 * 1000;

export async function evaluateRules() {
  const now = Date.now();
  const recent = await getRecentEvents(80);
  if (!recent.length) return;

  const summary = await getSummary(80);

  // Budget hard-limit alert (fires regardless of request count)
  const dailySpend = await getDailySpend();
  if (
    dailySpend >= config.budgetDailyUsd &&
    now - lastBudgetAlertAt > ALERT_COOLDOWN_MS
  ) {
    await addAlert({
      type: "budget_exceeded",
      severity: "critical",
      message: `Daily budget of $${config.budgetDailyUsd} exceeded — spent $${dailySpend.toFixed(4)} today. All inference is blocked until midnight or budget is raised.`
    });
    lastBudgetAlertAt = now;
  }

  // Need sufficient data to make reliable decisions
  if (recent.length < 20) return;

  const recent20 = recent.slice(0, 20);
  const baseline60 = recent.slice(20, 80);

  const recentCost = recent20.reduce((sum, e) => sum + e.costUsd, 0);
  const baselineCost = baseline60.reduce((sum, e) => sum + e.costUsd, 0);
  const baselinePerReq = baseline60.length ? baselineCost / baseline60.length : 0;
  const recentPerReq = recent20.length ? recentCost / recent20.length : 0;

  if (
    recent20.length >= 10 &&
    baseline60.length >= 20 &&
    baselinePerReq > 0 &&
    recentPerReq > baselinePerReq * 1.4 &&
    now - lastCostAlertAt > ALERT_COOLDOWN_MS
  ) {
    await addAlert({
      type: "cost_spike",
      severity: "high",
      message: `Cost per request spiked ${(recentPerReq / baselinePerReq).toFixed(2)}x above baseline.`
    });
    lastCostAlertAt = now;
  }

  if (
    recent20.length >= 10 &&
    (summary.errorRate > 0.08 || summary.p95LatencyMs > 2500) &&
    now - lastReliabilityAlertAt > ALERT_COOLDOWN_MS
  ) {
    const reason =
      summary.errorRate > 0.08
        ? `error rate ${(summary.errorRate * 100).toFixed(1)}%`
        : `p95 latency ${summary.p95LatencyMs}ms`;

    await addAlert({
      type: "reliability_degradation",
      severity: "critical",
      message: `Possible model outage/degradation detected (${reason}).`
    });
    lastReliabilityAlertAt = now;
  }

  if (now - lastRecommendationAt < REC_COOLDOWN_MS) return;

  if (summary.errorRate > 0.05 || summary.p95LatencyMs > 2500) {
    await addRecommendation({
      ruleId: "R-RELIABILITY",
      title: "Enable reliability guardrails",
      message:
        "Service is degraded. Route non-critical traffic to fallback models and tighten timeout/retry policy.",
      estimatedSavingsPct: 15,
      confidence: "high"
    });
    lastRecommendationAt = now;
    return;
  }

  const expensiveCalls = recent20.filter(
    (e) => e.model === "gpt-4.1" && e.success && e.outputTokens < 220
  );

  if (expensiveCalls.length >= 5) {
    await addRecommendation({
      ruleId: "R3",
      title: "Route short responses to gpt-4.1-mini",
      message:
        "Detected many short outputs on gpt-4.1. Move low-risk endpoints to gpt-4.1-mini.",
      estimatedSavingsPct: 45,
      confidence: "medium"
    });
    lastRecommendationAt = now;
    return;
  }

  // R4: Prompt caching detection
  // Check if there are repeated prompts/prefixes that could benefit from caching
  const endpointGroups = recent20.reduce((acc, e) => {
    if (!acc[e.endpoint]) acc[e.endpoint] = [];
    acc[e.endpoint].push(e);
    return acc;
  }, {});

  for (const [endpoint, events] of Object.entries(endpointGroups)) {
    if (events.length >= 5) {
      // Check if these requests have high input token counts (indicating large prompts)
      const avgInputTokens = events.reduce((sum, e) => sum + e.inputTokens, 0) / events.length;
      const highInputCalls = events.filter((e) => e.inputTokens > 100).length;

      if (avgInputTokens > 150 && highInputCalls >= 3) {
        await addRecommendation({
          ruleId: "R4",
          title: "Enable prompt caching",
          message:
            `Endpoint ${endpoint} has ${highInputCalls} calls with high input tokens (avg ${Math.round(avgInputTokens)}). Consider prompt caching for repeated prefixes.`,
          estimatedSavingsPct: 35,
          confidence: "medium"
        });
        lastRecommendationAt = now;
        return;
      }
    }
  }

  const heavyOutputs = recent20.filter(
    (e) => e.success && e.outputTokens > 320
  ).length;
  if (heavyOutputs >= 5) {
    await addRecommendation({
      ruleId: "R5",
      title: "Reduce max output tokens",
      message:
        "High output token usage detected. Cap max_tokens for non-critical endpoints.",
      estimatedSavingsPct: 22,
      confidence: "high"
    });
    lastRecommendationAt = now;
    return;
  }

  if (summary.totalCostUsd > config.budgetDailyUsd) {
    await addRecommendation({
      ruleId: "BUDGET",
      title: "Daily budget exceeded",
      message:
        "Daily spend crossed budget. Enable fallback routing and stricter token caps.",
      estimatedSavingsPct: 30,
      confidence: "high"
    });
    lastRecommendationAt = now;
  }
}
