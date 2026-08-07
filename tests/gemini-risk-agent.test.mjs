import assert from "node:assert/strict";
import { generateGeminiRiskBrief, parseGeminiJson } from "../src/gemini-risk-agent.mjs";

const parsed = parseGeminiJson({
  output_text: `\`\`\`json
${JSON.stringify({
    pattern: "possible FOMO",
    confidence: 0.81,
    missingItems: ["exit condition"],
    signals: ["urgent language"],
    summary: "Reduce size and define the stop first.",
    reflectionPrompt: "What proves this trade wrong?",
  })}
\`\`\``,
});

assert.equal(parsed.pattern, "possible FOMO");

const oldKey = process.env.GEMINI_API_KEY;
delete process.env.GEMINI_API_KEY;

const localBrief = await generateGeminiRiskBrief({
  trade: { symbol: "AAPL", thesis: "I want to buy now before I miss out." },
  sizing: { suggestedShares: 0, futurePositionPercent: 0 },
  kelly: { edge: -0.01 },
  market: { isStale: false },
  decision: { kind: "avoid" },
});

assert.equal(localBrief.source, "local");

process.env.GEMINI_API_KEY = "test-key";
const called = [];
const geminiBrief = await generateGeminiRiskBrief(
  {
    trade: { symbol: "AAPL", side: "buy", thesis: "Planned entry with stop." },
    decision: { kind: "consider" },
    riskScore: 20,
    market: {},
    kelly: {},
    sizing: {},
    scenarios: {},
    flags: [],
  },
  async (url, options) => {
    called.push({ url, options });
    return {
      ok: true,
      async json() {
        return {
          steps: [
            {
              type: "model_output",
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    pattern: "plan-based trade",
                    confidence: 0.7,
                    missingItems: [],
                    signals: [],
                    summary: "The plan is structured.",
                    reflectionPrompt: "Will you follow the stop?",
                  }),
                },
              ],
            },
          ],
        };
      },
    };
  },
);

assert.equal(geminiBrief.source, "gemini");
assert.equal(called.length, 1);
assert.equal(
  called[0].url,
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
);
assert.equal(called[0].options.headers["x-goog-api-key"], "test-key");
const body = JSON.parse(called[0].options.body);
assert.match(body.contents[0].parts[0].text, /Return JSON only/);
assert.equal(body.generationConfig.responseMimeType, "application/json");

if (oldKey) {
  process.env.GEMINI_API_KEY = oldKey;
} else {
  delete process.env.GEMINI_API_KEY;
}

console.log("gemini-risk-agent tests passed");
