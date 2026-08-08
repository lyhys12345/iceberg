import { beginnerAdvice, beginnerIntro, beginnerMissingFields, beginnerQuestion, parseBeginnerTradeMessage } from "./conversation-agent.mjs";
import {
  finalMarketSnapshotSkill,
  runFinalResponseSkill,
  runIncompleteTradeResponseSkill,
  runAiRiskBriefSkill,
  runBehavioralFrictionSkill,
  runIntentExtractionSkill,
  runMarketResearchSkill,
  runMarketResolverSkill,
  runPortfolioContextSkill,
  runRiskSizingSkill,
  runStrategySelectionSkill,
} from "./agent-skills/index.mjs";

export async function runIcebergAgent(input, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const message = String(input?.message || "").trim();
  const defaults = input?.defaults || {};
  const conversationContext = normalizeConversationContext(input?.context || input?.conversationContext || {});
  const portfolio = input?.portfolio || null;
  const trace = [];

  if (!message) {
    return agentReply("intro", beginnerIntro("greeting"), { trace });
  }

  const interpretation = await runIntentExtractionSkill(message, defaults, fetchImpl);
  trace.push({
    step: "intent_extraction",
    source: interpretation.source,
    fallbackReason: interpretation.fallbackReason || "",
    intent: interpretation.intent,
    fields: summarizeFields(interpretation.fields),
  });

  const trade = mergeTradeFields(parseBeginnerTradeMessage(message, defaults), interpretation.fields);
  const conversationContextResult = applyConversationContext(trade, conversationContext, message);
  trace.push({ step: "conversation_context", applied: conversationContextResult.applied });

  const effectiveIntent = resolveEffectiveIntent(interpretation.intent, trade, message, conversationContextResult);

  if (effectiveIntent === "quote") {
    const quoteTrade = trade;
    if (!quoteTrade.symbol) {
      return agentReply("question", "Which stock ticker do you want me to check?", { trade: quoteTrade, trace, intent: "quote" });
    }

    const marketResult = await runMarketResolverSkill(quoteTrade.symbol, portfolio, fetchImpl);
    trace.push({ step: "market_resolver", source: marketResult.source, ok: Boolean(marketResult.market), note: marketResult.note });

    if (!marketResult.market) {
      return agentReply(
        "question",
        `${marketResult.note} If you paste the latest ${quoteTrade.symbol} price, I can use it for a risk check.`,
        { trade: quoteTrade, trace, intent: "quote" },
      );
    }

    return agentReply("quote", quoteMessage(marketResult.market, marketResult.note), {
      trade: quoteTrade,
      market: marketResult.market,
      trace,
      intent: "quote",
    });
  }

  if (effectiveIntent !== "trade") {
    return agentReply("intro", interpretation.reply || beginnerIntro(interpretation.intent), { trace, intent: interpretation.intent });
  }

  const portfolioContext = runPortfolioContextSkill(trade, portfolio, message);
  trace.push({ step: "portfolio_context", applied: portfolioContext.applied });

  let marketNote = "";
  let resolvedMarket = null;
  if (trade.symbol && !positive(trade.currentPrice)) {
    const marketResult = await runMarketResolverSkill(trade.symbol, portfolio, fetchImpl);
    trace.push({ step: "market_resolver", source: marketResult.source, ok: Boolean(marketResult.market), note: marketResult.note });

    if (marketResult.market) {
      resolvedMarket = marketResult.market;
      trade.currentPrice = String(marketResult.market.latestClose);
      marketNote = marketResult.note ? `${marketResult.note} ` : "";
    } else {
      marketNote = `${marketResult.note} `;
    }
  }

  const missing = beginnerMissingFields(trade);
  trace.push({ step: "missing_fields", missing });

  if (missing.length > 0) {
    if (shouldGiveTimingRead(message, trade, missing)) {
      const market = resolvedMarket || (await finalMarketSnapshotSkill(trade, portfolio, fetchImpl));
      const marketResearch = runMarketResearchSkill(trade, market);
      const finalResponse = runIncompleteTradeResponseSkill({ marketResearch, missing });
      trace.push({
        step: "market_research",
        symbol: trade.symbol,
        marketSource: market.source,
        timingBias: marketResearch.timingBias,
      });
      trace.push({ step: "final_response", type: "incomplete_trade" });
      return agentReply("research", `${marketNote}${finalResponse.message}`, {
        trade,
        market,
        workflow: {
          intent: interpretation.intent,
          marketResearch,
          finalResponse,
        },
        trace,
        intent: "trade",
      });
    }

    const marketSearchFailed = missing.includes("current price") && Boolean(marketNote);
    return agentReply(
      "question",
      `${marketNote}${beginnerQuestion(missing, { marketSearchFailed, symbol: trade.symbol })}`,
      { trade, trace },
    );
  }

  const market = resolvedMarket || (await finalMarketSnapshotSkill(trade, portfolio, fetchImpl));
  const marketResearch = runMarketResearchSkill(trade, market);
  trace.push({
    step: "market_research",
    symbol: trade.symbol,
    marketSource: market.source,
    timingBias: marketResearch.timingBias,
  });

  const riskSizing = runRiskSizingSkill(trade, market);
  const report = riskSizing.report;
  trace.push({ step: "risk_sizing", symbol: trade.symbol, marketSource: market.source, summary: riskSizing.summary });

  const friction = runBehavioralFrictionSkill(trade, report);
  trace.push({ step: "behavioral_friction", level: friction.level, impulseLanguage: friction.impulseLanguage, oversized: friction.oversized });

  const strategySelection = runStrategySelectionSkill({ trade, marketResearch, riskSizing, friction, report });
  trace.push({
    step: "strategy_selection",
    strategy: strategySelection.strategyName,
    action: strategySelection.action,
    confidence: strategySelection.confidence,
  });

  let aiBrief = null;
  try {
    aiBrief = await runAiRiskBriefSkill(report, fetchImpl);
    trace.push({ step: "ai_risk_brief", source: aiBrief.source || "local" });
  } catch (error) {
    trace.push({ step: "ai_risk_brief", source: "failed", error: String(error?.message || error) });
  }

  const finalResponse = runFinalResponseSkill({
    trade,
    marketResearch,
    riskSizing,
    friction,
    strategySelection,
    aiBrief,
    workflowSteps: buildWorkflowSteps({ interpretation, marketResearch, riskSizing, strategySelection, aiBrief }),
  });
  trace.push({ step: "final_response", type: "trade_plan", sections: Object.keys(finalResponse.sections) });

  return agentReply("plan", `${marketNote}${finalResponse.message}`, {
    trade,
    market,
    report,
    friction,
    protectionStrategy: strategySelection,
    strategySelection,
    aiBrief,
    workflow: {
      intent: interpretation.intent,
      steps: buildWorkflowSteps({ interpretation, marketResearch, riskSizing, strategySelection, aiBrief }),
      marketResearch,
      riskSizing: withoutReport(riskSizing),
      strategySelection,
      finalResponse,
    },
    trace,
  });
}

function mergeTradeFields(base, fields) {
  const merged = { ...base };
  Object.entries(fields || {}).forEach(([key, value]) => {
    if (value === "" || value === null || value === undefined) return;
    if (typeof value === "number" && !Number.isFinite(value)) return;
    merged[key] = String(value);
  });
  if (!merged.side) merged.side = "buy";
  if (!merged.horizon) merged.horizon = "swing";
  return merged;
}

function normalizeConversationContext(context) {
  const lastTrade = normalizeTradeContext(context.lastTrade || context.trade || {});
  const pendingTrade = normalizeTradeContext(context.pendingTrade || {});
  const lastMarket = normalizeMarketContext(context.lastMarket || context.market || {});
  const lastSymbol = normalizeSymbol(context.lastSymbol || lastMarket.symbol || lastTrade.symbol || pendingTrade.symbol);

  return {
    lastSymbol,
    lastMarket,
    lastTrade,
    pendingTrade,
  };
}

function normalizeTradeContext(trade) {
  const normalized = {};
  [
    "symbol",
    "side",
    "accountValue",
    "cashAvailable",
    "currentShares",
    "plannedBudget",
    "currentPrice",
    "horizon",
    "maxRiskPercent",
    "winProbability",
    "upsidePercent",
    "downsidePercent",
    "stopLossPercent",
    "targetGainPercent",
    "kellyFractionPercent",
  ].forEach((key) => {
    const value = trade?.[key];
    if (value === "" || value === null || value === undefined) return;
    normalized[key] = key === "symbol" ? normalizeSymbol(value) : String(value);
  });
  return normalized;
}

function normalizeMarketContext(market) {
  const symbol = normalizeSymbol(market?.symbol);
  const latestClose = Number(market?.latestClose || market?.currentPrice || 0);
  if (!symbol || !Number.isFinite(latestClose) || latestClose <= 0) return {};
  return {
    ...market,
    symbol,
    latestClose,
  };
}

function normalizeSymbol(value) {
  const symbol = String(value || "").trim().toUpperCase();
  return /^[A-Z]{1,6}$/.test(symbol) ? symbol : "";
}

function applyConversationContext(trade, context, message) {
  const applied = [];
  const explicit = parseBeginnerTradeMessage(message, {});
  const contextTrade = pickContextTrade(context, explicit.symbol || trade.symbol);

  if (!trade.symbol && !explicit.symbol) {
    const symbol = contextTrade.symbol || context.lastSymbol;
    if (symbol) {
      trade.symbol = symbol;
      applied.push("symbol");
    }
  }

  const matchingMarket = marketForSymbol(context, trade.symbol || contextTrade.symbol || context.lastSymbol);
  if (!positive(trade.currentPrice) && matchingMarket?.latestClose) {
    trade.currentPrice = String(matchingMarket.latestClose);
    applied.push("currentPrice");
  } else if (!positive(trade.currentPrice) && positive(contextTrade.currentPrice)) {
    trade.currentPrice = String(contextTrade.currentPrice);
    applied.push("currentPrice");
  }

  if (!positive(trade.plannedBudget) && !positive(explicit.plannedBudget) && positive(contextTrade.plannedBudget)) {
    trade.plannedBudget = String(contextTrade.plannedBudget);
    applied.push("plannedBudget");
  }

  if (!positive(trade.accountValue) && !positive(explicit.accountValue) && positive(contextTrade.accountValue)) {
    trade.accountValue = String(contextTrade.accountValue);
    applied.push("accountValue");
  }

  if (!positive(trade.cashAvailable) && !positive(explicit.cashAvailable) && positive(contextTrade.cashAvailable)) {
    trade.cashAvailable = String(contextTrade.cashAvailable);
    applied.push("cashAvailable");
  }

  if (!positive(trade.currentShares) && !positive(explicit.currentShares) && positive(contextTrade.currentShares)) {
    trade.currentShares = String(contextTrade.currentShares);
    applied.push("currentShares");
  }

  return { applied };
}

function pickContextTrade(context, symbol = "") {
  const candidates = [context.pendingTrade, context.lastTrade].filter(Boolean);
  const normalizedSymbol = normalizeSymbol(symbol);
  return (
    candidates.find((trade) => normalizedSymbol && normalizeSymbol(trade.symbol) === normalizedSymbol) ||
    candidates.find((trade) => normalizeSymbol(trade.symbol) === context.lastSymbol) ||
    candidates.find((trade) => positive(trade.plannedBudget) || positive(trade.accountValue)) ||
    {}
  );
}

function marketForSymbol(context, symbol = "") {
  const normalizedSymbol = normalizeSymbol(symbol);
  if (context.lastMarket?.symbol && (!normalizedSymbol || context.lastMarket.symbol === normalizedSymbol)) {
    return context.lastMarket;
  }
  return null;
}

function resolveEffectiveIntent(intent, trade, message, conversationContextResult) {
  if (intent !== "quote") return intent;
  if (asksExplicitQuote(message)) return "quote";
  if (trade.symbol && positive(trade.plannedBudget) && conversationContextResult.applied.length > 0) return "trade";
  return intent;
}

function summarizeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== "" && value !== null && value !== undefined));
}

function positive(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function quoteMessage(market, note = "") {
  const price = Number(market.latestClose).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
  const asOf = market.asOf ? ` as of ${market.asOf}` : "";
  const source = market.source ? ` Source: ${market.source}.` : "";
  const prefix = note ? `${note} ` : "";
  return `${prefix}${market.symbol} latest available price is ${price}${asOf}.${source} If you want a trade plan, tell me how much you are considering buying and your account size.`;
}

function shouldGiveTimingRead(message, trade, missing) {
  return Boolean(
    trade.symbol &&
      positive(trade.currentPrice) &&
      missing.includes("planned amount") &&
      asksTimingQuestion(message),
  );
}

function asksTimingQuestion(message) {
  const text = String(message || "").toLowerCase();
  return (
    /\b(good time|right time|should i buy|should i enter|buy now|worth buying|is this.*buy|is now.*buy)\b/.test(text) ||
    /\u597d\u65f6\u673a|\u597d\u6642\u6a5f|\u73b0\u5728.*\u4e70|\u73fe\u5728.*\u8cb7|\u8be5\u4e70|\u8a72\u8cb7|\u9002\u5408\u4e70|\u503c\u5f97\u4e70/.test(text)
  );
}

function asksExplicitQuote(message) {
  const text = String(message || "").toLowerCase();
  return (
    /\b(price|quote|stock price|latest price|how much is|what is .* trading at)\b/.test(text) ||
    /\u80a1\u4ef7|\u4ef7\u683c|\u591a\u5c11\u94b1|\u62a5\u4ef7|\u5831\u50f9/.test(text)
  );
}

function timingReadMessage(market) {
  const price = Number(market.latestClose).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
  const trend = market.trend || "mixed";
  const return20d = formatSignedPercent(market.return20d);
  const drawdown = formatSignedPercent(market.maxDrawdown60d);
  const volatility = formatSignedPercent(market.annualizedVolatility);

  return `${market.symbol} is around ${price} as of ${market.asOf}. Recent 20-day move is ${return20d}, trend reads ${trend}, estimated annualized volatility is ${volatility}, and the recent 60-day drawdown is ${drawdown}. I can give you a timing read, but I should not pretend this is a full trade plan without order size. If you are unsure, start by deciding the maximum dollars you are willing to risk, then tell me the planned buy amount and I will calculate sizing, stop, downside, and protection.`;
}

function withoutReport(riskSizing) {
  const { report, ...summary } = riskSizing;
  return summary;
}

function buildWorkflowSteps({ interpretation, marketResearch, riskSizing, strategySelection, aiBrief }) {
  return [
    {
      id: "intent_extraction",
      label: "Intent extraction",
      status: "complete",
      output: interpretation.intent,
      detail: `Read the message as ${interpretation.intent}.`,
    },
    {
      id: "market_research",
      label: "Market research",
      status: "complete",
      output: marketResearch.timingBias,
      detail: marketResearch.summary,
    },
    {
      id: "risk_sizing",
      label: "Risk sizing",
      status: "complete",
      output: `${riskSizing.sizing.suggestedShares} shares`,
      detail: `Risk score ${riskSizing.riskScore}/100; Kelly cap ${formatSignedPercent(riskSizing.kelly.fractionalKelly)} of account.`,
    },
    {
      id: "strategy_selection",
      label: "Strategy selection",
      status: "complete",
      output: strategySelection.strategyName,
      detail: strategySelection.beginnerSummary,
    },
    {
      id: "final_response",
      label: "Final response",
      status: "complete",
      output: aiBrief?.source === "gemini" ? "Gemini assisted" : "Deterministic fallback",
      detail: "Compose a beginner-readable answer without pretending to predict price.",
    },
  ];
}

function formatSignedPercent(value) {
  const number = Number(value || 0) * 100;
  const sign = number > 0 ? "+" : "";
  return `${sign}${number.toFixed(1)}%`;
}

function agentReply(type, message, extra = {}) {
  return {
    type,
    message,
    ...extra,
  };
}
