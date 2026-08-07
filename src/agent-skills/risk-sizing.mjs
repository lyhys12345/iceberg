import { runPreTradeRiskCheckSkill } from "./pre-trade-risk-check.mjs";

export function runRiskSizingSkill(trade, market) {
  const risk = runPreTradeRiskCheckSkill(trade, market);
  const report = risk.report;

  return {
    report,
    decision: report.decision,
    riskScore: report.riskScore,
    sizing: {
      suggestedDollars: report.sizing.suggestedDollars,
      suggestedShares: report.sizing.suggestedShares,
      riskCapDollars: report.sizing.riskCapDollars,
      futurePositionPercent: report.sizing.futurePositionPercent,
      maxSharesByRisk: report.sizing.maxSharesByRisk,
      maxSharesByCash: report.sizing.maxSharesByCash,
      maxSharesByKelly: report.sizing.maxSharesByKelly,
    },
    stop: {
      price: report.scenarios.stop.price,
      lossDollars: Math.abs(report.scenarios.stop.pnl),
    },
    kelly: {
      fullKelly: report.kelly.fullKelly,
      fractionalKelly: report.kelly.fractionalKelly,
      edge: report.kelly.edge,
      payoffRatio: report.kelly.payoffRatio,
    },
    flags: report.flags,
    summary: risk.summary,
  };
}
