const urgencyTerms = ["now", "today", "can't miss", "cant miss", "everyone", "viral", "breakout", "miss out", "moon", "recover"];
const planTerms = ["stop", "invalidation", "exit", "risk", "size", "target", "thesis", "because"];

export function createAiRiskBrief(report) {
  const thesis = String(report.trade.thesis || "").toLowerCase();
  const missingItems = [];
  const signals = [];

  if (report.trade.thesis.length < 50) {
    missingItems.push("clear trade thesis");
  }

  if (!planTerms.some((term) => thesis.includes(term))) {
    missingItems.push("invalidation or exit condition");
  }

  if (report.sizing.suggestedShares <= 0) {
    signals.push("No safe position size under current assumptions.");
  }

  if (report.kelly.edge <= 0) {
    signals.push("The win-rate and payoff assumptions imply no positive edge.");
  }

  if (report.market.isStale) {
    signals.push("Market data may be stale.");
  }

  if (report.sizing.futurePositionPercent > 0.2) {
    signals.push("Single-name exposure would be high after this trade.");
  }

  if (urgencyTerms.some((term) => thesis.includes(term))) {
    signals.push("Thesis contains urgency language that may indicate FOMO.");
  }

  const pattern = pickPattern(report, thesis);
  const confidence = estimateConfidence(report, missingItems, signals);

  return {
    pattern,
    confidence,
    missingItems,
    signals,
    strategy: report.strategy,
    strategyName: report.strategy.primaryName,
    strategySteps: report.strategy.executionRules,
    summary: buildSummary(report, pattern, missingItems),
    reflectionPrompt: buildPrompt(report, missingItems),
  };
}

function pickPattern(report, thesis) {
  if (report.sizing.suggestedShares <= 0 || report.kelly.edge <= 0) return "risk budget mismatch";
  if (urgencyTerms.some((term) => thesis.includes(term))) return "possible FOMO";
  if (report.sizing.futurePositionPercent > 0.2) return "concentration risk";
  if (report.decision.kind === "consider") return "plan-based trade";
  return "needs tighter plan";
}

function estimateConfidence(report, missingItems, signals) {
  let confidence = 0.58;
  if (report.trade.thesis.length > 80) confidence += 0.12;
  if (missingItems.length > 0) confidence -= 0.08;
  if (signals.length > 1) confidence += 0.12;
  return clamp(confidence, 0.35, 0.9);
}

function buildSummary(report, pattern, missingItems) {
  if (report.decision.kind === "avoid") {
    return `Use ${report.strategy.primaryName}: the plan should be avoided or rewritten before execution because the sizing model does not leave enough protected room.`;
  }

  if (missingItems.length > 0) {
    return `Use ${report.strategy.primaryName}: the trade can be reviewed, but the plan is missing ${missingItems.join(" and ")}.`;
  }

  return `Use ${report.strategy.primaryName}: the setup reads as ${pattern}; keep the stop and size fixed before placing the order.`;
}

function buildPrompt(report, missingItems) {
  if (missingItems.length > 0) {
    return "What exact price or event proves this trade is wrong?";
  }

  if (report.sizing.futurePositionPercent > 0.2) {
    return "Would you still want this much single-name exposure if the stock gaps down tomorrow?";
  }

  return "If this trade drops to the stop price today, will you follow the plan without resizing?";
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
