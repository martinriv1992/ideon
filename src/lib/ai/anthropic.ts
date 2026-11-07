import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { TASK_EFFORT, type AIProvider, type CompletionRequest, type CompletionResult } from "./provider";

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export const anthropicProvider: AIProvider = {
  name: "anthropic",
  async complete(req: CompletionRequest): Promise<CompletionResult> {
    // En streaming: las salidas largas (HTML completo) no chocan con los timeouts HTTP.
    const res = await getClient().messages.stream({
      model: req.model,
      max_tokens: req.maxOutputTokens,
      output_config: { effort: TASK_EFFORT[req.task] },
      system: req.system,
      messages: [{ role: "user", content: req.user }],
    }).finalMessage();
    if (res.stop_reason === "refusal") throw Object.assign(new Error("El modelo rechazó la petición."), { code: "ai_refusal" });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return {
      text,
      model: res.model,
      // Los tokens de razonamiento se facturan como salida y ya están en output_tokens.
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      truncated: res.stop_reason === "max_tokens",
    };
  },
};
