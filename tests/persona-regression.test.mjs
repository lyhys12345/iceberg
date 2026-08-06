import assert from "node:assert/strict";
import { analyzeAdvisorTrade } from "../src/advisor-engine.mjs";
import { createAiRiskBrief } from "../src/ai-risk-layer.mjs";
import { beginnerMissingFields, parseBeginnerTradeMessage } from "../src/conversation-agent.mjs";
import { manualMarketSnapshot } from "../src/market-data.mjs";

const market = manualMarketSnapshot("TSLA", 250, 0.7);

const vagueBeginner = parseBeginnerTradeMessage("I want to buy DRAM ETF, is now a good time to trade?");
assert.deepEqual(beginnerMissingFields(vagueBeginner), ["account value", "planned amount", "current price"]);

const allInParsed = parseBeginnerTradeMessage(
  "I want to go all in with margin because everyone is buying TSLA. Account $10000, cash $1000, buy $8000. Current price $250.",
);
assert.equal(allInParsed.symbol, "TSLA");
assert.equal(allInParsed.accountValue, "10000");
assert.equal(allInParsed.cashAvailable, "1000");
assert.equal(allInParsed.plannedBudget, "8000");
assert.equal(allInParsed.currentPrice, "250");

const allInReport = analyzeAdvisorTrade(
  {
    symbol: "TSLA",
    accountValue: 10000,
    cashAvailable: 1000,
    plannedBudget: 8000,
    currentPrice: 250,
    maxRiskPercent: 1,
    winProbability: 55,
    upsidePercent: 12,
    downsidePercent: 8,
    stopLossPercent: 6,
    targetGainPercent: 12,
    kellyFractionPercent: 25,
    thesis: "I want to go all in with margin because everyone is buying it today.",
  },
  market,
);
assert.equal(allInReport.decision.kind, "avoid");
assert.equal(allInReport.strategy.primaryId, "no-trade-wait");
assert.deepEqual(
  ["Impulse language", "Oversized request", "Cash cap", "High volatility"].every((title) => allInReport.flags.some((flag) => flag.title === title)),
  true,
);

const chineseAllInReport = analyzeAdvisorTrade(
  {
    symbol: "NVDA",
    accountValue: 30000,
    cashAvailable: 5000,
    plannedBudget: 30000,
    currentPrice: 120,
    maxRiskPercent: 1,
    winProbability: 55,
    upsidePercent: 12,
    downsidePercent: 8,
    stopLossPercent: 6,
    targetGainPercent: 12,
    kellyFractionPercent: 25,
    thesis: "我想满仓加杠杆买 NVDA，亏了也想尽快回本。",
  },
  manualMarketSnapshot("NVDA", 120, 0.6),
);
assert.ok(chineseAllInReport.flags.some((flag) => flag.title === "Impulse language"));
assert.ok(chineseAllInReport.flags.some((flag) => flag.title === "Oversized request"));

const concentratedReport = analyzeAdvisorTrade(
  {
    symbol: "TSLA",
    accountValue: 25000,
    cashAvailable: 5000,
    currentShares: 80,
    plannedBudget: 3000,
    currentPrice: 250,
    maxRiskPercent: 1,
    winProbability: 55,
    upsidePercent: 12,
    downsidePercent: 8,
    stopLossPercent: 6,
    targetGainPercent: 12,
    kellyFractionPercent: 25,
    thesis: "I already own TSLA and want to add more with a stop and target.",
  },
  market,
);
assert.equal(concentratedReport.decision.kind, "avoid");
assert.ok(concentratedReport.flags.some((flag) => flag.title === "Concentration risk"));
assert.ok(["no-trade-wait", "rebalance-reduce"].includes(concentratedReport.strategy.primaryId));

const overconfidentReport = analyzeAdvisorTrade(
  {
    symbol: "AAPL",
    accountValue: 20000,
    cashAvailable: 10000,
    plannedBudget: 5000,
    currentPrice: 200,
    maxRiskPercent: 1,
    winProbability: 95,
    upsidePercent: 50,
    downsidePercent: 5,
    stopLossPercent: 5,
    targetGainPercent: 50,
    kellyFractionPercent: 100,
    thesis: "I am sure this wins.",
  },
  manualMarketSnapshot("AAPL", 200, 0.28),
);
assert.ok(overconfidentReport.sizing.suggestedDollars <= 1000);
assert.ok(overconfidentReport.flags.some((flag) => flag.title === "Unverified edge"));

const optionsCurious = analyzeAdvisorTrade(
  {
    symbol: "NVDA",
    accountValue: 25000,
    cashAvailable: 8000,
    currentShares: 20,
    plannedBudget: 2000,
    currentPrice: 120,
    maxRiskPercent: 1,
    winProbability: 55,
    upsidePercent: 12,
    downsidePercent: 8,
    stopLossPercent: 6,
    targetGainPercent: 12,
    kellyFractionPercent: 25,
    thesis: "I want to use options to protect this but I only plan to own 20 shares.",
  },
  manualMarketSnapshot("NVDA", 120, 0.35),
);
assert.ok(optionsCurious.flags.some((flag) => flag.title === "Options mismatch"));

const brief = createAiRiskBrief(allInReport);
assert.equal(brief.pattern, "possible FOMO");
assert.match(brief.summary, /No Trade|Wait|avoid|rewritten/i);

console.log("persona-regression tests passed");
