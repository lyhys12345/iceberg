export function runTradeProtectionStrategySkill(report) {
  const strategy = report?.strategy || null;
  return {
    strategyName: strategy?.primaryName || "Review strategy",
    strategyId: strategy?.primaryId || "review",
    protectionRules: report?.protection || [],
    entryPlan: report?.entries || [],
    strategySteps: strategy?.executionRules || [],
  };
}
