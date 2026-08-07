import { beginnerIntro, classifyBeginnerIntent } from "../conversation-agent.mjs";
import { callGeminiGenerateContent, geminiModel, parseJsonFromText, readGeminiText } from "../gemini-client.mjs";

export async function runIntentExtractionSkill(message, defaults = {}, fetchImpl = fetch) {
  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = await interpretWithGemini(message, defaults, fetchImpl);
      if (ai.intent) return { ...ai, source: "gemini" };
    } catch (error) {
      return localInterpretation(message, String(error?.message || error));
    }
  }

  return localInterpretation(message, "");
}
async function interpretWithGemini(message, defaults, fetchImpl) {
  const model = geminiModel();
  const prompt = [
    "You are the intent and field extraction layer for Iceberg, an AI pre-trade risk system.",
    "Classify the user message. Extract only facts the user explicitly provided.",
    "If the user is greeting, asking who you are, or asking how to use the product, do not invent a trade.",
    "If the user only asks for a stock price, quote, latest price, or current market price, classify it as quote, not trade.",
    "Return JSON only.",
    JSON.stringify({ message, knownDefaults: defaults }),
  ].join("\n\n");

  const data = await callGeminiGenerateContent(
    {
      model,
      prompt: `${prompt}\n\nReturn JSON only with keys: intent, reply, fields. intent must be one of greeting, identity, help, quote, trade.`,
      generationConfig: { responseMimeType: "application/json" },
    },
    fetchImpl,
  );
  const parsed = parseJsonFromText(readGeminiText(data));
  return {
    intent: normalizeIntent(parsed.intent),
    reply: String(parsed.reply || ""),
    fields: normalizeExtractedFields(parsed.fields || {}),
  };
}

function localInterpretation(message, fallbackReason) {
  const intent = classifyBeginnerIntent(message);
  return {
    source: "local",
    fallbackReason,
    intent,
    reply: intent === "trade" ? "" : beginnerIntro(intent),
    fields: {},
  };
}

function normalizeIntent(intent) {
  return ["greeting", "identity", "help", "quote", "trade"].includes(intent) ? intent : "trade";
}

function normalizeExtractedFields(fields) {
  const normalized = {};
  const fieldMap = {
    ticker: "symbol",
    ticker_symbol: "symbol",
    stock: "symbol",
    action: "side",
    current_price: "currentPrice",
    latest_price: "currentPrice",
    stock_price: "currentPrice",
    price: "currentPrice",
    account_value: "accountValue",
    account_size: "accountValue",
    portfolio_value: "accountValue",
    cash_available: "cashAvailable",
    current_shares: "currentShares",
    shares_owned: "currentShares",
    planned_amount: "plannedBudget",
    order_amount: "plannedBudget",
    budget: "plannedBudget",
    notional: "plannedBudget",
    time_horizon: "horizon",
  };
  const allowed = new Set([
    "symbol",
    "side",
    "accountValue",
    "cashAvailable",
    "currentShares",
    "plannedBudget",
    "currentPrice",
    "horizon",
    "thesis",
    "maxRiskPercent",
    "winProbability",
    "upsidePercent",
    "downsidePercent",
    "stopLossPercent",
    "targetGainPercent",
    "kellyFractionPercent",
  ]);

  Object.entries(fields || {}).forEach(([key, value]) => {
    if (value === "" || value === null || value === undefined) return;
    const canonical = fieldMap[key] || key;
    if (!allowed.has(canonical)) return;
    if (canonical === "symbol") normalized.symbol = String(value).trim().toUpperCase();
    else normalized[canonical] = value;
  });
  return normalized;
}
