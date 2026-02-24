import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "./config.js";
import {
  getAlerts,
  getRecommendations,
  getRecentEvents,
  getStoreInfo,
  getSummary,
  initStore
} from "./metrics-store.js";
import { invokeWithResilience } from "./resilient-client.js";
import { evaluateRules } from "./rules.js";
import { readJsonBody, sendJson } from "./utils.js";

async function serveDashboard(res) {
  const htmlPath = resolve(process.cwd(), "public", "index.html");
  const html = await readFile(htmlPath, "utf-8");
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

async function serveStaticFile(res, filename) {
  try {
    const filePath = resolve(process.cwd(), "public", filename);
    const content = await readFile(filePath, "utf-8");
    const contentType = filename.endsWith(".html")
      ? "text/html; charset=utf-8"
      : "text/plain";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch (error) {
    notFound(res);
  }
}

function notFound(res) {
  sendJson(res, 404, { error: "Not found" });
}

async function handleInfer(req, res) {
  try {
    const body = await readJsonBody(req);
    const prompt = body.prompt || "Summarize this request in one sentence.";
    const endpoint = body.endpoint || "/chat";
    const preferredModel = body.model;
    const provider = body.provider;
    const maxOutputTokens = body.maxOutputTokens;
    const chaos = body.chaos || {};

    const result = await invokeWithResilience({
      prompt,
      endpoint,
      preferredModel,
      provider,
      maxOutputTokens,
      chaos,
      metadata: { source: body.source || "manual" }
    });

    await evaluateRules();

    if (!result.ok) {
      return sendJson(res, 503, {
        ok: false,
        error: result.error
      });
    }

    return sendJson(res, 200, {
      ok: true,
      provider: result.provider,
      model: result.model,
      text: result.text,
      event: result.event
    });
  } catch (error) {
    return sendJson(res, 400, { ok: false, error: { message: error.message } });
  }
}

async function handleSimulate(req, res) {
  try {
    const body = await readJsonBody(req);
    const count = Math.max(1, Math.min(Number(body.count) || 40, 200));
    const chaos = body.chaos || {
      providerOutage: true,
      rateLimitSpike: true,
      slowResponses: true
    };

    for (let i = 0; i < count; i += 1) {
      await invokeWithResilience({
        prompt: `Synthetic request ${i + 1}`,
        endpoint: i % 2 === 0 ? "/summarize" : "/classify",
        preferredModel: i % 3 === 0 ? "gpt-4.1" : "gpt-4.1-mini",
        provider: "mock",
        chaos,
        metadata: { source: "simulator" }
      });
    }

    await evaluateRules();
    sendJson(res, 200, { ok: true, message: `Simulated ${count} requests` });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: { message: error.message } });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/") {
    return serveDashboard(res);
  }

  if (req.method === "GET" && url.pathname === "/api/v1/health") {
    return sendJson(res, 200, { ok: true, ...getStoreInfo() });
  }

  if (req.method === "GET" && url.pathname === "/api/v1/dashboard/summary") {
    const summary = await getSummary(250);
    return sendJson(res, 200, { ok: true, summary });
  }

  if (req.method === "GET" && url.pathname === "/api/v1/events") {
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
    const events = await getRecentEvents(limit);
    return sendJson(res, 200, { ok: true, events });
  }

  if (req.method === "GET" && url.pathname === "/api/v1/alerts") {
    const alerts = await getAlerts(50);
    return sendJson(res, 200, { ok: true, alerts });
  }

  if (req.method === "GET" && url.pathname === "/api/v1/recommendations") {
    const recommendations = await getRecommendations(50);
    return sendJson(res, 200, { ok: true, recommendations });
  }

  if (req.method === "POST" && url.pathname === "/api/v1/infer") {
    return handleInfer(req, res);
  }

  if (req.method === "POST" && url.pathname === "/api/v1/simulate") {
    return handleSimulate(req, res);
  }

  // Serve static HTML files from public directory
  if (req.method === "GET" && url.pathname.endsWith(".html")) {
    const filename = url.pathname.slice(1); // Remove leading slash
    return serveStaticFile(res, filename);
  }

  return notFound(res);
});

async function boot() {
  await initStore();

  server.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`LLM Copilot running at http://localhost:${config.port}`);
  });
}

boot().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`Failed to boot server: ${error.message}`);
  process.exitCode = 1;
});
