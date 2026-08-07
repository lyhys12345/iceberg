import { createAiRiskBrief } from "./ai-risk-layer.mjs";

export async function generateGeminiRiskBrief(report, fetchImpl = fetch) {
  if (!process.env.GEMINI_API_KEY) {
    return withSource(createAiRiskBrief(report), "local");
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const prompt = [
    "You are Iceberg, a beginner-friendly pre-trade risk agent.",
    "Analyze risk, sizing, downside, protection, and the supplied strategy recommendation in plain English.",
    "Do not predict prices. Do not say a stock is a buy or sell.",
    "Keep advice conservative and based only on the supplied report. Use the supplied strategy unless the report clearly says no safe size.",
    JSON.stringify(summarizeReportForAi(report)),
  ].join("\n\n");
  const response = await fetchImpl("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env.GEMINI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: `${prompt}\n\nReturn JSON only with keys: pattern, confidence, missingItems, signals, strategyName, strategySteps, summary, reflectionPrompt.`,
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
    data.steps
      ?.flatMap((step) => step.content || [])
      ?.map((content) => content.text)
      ?.filter(Boolean)
      ?.join("") ||
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      ?.filter(Boolean)
      ?.join("");

  if (!outputText) {
    throw new Error("Gemini response did not include structured text.");
  }

  return parseJsonFromText(outputText);
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
