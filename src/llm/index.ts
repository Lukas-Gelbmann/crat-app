import type { ServerEnv } from "@/env";
import { createAnthropicClient } from "./anthropic";
import type { LlmClient } from "./client";
import { createOpenAiCompatibleClient } from "./openai-compatible";

export function createLlmClient(env: ServerEnv): LlmClient {
  if (env.LLM_PROVIDER === "anthropic") {
    // ANTHROPIC_API_KEY is guaranteed by the env schema for this provider.
    return createAnthropicClient({
      apiKey: env.ANTHROPIC_API_KEY!,
      model: env.LLM_MODEL,
    });
  }
  return createOpenAiCompatibleClient({
    baseUrl: env.LLM_BASE_URL,
    model: env.LLM_MODEL,
    apiKey: env.LLM_API_KEY,
  });
}
