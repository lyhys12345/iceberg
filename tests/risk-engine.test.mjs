import assert from "node:assert/strict";
import { analyzeTrade, defaultRules } from "../src/risk-engine.mjs";

const safeTrade = analyzeTrade({
  symbol: "VOO",
  assetType: "etf",
  direction: "buy",
  positionSize: 500,
  accountSize: 25000,
  maxLoss: 100,
  thesis: "Monthly planned broad-market index contribution. Exit only if the portfolio allocation rule changes.",
  drivers: ["plan"],
  emotionLevel: 2,
});

assert.equal(safeTrade.action.kind, "pass");
assert.ok(safeTrade.score < 40);

const revengeTrade = analyzeTrade({
  symbol: "TSLA",
  assetType: "option",
  direction: "buy",
  positionSize: 3000,
  accountSize: 10000,
  maxLoss: 1000,
  thesis: "Need to make it back quickly after yesterday. Everyone online says this can moon.",
  drivers: ["news", "revenge", "fomo"],
  emotionLevel: 9,
});

assert.equal(revengeTrade.action.kind, "block");
assert.ok(revengeTrade.score >= 70);

const customRules = analyzeTrade(
  {
    symbol: "NVDA",
    assetType: "stock",
    direction: "buy",
    positionSize: 1000,
    accountSize: 50000,
    maxLoss: 400,
    thesis: "Planned entry with defined invalidation and exit if the setup breaks.",
    drivers: ["plan"],
    emotionLevel: 4,
  },
  { ...defaultRules, maxLossDollars: 300 },
);

assert.equal(customRules.action.kind, "slow");
assert.ok(customRules.findings.some((finding) => finding.title === "Loss limit exceeded"));

console.log("risk-engine tests passed");
