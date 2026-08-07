export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

export class GeminiRequestError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "GeminiRequestError";
    this.status = details.status || 0;
    this.reason = details.reason || "";
    this.detail = details.detail || "";
  }
}

export async function callGeminiGenerateContent(
  { prompt, apiKey = process.env.GEMINI_API_KEY, model = geminiModel(), generationConfig = {} },
  fetchImpl = fetch,
) {
  if (!apiKey) throw new GeminiRequestError("Gemini API key is missing.", { reason: "missing_api_key" });

  const response = await fetchImpl(geminiGenerateContentUrl(model), {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: String(prompt || "") }],
        },
      ],
      generationConfig,
    }),
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    const reason = detail?.error?.status || "request_failed";
    const message = detail?.error?.message || `Gemini request failed with ${response.status}.`;
    throw new GeminiRequestError(message, {
      status: response.status,
      reason,
      detail: detail?.error || detail,
    });
  }

  return response.json();
}

export function geminiModel(env = process.env) {
  return env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
}

export function geminiGenerateContentUrl(model = DEFAULT_GEMINI_MODEL) {
  const normalized = String(model || DEFAULT_GEMINI_MODEL).replace(/^models\//, "");
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalized)}:generateContent`;
}

export function readGeminiText(data) {
  const text =
    data.output_text ||
    data.output?.text ||
    data.steps
      ?.flatMap((step) => step.content || [])
      ?.map((content) => content.text)
      ?.filter(Boolean)
      ?.join("") ||
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      ?.filter(Boolean)
      ?.join("");

  if (!text) throw new Error("Gemini response did not include text.");
  return text;
}

export function parseJsonFromText(text) {
  const trimmed = String(text || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start < 0 || end < start) {
    throw new Error("Gemini response did not include JSON.");
  }

  return JSON.parse(candidate.slice(start, end + 1));
}

export function explainGeminiNetworkError(error) {
  const message = String(error?.message || error || "");
  if (/fetch failed|unable to connect|network|tcp|dns|getaddrinfo|econn/i.test(message)) {
    return {
      reason: "network_error",
      message:
        "Iceberg could not reach generativelanguage.googleapis.com over HTTPS. Check VPN/proxy/firewall/DNS, then retry.",
      detail: message,
    };
  }

  return {
    reason: error?.reason || "request_failed",
    message: message || "Gemini request failed.",
    detail: error?.detail || "",
  };
}
