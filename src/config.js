import { loadEnvFile } from "./load-env.js";

loadEnvFile();

export const config = {
  port: process.env.PORT ? Number(process.env.PORT) : 8787,
  requestTimeoutMs: process.env.REQUEST_TIMEOUT_MS
    ? Number(process.env.REQUEST_TIMEOUT_MS)
    : 10_000,
  maxRetries: process.env.MAX_RETRIES ? Number(process.env.MAX_RETRIES) : 4,
  backoffBaseMs: process.env.BACKOFF_BASE_MS
    ? Number(process.env.BACKOFF_BASE_MS)
    : 250,
  maxBackoffMs: process.env.MAX_BACKOFF_MS
    ? Number(process.env.MAX_BACKOFF_MS)
    : 8_000,
  budgetDailyUsd: process.env.BUDGET_DAILY_USD
    ? Number(process.env.BUDGET_DAILY_USD)
    : 25,
  databaseUrl: process.env.DATABASE_URL || "",
  databaseSsl: process.env.DATABASE_SSL === "true",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  groqApiKey: process.env.GROQ_API_KEY || "",
  groqBaseUrl: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiBaseUrl: process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta",
  defaultProvider: process.env.DEFAULT_PROVIDER || "mock"
};

export const modelCostsPer1k = {
  "gpt-4.1": { input: 0.005, output: 0.015 },
  "gpt-4.1-mini": { input: 0.001, output: 0.003 },
  "gpt-4o-mini": { input: 0.0006, output: 0.0024 },
  "llama-3.1-8b-instant": { input: 0.00005, output: 0.00008 },
  "llama-3.3-70b-versatile": { input: 0.00059, output: 0.00079 },
  "claude-opus-4-6": { input: 0.015, output: 0.075 },
  "claude-sonnet-4-6": { input: 0.003, output: 0.015 },
  "claude-haiku-4-5-20251001": { input: 0.0008, output: 0.004 },
  "gemini-2.0-flash": { input: 0.000075, output: 0.0003 },
  "gemini-1.5-flash": { input: 0.000075, output: 0.0003 },
  "gemini-1.5-pro": { input: 0.00125, output: 0.005 }
};

export const defaultRoutingByProvider = {
  mock: {
    primary: "gpt-4.1",
    fallback: "gpt-4.1-mini"
  },
  openai: {
    primary: "gpt-4.1",
    fallback: "gpt-4.1-mini"
  },
  groq: {
    primary: process.env.GROQ_PRIMARY_MODEL || "llama-3.1-8b-instant",
    fallback: process.env.GROQ_FALLBACK_MODEL || "llama-3.3-70b-versatile"
  },
  anthropic: {
    primary: process.env.ANTHROPIC_PRIMARY_MODEL || "claude-sonnet-4-6",
    fallback: process.env.ANTHROPIC_FALLBACK_MODEL || "claude-haiku-4-5-20251001"
  },
  gemini: {
    primary: process.env.GEMINI_PRIMARY_MODEL || "gemini-2.0-flash",
    fallback: process.env.GEMINI_FALLBACK_MODEL || "gemini-1.5-flash"
  }
};
