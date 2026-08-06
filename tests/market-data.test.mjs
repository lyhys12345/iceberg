import assert from "node:assert/strict";
import {
  buildAlphaVantageSnapshot,
  buildMarketSnapshot,
  buildOpenAiMarketSnapshot,
  buildYahooChartSnapshot,
  fetchMarketSnapshot,
  parseStooqCsv,
} from "../src/market-data.mjs";

const csv = `Date,Open,High,Low,Close,Volume
2026-01-01,100,102,99,101,1000
2026-01-02,101,103,100,102,1100
2026-01-03,102,104,101,103,1200
2026-01-04,103,105,102,104,1300
2026-01-05,104,106,103,105,1400
2026-01-06,105,107,104,106,1500
2026-01-07,106,108,105,107,1600
2026-01-08,107,109,106,108,1700
2026-01-09,108,110,107,109,1800
2026-01-10,109,111,108,110,1900
2026-01-11,110,112,109,111,2000
2026-01-12,111,113,110,112,2100
2026-01-13,112,114,111,113,2200
2026-01-14,113,115,112,114,2300
2026-01-15,114,116,113,115,2400
2026-01-16,115,117,114,116,2500
2026-01-17,116,118,115,117,2600
2026-01-18,117,119,116,118,2700
2026-01-19,118,120,117,119,2800
2026-01-20,119,121,118,120,2900
2026-01-21,120,122,119,121,3000
2026-01-22,121,123,120,122,3100
2026-01-23,122,124,121,123,3200
2026-01-24,123,125,122,124,3300
2026-01-25,124,126,123,125,3400
2026-01-26,125,127,124,126,3500
2026-01-27,126,128,125,127,3600
2026-01-28,127,129,126,128,3700
2026-01-29,128,130,127,129,3800
2026-01-30,129,131,128,130,3900
2026-01-31,130,132,129,131,4000`;

const candles = parseStooqCsv(csv);
assert.equal(candles.length, 31);

const snapshot = buildMarketSnapshot("abc", candles, "test");
assert.equal(snapshot.symbol, "ABC");
assert.equal(snapshot.latestClose, 131);
assert.ok(snapshot.return5d > 0);
assert.ok(snapshot.annualizedVolatility >= 0);
assert.equal(snapshot.range20d.high, 132);
assert.equal(snapshot.isStale, true);

const alpha = buildAlphaVantageSnapshot("IBM", {
  "Time Series (Daily)": {
    "2026-08-05": {
      "1. open": "100",
      "2. high": "105",
      "3. low": "98",
      "4. close": "104",
      "5. volume": "1000",
    },
    "2026-08-04": {
      "1. open": "99",
      "2. high": "101",
      "3. low": "97",
      "4. close": "100",
      "5. volume": "900",
    },
  },
});

assert.equal(alpha.symbol, "IBM");
assert.equal(alpha.latestClose, 104);
assert.equal(alpha.source, "Alpha Vantage daily prices");

const yahoo = buildYahooChartSnapshot("DRAM", {
  chart: {
    result: [
      {
        meta: { symbol: "DRAM" },
        timestamp: Array.from({ length: 35 }, (_, index) => 1800000000 + index * 86400),
        indicators: {
          quote: [
            {
              open: Array.from({ length: 35 }, (_, index) => 20 + index),
              high: Array.from({ length: 35 }, (_, index) => 21 + index),
              low: Array.from({ length: 35 }, (_, index) => 19 + index),
              close: Array.from({ length: 35 }, (_, index) => 20.5 + index),
              volume: Array.from({ length: 35 }, () => 1000),
            },
          ],
        },
      },
    ],
  },
});

assert.equal(yahoo.symbol, "DRAM");
assert.equal(yahoo.latestClose, 54.5);
assert.equal(yahoo.source, "Yahoo Finance chart search");

const searched = buildOpenAiMarketSnapshot("DRAM", {
  output_text: JSON.stringify({
    symbol: "DRAM",
    latestPrice: 47.77,
    asOf: "2026-07-28",
    sourceName: "StockAnalysis",
    sourceUrl: "https://stockanalysis.com/etf/dram/",
    notes: "Delayed close quote.",
  }),
});

assert.equal(searched.symbol, "DRAM");
assert.equal(searched.latestClose, 47.77);
assert.equal(searched.source, "OpenAI web search: StockAnalysis");
assert.equal(searched.search.sourceUrl, "https://stockanalysis.com/etf/dram/");

globalThis.window = { location: { protocol: "http:" } };
await assert.rejects(
  () =>
    fetchMarketSnapshot("MSFT", async () => ({
      ok: true,
      async json() {
        return { symbol: "MSFT", needsManualPrice: true };
      },
    })),
  /Enter current price manually/,
);

globalThis.window = { location: { protocol: "file:" } };
await assert.rejects(() => fetchMarketSnapshot("MSFT"), /backend agent and market APIs/);
delete globalThis.window;

console.log("market-data tests passed");
