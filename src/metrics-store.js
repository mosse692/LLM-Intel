import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config, modelCostsPer1k } from "./config.js";
import { nowIso, percentile } from "./utils.js";

const state = {
  events: [],
  alerts: [],
  recommendations: [],
  backend: "memory"
};

let pool = null;

function estimateCost(model, inputTokens, outputTokens) {
  const pricing = modelCostsPer1k[model] || { input: 0.002, output: 0.006 };
  return (
    (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output
  );
}

function normalizeEvent(event) {
  return {
    ...event,
    costUsd: Number(event.costUsd),
    attemptCount: Number(event.attemptCount),
    latencyMs: Number(event.latencyMs),
    inputTokens: Number(event.inputTokens),
    outputTokens: Number(event.outputTokens),
    totalRetryDelayMs: Number(event.totalRetryDelayMs),
    statusCode: Number(event.statusCode)
  };
}

function fromDbEventRow(row) {
  return normalizeEvent({
    id: row.id,
    timestamp: row.timestamp,
    endpoint: row.endpoint,
    provider: row.provider || "mock",
    model: row.model,
    success: row.success,
    statusCode: row.status_code,
    latencyMs: row.latency_ms,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    attemptCount: row.attempt_count,
    totalRetryDelayMs: row.total_retry_delay_ms,
    usedFallbackModel: row.used_fallback_model,
    metadata: row.metadata || {},
    costUsd: row.cost_usd,
    error: row.error || null
  });
}

function fromDbAlertRow(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    resolved: row.resolved,
    type: row.type,
    severity: row.severity,
    message: row.message
  };
}

function fromDbRecRow(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    ruleId: row.rule_id,
    title: row.title,
    message: row.message,
    estimatedSavingsPct: Number(row.estimated_savings_pct),
    confidence: row.confidence
  };
}

async function ensureSchema() {
  const schemaPath = resolve(process.cwd(), "db", "schema.sql");
  const ddl = await readFile(schemaPath, "utf-8");
  await pool.query(ddl);
}

async function hydrateCache() {
  const [eventsRes, alertsRes, recsRes] = await Promise.all([
    pool.query("SELECT * FROM events ORDER BY timestamp DESC LIMIT 5000"),
    pool.query("SELECT * FROM alerts ORDER BY created_at DESC LIMIT 200"),
    pool.query("SELECT * FROM recommendations ORDER BY created_at DESC LIMIT 200")
  ]);

  state.events = eventsRes.rows.reverse().map(fromDbEventRow);
  state.alerts = alertsRes.rows.map(fromDbAlertRow);
  state.recommendations = recsRes.rows.map(fromDbRecRow);
}

export async function initStore() {
  if (!config.databaseUrl) {
    state.backend = "memory";
    return;
  }

  try {
    const { Pool } = await import("pg");
    pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined
    });

    await ensureSchema();
    await hydrateCache();
    state.backend = "postgres";
  } catch (error) {
    state.backend = "memory";
    // eslint-disable-next-line no-console
    console.warn(`Postgres unavailable; using memory store: ${error.message}`);
  }
}

export async function recordEvent(event) {
  const costUsd =
    event.costUsd ?? estimateCost(event.model, event.inputTokens, event.outputTokens);

  const enriched = normalizeEvent({
    id: randomUUID(),
    timestamp: nowIso(),
    ...event,
    provider: event.provider || "mock",
    costUsd: Number(costUsd.toFixed(6))
  });

  state.events.push(enriched);
  if (state.events.length > 5000) state.events.shift();

  if (pool) {
    await pool.query(
      `INSERT INTO events (
        id, timestamp, endpoint, provider, model, success, status_code, latency_ms,
        input_tokens, output_tokens, attempt_count, total_retry_delay_ms,
        used_fallback_model, metadata, cost_usd, error
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16
      )`,
      [
        enriched.id,
        enriched.timestamp,
        enriched.endpoint,
        enriched.provider,
        enriched.model,
        enriched.success,
        enriched.statusCode,
        enriched.latencyMs,
        enriched.inputTokens,
        enriched.outputTokens,
        enriched.attemptCount,
        enriched.totalRetryDelayMs,
        enriched.usedFallbackModel,
        JSON.stringify(enriched.metadata || {}),
        enriched.costUsd,
        enriched.error || null
      ]
    );

    await pool.query(
      `INSERT INTO daily_rollups (
        date, model, endpoint, total_requests, error_requests, total_cost_usd,
        sum_latency_ms, sum_retries, fallback_requests
      ) VALUES (
        DATE($1), $2, $3, 1, $4, $5, $6, $7, $8
      )
      ON CONFLICT (date, model, endpoint)
      DO UPDATE SET
        total_requests = daily_rollups.total_requests + 1,
        error_requests = daily_rollups.error_requests + EXCLUDED.error_requests,
        total_cost_usd = daily_rollups.total_cost_usd + EXCLUDED.total_cost_usd,
        sum_latency_ms = daily_rollups.sum_latency_ms + EXCLUDED.sum_latency_ms,
        sum_retries = daily_rollups.sum_retries + EXCLUDED.sum_retries,
        fallback_requests = daily_rollups.fallback_requests + EXCLUDED.fallback_requests`,
      [
        enriched.timestamp,
        enriched.model,
        enriched.endpoint,
        enriched.success ? 0 : 1,
        enriched.costUsd,
        enriched.latencyMs,
        Math.max(0, enriched.attemptCount - 1),
        enriched.usedFallbackModel ? 1 : 0
      ]
    );
  }

  return enriched;
}

export async function addAlert(alert) {
  // Check for recent duplicate (within last 10 alerts)
  const recentDuplicate = state.alerts.slice(0, 10).find(
    (a) => a.type === alert.type && !a.resolved
  );
  if (recentDuplicate) {
    return recentDuplicate;
  }

  const newAlert = {
    id: randomUUID(),
    createdAt: nowIso(),
    resolved: false,
    ...alert
  };

  state.alerts.unshift(newAlert);
  state.alerts = state.alerts.slice(0, 200);

  if (pool) {
    await pool.query(
      `INSERT INTO alerts (id, created_at, resolved, type, severity, message)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        newAlert.id,
        newAlert.createdAt,
        newAlert.resolved,
        newAlert.type,
        newAlert.severity,
        newAlert.message
      ]
    );
  }

  return newAlert;
}

export async function addRecommendation(rec) {
  // Check for recent duplicate (within last 10 recommendations)
  const recentDuplicate = state.recommendations.slice(0, 10).find(
    (r) => r.ruleId === rec.ruleId && r.status === "open"
  );
  if (recentDuplicate) {
    return recentDuplicate;
  }

  const newRec = {
    id: randomUUID(),
    createdAt: nowIso(),
    status: "open",
    ...rec
  };

  state.recommendations.unshift(newRec);
  state.recommendations = state.recommendations.slice(0, 200);

  if (pool) {
    await pool.query(
      `INSERT INTO recommendations (
        id, created_at, status, rule_id, title, message, estimated_savings_pct, confidence
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        newRec.id,
        newRec.createdAt,
        newRec.status,
        newRec.ruleId,
        newRec.title,
        newRec.message,
        newRec.estimatedSavingsPct,
        newRec.confidence
      ]
    );
  }

  return newRec;
}

async function getLastEvents(lastN) {
  if (!pool) {
    return state.events.slice(-lastN);
  }

  const result = await pool.query(
    "SELECT * FROM events ORDER BY timestamp DESC LIMIT $1",
    [lastN]
  );

  return result.rows.map(fromDbEventRow).reverse();
}

export async function getSummary(lastN = 200) {
  const events = await getLastEvents(lastN);
  const successful = events.filter((e) => e.success);
  const failed = events.filter((e) => !e.success);
  const latencySeries = successful.map((e) => e.latencyMs).filter(Boolean);

  const totalCostUsd = events.reduce((sum, e) => sum + e.costUsd, 0);
  const totalRequests = events.length;
  const errorRate = totalRequests ? failed.length / totalRequests : 0;
  const fallbackRate =
    totalRequests
      ? events.filter((e) => e.usedFallbackModel).length / totalRequests
      : 0;
  const avgRetries =
    totalRequests
      ? events.reduce((sum, e) => sum + (e.attemptCount - 1), 0) / totalRequests
      : 0;

  const byModelMap = new Map();
  for (const evt of events) {
    const cur = byModelMap.get(evt.model) || {
      model: evt.model,
      requests: 0,
      costUsd: 0,
      errors: 0
    };
    cur.requests += 1;
    cur.costUsd += evt.costUsd;
    if (!evt.success) cur.errors += 1;
    byModelMap.set(evt.model, cur);
  }

  return {
    totalRequests,
    totalCostUsd: Number(totalCostUsd.toFixed(4)),
    successRate: Number((1 - errorRate).toFixed(4)),
    errorRate: Number(errorRate.toFixed(4)),
    fallbackRate: Number(fallbackRate.toFixed(4)),
    avgRetries: Number(avgRetries.toFixed(2)),
    p95LatencyMs: Number(percentile(latencySeries, 95).toFixed(1)),
    p50LatencyMs: Number(percentile(latencySeries, 50).toFixed(1)),
    byModel: Array.from(byModelMap.values()).map((m) => ({
      ...m,
      costUsd: Number(m.costUsd.toFixed(4)),
      errorRate: Number((m.errors / m.requests).toFixed(4))
    }))
  };
}

export async function getRecentEvents(limit = 50) {
  if (!pool) {
    return state.events.slice(-limit).reverse();
  }

  const result = await pool.query(
    "SELECT * FROM events ORDER BY timestamp DESC LIMIT $1",
    [limit]
  );
  return result.rows.map(fromDbEventRow);
}

export async function getAlerts(limit = 30) {
  if (!pool) {
    return state.alerts.slice(0, limit);
  }

  const result = await pool.query(
    "SELECT * FROM alerts ORDER BY created_at DESC LIMIT $1",
    [limit]
  );
  return result.rows.map(fromDbAlertRow);
}

export async function getRecommendations(limit = 30) {
  if (!pool) {
    return state.recommendations.slice(0, limit);
  }

  const result = await pool.query(
    "SELECT * FROM recommendations ORDER BY created_at DESC LIMIT $1",
    [limit]
  );
  return result.rows.map(fromDbRecRow);
}

export function getStoreInfo() {
  return {
    backend: state.backend,
    postgresEnabled: Boolean(pool)
  };
}

export async function clearAllData() {
  if (pool) {
    await Promise.all([
      pool.query("DELETE FROM events"),
      pool.query("DELETE FROM alerts"),
      pool.query("DELETE FROM recommendations")
    ]);
  }
  state.events = [];
  state.alerts = [];
  state.recommendations = [];
}
