export function parseBeginnerTradeMessage(message, defaults = {}) {
  const text = String(message || "").trim();
  const normalized = text.replaceAll(",", "");
  const lower = normalized.toLowerCase();
  const symbol = extractSymbol(normalized);
  const accountValue = findFieldAmount(normalized, ["account", "portfolio", "账户", "本金", "资金"]) || defaults.accountValue || "";
  const cashAvailable = findFieldAmount(normalized, ["available cash", "cash available", "cash", "现金", "可用资金", "可用现金"]) || defaults.cashAvailable || accountValue || "";
  const plannedBudget = findPlannedAmount(normalized) || defaults.plannedBudget || "";
  const currentPrice = findFieldAmount(normalized, ["current price", "latest price", "stock price", "price", "现在股价", "股价", "价格"]) || "";
  const horizon = lower.includes("day") || lower.includes("日内") ? "day" : lower.includes("long") || lower.includes("长期") ? "long" : defaults.horizon || "swing";
  const side = lower.includes("sell") || lower.includes("卖") ? "sell" : "buy";

  return {
    symbol,
    side,
    horizon,
    currentPrice,
    accountValue,
    cashAvailable,
    currentShares: defaults.currentShares || "0",
    plannedBudget,
    maxRiskPercent: defaults.maxRiskPercent || "1",
    winProbability: defaults.winProbability || "55",
    upsidePercent: defaults.upsidePercent || "12",
    downsidePercent: defaults.downsidePercent || "8",
    stopLossPercent: defaults.stopLossPercent || "6",
    targetGainPercent: defaults.targetGainPercent || "12",
    kellyFractionPercent: defaults.kellyFractionPercent || "25",
    thesis: text,
  };
}

export function beginnerMissingFields(trade) {
  const missing = [];
  if (!trade.symbol) missing.push("ticker");
  if (!positive(trade.accountValue)) missing.push("account value");
  if (!positive(trade.plannedBudget)) missing.push("planned amount");
  if (!positive(trade.currentPrice)) missing.push("current price");
  return missing;
}

export function beginnerAdvice(report) {
  const size = money(report.sizing.suggestedDollars);
  const stop = money(report.scenarios.stop.price);
  const stopLoss = money(Math.abs(report.scenarios.stop.pnl));
  const exposure = `${(report.sizing.futurePositionPercent * 100).toFixed(1)}%`;
  const strategy = report.strategy?.primaryName ? `Strategy: ${report.strategy.primaryName}. ` : "";

  if (report.decision.kind === "avoid") {
    return `${strategy}I would not rush this trade. Under your inputs, Iceberg cannot find a protected size. The safer move is to wait, rewrite the plan, or reduce the amount until the stop-loss risk fits your account.`;
  }

  if (report.decision.kind === "reduce") {
    return `${strategy}This may be tradable only at a small size. A beginner-friendly cap is about ${size}, with a protective stop near ${stop}. If that stop hits, the estimated loss is about ${stopLoss}.`;
  }

  return `${strategy}This looks acceptable only if you follow the protection plan. Keep the trade around ${size}, set the stop near ${stop}, and keep total exposure around ${exposure}.`;
}

export function beginnerQuestion(missingFields, context = {}) {
  if (missingFields.length === 0) return "";

  const labels = {
    ticker: "which stock ticker",
    "account value": "your account size",
    "planned amount": "how much you plan to buy",
    "current price": "the current stock price",
  };

  const userFields = context.marketSearchFailed ? missingFields.filter((field) => field !== "current price") : missingFields;
  const priceFallback =
    context.marketSearchFailed && missingFields.includes("current price")
      ? ` I already tried to resolve ${context.symbol || "the ticker"} from market data providers; if they are unavailable, paste the latest price once and I can continue.`
      : "";

  if (userFields.length === 0) {
    return priceFallback.trim();
  }

  return `I still need ${userFields.map((field) => labels[field]).join(", ")} before I can estimate your position size and protection.${priceFallback}`;
}

function extractSymbol(text) {
  const explicit = text.match(/\$([A-Za-z]{1,5})\b/);
  if (explicit) return explicit[1].toUpperCase();

  const words = text.match(/\b[A-Z]{1,5}\b/g) || [];
  const ignored = new Set(["I", "AI", "USD", "ETF"]);
  const candidate = words.find((word) => !ignored.has(word));
  return candidate || "";
}

function findFieldAmount(text, phrases) {
  for (const phrase of phrases) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`${escaped}\\s*(?:is|=|:|：|为|是)?\\s*(?:\\$|usd\\s*)?(\\d+(?:\\.\\d+)?)(?:\\s*(k|m|万))?`, "i");
    const match = text.match(pattern);
    if (match) return String(scaleAmount(match[1], match[2]));
  }

  return "";
}

function findPlannedAmount(text) {
  const phrases = [
    "plan to buy",
    "planning to buy",
    "want to buy",
    "buy",
    "spend",
    "budget",
    "准备买",
    "打算买",
    "买入",
    "投入",
    "计划",
  ];

  for (const phrase of phrases) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`${escaped}\\s*(?:another|about|around|roughly|approximately|up to|大概|大约|约)?\\s*(?:\\$|usd\\s*)?(\\d+(?:\\.\\d+)?)(?:\\s*(k|m|万))?`, "i");
    const match = text.match(pattern);
    if (match) return String(scaleAmount(match[1], match[2]));
  }

  const withAmount = text.match(/\b(?:with|for)\s*(?:\$|usd\s*)?(\d+(?:\.\d+)?)(?:\s*(k|m))?\s*(?:dollars|usd)\b/i);
  if (withAmount) return String(scaleAmount(withAmount[1], withAmount[2]));

  return "";
}

function scaleAmount(rawValue, rawSuffix) {
  const value = Number(rawValue);
  const suffix = String(rawSuffix || "").toLowerCase();
  const multiplier = suffix === "k" ? 1000 : suffix === "m" ? 1000000 : suffix === "万" ? 10000 : 1;
  return value * multiplier;
}

function positive(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function money(value) {
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
