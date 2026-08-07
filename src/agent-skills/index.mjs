export { runAiRiskBriefSkill } from "./ai-risk-brief.mjs";
export { runBehavioralFrictionSkill } from "./behavioral-friction.mjs";
export { runIntentExtractionSkill } from "./intent-extraction.mjs";
export { finalMarketSnapshotSkill, runMarketResolverSkill } from "./market-resolver.mjs";
export { portfolioPriceForSymbol, runPortfolioContextSkill } from "./portfolio-context.mjs";
export { runPreTradeRiskCheckSkill } from "./pre-trade-risk-check.mjs";
export { runTradeProtectionStrategySkill } from "./trade-protection-strategy.mjs";

export const icebergAgentSkillCatalog = [
  {
    id: "intent_extraction",
    purpose: "Classify user intent and extract explicitly supplied trade fields from natural language.",
  },
  {
    id: "portfolio_context",
    purpose: "Apply saved portfolio facts such as account value, cash, and current shares when the user did not override them.",
  },
  {
    id: "market_resolver",
    purpose: "Resolve current market data, falling back to portfolio saved prices when live providers fail.",
  },
  {
    id: "pre_trade_risk_check",
    purpose: "Run deterministic sizing, Kelly, downside, exposure, and decision logic.",
  },
  {
    id: "behavioral_friction",
    purpose: "Detect FOMO, oversized requests, and emotional language that should slow or stop trading.",
  },
  {
    id: "trade_protection_strategy",
    purpose: "Convert the risk report into entry, stop, target, and strategy guidance.",
  },
  {
    id: "ai_risk_brief",
    purpose: "Use Gemini/OpenAI/local fallback to explain the risk report in beginner-friendly language.",
  },
];
