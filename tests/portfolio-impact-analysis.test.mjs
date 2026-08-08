import assert from "node:assert/strict";
import { runPortfolioImpactAnalysisSkill } from "../src/agent-skills/portfolio-impact-analysis.mjs";
import { manualMarketSnapshot } from "../src/market-data.mjs";
import { demoPortfolio } from "../src/portfolio-advisor.mjs";

const concentratedMsftPortfolio = {
  riskProfile: "balanced",
  timeHorizon: "long",
  cash: 16000,
  monthlyContribution: 1000,
  holdings: [
    { symbol: "AAPL", name: "Apple", shares: 20, price: 200, theme: "Mega-cap Technology" },
    { symbol: "NVDA", name: "NVIDIA", shares: 20, price: 120, theme: "AI / Semiconductors" },
    { symbol: "VTI", name: "US Total Market ETF", shares: 25, price: 260, theme: "Broad Market" },
  ],
};

const msftImpact = runPortfolioImpactAnalysisSkill({
  trade: {
    symbol: "MSFT",
    plannedBudget: 15000,
    currentPrice: 500,
    cashAvailable: 16000,
  },
  portfolio: concentratedMsftPortfolio,
  market: manualMarketSnapshot("MSFT", 500, 0.28),
});

assert.equal(msftImpact.symbol, "MSFT");
assert.ok(msftImpact.after.symbolWeight > 0.25);
assert.ok(msftImpact.flags.some((flag) => flag.title === "Single-name concentration"));
assert.ok(msftImpact.flags.some((flag) => flag.title === "Low cash after trade" || flag.title === "Cash depletion"));
assert.ok(msftImpact.riskAdjustment.scoreDelta > 0);
assert.ok(msftImpact.riskAdjustment.sizeMultiplier < 1);

const nvdaAddImpact = runPortfolioImpactAnalysisSkill({
  trade: {
    symbol: "NVDA",
    plannedBudget: 5000,
    currentPrice: 120,
  },
  portfolio: demoPortfolio,
  market: manualMarketSnapshot("NVDA", 120, 0.6),
});

assert.ok(nvdaAddImpact.after.symbolWeight > nvdaAddImpact.before.symbolWeight);
assert.ok(nvdaAddImpact.flags.some((flag) => flag.title === "Volatility concentration" || flag.title === "Single-name concentration"));

const broadEtfImpact = runPortfolioImpactAnalysisSkill({
  trade: {
    symbol: "VTI",
    plannedBudget: 5000,
    currentPrice: 260,
  },
  portfolio: demoPortfolio,
  market: manualMarketSnapshot("VTI", 260, 0.18),
});

assert.equal(broadEtfImpact.flags.some((flag) => flag.title === "Single-name concentration"), false);
assert.ok(broadEtfImpact.riskAdjustment.sizeMultiplier >= 0.75);

const highVolImpact = runPortfolioImpactAnalysisSkill({
  trade: {
    symbol: "TSLA",
    plannedBudget: 8000,
    currentPrice: 250,
  },
  portfolio: {
    cash: 10000,
    holdings: [{ symbol: "VTI", name: "US Total Market ETF", shares: 10, price: 260, theme: "Broad Market" }],
  },
  market: manualMarketSnapshot("TSLA", 250, 0.8),
});

assert.ok(highVolImpact.flags.some((flag) => flag.severity === "high"));
assert.equal(highVolImpact.riskAdjustment.recommendationBias, "wait");

const neutralImpact = runPortfolioImpactAnalysisSkill({
  trade: {
    symbol: "MSFT",
    plannedBudget: 1000,
    currentPrice: 500,
  },
  portfolio: null,
});

assert.equal(neutralImpact.source, "neutral");
assert.equal(neutralImpact.riskAdjustment.scoreDelta, 0);
assert.equal(neutralImpact.riskAdjustment.sizeMultiplier, 1);

console.log("portfolio-impact-analysis tests passed");
