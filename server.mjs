import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { generateAiRiskBrief } from "./src/ai-provider.mjs";
import { fetchMarketSnapshot } from "./src/market-data.mjs";

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
      const snapshot = await fetchMarketSnapshot(symbol);
      sendJson(response, 200, snapshot);
      return;
    }

    if (url.pathname === "/api/ai-risk-brief" && request.method === "POST") {
      const body = await readJson(request);
      const brief = await generateAiRiskBrief(body.report);
      sendJson(response, 200, brief);
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
