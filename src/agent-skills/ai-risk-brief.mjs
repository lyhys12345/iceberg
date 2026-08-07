import { generateAiRiskBrief } from "../ai-provider.mjs";

export async function runAiRiskBriefSkill(report, fetchImpl = fetch) {
  return generateAiRiskBrief(report, fetchImpl);
}
