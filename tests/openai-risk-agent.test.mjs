import assert from "node:assert/strict";
import { generateOpenAiRiskBrief, parseOpenAiJson } from "../src/openai-risk-agent.mjs";

const parsed = parseOpenAiJson({
  output_text: JSON.stringify({
    pattern: "possible FOMO",
    confidence: 0.72,
    missingItems: ["exit condition"],
    signals: ["urgent language"],
    summary: "Slow down and define the stop first.",
    reflectionPrompt: "What proves this trade wrong?",
  }),
});

assert.equal(parsed.pattern, "possible FOMO");

const oldKey = process.env.OPENAI_API_KEY;
delete process.env.OPENAI_API_KEY;

const localBrief = await generateOpenAiRiskBrief({
  trade: { symbol: "AAPL", thesis: "I need to buy now before I miss out." },
  sizing: { suggestedShares: 0, futurePositionPercent: 0 },
  kelly: { edge: -0.01 },
  market: { isStale: false },
  decision: { kind: "avoid" },
});

assert.equal(localBrief.source, "local");

if (oldKey) process.env.OPENAI_API_KEY = oldKey;

console.log("openai-risk-agent tests passed");
