import assert from "node:assert/strict";
import {
  analyzePortfolio,
  buildResearchDossier,
  demoPortfolio,
  holdingsToText,
  parseHoldingsText,
  portfolioDefaultsForSymbol,
} from "../src/portfolio-advisor.mjs";

const concentrated = analyzePortfolio({
  riskProfile: "balanced",
  timeHorizon: "long",
  cash: 1000,
  monthlyContribution: 500,
  holdings: [
    { symbol: "NVDA", name: "NVIDIA", shares: 50, price: 120, theme: "AI / Semiconductors" },
    { symbol: "VTI", name: "US Total Market ETF", shares: 5, price: 260, theme: "Broad Market" },
  ],
});

assert.equal(concentrated.largest.symbol, "NVDA");
assert.ok(concentrated.riskScore >= 70, "concentrated single-stock portfolio should score as high risk");
assert.ok(
  concentrated.flags.some((flag) => flag.title === "Single-name concentration"),
  "concentration should create a clear flag",
);
assert.ok(
  concentrated.whatToSell.some((item) => item.symbol === "NVDA"),
  "oversized largest holding should appear in What To Sell",
);

const conservative = analyzePortfolio({
  ...demoPortfolio,
  riskProfile: "conservative",
});

assert.ok(conservative.financialPlan.some((item) => item.detail.includes("10-12%")));

const demoAnalysis = analyzePortfolio(demoPortfolio);
assert.equal(demoAnalysis.largest.symbol, "VTI");
assert.ok(
  !demoAnalysis.whatToSell.some((item) => item.symbol === "VTI"),
  "broad-market ETF should not be treated like a high-risk single-stock trim candidate",
);
assert.ok(
  !demoAnalysis.financialPlan.some((item) => item.detail.includes("Do not add to VTI")),
  "broad-market core allocation should not trigger single-name leader language",
);

const serialized = holdingsToText(demoPortfolio.holdings);
const parsed = parseHoldingsText(serialized);
assert.equal(parsed.length, demoPortfolio.holdings.length);
assert.equal(parsed[0].symbol, "NVDA");

const defaults = portfolioDefaultsForSymbol(demoPortfolio, "NVDA");
assert.ok(Number(defaults.accountValue) > 0);
assert.equal(defaults.currentShares, "10");

const dossier = buildResearchDossier(
  "NVDA",
  {
    latestClose: 125,
    asOf: "2026-08-06",
    return5d: 0.04,
    return20d: 0.12,
    return60d: 0.25,
    annualizedVolatility: 0.62,
    maxDrawdown60d: -0.18,
  },
  analyzePortfolio(demoPortfolio),
);

assert.ok(dossier.facts.some((fact) => fact.includes("last close")));
assert.ok(dossier.fit.some((item) => item.includes("already hold")));
assert.ok(dossier.questions.length >= 3);

console.log("portfolio-advisor tests passed");
