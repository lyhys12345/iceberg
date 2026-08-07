export function runBehavioralFrictionSkill(trade, report) {
  const text = String(trade?.thesis || "").toLowerCase();
  const flagTitles = new Set((report?.flags || []).map((flag) => flag.title));
  const plannedExposure = Number(trade?.accountValue || 0) > 0 ? Number(trade.plannedBudget || 0) / Number(trade.accountValue) : 0;
  const impulseTerms = ["all in", "all-in", "fomo", "afraid to miss", "miss out", "moon", "revenge", "make back", "margin", "leverage"];
  const impulseLanguage = impulseTerms.some((term) => text.includes(term)) || flagTitles.has("Impulse language");
  const oversized = plannedExposure > 0.25 || flagTitles.has("Oversized request");

  let level = "normal";
  let instruction = "Proceed only if the written plan, stop, and size match the risk report.";

  if (report?.decision?.kind === "avoid" || (impulseLanguage && oversized)) {
    level = "hard_stop";
    instruction = "Do not place the full order now. Require a cooldown or rewrite the thesis before any trade.";
  } else if (report?.decision?.kind === "reduce" || impulseLanguage || oversized) {
    level = "slow";
    instruction = "Add friction: cap size, require the stop first, and avoid increasing the order during this session.";
  }

  return {
    level,
    impulseLanguage,
    oversized,
    instruction,
  };
}
