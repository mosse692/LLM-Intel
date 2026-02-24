import { config } from "../config.js";

function isRetryableStatus(statusCode) {
  return [408, 409, 429, 500, 502, 503, 504].includes(statusCode);
}

function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.type === "text") return part.text || "";
        return "";
      })
      .join("\n");
  }
  return "";
}

export async function groqModelCall({ prompt, model, maxOutputTokens }) {
  if (!config.groqApiKey) {
    const err = new Error("GROQ_API_KEY is not set");
    err.code = 401;
    err.retryable = false;
    throw err;
  }

  const started = Date.now();
  const response = await fetch(`${config.groqBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.groqApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxOutputTokens || 500,
      temperature: 0.2
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const statusCode = response.status;
    const message =
      payload?.error?.message ||
      payload?.message ||
      `Groq request failed with status ${statusCode}`;

    const err = new Error(message);
    err.code = statusCode;
    err.retryable = isRetryableStatus(statusCode);
    throw err;
  }

  const usage = payload.usage || {};
  const choice = payload.choices?.[0];
  const text = extractText(choice?.message?.content);

  return {
    text,
    inputTokens: usage.prompt_tokens || 0,
    outputTokens: usage.completion_tokens || 0,
    latencyMs: Date.now() - started
  };
}
