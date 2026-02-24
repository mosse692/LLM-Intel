import { config } from "../config.js";

function isRetryableStatus(statusCode) {
  return [408, 409, 429, 500, 502, 503, 504].includes(statusCode);
}

function extractOutputText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.length > 0) {
    return payload.output_text;
  }

  const parts = [];
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) {
        parts.push(content.text);
      }
    }
  }

  return parts.join("\n") || "";
}

export async function openaiModelCall({ prompt, model, maxOutputTokens }) {
  if (!config.openaiApiKey) {
    const err = new Error("OPENAI_API_KEY is not set");
    err.code = 401;
    err.retryable = false;
    throw err;
  }

  const started = Date.now();
  const response = await fetch(`${config.openaiBaseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: maxOutputTokens || 500
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const statusCode = response.status;
    const message =
      payload?.error?.message ||
      `OpenAI request failed with status ${statusCode}`;

    const err = new Error(message);
    err.code = statusCode;
    err.retryable = isRetryableStatus(statusCode);
    throw err;
  }

  const usage = payload.usage || {};
  const inputTokens = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;
  const text = extractOutputText(payload);

  return {
    text,
    inputTokens,
    outputTokens,
    latencyMs: Date.now() - started
  };
}
