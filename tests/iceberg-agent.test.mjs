import assert from "node:assert/strict";
import { runIcebergAgent } from "../src/iceberg-agent.mjs";
import { demoPortfolio } from "../src/portfolio-advisor.mjs";

const oldGeminiKey = process.env.GEMINI_API_KEY;
const oldOpenAiKey = process.env.OPENAI_API_KEY;
const oldProvider = process.env.AI_PROVIDER;
delete process.env.GEMINI_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.AI_PROVIDER;

const identity = await runIcebergAgent({
  message: "hi who are you",
  portfolio: demoPortfolio,
});

assert.equal(identity.type, "intro");
assert.match(identity.message, /pre-trade risk layer/);
assert.ok(identity.trace.some((step) => step.step === "intent_extraction"));

const missingAmount = await runIcebergAgent(
  {
    message: "nvda",
    defaults: {},
    portfolio: demoPortfolio,
  },
  {
    async fetchImpl() {
      throw new Error("market offline");
    },
  },
);

assert.equal(missingAmount.type, "question");
assert.equal(missingAmount.trade.symbol, "NVDA");
assert.equal(missingAmount.trade.currentPrice, "120");
assert.match(missingAmount.message, /how much you plan to buy/);
assert.ok(missingAmount.trace.some((step) => step.step === "portfolio_context" && step.applied.includes("currentShares")));
assert.ok(missingAmount.trace.some((step) => step.step === "market_resolver" && step.source === "portfolio_saved_price"));

const plan = await runIcebergAgent(
  {
    message: "I want to buy NVDA with $1000. Current price is $120.",
    portfolio: demoPortfolio,
  },
  {
    async fetchImpl() {
      throw new Error("no network needed");
    },
  },
);

assert.equal(plan.type, "plan");
assert.equal(plan.report.trade.symbol, "NVDA");
assert.equal(plan.report.trade.currentShares, 10);
assert.ok(plan.report.sizing.suggestedShares > 0);
assert.ok(plan.aiBrief);
assert.ok(plan.trace.some((step) => step.step === "pre_trade_risk_check"));
assert.ok(plan.trace.some((step) => step.step === "behavioral_friction"));
assert.ok(plan.trace.some((step) => step.step === "trade_protection_strategy"));
assert.ok(plan.trace.some((step) => step.step === "ai_risk_brief"));

process.env.GEMINI_API_KEY = "test-key";
const extractionCalls = [];
const geminiIdentity = await runIcebergAgent(
  {
    message: "hi who are you",
    portfolio: demoPortfolio,
  },
  {
    async fetchImpl(url, options) {
      extractionCalls.push({ url, options });
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
                    intent: "identity",
                    reply: "I am Iceberg, your pre-trade risk layer.",
                    fields: {},
                  }),
                },
              ],
            },
          ],
        };
        },
      };
    },
  },
);

assert.equal(geminiIdentity.trace[0].source, "gemini");
assert.equal(geminiIdentity.message, "I am Iceberg, your pre-trade risk layer.");
const extractionBody = JSON.parse(extractionCalls[0].options.body);
assert.equal(extractionCalls[0].url, "https://generativelanguage.googleapis.com/v1beta/interactions");
assert.equal(extractionBody.model, "gemini-3.6-flash");
assert.match(extractionBody.input, /Return JSON only/);

if (oldGeminiKey) process.env.GEMINI_API_KEY = oldGeminiKey;
else delete process.env.GEMINI_API_KEY;
if (oldOpenAiKey) process.env.OPENAI_API_KEY = oldOpenAiKey;
else delete process.env.OPENAI_API_KEY;
if (oldProvider) process.env.AI_PROVIDER = oldProvider;
else delete process.env.AI_PROVIDER;

console.log("iceberg-agent tests passed");
