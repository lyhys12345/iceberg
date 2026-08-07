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

const timingRead = await runIcebergAgent(
  {
    message: "i want to buy NVDA, currently I have 10k free cash. is this a good time to buy?",
    portfolio: demoPortfolio,
  },
  {
    async fetchImpl() {
      throw new Error("market offline");
    },
  },
);

assert.equal(timingRead.type, "research");
assert.equal(timingRead.market.latestClose, 120);
assert.match(timingRead.message, /Timing bias/);
assert.match(timingRead.message, /planned buy amount/);
assert.doesNotMatch(timingRead.message, /I still need how much you plan to buy before/);
assert.equal(timingRead.workflow.marketResearch.symbol, "NVDA");
assert.ok(timingRead.trace.some((step) => step.step === "market_research"));
assert.ok(timingRead.trace.some((step) => step.step === "final_response" && step.type === "incomplete_trade"));

const quote = await runIcebergAgent(
  {
    message: "现在nvda股价多少钱",
    portfolio: demoPortfolio,
  },
  {
    async fetchImpl() {
      throw new Error("market offline");
    },
  },
);

assert.equal(quote.type, "quote");
assert.equal(quote.intent, "quote");
assert.equal(quote.market.latestClose, 120);
assert.match(quote.message, /NVDA latest available price is \$120/);
assert.doesNotMatch(quote.message, /how much you plan to buy before/);

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
assert.ok(plan.workflow.marketResearch);
assert.ok(plan.workflow.riskSizing);
assert.ok(plan.workflow.strategySelection);
assert.ok(plan.workflow.finalResponse);
assert.ok(Array.isArray(plan.workflow.steps));
assert.equal(plan.workflow.steps.map((step) => step.id).join(","), "intent_extraction,market_research,risk_sizing,strategy_selection,final_response");
assert.match(plan.message, /Short answer:/);
assert.match(plan.message, /Step 1 - Intent extraction:/);
assert.match(plan.message, /Step 2 - Market research:/);
assert.match(plan.message, /Step 3 - Risk sizing:/);
assert.match(plan.message, /Step 4 - Strategy selection:/);
assert.match(plan.message, /Step 5 - Final response:/);
assert.ok(plan.trace.some((step) => step.step === "risk_sizing"));
assert.ok(plan.trace.some((step) => step.step === "behavioral_friction"));
assert.ok(plan.trace.some((step) => step.step === "strategy_selection"));
assert.ok(plan.trace.some((step) => step.step === "ai_risk_brief"));
assert.ok(plan.trace.some((step) => step.step === "final_response"));
assert.ok(plan.strategySelection.orderTicket);

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
assert.equal(
  extractionCalls[0].url,
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
);
assert.match(extractionBody.contents[0].parts[0].text, /Return JSON only/);
assert.equal(extractionBody.generationConfig.responseMimeType, "application/json");

if (oldGeminiKey) process.env.GEMINI_API_KEY = oldGeminiKey;
else delete process.env.GEMINI_API_KEY;
if (oldOpenAiKey) process.env.OPENAI_API_KEY = oldOpenAiKey;
else delete process.env.OPENAI_API_KEY;
if (oldProvider) process.env.AI_PROVIDER = oldProvider;
else delete process.env.AI_PROVIDER;

console.log("iceberg-agent tests passed");
