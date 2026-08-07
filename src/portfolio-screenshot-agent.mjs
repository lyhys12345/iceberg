import { callGeminiGenerateContent, parseJsonFromText, readGeminiText } from "./gemini-client.mjs";

const allowedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function parsePortfolioScreenshot(input, fetchImpl = fetch) {
  const image = parseImageDataUrl(input?.imageDataUrl || "");
  const data = await callGeminiGenerateContent(
    {
      prompt: portfolioScreenshotPrompt(),
      parts: [
        {
          inlineData: {
            mimeType: image.mimeType,
            data: image.data,
          },
        },
      ],
      generationConfig: { responseMimeType: "application/json" },
    },
    fetchImpl,
  );
  const parsed = parseJsonFromText(readGeminiText(data));
  return normalizeScreenshotResult(parsed);
}

export function parseImageDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error("Upload a PNG, JPEG, or WebP portfolio screenshot.");
  }

  const [, mimeType, data] = match;
  if (!allowedMimeTypes.has(mimeType)) {
    throw new Error("Unsupported screenshot type.");
  }

  return { mimeType, data };
}

export function normalizeScreenshotResult(result) {
  const holdings = Array.isArray(result?.holdings)
    ? result.holdings
        .map((holding) => ({
          symbol: String(holding.symbol || "").trim().toUpperCase(),
          name: String(holding.name || holding.symbol || "").trim(),
          shares: positiveNumber(holding.shares),
          price: positiveNumber(holding.price),
          theme: String(holding.theme || inferTheme(holding.symbol, holding.name)).trim(),
        }))
        .filter((holding) => holding.symbol && holding.shares > 0 && holding.price > 0)
    : [];

  return {
    holdings,
    cash: positiveNumber(result?.cash),
    totalValue: positiveNumber(result?.totalValue),
    confidence: clamp(Number(result?.confidence) || 0.5, 0, 1),
    warnings: asStringArray(result?.warnings),
    source: "gemini_vision",
  };
}

function portfolioScreenshotPrompt() {
  return [
    "You are Iceberg's portfolio screenshot parser.",
    "Read this brokerage or portfolio screenshot and extract only visible holdings. Do not invent missing positions.",
    "For each holding, return ticker symbol, display name, share quantity, latest/market price per share, and theme.",
    "If market value is visible but price is not, leave that holding out unless quantity and price can both be inferred clearly.",
    "Ignore daily P/L, total gain/loss, percentage return, watchlist rows, ads, buttons, and account navigation text.",
    "Return JSON only with keys: holdings, cash, totalValue, confidence, warnings.",
    "holdings must be an array of objects: symbol, name, shares, price, theme.",
    "cash and totalValue should be numbers if visible, otherwise 0. confidence is 0 to 1.",
  ].join("\n");
}

function positiveNumber(value) {
  const parsed = Number(String(value ?? "").replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function asStringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function inferTheme(symbol, name) {
  const text = `${symbol || ""} ${name || ""}`.toLowerCase();
  if (/vti|voo|spy|qqq|index|s&p|total market|etf/.test(text)) return "Broad Market";
  if (/bond|treasury|cash|money market|bnd|sgov/.test(text)) return "Defensive";
  if (/nvda|amd|semiconductor|ai/.test(text)) return "AI / Semiconductors";
  if (/tsla|consumer/.test(text)) return "Consumer Discretionary";
  return "Single Stock";
}
