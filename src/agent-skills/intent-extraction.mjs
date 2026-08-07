import { beginnerIntro, classifyBeginnerIntent } from "../conversation-agent.mjs";

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
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const prompt = [
    "You are the intent and field extraction layer for Iceberg, an AI pre-trade risk system.",
    "Classify the user message. Extract only facts the user explicitly provided.",
    "If the user is greeting, asking who you are, or asking how to use the product, do not invent a trade.",
    "Return JSON only.",
    JSON.stringify({ message, knownDefaults: defaults }),
  ].join("\n\n");

  const response = await fetchImpl("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env.GEMINI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: `${prompt}\n\nReturn JSON only with keys: intent, reply, fields. intent must be one of greeting, identity, help, trade.`,
    }),
  });

  if (!response.ok) throw new Error(`Gemini extraction failed with ${response.status}.`);
  const data = await response.json();
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
  return ["greeting", "identity", "help", "trade"].includes(intent) ? intent : "trade";
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

function readGeminiText(data) {
  const text =
    data.output_text ||
    data.output?.text ||
    data.steps
      ?.flatMap((step) => step.content || [])
      ?.map((content) => content.text)
      ?.filter(Boolean)
      ?.join("") ||
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      ?.filter(Boolean)
      ?.join("");

  if (!text) throw new Error("Gemini response did not include text.");
  return text;
}

function parseJsonFromText(text) {
  const trimmed = String(text || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start < 0 || end < start) {
    throw new Error("Gemini response did not include JSON.");
  }

  return JSON.parse(candidate.slice(start, end + 1));
}
