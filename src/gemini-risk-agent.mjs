import { createAiRiskBrief } from "./ai-risk-layer.mjs";

const riskBriefSchema = {
  type: "object",
  additionalProperties: false,
  required: ["pattern", "confidence", "missingItems", "signals", "strategyName", "strategySteps", "summary", "reflectionPrompt"],
  properties: {
    pattern: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    missingItems: { type: "array", items: { type: "string" } },
    signals: { type: "array", items: { type: "string" } },
    strategyName: { type: "string" },
    strategySteps: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
    reflectionPrompt: { type: "string" },
  },
};

export async function generateGeminiRiskBrief(report, fetchImpl = fetch) {
  if (!process.env.GEMINI_API_KEY) {
    return withSource(createAiRiskBrief(report), "local");
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const response = await fetchImpl("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env.GEMINI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        "You are Iceberg, a beginner-friendly pre-trade risk agent.",
        "Analyze risk, sizing, downside, protection, and the supplied strategy recommendation in plain English.",
        "Do not predict prices. Do not say a stock is a buy or sell.",
        "Keep advice conservative and based only on the supplied report. Use the supplied strategy unless the report clearly says no safe size.",
        JSON.stringify(summarizeReportForAi(report)),
      ].join("\n\n"),
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: riskBriefSchema,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini request failed with ${response.status}.`);
  }

  const data = await response.json();
  const parsed = parseGeminiJson(data);
  return withSource(validateBrief(parsed), "gemini");
}

export function parseGeminiJson(data) {
  const outputText =
    data.output_text ||
    data.output?.text ||
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      ?.filter(Boolean)
      ?.join("");

  if (!outputText) {
    throw new Error("Gemini response did not include structured text.");
  }

  return JSON.parse(outputText);
}

function summarizeReportForAi(report) {
  return {
    symbol: report.trade.symbol,
    side: report.trade.side,
    thesis: report.trade.thesis,
    decision: report.decision,
    riskScore: report.riskScore,
    market: report.market,
    kelly: report.kelly,
    sizing: report.sizing,
    scenarios: report.scenarios,
    flags: report.flags,
    strategy: report.strategy,
  };
}

function validateBrief(brief) {
  return {
    pattern: String(brief.pattern || "needs review"),
    confidence: clamp(Number(brief.confidence) || 0.5, 0, 1),
    missingItems: asStringArray(brief.missingItems),
    signals: asStringArray(brief.signals),
    strategyName: String(brief.strategyName || "Review strategy"),
    strategySteps: asStringArray(brief.strategySteps),
    summary: String(brief.summary || "Review the risk plan before trading."),
    reflectionPrompt: String(brief.reflectionPrompt || "What would make this trade invalid?"),
  };
}

function withSource(brief, source) {
  return { ...brief, source };
}

function asStringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
