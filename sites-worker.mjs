import { generateAiRiskBrief, pickProvider } from "./src/ai-provider.mjs";
import { callGeminiGenerateContent, explainGeminiNetworkError, geminiModel } from "./src/gemini-client.mjs";
import { runIcebergAgent } from "./src/iceberg-agent.mjs";
import { fetchMarketSnapshot } from "./src/market-data.mjs";
import { staticAssets } from "./server/static-assets.mjs";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

export default {
  async fetch(request, env = {}) {
    installProcessEnv(env);

    try {
      const url = new URL(request.url);

      if (url.pathname.startsWith("/api/market/")) {
        const symbol = decodeURIComponent(url.pathname.replace("/api/market/", ""));
        try {
          return json(await fetchMarketSnapshot(symbol, fetch));
        } catch (error) {
          return json({
            symbol,
            needsManualPrice: true,
            error: error.message || "Market data unavailable.",
          });
        }
      }

      if (url.pathname === "/api/ai-status") {
        const check = url.searchParams.get("check") === "1";
        return json({
          provider: pickProvider(process.env),
          hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
          hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
          geminiModel: geminiModel(process.env),
          health: check ? await checkAiHealth() : null,
        });
      }

      if (url.pathname === "/api/ai-risk-brief" && request.method === "POST") {
        const body = await request.json();
        return json(await generateAiRiskBrief(body.report, fetch));
      }

      if (url.pathname === "/api/agent-chat" && request.method === "POST") {
        const body = await request.json();
        return json(await runIcebergAgent(body, { fetchImpl: fetch }));
      }

      return serveStatic(url.pathname);
    } catch (error) {
      return json({ error: error.message || "Server error" }, 500);
    }
  },
};

function installProcessEnv(env) {
  globalThis.process = globalThis.process || { env: {} };
  globalThis.process.env = {
    ...globalThis.process.env,
    ...env,
  };
}

function serveStatic(pathname) {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const asset = staticAssets[cleanPath] || staticAssets["/index.html"];

  if (!asset) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(asset.body, {
    status: 200,
    headers: {
      "Content-Type": asset.contentType || mimeType(cleanPath),
      "Cache-Control": cleanPath === "/index.html" ? "no-cache" : "public, max-age=3600",
    },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

async function checkAiHealth() {
  const provider = pickProvider(process.env);
  if (provider !== "gemini") return { ok: provider !== "local", provider };

  try {
    const model = geminiModel(process.env);
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

function mimeType(pathname) {
  const match = pathname.match(/\.[^.]+$/);
  return mimeTypes[match?.[0] || ""] || "application/octet-stream";
}
