const broadSymbols = new Set(["VTI", "VOO", "SPY", "QQQ", "VT", "VEA", "VWO", "DIA", "IWM"]);
const defensiveSymbols = new Set(["BND", "TLT", "IEF", "SHY", "SGOV", "BIL"]);

const symbolThemes = {
  NVDA: "AI / Semiconductors",
  AMD: "AI / Semiconductors",
  AVGO: "AI / Semiconductors",
  SMH: "AI / Semiconductors",
  MSFT: "Mega-cap Technology",
  AAPL: "Mega-cap Technology",
  GOOGL: "Mega-cap Technology",
  GOOG: "Mega-cap Technology",
  META: "Mega-cap Technology",
  AMZN: "Mega-cap Technology",
  TSLA: "Consumer Discretionary",
  VTI: "Broad Market",
  VOO: "Broad Market",
  SPY: "Broad Market",
  QQQ: "Broad Market",
  BND: "Bonds / Cash-like",
  TLT: "Bonds / Cash-like",
  SGOV: "Bonds / Cash-like",
};

export function runPortfolioImpactAnalysisSkill({ trade = {}, portfolio = null, market = null } = {}) {
  const symbol = normalizeSymbol(trade.symbol || market?.symbol);
  const plannedBudget = positiveNumber(trade.plannedBudget);
  const price = positiveNumber(trade.currentPrice || market?.latestClose);

  if (!portfolio?.holdings?.length || !symbol || plannedBudget <= 0 || price <= 0) {
    return neutralImpact(symbol);
  }

  const beforeHoldings = normalizeHoldings(portfolio.holdings);
  const beforeCash = Number.isFinite(Number(portfolio.cash)) ? Number(portfolio.cash) : positiveNumber(trade.cashAvailable);
  const before = summarizePortfolio(beforeHoldings, beforeCash, symbol);
  const tradeTheme = inferTradeTheme(symbol, beforeHoldings);
  const tradeShares = plannedBudget / price;
  const afterHoldings = applyTrade(beforeHoldings, { symbol, shares: tradeShares, price, theme: tradeTheme });
  const afterCash = beforeCash - plannedBudget;
  const after = summarizePortfolio(afterHoldings, afterCash, symbol);
  const deltas = {
    cashWeightChange: round(after.cashWeight - before.cashWeight),
    symbolWeightChange: round(after.symbolWeight - before.symbolWeight),
    topThemeWeightChange: round((after.themeWeights[0]?.weight || 0) - (before.themeWeights.find((item) => item.theme === after.themeWeights[0]?.theme)?.weight || 0)),
  };
  const flags = buildImpactFlags({ symbol, plannedBudget, tradeTheme, before, after, deltas, market });
  const riskAdjustment = buildRiskAdjustment(flags, symbol);

  return {
    symbol,
    tradeTheme,
    before: publicSummary(before),
    after: publicSummary(after),
    deltas,
    flags,
    riskAdjustment,
    beginnerSummary: beginnerSummary({ symbol, before, after, flags }),
    source: "deterministic",
  };
}

function neutralImpact(symbol = "") {
  return {
    symbol,
    tradeTheme: symbolThemes[symbol] || "",
    before: emptySummary(),
    after: emptySummary(),
    deltas: {
      cashWeightChange: 0,
      symbolWeightChange: 0,
      topThemeWeightChange: 0,
    },
    flags: [],
    riskAdjustment: {
      scoreDelta: 0,
      sizeMultiplier: 1,
      recommendationBias: "neutral",
    },
    beginnerSummary: "No saved portfolio was available, so Iceberg sized this as a standalone trade.",
    source: "neutral",
  };
}

function normalizeHoldings(holdings = []) {
  return holdings
    .map((holding) => {
      const symbol = normalizeSymbol(holding.symbol);
      const shares = positiveNumber(holding.shares);
      const price = positiveNumber(holding.price);
      return {
        symbol,
        name: String(holding.name || symbol).trim(),
        shares,
        price,
        theme: String(holding.theme || symbolThemes[symbol] || inferThemeFromText(`${symbol} ${holding.name || ""}`)).trim(),
        value: shares * price,
      };
    })
    .filter((holding) => holding.symbol && holding.value > 0);
}

function applyTrade(holdings, trade) {
  let found = false;
  const updated = holdings.map((holding) => {
    if (holding.symbol !== trade.symbol) return holding;
    found = true;
    const value = holding.value + trade.shares * trade.price;
    const shares = holding.shares + trade.shares;
    return {
      ...holding,
      shares,
      price: trade.price,
      value,
    };
  });

  if (!found) {
    updated.push({
      symbol: trade.symbol,
      name: trade.symbol,
      shares: trade.shares,
      price: trade.price,
      theme: trade.theme,
      value: trade.shares * trade.price,
    });
  }

  return updated;
}

function summarizePortfolio(holdings, cash, focusSymbol) {
  const holdingsValue = holdings.reduce((sum, holding) => sum + holding.value, 0);
  const totalValue = Math.max(holdingsValue + cash, holdingsValue, 1);
  const enriched = holdings
    .map((holding) => ({
      ...holding,
      weight: round(holding.value / totalValue),
    }))
    .sort((a, b) => b.value - a.value);
  const themeWeights = buildThemeWeights(enriched, totalValue);
  const focus = enriched.find((holding) => holding.symbol === focusSymbol);

  return {
    totalValue: roundMoney(totalValue),
    cash: roundMoney(cash),
    cashWeight: round(cash / totalValue),
    symbolWeight: round(focus?.weight || 0),
    topHolding: enriched[0] ? { symbol: enriched[0].symbol, weight: enriched[0].weight } : null,
    topTheme: themeWeights[0] || null,
    themeWeights,
  };
}

function buildThemeWeights(holdings, totalValue) {
  const weights = new Map();
  holdings.forEach((holding) => {
    const theme = holding.theme || "Other";
    weights.set(theme, (weights.get(theme) || 0) + holding.value / totalValue);
  });

  return [...weights.entries()]
    .map(([theme, weight]) => ({ theme, weight: round(weight) }))
    .sort((a, b) => b.weight - a.weight);
}

function publicSummary(summary) {
  return {
    totalValue: summary.totalValue,
    cash: summary.cash,
    cashWeight: summary.cashWeight,
    symbolWeight: summary.symbolWeight,
    topHolding: summary.topHolding,
    topTheme: summary.topTheme,
  };
}

function emptySummary() {
  return {
    totalValue: 0,
    cash: 0,
    cashWeight: 0,
    symbolWeight: 0,
    topHolding: null,
    topTheme: null,
  };
}

function buildImpactFlags({ symbol, plannedBudget, tradeTheme, before, after, deltas, market }) {
  const flags = [];
  const broad = isBroad(symbol, tradeTheme);

  if (after.cashWeight < 0.03) {
    flags.push({
      title: "Cash depletion",
      severity: "high",
      detail: "This order would leave almost no cash buffer after the trade.",
    });
  } else if (after.cashWeight < 0.08) {
    flags.push({
      title: "Low cash after trade",
      severity: "medium",
      detail: "This order would leave a thin cash buffer for mistakes or better entries.",
    });
  }

  if (after.cash < 0) {
    flags.push({
      title: "Cash shortfall",
      severity: "high",
      detail: "The requested order is larger than the portfolio cash balance.",
    });
  }

  if (!broad && after.symbolWeight > 0.25) {
    flags.push({
      title: "Single-name concentration",
      severity: "high",
      detail: `${symbol} would become ${formatPercent(after.symbolWeight)} of the portfolio after this order.`,
    });
  } else if (!broad && after.symbolWeight > 0.18) {
    flags.push({
      title: "Single-name concentration",
      severity: "medium",
      detail: `${symbol} would become ${formatPercent(after.symbolWeight)} of the portfolio after this order.`,
    });
  }

  if (!broad && deltas.symbolWeightChange > 0.1) {
    flags.push({
      title: "Large one-trade jump",
      severity: "medium",
      detail: `${symbol} weight would rise by ${formatPercent(deltas.symbolWeightChange)} in one order.`,
    });
  }

  const afterTheme = after.themeWeights.find((item) => item.theme === tradeTheme);
  const themeWeight = afterTheme?.weight || 0;
  if (!isCoreTheme(tradeTheme) && themeWeight > 0.45) {
    flags.push({
      title: "Theme crowding",
      severity: "high",
      detail: `${tradeTheme} would become ${formatPercent(themeWeight)} of the portfolio.`,
    });
  } else if (!isCoreTheme(tradeTheme) && themeWeight > 0.35) {
    flags.push({
      title: "Theme crowding",
      severity: "medium",
      detail: `${tradeTheme} would become ${formatPercent(themeWeight)} of the portfolio.`,
    });
  }

  const volatility = Number(market?.annualizedVolatility || 0);
  if (!broad && volatility > 0.55 && after.symbolWeight > 0.15) {
    flags.push({
      title: "Volatility concentration",
      severity: "high",
      detail: "A volatile stock would become too large relative to the account.",
    });
  }

  if (!broad && Number(market?.return20d || 0) > 0.18 && plannedBudget / Math.max(before.totalValue, 1) > 0.1) {
    flags.push({
      title: "Portfolio-level chasing risk",
      severity: "medium",
      detail: "The order is large relative to the account after a hot 20-day move.",
    });
  }

  if (!broad && Number(market?.maxDrawdown60d || 0) < -0.25 && plannedBudget / Math.max(before.totalValue, 1) > 0.1) {
    flags.push({
      title: "Drawdown exposure",
      severity: "medium",
      detail: "The order is large relative to the account for a stock with recent deep drawdowns.",
    });
  }

  return flags;
}

function buildRiskAdjustment(flags, symbol) {
  const highCount = flags.filter((flag) => flag.severity === "high").length;
  const mediumCount = flags.filter((flag) => flag.severity === "medium").length;
  const scoreDelta = Math.min(32, highCount * 14 + mediumCount * 7);
  let sizeMultiplier = 1;
  if (highCount > 0) sizeMultiplier = 0.45;
  else if (mediumCount > 1) sizeMultiplier = 0.65;
  else if (mediumCount > 0) sizeMultiplier = 0.8;
  if (isBroad(symbol)) sizeMultiplier = Math.max(sizeMultiplier, 0.75);

  return {
    scoreDelta,
    sizeMultiplier,
    recommendationBias: highCount > 0 ? "wait" : mediumCount > 0 ? "reduce" : "neutral",
  };
}

function beginnerSummary({ symbol, before, after, flags }) {
  if (!flags.length) {
    return `This trade does not materially worsen portfolio concentration. ${symbol} would be ${formatPercent(after.symbolWeight)} of the account and cash would be ${formatPercent(after.cashWeight)} after the order.`;
  }

  const concern = flags[0];
  return `This trade changes the whole account, not just ${symbol}. ${symbol} would move from ${formatPercent(before.symbolWeight)} to ${formatPercent(after.symbolWeight)}, cash would move from ${formatPercent(before.cashWeight)} to ${formatPercent(after.cashWeight)}, and the main concern is ${concern.title.toLowerCase()}.`;
}

function inferTradeTheme(symbol, holdings) {
  const existing = holdings.find((holding) => holding.symbol === symbol);
  return existing?.theme || symbolThemes[symbol] || inferThemeFromText(symbol);
}

function inferThemeFromText(value) {
  const text = String(value || "").toLowerCase();
  if (broadSymbols.has(String(value || "").toUpperCase()) || /broad|index|s&p|total market|etf/.test(text)) return "Broad Market";
  if (defensiveSymbols.has(String(value || "").toUpperCase()) || /bond|treasury|cash|money market/.test(text)) return "Bonds / Cash-like";
  if (/nvda|amd|avgo|semi|chip|ai/.test(text)) return "AI / Semiconductors";
  if (/msft|aapl|goog|meta|amzn|software|cloud|technology|tech/.test(text)) return "Mega-cap Technology";
  if (/tsla|consumer|auto|ev/.test(text)) return "Consumer Discretionary";
  return "Single Stock";
}

function isBroad(symbol, theme = "") {
  return broadSymbols.has(normalizeSymbol(symbol)) || /broad|index|total market|s&p/i.test(theme);
}

function isCoreTheme(theme = "") {
  return /broad|index|total market|bond|treasury|cash/i.test(theme);
}

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function round(value) {
  return Math.round(Number(value || 0) * 10000) / 10000;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}
