export function runFinalResponseSkill(context) {
  const { marketResearch, riskSizing, friction, strategySelection, aiBrief } = context;
  const report = riskSizing.report;
  const topFlags = report.flags.slice(0, 3);
  const strategySteps = strategySelection.strategySteps.slice(0, 3);
  const reflectionPrompt = aiBrief?.reflectionPrompt || "What would make this trade invalid before you enter?";
  const message = [
    `Verdict: ${verdictText(report.decision.kind)}. ${report.decision.title}, with risk score ${report.riskScore}/100.`,
    `Market read: ${marketResearch.summary} Timing bias: ${marketResearch.timingBias}.`,
    `Risk sizing: cap the modeled trade around ${formatCurrency(report.sizing.suggestedDollars)} (${report.sizing.suggestedShares} shares). A stop near ${formatCurrency(report.scenarios.stop.price)} would put about ${formatCurrency(Math.abs(report.scenarios.stop.pnl))} at risk, and future exposure would be ${(report.sizing.futurePositionPercent * 100).toFixed(1)}% of the account.`,
    `Why: ${topFlags.map((flag) => `${flag.title}: ${flag.detail}`).join(" ")}`,
    `Protection plan: use ${strategySelection.strategyName}. ${strategySteps.join(" ")}`,
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

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}
