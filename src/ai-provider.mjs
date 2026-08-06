import { createAiRiskBrief } from "./ai-risk-layer.mjs";
import { generateGeminiRiskBrief } from "./gemini-risk-agent.mjs";
import { generateOpenAiRiskBrief } from "./openai-risk-agent.mjs";

export async function generateAiRiskBrief(report, fetchImpl = fetch) {
  const provider = pickProvider();

  try {
    if (provider === "gemini") {
      return await generateGeminiRiskBrief(report, fetchImpl);
    }

    if (provider === "openai") {
      return await generateOpenAiRiskBrief(report, fetchImpl);
    }
  } catch {
    return { ...createAiRiskBrief(report), source: "local" };
  }

  return { ...createAiRiskBrief(report), source: "local" };
}

export function pickProvider(env = process.env) {
  const explicit = String(env.AI_PROVIDER || "").trim().toLowerCase();
  if (["gemini", "openai", "local"].includes(explicit)) return explicit;
  if (env.GEMINI_API_KEY) return "gemini";
  if (env.OPENAI_API_KEY) return "openai";
  return "local";
}
