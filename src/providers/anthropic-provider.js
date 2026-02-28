import { config } from "../config.js";

function isRetryableStatus(statusCode) {
  return [408, 409, 429, 500, 502, 503, 504].includes(statusCode);
}

export async function anthropicModelCall({ prompt, model, maxOutputTokens }) {
  if (!config.anthropicApiKey) {
    const err = new Error("ANTHROPIC_API_KEY is not set");
    err.code = 401;
    err.retryable = false;
    throw err;
  }

  const started = Date.now();
  const response = await fetch(`${config.anthropicBaseUrl}/messages`, {
    method: "POST",
    headers: {
      "x-api-key": config.anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      max_tokens: maxOutputTokens || 500,
      messages: [{ role: "user", content: prompt }]
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const statusCode = response.status;
    const message =
      payload?.error?.message ||
      `Anthropic request failed with status ${statusCode}`;

    const err = new Error(message);
    err.code = statusCode;
    err.retryable = isRetryableStatus(statusCode);
    throw err;
  }

  const usage = payload.usage || {};
  const text = (payload.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return {
    text,
    inputTokens: usage.input_tokens || 0,
    outputTokens: usage.output_tokens || 0,
    latencyMs: Date.now() - started
  };
}
