import { createAiRiskBrief } from "./ai-risk-layer.mjs";
import { callGeminiGenerateContent, geminiModel, parseJsonFromText, readGeminiText } from "./gemini-client.mjs";

export async function generateGeminiRiskBrief(report, fetchImpl = fetch) {
  if (!process.env.GEMINI_API_KEY) {
    return withSource(createAiRiskBrief(report), "local");
  }

  const model = geminiModel();
  const prompt = [
    "You are Iceberg, a beginner-friendly pre-trade risk agent.",
    "Analyze risk, sizing, downside, protection, and the supplied strategy recommendation in plain English.",
    "Do not predict prices. Do not say a stock is a buy or sell.",
    "Keep advice conservative and based only on the supplied report. Use the supplied strategy unless the report clearly says no safe size.",
    JSON.stringify(summarizeReportForAi(report)),
  ].join("\n\n");
  const data = await callGeminiGenerateContent(
    {
      model,
      prompt: `${prompt}\n\nReturn JSON only with keys: pattern, confidence, missingItems, signals, strategyName, strategySteps, summary, reflectionPrompt.`,
      generationConfig: { responseMimeType: "application/json" },
    },
    fetchImpl,
  );
  const parsed = parseGeminiJson(data);
  return withSource(validateBrief(parsed), "gemini");
}

export function parseGeminiJson(data) {
  return parseJsonFromText(readGeminiText(data));
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
