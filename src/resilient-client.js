import { config, defaultRoutingByProvider } from "./config.js";
import { recordEvent } from "./metrics-store.js";
import { mockModelCall } from "./providers/mock-provider.js";
import { openaiModelCall } from "./providers/openai-provider.js";
import { groqModelCall } from "./providers/groq-provider.js";
import { sleep } from "./utils.js";

function isRetryableError(error) {
  const retryableCodes = new Set([408, 409, 429, 500, 502, 503, 504]);
  return Boolean(error.retryable || retryableCodes.has(error.code));
}

async function withTimeout(promise, timeoutMs) {
  return await Promise.race([
    promise,
    new Promise((_, reject) => {
      const timeoutError = new Error(`Request timed out after ${timeoutMs}ms`);
      timeoutError.code = 408;
      timeoutError.retryable = true;
      setTimeout(() => reject(timeoutError), timeoutMs);
    })
  ]);
}

function computeBackoffMs(attemptIndex) {
  const expo = config.backoffBaseMs * 2 ** attemptIndex;
  const capped = Math.min(expo, config.maxBackoffMs);
  const jitter = Math.random() * 300;
  return Math.floor(capped + jitter);
}

function getProviderRouting(provider) {
  return (
    defaultRoutingByProvider[provider] ||
    defaultRoutingByProvider.mock
  );
}

async function callProvider({ provider, prompt, model, chaos, maxOutputTokens }) {
  if (provider === "openai") {
    return openaiModelCall({ prompt, model, maxOutputTokens });
  }

  if (provider === "groq") {
    return groqModelCall({ prompt, model, maxOutputTokens });
  }

  return mockModelCall({ prompt, model, chaos });
}

export async function invokeWithResilience({
  prompt,
  endpoint = "/default",
  preferredModel,
  provider,
  metadata = {},
  chaos = {},
  maxOutputTokens
}) {
  const effectiveProvider = provider || config.defaultProvider;
  const providerRouting = getProviderRouting(effectiveProvider);
  const primaryModel = preferredModel || providerRouting.primary;
  const fallbackModel = providerRouting.fallback;

  let attemptCount = 0;
  let totalRetryDelayMs = 0;

  async function executeAgainstModel(model, usedFallbackModel) {
    let lastError;

    for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
      attemptCount += 1;
      const started = Date.now();

      try {
        const response = await withTimeout(
          callProvider({
            provider: effectiveProvider,
            prompt,
            model,
            chaos,
            maxOutputTokens
          }),
          config.requestTimeoutMs
        );

        const latencyMs = Date.now() - started;
        const event = await recordEvent({
          endpoint,
          model,
          provider: effectiveProvider,
          success: true,
          statusCode: 200,
          latencyMs,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          attemptCount,
          totalRetryDelayMs,
          usedFallbackModel,
          metadata
        });

        return {
          ok: true,
          event,
          text: response.text,
          model,
          provider: effectiveProvider
        };
      } catch (error) {
        lastError = error;
        const statusCode = Number(error.code) || 500;
        const retryable = isRetryableError(error);

        if (!retryable || attempt === config.maxRetries) {
          const event = await recordEvent({
            endpoint,
            model,
            provider: effectiveProvider,
            success: false,
            statusCode,
            latencyMs: Date.now() - started,
            inputTokens: error.inputTokens || Math.max(1, Math.ceil(prompt.length / 4)),
            outputTokens: error.outputTokens || 0,
            attemptCount,
            totalRetryDelayMs,
            usedFallbackModel,
            metadata,
            error: error.message
          });

          return {
            ok: false,
            event,
            error: { message: error.message, statusCode },
            model,
            lastError
          };
        }

        const delay = computeBackoffMs(attempt);
        totalRetryDelayMs += delay;
        await sleep(delay);
      }
    }

    return {
      ok: false,
      error: { message: lastError?.message || "Unknown error", statusCode: 500 },
      model
    };
  }

  const primaryAttempt = await executeAgainstModel(primaryModel, false);
  if (primaryAttempt.ok) return primaryAttempt;

  const fallbackAttempt = await executeAgainstModel(fallbackModel, true);
  if (fallbackAttempt.ok) return fallbackAttempt;

  return {
    ok: false,
    error: {
      message: `Primary and fallback failed: ${fallbackAttempt.error?.message || "unknown"}`,
      statusCode: fallbackAttempt.error?.statusCode || 503
    },
    primaryAttempt,
    fallbackAttempt
  };
}
