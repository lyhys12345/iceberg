import { recommendTradeStrategy } from "./strategy-catalog.mjs";

export function analyzeAdvisorTrade(input, market) {
  const trade = normalizeAdvisorInput(input, market);
  const kelly = calculateKelly(trade.winProbability, trade.upsidePercent, trade.downsidePercent, trade.kellyFractionPercent);
  const riskCapDollars = trade.accountValue * (trade.maxRiskPercent / 100);
  const stopLossPrice = trade.currentPrice * (1 - trade.stopLossPercent / 100);
  const targetPrice = trade.currentPrice * (1 + trade.targetGainPercent / 100);
  const dollarsAtStopRisk = trade.currentPrice * (trade.stopLossPercent / 100);
  const maxSharesByRisk = dollarsAtStopRisk > 0 ? Math.floor(riskCapDollars / dollarsAtStopRisk) : 0;
  const maxSharesByCash = Math.floor(trade.cashAvailable / trade.currentPrice);
  const plannedShares = Math.floor(trade.plannedBudget / trade.currentPrice);
  const kellyDollarCap = trade.accountValue * kelly.fractionalKelly;
  const maxSharesByKelly = Math.floor(kellyDollarCap / trade.currentPrice);
  const requestedShares = plannedShares > 0 ? plannedShares : maxSharesByCash;
  const unverifiedEdge = hasUnverifiedEdge(trade);
  let suggestedShares =
    kelly.fractionalKelly > 0
      ? Math.max(0, Math.min(requestedShares, maxSharesByRisk, maxSharesByCash, maxSharesByKelly))
      : 0;
  if (unverifiedEdge) {
    const starterCapShares = Math.floor((trade.accountValue * 0.05) / trade.currentPrice);
    suggestedShares = Math.min(suggestedShares, starterCapShares);
  }
  const suggestedDollars = suggestedShares * trade.currentPrice;
  const futurePositionDollars = trade.currentShares * trade.currentPrice + suggestedDollars;
  const futurePositionPercent = trade.accountValue > 0 ? futurePositionDollars / trade.accountValue : 0;
  const upsideDollars = suggestedDollars * (trade.upsidePercent / 100);
  const downsideDollars = suggestedDollars * (trade.downsidePercent / 100);
  const stopLossDollars = suggestedShares * dollarsAtStopRisk;
  const riskScore = scoreRisk(trade, market, kelly, futurePositionPercent);
  const decision = pickDecision(riskScore, kelly.fractionalKelly, suggestedShares, futurePositionPercent);
  const entries = buildEntryPlan(suggestedShares, trade.currentPrice);
  const protection = buildProtectionPlan(trade, market, suggestedShares, stopLossPrice, targetPrice);
  const flags = buildRiskFlags(trade, market, kelly, futurePositionPercent, suggestedShares);
  const strategy = recommendTradeStrategy({
    trade,
    market,
    decision,
    riskScore,
    sizing: {
      suggestedShares,
      suggestedDollars,
      futurePositionPercent,
    },
    kelly,
  });

  return {
    trade,
    market,
    decision,
    riskScore,
    kelly,
    sizing: {
      riskCapDollars,
      suggestedShares,
      suggestedDollars,
      maxSharesByRisk,
      maxSharesByCash,
      maxSharesByKelly,
      futurePositionDollars,
      futurePositionPercent,
    },
    scenarios: {
      bull: {
        price: trade.currentPrice * (1 + trade.upsidePercent / 100),
        pnl: upsideDollars,
      },
      base: {
        price: trade.currentPrice * (1 + market.return20d / 2),
        pnl: suggestedDollars * (market.return20d / 2),
      },
      bear: {
        price: trade.currentPrice * (1 - trade.downsidePercent / 100),
        pnl: -downsideDollars,
      },
      stop: {
        price: stopLossPrice,
        pnl: -stopLossDollars,
      },
    },
    protection,
    entries,
    flags,
    strategy,
  };
}

export function calculateKelly(winProbability, upsidePercent, downsidePercent, kellyFractionPercent = 25) {
  const p = clamp(toNumber(winProbability) / 100, 0, 1);
  const upside = Math.max(toNumber(upsidePercent) / 100, 0);
  const downside = Math.max(toNumber(downsidePercent) / 100, 0.001);
  const b = upside / downside;
  const fraction = clamp(toNumber(kellyFractionPercent) / 100, 0.05, 1);
  const fullKelly = b > 0 ? (p * b - (1 - p)) / b : 0;
  const safeFullKelly = clamp(fullKelly, 0, 0.5);

  return {
    fullKelly: safeFullKelly,
    fractionalKelly: safeFullKelly * fraction,
    fractionUsed: fraction,
    edge: p * upside - (1 - p) * downside,
    payoffRatio: b,
  };
}

function normalizeAdvisorInput(input, market) {
  const currentPrice = positive(input.currentPrice) || positive(market.latestClose) || 100;

  return {
    symbol: String(input.symbol || market.symbol || "").trim().toUpperCase(),
    side: input.side || "buy",
    horizon: input.horizon || "swing",
    accountValue: positive(input.accountValue) || 25000,
    cashAvailable: positive(input.cashAvailable) || positive(input.accountValue) || 25000,
    currentShares: Math.max(0, toNumber(input.currentShares)),
    plannedBudget: positive(input.plannedBudget) || positive(input.cashAvailable) || 0,
    currentPrice,
    thesis: String(input.thesis || "").trim(),
    maxRiskPercent: clamp(positive(input.maxRiskPercent) || 1, 0.1, 10),
    winProbability: clamp(positive(input.winProbability) || 50, 1, 99),
    upsidePercent: clamp(positive(input.upsidePercent) || 12, 0.1, 200),
    downsidePercent: clamp(positive(input.downsidePercent) || 8, 0.1, 90),
    stopLossPercent: clamp(positive(input.stopLossPercent) || positive(input.downsidePercent) || 8, 0.1, 90),
    targetGainPercent: clamp(positive(input.targetGainPercent) || positive(input.upsidePercent) || 12, 0.1, 200),
    kellyFractionPercent: clamp(positive(input.kellyFractionPercent) || 25, 5, 100),
  };
}

function scoreRisk(trade, market, kelly, futurePositionPercent) {
  let score = 25;
  const plannedExposure = trade.accountValue > 0 ? trade.plannedBudget / trade.accountValue : 0;

  if (kelly.edge <= 0) score += 30;
  if (kelly.fractionalKelly < 0.01) score += 18;
  if (plannedExposure > 0.5) score += 18;
  if (plannedExposure > 0.25) score += 10;
  if (trade.plannedBudget > trade.cashAvailable) score += 8;
  if (hasImpulseLanguage(trade.thesis)) score += 12;
  if (hasUnverifiedEdge(trade)) score += 18;
  if (futurePositionPercent > 0.25) score += 24;
  if (futurePositionPercent > 0.15) score += 12;
  if (market.annualizedVolatility > 0.65) score += 18;
  if (market.annualizedVolatility > 0.4) score += 9;
  if (market.isStale) score += 12;
  if (market.return20d > 0.18) score += 16;
  if (market.return5d > 0.1) score += 12;
  if (market.maxDrawdown60d < -0.25) score += 10;
  if (trade.horizon === "day" && market.annualizedVolatility > 0.45) score += 8;
  if (trade.maxRiskPercent <= 1) score -= 4;

  return clamp(Math.round(score), 0, 100);
}

function pickDecision(score, fractionalKelly, suggestedShares, futurePositionPercent) {
  if (suggestedShares <= 0 || fractionalKelly <= 0) {
    return {
      kind: "avoid",
      title: "Avoid for now",
      summary: "The estimate does not support a positive risk-adjusted size under your assumptions.",
    };
  }

  if (score >= 72 || futurePositionPercent > 0.25) {
    return {
      kind: "avoid",
      title: "Avoid or wait",
      summary: "Risk is too high for a new position under the current assumptions.",
    };
  }

  if (score >= 48) {
    return {
      kind: "reduce",
      title: "Only small size with protection",
      summary: "The setup may be tradable, but size should stay below the risk cap.",
    };
  }

  return {
    kind: "consider",
    title: "Consider with rules",
    summary: "The position fits the current risk model if the protection plan is placed first.",
  };
}

function buildEntryPlan(shares, price) {
  if (shares <= 0) return [];

  const first = Math.ceil(shares * 0.5);
  const second = Math.floor(shares * 0.3);
  const third = Math.max(0, shares - first - second);

  return [
    { label: "Starter entry", shares: first, trigger: `near $${formatMoney(price)}` },
    { label: "Add only if thesis confirms", shares: second, trigger: `after price holds above $${formatMoney(price * 1.02)}` },
    { label: "Final add", shares: third, trigger: `only after risk is reduced or stop is trailed` },
  ].filter((step) => step.shares > 0);
}

function buildProtectionPlan(trade, market, shares, stopLossPrice, targetPrice) {
  const highVolBuffer = market.annualizedVolatility > 0.55 ? "Use smaller size because volatility is elevated." : "Normal volatility buffer is enough for this estimate.";
  const riskCapDollars = trade.accountValue * (trade.maxRiskPercent / 100);

  return [
    {
      title: "Stop loss",
      detail: shares > 0 ? `Set a protective stop near $${formatMoney(stopLossPrice)} before entering full size.` : "No stop suggested because no position size passed the model.",
    },
    {
      title: "Take profit",
      detail: shares > 0 ? `Plan partial profit-taking near $${formatMoney(targetPrice)} instead of deciding while emotional.` : "No target suggested until the trade passes sizing.",
    },
    {
      title: "Position cap",
      detail: `Keep stop-loss risk below $${formatMoney(riskCapDollars)} per trade, or ${trade.maxRiskPercent.toFixed(1)}% of the account.`,
    },
    {
      title: "Volatility buffer",
      detail: highVolBuffer,
    },
  ];
}

function buildRiskFlags(trade, market, kelly, futurePositionPercent, suggestedShares) {
  const flags = [];
  const plannedExposure = trade.accountValue > 0 ? trade.plannedBudget / trade.accountValue : 0;

  if (kelly.edge <= 0) flags.push({ title: "Negative edge assumption", detail: "Your win rate and payoff assumptions do not support the trade." });
  if (hasUnverifiedEdge(trade)) flags.push({ title: "Unverified edge", detail: "The win-rate or upside assumptions are aggressive, but the thesis does not prove a repeatable edge." });
  if (hasImpulseLanguage(trade.thesis)) flags.push({ title: "Impulse language", detail: "The thesis sounds emotional, such as all-in, revenge, borrowed money, or fear of missing out." });
  if (plannedExposure > 0.25) flags.push({ title: "Oversized request", detail: "The requested order is large relative to the account; Iceberg will use a smaller protected size." });
  if (trade.plannedBudget > trade.cashAvailable) flags.push({ title: "Cash cap", detail: "The planned order is larger than available cash, so cash availability must cap the trade." });
  if (market.return20d > 0.18) flags.push({ title: "Chasing risk", detail: "The stock has already moved sharply over the last month." });
  if (market.isStale) flags.push({ title: "Stale market data", detail: "Confirm the current price before using this sizing estimate." });
  if (market.return5d > 0.1) flags.push({ title: "Hot short-term move", detail: "Recent price action may increase FOMO risk." });
  if (market.annualizedVolatility > 0.55) flags.push({ title: "High volatility", detail: "Position size should be reduced because price swings are elevated." });
  if (futurePositionPercent > 0.2) flags.push({ title: "Concentration risk", detail: "This would create a large single-name exposure." });
  if (hasOptionsProtectionMismatch(trade)) flags.push({ title: "Options mismatch", detail: "Options protection is advanced and usually maps to 100-share contracts; use a protective stop unless the contract mechanics are clear." });
  if (suggestedShares <= 0) flags.push({ title: "No safe size", detail: "Cash, risk cap, and Kelly sizing do not leave room for the planned trade." });

  if (flags.length === 0) {
    flags.push({ title: "Risk model passed", detail: "No major rule conflict was detected under your assumptions." });
  }

  return flags;
}

function hasUnverifiedEdge(trade) {
  const thesis = String(trade.thesis || "").toLowerCase();
  const aggressiveAssumption = trade.winProbability >= 75 || trade.upsidePercent / Math.max(trade.downsidePercent, 0.1) >= 4 || trade.kellyFractionPercent > 50;
  const hasRiskPlan = ["stop", "exit", "invalidation", "target", "risk", "止损", "退出", "目标"].some((term) => thesis.includes(term));
  const hasThinThesis = thesis.length < 70;
  return aggressiveAssumption && (hasThinThesis || !hasRiskPlan);
}

function hasOptionsProtectionMismatch(trade) {
  const thesis = String(trade.thesis || "").toLowerCase();
  const asksOptionsProtection = ["option", "put", "collar", "期权", "保护性看跌"].some((term) => thesis.includes(term));
  return asksOptionsProtection && trade.currentShares < 100;
}

function hasImpulseLanguage(thesis) {
  const text = String(thesis || "").toLowerCase();
  const terms = [
    "all in",
    "all-in",
    "yolo",
    "everyone",
    "can't miss",
    "cant miss",
    "borrow",
    "loan",
    "margin",
    "leverage",
    "double down",
    "make back",
    "recover",
    "fomo",
    "moon",
    "梭哈",
    "满仓",
    "借钱",
    "融资",
    "杠杆",
    "回本",
    "翻倍",
    "梭哈",
    "满仓",
    "借钱",
    "融资",
    "杠杆",
    "回本",
    "翻倍",
  ];

  return terms.some((term) => text.includes(term));
}

function positive(value) {
  const parsed = toNumber(value);
  return parsed > 0 ? parsed : 0;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatMoney(value) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
