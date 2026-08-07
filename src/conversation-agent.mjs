export function parseBeginnerTradeMessage(message, defaults = {}) {
  const text = String(message || "").trim();
  const normalized = text.replaceAll(",", "");
  const lower = normalized.toLowerCase();
  const symbol = extractSymbol(normalized);
  const accountValue = findFieldAmount(normalized, ["account", "portfolio", "\u8d26\u6237", "\u672c\u91d1", "\u8d44\u91d1"]) || defaults.accountValue || "";
  const cashAvailable =
    findFieldAmount(normalized, ["available cash", "cash available", "cash", "\u73b0\u91d1", "\u53ef\u7528\u8d44\u91d1", "\u53ef\u7528\u73b0\u91d1"]) ||
    defaults.cashAvailable ||
    accountValue ||
    "";
  const plannedBudget =
    findPlannedAmount(normalized, Boolean(classifyBeginnerIntent(message) === "quote")) || defaults.plannedBudget || "";
  const currentPrice =
    findFieldAmount(normalized, ["current price", "latest price", "stock price", "price", "\u73b0\u5728\u80a1\u4ef7", "\u80a1\u4ef7", "\u4ef7\u683c"]) ||
    "";
  const horizon = lower.includes("day") || lower.includes("\u65e5\u5185") ? "day" : lower.includes("long") || lower.includes("\u957f\u671f") ? "long" : defaults.horizon || "swing";
  const side = lower.includes("sell") || lower.includes("\u5356") ? "sell" : "buy";

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

export function classifyBeginnerIntent(message) {
  const text = String(message || "").trim().toLowerCase();
  if (!text) return "empty";

  const greetingOnly = /^(hi|hello|hey|yo|hello there|\u4f60\u597d|\u55e8|\u54c8\u55bd)[\s!.?,.\u3002\uff0c]*$/.test(text);
  const asksIdentity =
    /\b(who are you|what are you|what is iceberg|introduce yourself)\b/.test(text) ||
    /\u4f60\u662f\u8c01|\u4f60\u662f\u5e72\u561b|\u8fd9\u662f\u4ec0\u4e48/.test(text);
  const asksHelp =
    /\b(help|how do i use|what can you do|how does this work|example)\b/.test(text) ||
    /\u600e\u4e48\u7528|\u4f60\u80fd\u505a\u4ec0\u4e48|\u5982\u4f55\u4f7f\u7528|\u5e2e\u6211/.test(text);
  const asksQuote =
    /\b(price|quote|stock price|latest price|how much is|what is .* trading at)\b/.test(text) ||
    /\u80a1\u4ef7|\u4ef7\u683c|\u591a\u5c11\u94b1|\u62a5\u4ef7|\u5831\u50f9/.test(text);
  const tradeVerb =
    /\b(buy|sell|trade|purchase|short|long|add|trim)\b/.test(text) ||
    /\u4e70|\u5356|\u4ea4\u6613|\u4e70\u5165|\u5356\u51fa|\u52a0\u4ed3|\u51cf\u4ed3/.test(text);

  if (asksIdentity) return "identity";
  if (asksHelp) return "help";
  if (greetingOnly) return "greeting";
  if (asksQuote && !tradeVerb) return "quote";
  return "trade";
}

export function beginnerIntro(intent = "identity") {
  const base =
    "I am Iceberg, a pre-trade risk layer. I help you slow down before buying by checking position size, downside, concentration, Kelly sizing, and protection rules. I am education-only, not a financial advisor.";

  if (intent === "greeting") {
    return `${base} Tell me a ticker and the amount you are thinking about, for example: "I want to buy NVDA with $1,000."`;
  }

  if (intent === "help") {
    return `${base} You can say: "I want to buy NVDA with $1,000", ask "what is NVDA's price?", or add context like account size, cash, current shares, and current price. If you saved a Portfolio, I will use that context automatically.`;
  }

  if (intent === "quote") {
    return "Tell me a ticker and I can check the latest available market price before we talk about trade sizing.";
  }

  return `${base} My job is to make impulsive trades harder and planned trades clearer. Start with a ticker, planned amount, and price if you have it.`;
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
  if (candidate) return candidate;

  const lowerIgnored = new Set([
    "a",
    "an",
    "buy",
    "cash",
    "day",
    "for",
    "hold",
    "long",
    "now",
    "put",
    "sell",
    "the",
    "this",
    "usd",
    "with",
  ]);
  const contextMatch = text.match(/\b(?:buy|sell|trade|research|watch|ticker|symbol|stock|\u4e70|\u5356)\s+\$?([a-z]{1,5})\b/i);
  if (contextMatch && !lowerIgnored.has(contextMatch[1].toLowerCase())) {
    return contextMatch[1].toUpperCase();
  }

  const quoteContextMatch = text.match(/\b([a-z]{1,5})\b(?=.*(?:price|quote|stock price|latest price|\u80a1\u4ef7|\u4ef7\u683c|\u591a\u5c11\u94b1|\u62a5\u4ef7|\u5831\u50f9))/i);
  if (quoteContextMatch && !lowerIgnored.has(quoteContextMatch[1].toLowerCase())) {
    return quoteContextMatch[1].toUpperCase();
  }

  const trimmed = text.trim();
  if (/^[a-z]{1,5}$/i.test(trimmed) && !lowerIgnored.has(trimmed.toLowerCase())) {
    return trimmed.toUpperCase();
  }

  return "";
}

function findFieldAmount(text, phrases) {
  for (const phrase of phrases) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`${escaped}\\s*(?:is|=|:|\uff1a|\u4e3a|\u662f)?\\s*(?:\\$|usd\\s*)?(\\d+(?:\\.\\d+)?)(?:\\s*(k|m|\u4e07))?`, "i");
    const match = text.match(pattern);
    if (match) return String(scaleAmount(match[1], match[2]));
  }

  return "";
}

function findPlannedAmount(text, isQuote = false) {
  if (isQuote) return "";

  const phrases = [
    "plan to buy",
    "planning to buy",
    "want to buy",
    "want to put",
    "put",
    "buy",
    "spend",
    "budget",
    "\u51c6\u5907\u4e70",
    "\u6253\u7b97\u4e70",
    "\u4e70\u5165",
    "\u6295\u5165",
    "\u8ba1\u5212",
  ];

  for (const phrase of phrases) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`${escaped}\\s*(?:another|about|around|roughly|approximately|up to|\u5927\u6982|\u5927\u7ea6|\u7ea6)?\\s*(?:\\$|usd\\s*)?(\\d+(?:\\.\\d+)?)(?:\\s*(k|m|\u4e07))?`, "i");
    const match = text.match(pattern);
    if (match) return String(scaleAmount(match[1], match[2]));
  }

  const withAmount = text.match(/\b(?:with|for)\s*(?:\$|usd\s*)?(\d+(?:\.\d+)?)(?:\s*(k|m))?(?:\s*(?:dollars|usd))?\b/i);
  if (withAmount) {
    const amount = scaleAmount(withAmount[1], withAmount[2]);
    if (amount >= 100) return String(amount);
  }

  return "";
}

function scaleAmount(rawValue, rawSuffix) {
  const value = Number(rawValue);
  const suffix = String(rawSuffix || "").toLowerCase();
  const multiplier = suffix === "k" ? 1000 : suffix === "m" ? 1000000 : suffix === "\u4e07" ? 10000 : 1;
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
