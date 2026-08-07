export function runFinalResponseSkill(context) {
  const { marketResearch, riskSizing, friction, strategySelection, aiBrief, workflowSteps = [] } = context;
  const report = riskSizing.report;
  const topFlags = report.flags.slice(0, 3);
  const strategySteps = strategySelection.strategySteps.slice(0, 3);
  const reflectionPrompt = aiBrief?.reflectionPrompt || "What would make this trade invalid before you enter?";
  const shortAnswer = shortAnswerText(report, strategySelection);
  const message = [
    `Short answer: ${shortAnswer}`,
    `Step 1 - Intent extraction: I read this as a ${report.trade.side} trade plan for ${report.trade.symbol}, not just a quote request.`,
    `Step 2 - Market research: ${marketResearch.summary} Timing bias: ${marketResearch.timingBias}.`,
    `Step 3 - Risk sizing: cap the modeled trade around ${formatCurrency(report.sizing.suggestedDollars)} (${report.sizing.suggestedShares} shares). A stop near ${formatCurrency(report.scenarios.stop.price)} would put about ${formatCurrency(Math.abs(report.scenarios.stop.pnl))} at risk, and future exposure would be ${(report.sizing.futurePositionPercent * 100).toFixed(1)}% of the account.`,
    `Step 4 - Strategy selection: use ${strategySelection.strategyName}. ${strategySelection.beginnerSummary} ${strategySteps.join(" ")}`,
    `Step 5 - Final response: ${topFlags.map((flag) => `${flag.title}: ${flag.detail}`).join(" ")}`,
    `Friction: ${friction.instruction}`,
    `Before order entry: ${reflectionPrompt}`,
  ].join("\n\n");

  return {
    message,
    sections: {
      verdict: report.decision,
      marketRead: marketResearch,
      riskSizing: riskSizing.sizing,
      primaryRisks: topFlags,
      strategy: strategySelection,
      friction,
      workflowSteps,
      reflectionPrompt,
    },
  };
}

export function runIncompleteTradeResponseSkill(context) {
  const { marketResearch, missing } = context;
  const missingText = missing.includes("planned amount") ? "planned buy amount" : missing.join(", ");
  return {
    message: [
      `Market read: ${marketResearch.summary}`,
      `Timing bias: ${marketResearch.timingBias}. This is enough for a first timing read, but not enough for a full trade plan.`,
      `Next input needed: tell me the ${missingText}. Then I can calculate position size, stop risk, downside, and protection rules without guessing.`,
    ].join("\n\n"),
    sections: {
      marketRead: marketResearch,
      missing,
    },
  };
}

function verdictText(kind) {
  if (kind === "avoid") return "wait or avoid for now";
  if (kind === "reduce") return "only consider a smaller protected trade";
  return "researchable only with rules";
}

function shortAnswerText(report, strategySelection) {
  if (strategySelection.action === "wait" || report.decision.kind === "avoid") {
    return `I would not place this order yet. ${report.decision.summary}`;
  }

  if (strategySelection.action === "starter") {
    return `Do not buy the full amount at once. Use a small starter only if you accept the stop first.`;
  }

  if (strategySelection.action === "reduce") {
    return `The idea may be researchable, but the order should be reduced before entry.`;
  }

  return `${verdictText(report.decision.kind)}. The trade only makes sense if the size and stop are set before the order.`;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}
