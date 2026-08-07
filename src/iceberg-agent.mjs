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

function agentReply(type, message, extra = {}) {
  return {
    type,
    message,
    ...extra,
  };
}
