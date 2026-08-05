import assert from "node:assert/strict";
import { analyzeAdvisorTrade } from "../src/advisor-engine.mjs";
import { createAiRiskBrief } from "../src/ai-risk-layer.mjs";

const report = analyzeAdvisorTrade(
  {
    symbol: "AAPL",
    accountValue: 25000,
    cashAvailable: 8000,
    currentPrice: 200,
    plannedBudget: 3000,
    maxRiskPercent: 1,
    winProbability: 55,
    upsidePercent: 12,
    downsidePercent: 8,
    stopLossPercent: 6,
    targetGainPercent: 12,
    kellyFractionPercent: 25,
    thesis: "Everyone is buying now and I do not want to miss out on the breakout.",
  },
  {
    symbol: "AAPL",
    source: "test",
    asOf: "2026-08-05",
    latestClose: 200,
    return5d: 0.02,
    return20d: 0.05,
    return60d: 0.08,
    annualizedVolatility: 0.3,
    maxDrawdown60d: -0.08,
    range20d: { low: 190, high: 210 },
    trend: "uptrend",
    isStale: false,
  },
);

const brief = createAiRiskBrief(report);
assert.equal(brief.pattern, "possible FOMO");
assert.ok(brief.missingItems.length > 0);
assert.ok(brief.confidence > 0);

console.log("ai-risk-layer tests passed");
