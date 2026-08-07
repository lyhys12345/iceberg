import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { generateAiRiskBrief, pickProvider } from "./src/ai-provider.mjs";
import { callGeminiGenerateContent, explainGeminiNetworkError, geminiModel } from "./src/gemini-client.mjs";
import { runIcebergAgent } from "./src/iceberg-agent.mjs";
import { fetchMarketSnapshot } from "./src/market-data.mjs";
import { parsePortfolioScreenshot } from "./src/portfolio-screenshot-agent.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
await loadEnv();

const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "127.0.0.1";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${host}:${port}`);

    if (url.pathname.startsWith("/api/market/")) {
      const symbol = decodeURIComponent(url.pathname.replace("/api/market/", ""));
      try {
        const snapshot = await fetchMarketSnapshot(symbol);
        sendJson(response, 200, snapshot);
      } catch (error) {
        sendJson(response, 200, {
          symbol,
          needsManualPrice: true,
          error: error.message || "Market data unavailable.",
        });
      }
      return;
    }

    if (url.pathname === "/api/ai-status") {
      const check = url.searchParams.get("check") === "1";
      const health = check ? await checkAiHealth() : null;
      sendJson(response, 200, {
        provider: pickProvider(),
        hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
        hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
        geminiModel: geminiModel(),
        health,
      });
      return;
    }

    if (url.pathname === "/api/ai-risk-brief" && request.method === "POST") {
      const body = await readJson(request);
      const brief = await generateAiRiskBrief(body.report);
      sendJson(response, 200, brief);
      return;
    }

    if (url.pathname === "/api/agent-chat" && request.method === "POST") {
      const body = await readJson(request);
      const result = await runIcebergAgent(body);
      sendJson(response, 200, result);
      return;
    }

    if (url.pathname === "/api/portfolio-screenshot" && request.method === "POST") {
      const body = await readJson(request);
      try {
        const result = await parsePortfolioScreenshot(body);
        sendJson(response, 200, result);
      } catch (error) {
        const message = error.message || "Screenshot parsing failed.";
        const status = /upload a png|unsupported screenshot/i.test(message) ? 400 : 500;
        sendJson(response, status, { error: message });
      }
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Server error" });
  }
});

server.listen(port, host, () => {
  console.log(`Iceberg running at http://${host}:${port}`);
});

async function serveStatic(pathname, response) {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const resolved = normalize(join(root, cleanPath));

  if (!resolved.startsWith(root)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const content = await readFile(resolved);
    response.writeHead(200, { "Content-Type": mimeTypes[extname(resolved)] || "application/octet-stream" });
    response.end(content);
  } catch {
    sendText(response, 404, "Not found");
  }
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function loadEnv() {
  try {
    const content = await readFile(join(root, ".env"), "utf8");
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const [key, ...rest] = trimmed.split("=");
      if (!key || process.env[key]) return;
      process.env[key] = rest.join("=").replace(/^["']|["']$/g, "");
    });
  } catch {
    // .env is optional.
  }
}

function sendJson(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function sendText(response, status, text) {
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(text);
}

async function checkAiHealth() {
  const provider = pickProvider();
  if (provider !== "gemini") return { ok: provider !== "local", provider };

  try {
    const model = geminiModel();
    await callGeminiGenerateContent(
      {
        model,
        prompt: 'Return JSON only: {"ok": true}',
        generationConfig: { responseMimeType: "application/json" },
      },
      fetch,
    );
    return { ok: true, provider, model };
  } catch (error) {
    const diagnosis = explainGeminiNetworkError(error);
    return {
      ok: false,
      provider,
      status: error?.status || 0,
      ...diagnosis,
    };
  }
}
