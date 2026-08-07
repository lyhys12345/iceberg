export { runAiRiskBriefSkill } from "./ai-risk-brief.mjs";
export { runBehavioralFrictionSkill } from "./behavioral-friction.mjs";
export { runFinalResponseSkill, runIncompleteTradeResponseSkill } from "./final-response.mjs";
export { runIntentExtractionSkill } from "./intent-extraction.mjs";
export { runMarketResearchSkill } from "./market-research.mjs";
export { finalMarketSnapshotSkill, runMarketResolverSkill } from "./market-resolver.mjs";
export { portfolioPriceForSymbol, runPortfolioContextSkill } from "./portfolio-context.mjs";
export { runPreTradeRiskCheckSkill } from "./pre-trade-risk-check.mjs";
export { runRiskSizingSkill } from "./risk-sizing.mjs";
export { runStrategySelectionSkill } from "./strategy-selection.mjs";
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
    id: "market_research",
    purpose: "Convert market data into timing bias, volatility, drawdown, and chase-risk signals.",
  },
  {
    id: "pre_trade_risk_check",
    purpose: "Run deterministic sizing, Kelly, downside, exposure, and decision logic.",
  },
  {
    id: "risk_sizing",
    purpose: "Summarize position size, stop risk, Kelly, exposure, and hard sizing caps.",
  },
  {
    id: "behavioral_friction",
    purpose: "Detect FOMO, oversized requests, and emotional language that should slow or stop trading.",
  },
  {
    id: "strategy_selection",
    purpose: "Choose the right beginner-safe trade strategy from intent, market read, sizing, portfolio concentration, and behavioral friction.",
  },
  {
    id: "ai_risk_brief",
    purpose: "Use Gemini/OpenAI/local fallback to explain the risk report in beginner-friendly language.",
  },
  {
    id: "final_response",
    purpose: "Compose the final pre-trade risk memo from structured market, sizing, strategy, friction, and AI brief outputs.",
  },
];
