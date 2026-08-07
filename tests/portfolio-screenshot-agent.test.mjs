import assert from "node:assert/strict";
import {
  normalizeScreenshotResult,
  parseImageDataUrl,
  parsePortfolioScreenshot,
} from "../src/portfolio-screenshot-agent.mjs";

assert.deepEqual(parseImageDataUrl("data:image/png;base64,QUJD"), {
  mimeType: "image/png",
  data: "QUJD",
});
assert.throws(() => parseImageDataUrl("data:text/plain;base64,QUJD"), /PNG, JPEG, or WebP/);

const normalized = normalizeScreenshotResult({
  holdings: [
    { symbol: "nvda", name: "NVIDIA", shares: "10", price: "$120.50" },
    { symbol: "BAD", shares: 0, price: 10 },
  ],
  cash: "$1,250",
  totalValue: "$2,455",
  confidence: 0.77,
  warnings: ["One row was ignored."],
});

assert.equal(normalized.holdings.length, 1);
assert.equal(normalized.holdings[0].symbol, "NVDA");
assert.equal(normalized.holdings[0].price, 120.5);
assert.equal(normalized.cash, 1250);
assert.equal(normalized.confidence, 0.77);

const oldKey = process.env.GEMINI_API_KEY;
process.env.GEMINI_API_KEY = "test-key";
const calls = [];
const parsed = await parsePortfolioScreenshot(
  {
    imageDataUrl: "data:image/jpeg;base64,QUJD",
  },
  async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      holdings: [{ symbol: "VTI", name: "Total Market ETF", shares: 4, price: 260, theme: "Broad Market" }],
                      cash: 500,
                      totalValue: 1540,
                      confidence: 0.91,
                      warnings: [],
                    }),
                  },
                ],
              },
            },
          ],
        };
      },
    };
  },
);

assert.equal(parsed.source, "gemini_vision");
assert.equal(parsed.holdings[0].symbol, "VTI");
assert.equal(calls.length, 1);
const body = JSON.parse(calls[0].options.body);
assert.equal(body.contents[0].parts[1].inlineData.mimeType, "image/jpeg");
assert.equal(body.contents[0].parts[1].inlineData.data, "QUJD");
assert.equal(body.generationConfig.responseMimeType, "application/json");

if (oldKey) process.env.GEMINI_API_KEY = oldKey;
else delete process.env.GEMINI_API_KEY;

console.log("portfolio-screenshot-agent tests passed");
