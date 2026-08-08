import { runPreTradeRiskCheckSkill } from "./pre-trade-risk-check.mjs";

export function runRiskSizingSkill(trade, market, portfolioImpact = null) {
  const risk = runPreTradeRiskCheckSkill(trade, market);
  const report = applyPortfolioImpact(risk.report, portfolioImpact);

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
    portfolioImpact,
    summary: portfolioImpact?.riskAdjustment?.scoreDelta
      ? `${risk.summary} Portfolio impact reduced the modeled size because the proposed order worsens account-level risk.`
      : risk.summary,
  };
}

function applyPortfolioImpact(report, portfolioImpact) {
  const adjustment = portfolioImpact?.riskAdjustment;
  if (!adjustment || adjustment.sizeMultiplier >= 1 && adjustment.scoreDelta <= 0) return report;

  const multiplier = clamp(Number(adjustment.sizeMultiplier || 1), 0, 1);
  const adjusted = {
    ...report,
    decision: { ...report.decision },
    sizing: { ...report.sizing },
    scenarios: {
      ...report.scenarios,
      bull: { ...report.scenarios.bull },
      base: { ...report.scenarios.base },
      bear: { ...report.scenarios.bear },
      stop: { ...report.scenarios.stop },
    },
    flags: [...report.flags],
    prePortfolioImpactSizing: { ...report.sizing },
    portfolioImpact,
  };

  if (multiplier < 1) {
    adjusted.sizing.suggestedShares = Math.floor(Number(report.sizing.suggestedShares || 0) * multiplier);
    adjusted.sizing.suggestedDollars = adjusted.sizing.suggestedShares * Number(report.trade.currentPrice || 0);
    adjusted.sizing.futurePositionDollars = Number(report.trade.currentShares || 0) * Number(report.trade.currentPrice || 0) + adjusted.sizing.suggestedDollars;
    adjusted.sizing.futurePositionPercent = Number(report.trade.accountValue || 0) > 0 ? adjusted.sizing.futurePositionDollars / Number(report.trade.accountValue) : 0;
    adjusted.scenarios.bull.pnl = adjusted.sizing.suggestedDollars * (Number(report.trade.upsidePercent || 0) / 100);
    adjusted.scenarios.base.pnl = adjusted.sizing.suggestedDollars * (Number(report.market.return20d || 0) / 2);
    adjusted.scenarios.bear.pnl = -adjusted.sizing.suggestedDollars * (Number(report.trade.downsidePercent || 0) / 100);
    adjusted.scenarios.stop.pnl = -Math.abs(adjusted.sizing.suggestedShares * Number(report.trade.currentPrice || 0) * (Number(report.trade.stopLossPercent || 0) / 100));
  }

  adjusted.riskScore = clamp(Math.round(Number(report.riskScore || 0) + Number(adjustment.scoreDelta || 0)), 0, 100);
  adjusted.flags = mergeFlags(
    adjusted.flags,
    (portfolioImpact.flags || []).map((flag) => ({
      title: flag.title,
      detail: flag.detail,
      severity: flag.severity,
      source: "portfolio_impact_analysis",
    })),
  );
  adjusted.decision = pickAdjustedDecision(adjusted.decision, adjusted.riskScore, adjusted.sizing.suggestedShares, adjustment.recommendationBias);

  return adjusted;
}

function pickAdjustedDecision(current, riskScore, suggestedShares, recommendationBias) {
  if (suggestedShares <= 0 || riskScore >= 78 || recommendationBias === "wait") {
    return {
      kind: "avoid",
      title: "Wait because portfolio risk worsens",
      summary: "The trade may look interesting alone, but it makes the whole portfolio too fragile.",
    };
  }

  if (riskScore >= 48 || recommendationBias === "reduce") {
    return {
      kind: "reduce",
      title: "Reduce because portfolio risk rises",
      summary: "Portfolio impact requires a smaller order than the standalone sizing model.",
    };
  }

  return current;
}

function mergeFlags(existing, additions) {
  const seen = new Set(existing.map((flag) => flag.title));
  return [...existing, ...additions.filter((flag) => !seen.has(flag.title))];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
