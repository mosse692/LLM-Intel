import { config } from "../config.js";

function isRetryableStatus(statusCode) {
  return [408, 409, 429, 500, 502, 503, 504].includes(statusCode);
}

export async function geminiModelCall({ prompt, model, maxOutputTokens }) {
  if (!config.geminiApiKey) {
    const err = new Error("GEMINI_API_KEY is not set");
    err.code = 401;
    err.retryable = false;
    throw err;
  }

  const started = Date.now();
  const url = `${config.geminiBaseUrl}/models/${model}:generateContent?key=${config.geminiApiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: maxOutputTokens || 500
      }
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const statusCode = response.status;
    const message =
      payload?.error?.message ||
      `Gemini request failed with status ${statusCode}`;

    const err = new Error(message);
    err.code = statusCode;
    err.retryable = isRetryableStatus(statusCode);
    throw err;
  }

  const usage = payload.usageMetadata || {};
  const text = (payload.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || "")
    .join("");

  return {
    text,
    inputTokens: usage.promptTokenCount || 0,
    outputTokens: usage.candidatesTokenCount || 0,
    latencyMs: Date.now() - started
  };
}
