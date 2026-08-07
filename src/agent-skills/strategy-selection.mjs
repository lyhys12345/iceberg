export function runStrategySelectionSkill({ trade, marketResearch, riskSizing, friction, report }) {
  const baseStrategy = report?.strategy || {};
  const decision = riskSizing?.decision || report?.decision || { kind: "consider" };
  const sizing = riskSizing?.sizing || report?.sizing || {};
  const stop = riskSizing?.stop || {};
  const signals = marketResearch?.signals || [];
  const hardStop = friction?.level === "hard_stop" || decision.kind === "avoid" || Number(sizing.suggestedShares || 0) <= 0;
  const slowDown = marketResearch?.timingBias === "slow down" || marketResearch?.timingBias === "wait for a cleaner entry";
  const concentrated = Number(sizing.futurePositionPercent || 0) >= 0.18 || Number(trade?.currentShares || 0) > 0;
  const selected = selectStrategy({ baseStrategy, hardStop, slowDown, concentrated, riskScore: riskSizing?.riskScore || 0 });
  const firstEntryShares = firstEntrySize(selected.id, sizing.suggestedShares);
  const action = actionForSelection({ hardStop, selected, decision });
  const rationale = buildRationale({ selected, marketResearch, riskSizing, friction, signals, concentrated, slowDown });

  return {
    strategyName: selected.name,
    strategyId: selected.id,
    action,
    confidence: confidenceForSelection({ hardStop, slowDown, riskScore: riskSizing?.riskScore || 0, friction }),
    rationale,
    protectionRules: report?.protection || [],
    entryPlan: report?.entries || [],
    strategySteps: selected.steps,
    beginnerSummary: beginnerSummary({ selected, action, sizing, stop, firstEntryShares }),
    orderTicket: {
      action,
      maxDollars: Number(sizing.suggestedDollars || 0),
      maxShares: Number(sizing.suggestedShares || 0),
      firstEntryShares,
      stopPrice: Number(stop.price || report?.scenarios?.stop?.price || 0),
      maxLossAtStop: Number(stop.lossDollars || Math.abs(report?.scenarios?.stop?.pnl || 0)),
    },
    source: {
      modelStrategy: baseStrategy.primaryName || "",
      decision: decision.kind,
      timingBias: marketResearch?.timingBias || "",
      frictionLevel: friction?.level || "normal",
    },
  };
}

export function runTradeProtectionStrategySkill(report) {
  return runStrategySelectionSkill({
    trade: report?.trade || {},
    marketResearch: {
      timingBias: "from risk report",
      signals: [],
    },
    riskSizing: {
      decision: report?.decision,
      riskScore: report?.riskScore,
      sizing: report?.sizing || {},
      stop: {
        price: report?.scenarios?.stop?.price,
        lossDollars: Math.abs(report?.scenarios?.stop?.pnl || 0),
      },
    },
    friction: { level: "normal" },
    report,
  });
}

function selectStrategy({ baseStrategy, hardStop, slowDown, concentrated, riskScore }) {
  if (hardStop) {
    return {
      id: "no-trade-wait",
      name: "No Trade / Wait",
      steps: [
        "Do not place the order in this session.",
        "Write the condition that would make the setup safer.",
        "Wait for a fresh quote or a cleaner entry before recalculating.",
      ],
    };
  }

  if (concentrated) {
    return {
      id: "rebalance-reduce",
      name: "Rebalance / Reduce Exposure",
      steps: [
        "Keep the new order smaller than the model cap.",
        "Avoid increasing one-stock exposure before checking total portfolio concentration.",
        "Use the stop and position cap before thinking about upside.",
      ],
    };
  }

  if (slowDown || riskScore >= 48) {
    return {
      id: "small-starter",
      name: "Small Starter Position",
      steps: [
        "Start with a small first entry instead of the full approved amount.",
        "Add only if price confirms the thesis and risk remains capped.",
        "Cancel the remaining entry plan if the stop or thesis fails.",
      ],
    };
  }

  return {
    id: baseStrategy.primaryId || "risk-capped-position",
    name: baseStrategy.primaryName || "Risk-Capped Position",
    steps: baseStrategy.executionRules?.slice(0, 3) || [
      "Size from maximum acceptable loss, not excitement.",
      "Use the smallest cap from risk budget, cash, planned budget, and Kelly.",
      "Place the stop plan before the order.",
    ],
  };
}

function actionForSelection({ hardStop, selected, decision }) {
  if (hardStop) return "wait";
  if (selected.id === "small-starter") return "starter";
  if (selected.id === "rebalance-reduce" || decision.kind === "reduce") return "reduce";
  return "proceed_with_rules";
}

function firstEntrySize(strategyId, suggestedShares) {
  const shares = Number(suggestedShares || 0);
  if (shares <= 0) return 0;
  if (strategyId === "small-starter") return Math.max(1, Math.floor(shares * 0.35));
  if (strategyId === "rebalance-reduce") return Math.max(1, Math.floor(shares * 0.5));
  return shares;
}

function confidenceForSelection({ hardStop, slowDown, riskScore, friction }) {
  if (hardStop) return 0.8;
  let confidence = 0.72;
  if (slowDown) confidence -= 0.12;
  if (riskScore >= 48) confidence -= 0.1;
  if (friction?.impulseLanguage) confidence -= 0.12;
  return Math.max(0.45, Math.min(0.86, confidence));
}

function buildRationale({ selected, marketResearch, riskSizing, friction, signals, concentrated, slowDown }) {
  const rationale = [
    `Strategy selected: ${selected.name}.`,
    `Timing bias is ${marketResearch?.timingBias || "unknown"}.`,
    `Risk score is ${riskSizing?.riskScore ?? "unknown"}/100.`,
  ];

  if (slowDown) rationale.push("The market read says to slow down before taking full exposure.");
  if (concentrated) rationale.push("The portfolio would become more concentrated after this order.");
  if (friction?.level === "hard_stop") rationale.push("Behavioral friction triggered a hard stop.");
  signals.slice(0, 2).forEach((signal) => rationale.push(`${signal.title}: ${signal.detail}`));
  return rationale;
}

function beginnerSummary({ selected, action, sizing, stop, firstEntryShares }) {
  if (action === "wait") {
    return "My recommendation is to wait. A skipped trade is still a valid risk decision.";
  }

  const maxShares = Number(sizing.suggestedShares || 0);
  const maxDollars = formatCurrency(sizing.suggestedDollars);
  const stopPrice = formatCurrency(stop.price);

  if (action === "starter") {
    return `Use a starter entry: ${firstEntryShares} shares first, not the full ${maxShares}. Keep the full modeled cap near ${maxDollars}, with a stop around ${stopPrice}.`;
  }

  if (action === "reduce") {
    return `Reduce the order before entry. The model cap is ${maxShares} shares, but concentration risk means the first order should be smaller. Use the stop around ${stopPrice}.`;
  }

  return `This can be considered only with rules: max ${maxShares} shares, about ${maxDollars}, with a stop around ${stopPrice}.`;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}
