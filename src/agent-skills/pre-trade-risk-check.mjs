import { analyzeAdvisorTrade } from "../advisor-engine.mjs";

export function runPreTradeRiskCheckSkill(trade, market) {
  const report = analyzeAdvisorTrade(trade, market);
  return {
    report,
    summary: {
      decision: report.decision.kind,
      riskScore: report.riskScore,
      suggestedDollars: report.sizing.suggestedDollars,
      suggestedShares: report.sizing.suggestedShares,
      futurePositionPercent: report.sizing.futurePositionPercent,
    },
  };
}
