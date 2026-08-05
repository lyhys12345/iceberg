import { createAiRiskBrief } from "./ai-risk-layer.mjs";

const riskBriefSchema = {
  type: "object",
  additionalProperties: false,
  required: ["pattern", "confidence", "missingItems", "signals", "summary", "reflectionPrompt"],
  properties: {
    pattern: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    missingItems: { type: "array", items: { type: "string" } },
    signals: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
    reflectionPrompt: { type: "string" },
  },
};

export async function generateOpenAiRiskBrief(report, fetchImpl = fetch) {
  if (!process.env.OPENAI_API_KEY) {
    return withSource(createAiRiskBrief(report), "local");
  }

  const model = process.env.OPENAI_MODEL || "gpt-5.6";
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You are Iceberg, a beginner-friendly pre-trade risk agent. You analyze risk, sizing, downside, and protection. Do not predict prices. Do not say a stock is a buy or sell. Keep advice plain, conservative, and based only on the supplied report.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(summarizeReportForAi(report)),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "iceberg_risk_brief",
          strict: true,
          schema: riskBriefSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with ${response.status}.`);
  }

  const data = await response.json();
  const parsed = parseOpenAiJson(data);
  return withSource(validateBrief(parsed), "openai");
}

export function parseOpenAiJson(data) {
  const outputText =
    data.output_text ||
    data.output
      ?.flatMap((item) => item.content || [])
      ?.map((content) => content.text)
      ?.filter(Boolean)
      ?.join("");

  if (!outputText) {
    throw new Error("OpenAI response did not include structured text.");
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
  };
}

function validateBrief(brief) {
  return {
    pattern: String(brief.pattern || "needs review"),
    confidence: clamp(Number(brief.confidence) || 0.5, 0, 1),
    missingItems: asStringArray(brief.missingItems),
    signals: asStringArray(brief.signals),
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
