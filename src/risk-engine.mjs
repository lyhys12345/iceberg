export const defaultRules = {
  maxRiskPercent: 2,
  maxLossDollars: 250,
  cooldownMinutes: 15,
  emotionThreshold: 7,
  requireThesis: true,
  requireMaxLoss: true,
  extraFrictionForOptions: true,
};

const emotionalWords = [
  "moon",
  "yolo",
  "all in",
  "can't miss",
  "cant miss",
  "recover",
  "make it back",
  "爆",
  "梭哈",
  "翻本",
  "追",
  "赶紧",
  "错过",
];

export function normalizeTrade(rawTrade) {
  const drivers = Array.isArray(rawTrade.drivers) ? rawTrade.drivers : [];

  return {
    symbol: String(rawTrade.symbol || "").trim().toUpperCase(),
    assetType: rawTrade.assetType || "stock",
    direction: rawTrade.direction || "buy",
    positionSize: toNumber(rawTrade.positionSize),
    accountSize: toNumber(rawTrade.accountSize),
    maxLoss: toNumber(rawTrade.maxLoss),
    thesis: String(rawTrade.thesis || "").trim(),
    drivers,
    emotionLevel: clamp(toNumber(rawTrade.emotionLevel) || 1, 1, 10),
  };
}

export function analyzeTrade(rawTrade, rules = defaultRules) {
  const trade = normalizeTrade(rawTrade);
  const findings = [];
  let score = 0;

  const riskPercent = trade.accountSize > 0 ? (trade.maxLoss / trade.accountSize) * 100 : 0;
  const hasWrittenPlan = trade.thesis.length >= 40;
  const hasMaxLoss = trade.maxLoss > 0;
  const hasPlannedDriver = trade.drivers.includes("plan");
  const hasEmotionalDriver = trade.drivers.some((driver) => ["news", "revenge", "fomo"].includes(driver));
  const textLooksEmotional = emotionalWords.some((word) => trade.thesis.toLowerCase().includes(word));
  let hardRuleTriggered = false;

  if (!trade.symbol) {
    score += 10;
    findings.push(makeFinding("Missing symbol", "Name the asset before reviewing risk.", "warning"));
  }

  if (rules.requireMaxLoss && !hasMaxLoss) {
    score += 28;
    hardRuleTriggered = true;
    findings.push(makeFinding("No max loss", "A trade without a known downside should not pass.", "block"));
  }

  if (hasMaxLoss && trade.maxLoss > Number(rules.maxLossDollars)) {
    score += 22;
    hardRuleTriggered = true;
    findings.push(
      makeFinding(
        "Loss limit exceeded",
        `Planned loss is $${formatNumber(trade.maxLoss)}, above your $${formatNumber(rules.maxLossDollars)} rule.`,
        "block",
      ),
    );
  }

  if (riskPercent > Number(rules.maxRiskPercent)) {
    score += 22;
    hardRuleTriggered = true;
    findings.push(
      makeFinding(
        "Position risk too high",
        `This risks ${riskPercent.toFixed(1)}% of the account, above your ${rules.maxRiskPercent}% rule.`,
        "block",
      ),
    );
  }

  if (rules.requireThesis && !hasWrittenPlan) {
    score += 18;
    findings.push(makeFinding("Weak thesis", "Write the setup, invalidation point, and exit condition.", "warning"));
  }

  if (trade.emotionLevel >= Number(rules.emotionThreshold)) {
    score += 18;
    findings.push(makeFinding("High emotion", "This trade is happening in a hot state.", "warning"));
  }

  if (trade.drivers.includes("revenge")) {
    score += 24;
    findings.push(makeFinding("Revenge trading risk", "The trade is connected to making back a loss.", "block"));
  }

  if (trade.drivers.includes("fomo") || textLooksEmotional) {
    score += 18;
    findings.push(makeFinding("FOMO signal", "The reason contains urgency or fear of missing out.", "warning"));
  }

  if (trade.drivers.includes("news") && !hasPlannedDriver) {
    score += 10;
    findings.push(makeFinding("News-driven entry", "News can be valid, but it needs a predefined plan.", "notice"));
  }

  if (trade.assetType === "option" && rules.extraFrictionForOptions) {
    score += 14;
    findings.push(makeFinding("Options friction", "Options need stricter sizing and exit rules.", "warning"));
  }

  if (hasPlannedDriver && hasWrittenPlan && hasMaxLoss) {
    score -= 14;
    findings.push(makeFinding("Plan present", "This trade has a written plan and defined downside.", "positive"));
  }

  const finalScore = hardRuleTriggered ? clamp(Math.max(Math.round(score), 45), 0, 100) : clamp(Math.round(score), 0, 100);
  const action = pickAction(finalScore);
  const savedRisk = action.kind === "block" ? trade.maxLoss : 0;

  return {
    trade,
    score: finalScore,
    action,
    findings,
    riskPercent,
    savedRisk,
  };
}

function pickAction(score) {
  if (score >= 70) {
    return {
      kind: "block",
      title: "Block and cool down",
      summary: "This looks like a trade your calm self would want to slow down.",
    };
  }

  if (score >= 40) {
    return {
      kind: "slow",
      title: "Slow down",
      summary: "The trade can continue only after the weak points are fixed.",
    };
  }

  return {
    kind: "pass",
    title: "Pass with discipline",
    summary: "Risk looks controlled enough to proceed with your plan.",
  };
}

function makeFinding(title, detail, severity) {
  return { title, detail, severity };
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatNumber(value) {
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 });
}
