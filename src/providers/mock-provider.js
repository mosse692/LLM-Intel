import { sleep } from "../utils.js";

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function maybe(probability) {
  return Math.random() < probability;
}

export async function mockModelCall({ prompt, model, chaos = {} }) {
  const inputTokens = Math.max(1, Math.ceil(prompt.length / 4));
  const outputTokens = randomInt(60, 380);

  const baseLatency = model.includes("mini") ? 350 : 900;
  let latencyMs = baseLatency + randomInt(80, 650);

  if (chaos.slowResponses) {
    latencyMs += randomInt(900, 2400);
  }

  if (chaos.rateLimitSpike && maybe(0.2)) {
    const err = new Error("Rate limit exceeded");
    err.code = 429;
    err.retryable = true;
    err.inputTokens = inputTokens;
    err.outputTokens = 0;
    await sleep(randomInt(100, 400));
    throw err;
  }

  if (chaos.providerOutage && maybe(0.25)) {
    const err = new Error("Provider unavailable");
    err.code = 503;
    err.retryable = true;
    err.inputTokens = inputTokens;
    err.outputTokens = 0;
    await sleep(randomInt(100, 300));
    throw err;
  }

  if (maybe(0.04)) {
    const err = new Error("Transient internal error");
    err.code = 500;
    err.retryable = true;
    err.inputTokens = inputTokens;
    err.outputTokens = 0;
    await sleep(randomInt(100, 300));
    throw err;
  }

  await sleep(latencyMs);

  return {
    text: `Mock response from ${model} (${outputTokens} tokens)`,
    inputTokens,
    outputTokens,
    latencyMs
  };
}
