import { config } from "../config.js";

type RewriteInput = {
  content: string;
  fieldType: "summary" | "bullet";
  role?: string;
  evidence?: string[];
};

export async function rewriteWithDeepSeek(input: RewriteInput) {
  if (!config.deepseek.apiKey) return null;

  const response = await fetch(`${config.deepseek.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.deepseek.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.deepseek.model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are Resumora's truth-preserving resume editor. Improve clarity, specificity, and recruiter readability. Never invent employers, tools, skills, metrics, qualifications, or outcomes. Return strict JSON with keys suggestion, rationale, unsupportedClaims. Keep the suggestion concise and natural.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: `Rewrite this resume ${input.fieldType}`,
            role: input.role,
            original: input.content,
            verifiedEvidence: input.evidence ?? [],
          }),
        },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`DeepSeek request failed (${response.status}): ${details.slice(0, 240)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: Record<string, number>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek returned an empty response");
  return { ...JSON.parse(content), model: config.deepseek.model, usage: payload.usage };
}
