import assert from "node:assert/strict";
import { runBehavioralFrictionSkill } from "../src/agent-skills/behavioral-friction.mjs";
import { runIntentExtractionSkill } from "../src/agent-skills/intent-extraction.mjs";
import { icebergAgentSkillCatalog } from "../src/agent-skills/index.mjs";
import { runStrategySelectionSkill } from "../src/agent-skills/strategy-selection.mjs";

assert.deepEqual(
  icebergAgentSkillCatalog.map((skill) => skill.id),
  [
    "intent_extraction",
    "portfolio_context",
    "market_resolver",
    "market_research",
    "pre_trade_risk_check",
    "risk_sizing",
    "behavioral_friction",
    "strategy_selection",
    "ai_risk_brief",
    "final_response",
  ],
);

const friction = runBehavioralFrictionSkill(
  {
    thesis: "NVDA is mooning and I have FOMO. I want to make back losses with margin.",
    accountValue: 10000,
    plannedBudget: 5000,
  },
  {
    decision: { kind: "reduce" },
    flags: [{ title: "Impulse language" }, { title: "Oversized request" }],
  },
);

assert.equal(friction.level, "hard_stop");
assert.equal(friction.impulseLanguage, true);
assert.equal(friction.oversized, true);

const selectedStrategy = runStrategySelectionSkill({
  trade: { symbol: "NVDA", currentShares: 0 },
  marketResearch: {
    timingBias: "slow down",
    signals: [{ title: "Chasing risk", detail: "Recent price action is hot." }],
  },
  riskSizing: {
    decision: { kind: "reduce" },
    riskScore: 56,
    sizing: { suggestedDollars: 800, suggestedShares: 4, futurePositionPercent: 0.08 },
    stop: { price: 180, lossDollars: 80 },
  },
  friction: { level: "normal" },
  report: { protection: [], entries: [] },
});

assert.equal(selectedStrategy.strategyId, "small-starter");
assert.equal(selectedStrategy.action, "starter");
assert.equal(selectedStrategy.orderTicket.firstEntryShares, 1);
assert.match(selectedStrategy.beginnerSummary, /starter entry/);

const oldGeminiKey = process.env.GEMINI_API_KEY;
process.env.GEMINI_API_KEY = "test-key";
const extraction = await runIntentExtractionSkill(
  "I want to buy NVDA with $1000. Current price is $120.",
  {},
  async () => ({
    ok: true,
    async json() {
      return {
        steps: [
          {
            content: [
              {
                text: JSON.stringify({
                  intent: "trade",
                  fields: {
                    ticker: "nvda",
                    notional: 1000,
                    current_price: 120,
                    ignored_field: "do not leak",
                  },
                }),
              },
            ],
          },
        ],
      };
    },
  }),
);

assert.equal(extraction.fields.symbol, "NVDA");
assert.equal(extraction.fields.plannedBudget, 1000);
assert.equal(extraction.fields.currentPrice, 120);
assert.equal("notional" in extraction.fields, false);
assert.equal("current_price" in extraction.fields, false);
assert.equal("ignored_field" in extraction.fields, false);
if (oldGeminiKey) process.env.GEMINI_API_KEY = oldGeminiKey;
else delete process.env.GEMINI_API_KEY;

console.log("agent-skills tests passed");
