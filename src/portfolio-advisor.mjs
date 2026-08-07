export const demoPortfolio = {
  riskProfile: "balanced",
  timeHorizon: "long",
  cash: 5200,
  monthlyContribution: 1000,
  holdings: [
    { symbol: "NVDA", name: "NVIDIA", shares: 10, price: 120, theme: "AI / Semiconductors" },
    { symbol: "TSLA", name: "Tesla", shares: 8, price: 250, theme: "Consumer Discretionary" },
    { symbol: "VTI", name: "US Total Market ETF", shares: 20, price: 260, theme: "Broad Market" },
    { symbol: "BND", name: "US Bond ETF", shares: 15, price: 75, theme: "Bonds" },
  ],
};

const broadThemes = ["broad", "market", "index", "s&p", "total market", "etf"];
const defensiveThemes = ["bond", "treasury", "cash", "short-term", "money market"];
const highVolThemes = ["crypto", "meme", "ai", "semiconductor", "consumer discretionary", "single stock"];

export function parseHoldingsText(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [symbol, name, shares, price, theme] = line.split(",").map((part) => part.trim());
      return {
        symbol: String(symbol || "").toUpperCase(),
        name: name || String(symbol || "").toUpperCase(),
        shares: Number(shares || 0),
        price: Number(price || 0),
        theme: theme || inferTheme(symbol, name),
      };
    })
    .filter((holding) => holding.symbol && holding.shares > 0 && holding.price > 0);
}

export function holdingsToText(holdings) {
  return holdings
    .map((holding) => [holding.symbol, holding.name, holding.shares, holding.price, holding.theme].join(", "))
    .join("\n");
}

export function analyzePortfolio(input = demoPortfolio) {
  const cash = positiveNumber(input.cash);
  const monthlyContribution = positiveNumber(input.monthlyContribution);
  const riskProfile = input.riskProfile || "balanced";
  const timeHorizon = input.timeHorizon || "long";
  const holdings = normalizeHoldings(input.holdings || []);
  const holdingsValue = roundMoney(holdings.reduce((sum, holding) => sum + holding.value, 0));
  const totalValue = roundMoney(holdingsValue + cash);
  const enriched = holdings
    .map((holding) => ({
      ...holding,
      weight: totalValue > 0 ? holding.value / totalValue : 0,
      riskClass: classifyHolding(holding),
    }))
    .sort((a, b) => b.value - a.value);

  const largest = enriched[0] || null;
  const cashWeight = totalValue > 0 ? cash / totalValue : 0;
  const singleStockWeight = weightByPredicate(enriched, (holding) => holding.riskClass === "single");
  const broadWeight = weightByPredicate(enriched, (holding) => holding.riskClass === "broad");
  const defensiveWeight = weightByPredicate(enriched, (holding) => holding.riskClass === "defensive") + cashWeight;
  const themeWeights = buildThemeWeights(enriched, totalValue);
  const topTheme = themeWeights[0] || null;
  const flags = buildPortfolioFlags({
    riskProfile,
    timeHorizon,
    totalValue,
    cashWeight,
    singleStockWeight,
    broadWeight,
    defensiveWeight,
    largest,
    topTheme,
  });
  const riskScore = scorePortfolioRisk({ flags, cashWeight, singleStockWeight, broadWeight, largest, riskProfile });

  return {
    riskProfile,
    timeHorizon,
    cash,
    monthlyContribution,
    holdings: enriched,
    holdingsValue,
    totalValue,
    cashWeight,
    largest,
    topTheme,
    riskScore,
    riskLabel: labelRisk(riskScore),
    flags,
    pulse: buildPulse({ enriched, cashWeight, topTheme, broadWeight, riskProfile }),
    financialPlan: buildFinancialPlan({ riskProfile, timeHorizon, monthlyContribution, cashWeight, broadWeight, defensiveWeight, singleStockWeight, largest }),
    whatToSell: buildWhatToSell({ enriched, riskProfile, topTheme }),
    tickersForYou: buildTickerIdeas({ broadWeight, defensiveWeight, singleStockWeight, riskProfile, timeHorizon }),
  };
}

export function buildResearchDossier(symbol, market, portfolioAnalysis) {
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  const holding = portfolioAnalysis?.holdings?.find((item) => item.symbol === normalizedSymbol);
  const currentWeight = holding?.weight || 0;
  const largest = portfolioAnalysis?.largest;
  const facts = market
    ? [
        `${normalizedSymbol} last close: ${formatCurrency(market.latestClose)} as of ${market.asOf}.`,
        `Recent returns: 5D ${formatPercent(market.return5d)}, 20D ${formatPercent(market.return20d)}, 60D ${formatPercent(market.return60d)}.`,
        `Volatility read: ${formatPercent(market.annualizedVolatility)} annualized, drawdown ${formatPercent(market.maxDrawdown60d)}.`,
      ]
    : [`${normalizedSymbol} does not have a live snapshot yet. Use Research from localhost or enter a manual price before sizing.`];

  const fit = [];
  if (holding) {
    fit.push(`You already hold ${holding.shares} shares, about ${formatPercent(currentWeight)} of the account.`);
  } else {
    fit.push(`${normalizedSymbol} would be a new position, so Iceberg should size it smaller until the thesis is proven.`);
  }
  if (largest && largest.symbol === normalizedSymbol && largest.weight > 0.18) {
    fit.push("This is already your largest position. Adding more should require a stronger reason than price momentum.");
  }
  if (market?.annualizedVolatility > 0.45) {
    fit.push("High volatility means the stop distance and share count matter more than the entry story.");
  }

  return {
    symbol: normalizedSymbol,
    facts,
    fit,
    questions: [
      "What would make this thesis wrong within your holding period?",
      "Will this trade push one ticker or one theme above your risk limit?",
      "Can you accept the planned stop loss without changing the plan mid-trade?",
    ],
  };
}

export function portfolioDefaultsForSymbol(portfolio, symbol) {
  const analysis = analyzePortfolio(portfolio);
  const normalizedSymbol = String(symbol || "").toUpperCase();
  const holding = analysis.holdings.find((item) => item.symbol === normalizedSymbol);

  return {
    accountValue: analysis.totalValue ? String(Math.round(analysis.totalValue)) : "",
    cashAvailable: analysis.cash ? String(Math.round(analysis.cash)) : "",
    currentShares: holding ? String(holding.shares) : "0",
  };
}

function normalizeHoldings(holdings) {
  return holdings
    .map((holding) => {
      const symbol = String(holding.symbol || "").trim().toUpperCase();
      const name = String(holding.name || symbol).trim();
      const shares = positiveNumber(holding.shares);
      const price = positiveNumber(holding.price);
      return {
        symbol,
        name,
        shares,
        price,
        theme: String(holding.theme || inferTheme(symbol, name)).trim(),
        value: roundMoney(shares * price),
      };
    })
    .filter((holding) => holding.symbol && holding.value > 0);
}

function buildPortfolioFlags(context) {
  const flags = [];
  const maxSingle = context.riskProfile === "conservative" ? 0.12 : context.riskProfile === "aggressive" ? 0.25 : 0.18;

  if (!context.totalValue) {
    flags.push({ title: "No usable portfolio", detail: "Add cash and at least one holding before relying on the portfolio layer.", severity: "high" });
    return flags;
  }
  if (context.cashWeight < 0.05) {
    flags.push({ title: "Low cash buffer", detail: "A new buy would leave little room for mistakes or better entries.", severity: "medium" });
  }
  if (context.largest?.riskClass === "single" && context.largest.weight > maxSingle) {
    flags.push({ title: "Single-name concentration", detail: `${context.largest.symbol} is ${formatPercent(context.largest.weight)} of the account. New buys should not increase this concentration.`, severity: "high" });
  }
  if (context.topTheme?.weight > 0.38 && !isCoreTheme(context.topTheme.theme)) {
    flags.push({ title: "Theme crowding", detail: `${context.topTheme.theme} is ${formatPercent(context.topTheme.weight)} of the account. Correlated losses can arrive together.`, severity: "medium" });
  }
  if (context.broadWeight < 0.35 && context.timeHorizon !== "short") {
    flags.push({ title: "Missing broad base", detail: "The account is light on diversified broad-market exposure for a long-term investor.", severity: "medium" });
  }
  if (context.singleStockWeight > 0.55 && context.riskProfile !== "aggressive") {
    flags.push({ title: "Too much stock-picking risk", detail: "Single stocks dominate the portfolio. Require smaller trades and clearer invalidation points.", severity: "high" });
  }

  return flags;
}

function scorePortfolioRisk(context) {
  let score = 28;
  score += context.flags.reduce((sum, flag) => sum + (flag.severity === "high" ? 18 : 10), 0);
  score += context.largest ? Math.max(0, (context.largest.weight - 0.12) * 90) : 0;
  score += Math.max(0, (context.singleStockWeight - 0.45) * 70);
  score += Math.max(0, (0.25 - context.broadWeight) * 55);
  score += context.cashWeight < 0.03 ? 12 : 0;
  score -= context.riskProfile === "aggressive" ? 6 : 0;
  score += context.riskProfile === "conservative" ? 6 : 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildPulse(context) {
  const items = [];
  if (context.topTheme) {
    items.push({ title: "Main exposure", detail: `${context.topTheme.theme} drives ${formatPercent(context.topTheme.weight)} of this portfolio.` });
  }
  if (context.broadWeight < 0.35) {
    items.push({ title: "Diversification gap", detail: "The account depends more on individual outcomes than broad-market participation." });
  }
  if (context.cashWeight > 0.2) {
    items.push({ title: "Cash is available", detail: "You have dry powder. That reduces pressure to chase a weak entry." });
  } else {
    items.push({ title: "Cash is limited", detail: "A new buy should be funded by trimming or kept very small." });
  }
  items.push({ title: "Trade gate", detail: `Use ${context.riskProfile} sizing and require a written exit before adding risk.` });
  return items;
}

function buildFinancialPlan(context) {
  const maxSingle = context.riskProfile === "conservative" ? "10-12%" : context.riskProfile === "aggressive" ? "20-25%" : "15-18%";
  const plan = [
    { title: "Set position limits", detail: `Keep any single stock near ${maxSingle} of the account unless you intentionally rebalance around it.` },
    { title: "Use new money first", detail: context.monthlyContribution > 0 ? `Route the next ${formatCurrency(context.monthlyContribution)} contribution toward the biggest portfolio gap.` : "Add a planned monthly contribution before increasing risk." },
  ];

  if (context.broadWeight < 0.35) {
    plan.push({ title: "Build the base", detail: "Prioritize broad exposure before adding another high-conviction single name." });
  }
  if (context.defensiveWeight < 0.15 && context.riskProfile !== "aggressive") {
    plan.push({ title: "Add ballast", detail: "Research cash-like or bond exposure so a market drawdown does not force emotional selling." });
  }
  if (context.largest?.riskClass === "single" && context.largest.weight > 0.18) {
    plan.push({ title: "Control the leader", detail: `Do not add to ${context.largest.symbol} until it falls back inside the position limit or your total account grows.` });
  }

  return plan;
}

function buildWhatToSell(context) {
  const limit = context.riskProfile === "conservative" ? 0.12 : context.riskProfile === "aggressive" ? 0.25 : 0.18;
  const candidates = context.enriched
    .filter((holding) => holding.riskClass === "single" && (holding.weight > limit || holding.weight > 0.14))
    .slice(0, 4)
    .map((holding) => ({
      symbol: holding.symbol,
      title: `${holding.symbol}: trim to risk limit`,
      detail: `${holding.name} is ${formatPercent(holding.weight)} of the account. Consider trimming only if it violates your plan, not because of short-term fear.`,
    }));

  if (context.topTheme?.weight > 0.38 && !isCoreTheme(context.topTheme.theme)) {
    candidates.push({
      symbol: context.topTheme.theme,
      title: `${context.topTheme.theme}: reduce theme crowding`,
      detail: "If several holdings share the same driver, trim the weakest thesis before adding a new correlated idea.",
    });
  }

  return candidates.length
    ? candidates
    : [{ symbol: "HOLD", title: "No urgent sell candidate", detail: "The better move may be to avoid adding risk until a clean setup appears." }];
}

function buildTickerIdeas(context) {
  const ideas = [];
  if (context.broadWeight < 0.35) {
    ideas.push({ symbol: "VTI", label: "Broad base", detail: "Research as a diversified core benchmark, not as a hot trade." });
    ideas.push({ symbol: "VOO", label: "S&P 500 benchmark", detail: "Use it to compare whether stock-picking is actually adding value." });
  }
  if (context.defensiveWeight < 0.15 && context.riskProfile !== "aggressive") {
    ideas.push({ symbol: "SGOV", label: "Cash-like ballast", detail: "Research short-term Treasury exposure for dry powder and lower volatility." });
    ideas.push({ symbol: "BND", label: "Bond ballast", detail: "Research as a stabilizer if your horizon is longer than a few months." });
  }
  if (context.singleStockWeight > 0.55) {
    ideas.push({ symbol: "NO BUY", label: "Waitlist", detail: "Your highest edge may be doing nothing until concentration falls." });
  }
  if (ideas.length === 0) {
    ideas.push({ symbol: "WATCH", label: "Thesis watchlist", detail: "Add only tickers with clear invalidation, catalyst, and position limit." });
  }
  return ideas.slice(0, 5);
}

function buildThemeWeights(holdings, totalValue) {
  const weights = new Map();
  holdings.forEach((holding) => {
    const theme = holding.theme || "Other";
    weights.set(theme, (weights.get(theme) || 0) + (totalValue > 0 ? holding.value / totalValue : 0));
  });
  return [...weights.entries()]
    .map(([theme, weight]) => ({ theme, weight }))
    .sort((a, b) => b.weight - a.weight);
}

function weightByPredicate(holdings, predicate) {
  return holdings.reduce((sum, holding) => sum + (predicate(holding) ? holding.weight : 0), 0);
}

function classifyHolding(holding) {
  const text = `${holding.symbol} ${holding.name} ${holding.theme}`.toLowerCase();
  if (defensiveThemes.some((term) => text.includes(term))) return "defensive";
  if (broadThemes.some((term) => text.includes(term))) return "broad";
  return "single";
}

function isCoreTheme(theme) {
  const text = String(theme || "").toLowerCase();
  return broadThemes.some((term) => text.includes(term)) || defensiveThemes.some((term) => text.includes(term));
}

function inferTheme(symbol, name) {
  const text = `${symbol || ""} ${name || ""}`.toLowerCase();
  if (broadThemes.some((term) => text.includes(term))) return "Broad Market";
  if (defensiveThemes.some((term) => text.includes(term))) return "Defensive";
  if (highVolThemes.some((term) => text.includes(term))) return "High Growth";
  return "Single Stock";
}

function labelRisk(score) {
  if (score >= 72) return "High";
  if (score >= 48) return "Medium";
  return "Low";
}

function positiveNumber(value) {
  return Math.max(0, Number(value) || 0);
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}
