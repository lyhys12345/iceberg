import assert from "node:assert/strict";
import { analyzeAdvisorTrade, calculateKelly } from "../src/advisor-engine.mjs";

const kelly = calculateKelly(55, 12, 8);
assert.ok(kelly.fullKelly > 0);
assert.equal(Number(kelly.fractionalKelly.toFixed(4)), Number((kelly.fullKelly * 0.25).toFixed(4)));

const market = {
  symbol: "MSFT",
  source: "test",
  asOf: "2026-08-05",
  latestClose: 500,
  previousClose: 498,
  return5d: 0.02,
  return20d: 0.04,
  return60d: 0.08,
  annualizedVolatility: 0.24,
  maxDrawdown60d: -0.08,
  range20d: { low: 470, high: 510 },
  trend: "uptrend",
};

const report = analyzeAdvisorTrade(
  {
    symbol: "MSFT",
    accountValue: 50000,
    cashAvailable: 10000,
    currentShares: 5,
    plannedBudget: 5000,
    maxRiskPercent: 1,
    winProbability: 55,
    upsidePercent: 12,
    downsidePercent: 8,
    stopLossPercent: 6,
    targetGainPercent: 12,
  },
  market,
);

assert.ok(["consider", "reduce"].includes(report.decision.kind));
assert.ok(report.sizing.suggestedShares > 0);
assert.ok(report.scenarios.stop.pnl < 0);

const badReport = analyzeAdvisorTrade(
  {
    symbol: "XYZ",
    accountValue: 10000,
    cashAvailable: 10000,
    plannedBudget: 10000,
    maxRiskPercent: 1,
    winProbability: 35,
    upsidePercent: 8,
    downsidePercent: 20,
  },
  { ...market, symbol: "XYZ", latestClose: 100, annualizedVolatility: 0.9, return20d: 0.3 },
);

assert.equal(badReport.decision.kind, "avoid");
assert.equal(badReport.sizing.suggestedShares, 0);

console.log("advisor-engine tests passed");
