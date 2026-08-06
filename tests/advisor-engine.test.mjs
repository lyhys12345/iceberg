import assert from "node:assert/strict";
import { analyzeAdvisorTrade, calculateKelly } from "../src/advisor-engine.mjs";

const kelly = calculateKelly(55, 12, 8, 25);
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
    kellyFractionPercent: 25,
  },
  market,
);

assert.ok(["consider", "reduce"].includes(report.decision.kind));
assert.ok(report.sizing.suggestedShares > 0);
assert.ok(report.scenarios.stop.pnl < 0);
assert.ok(report.strategy.primaryName);
assert.ok(report.strategy.executionRules.length > 0);

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
    kellyFractionPercent: 25,
  },
  { ...market, symbol: "XYZ", latestClose: 100, annualizedVolatility: 0.9, return20d: 0.3 },
);

assert.equal(badReport.decision.kind, "avoid");
assert.equal(badReport.sizing.suggestedShares, 0);
assert.equal(badReport.strategy.primaryId, "no-trade-wait");

const impulseReport = analyzeAdvisorTrade(
  {
    symbol: "TSLA",
    accountValue: 10000,
    cashAvailable: 1000,
    plannedBudget: 8000,
    currentPrice: 100,
    maxRiskPercent: 1,
    winProbability: 55,
    upsidePercent: 12,
    downsidePercent: 8,
    stopLossPercent: 6,
    targetGainPercent: 12,
    kellyFractionPercent: 25,
    thesis: "I want to go all in with margin because everyone is buying it.",
  },
  { ...market, symbol: "TSLA", latestClose: 100, annualizedVolatility: 0.7 },
);

const impulseFlagTitles = impulseReport.flags.map((flag) => flag.title);
assert.ok(impulseFlagTitles.includes("Impulse language"));
assert.ok(impulseFlagTitles.includes("Oversized request"));
assert.ok(impulseFlagTitles.includes("Cash cap"));

console.log("advisor-engine tests passed");
