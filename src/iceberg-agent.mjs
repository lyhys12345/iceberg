import { beginnerAdvice, beginnerIntro, beginnerMissingFields, beginnerQuestion, parseBeginnerTradeMessage } from "./conversation-agent.mjs";
import {
  finalMarketSnapshotSkill,
  runAiRiskBriefSkill,
  runBehavioralFrictionSkill,
  runIntentExtractionSkill,
  runMarketResolverSkill,
  runPortfolioContextSkill,
  runPreTradeRiskCheckSkill,
  runTradeProtectionStrategySkill,
} from "./agent-skills/index.mjs";

export async function runIcebergAgent(input, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const message = String(input?.message || "").trim();
  const defaults = input?.defaults || {};
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

  if (interpretation.intent === "quote") {
    const quoteTrade = mergeTradeFields(parseBeginnerTradeMessage(message, defaults), interpretation.fields);
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

  if (interpretation.intent !== "trade") {
    return agentReply("intro", interpretation.reply || beginnerIntro(interpretation.intent), { trace, intent: interpretation.intent });
  }

  const trade = mergeTradeFields(parseBeginnerTradeMessage(message, defaults), interpretation.fields);
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
      trace.push({ step: "market_timing_read", symbol: trade.symbol, marketSource: market.source });
      return agentReply("research", `${marketNote}${timingReadMessage(market)}`, {
        trade,
        market,
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
  const risk = runPreTradeRiskCheckSkill(trade, market);
  const report = risk.report;
  trace.push({ step: "pre_trade_risk_check", symbol: trade.symbol, marketSource: market.source, summary: risk.summary });

  const friction = runBehavioralFrictionSkill(trade, report);
  trace.push({ step: "behavioral_friction", level: friction.level, impulseLanguage: friction.impulseLanguage, oversized: friction.oversized });

  const protectionStrategy = runTradeProtectionStrategySkill(report);
  trace.push({ step: "trade_protection_strategy", strategy: protectionStrategy.strategyName });

  let aiBrief = null;
  try {
    aiBrief = await runAiRiskBriefSkill(report, fetchImpl);
    trace.push({ step: "ai_risk_brief", source: aiBrief.source || "local" });
  } catch (error) {
    trace.push({ step: "ai_risk_brief", source: "failed", error: String(error?.message || error) });
  }

  const frictionSentence = friction.level === "normal" ? "" : ` ${friction.instruction}`;
  const agentMessage = `${marketNote}${beginnerAdvice(report)}${frictionSentence} I used the Iceberg skill chain: intent extraction, portfolio context, market resolver, risk check, behavioral friction, and protection strategy.`;
  return agentReply("plan", agentMessage, { trade, market, report, friction, protectionStrategy, aiBrief, trace });
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
