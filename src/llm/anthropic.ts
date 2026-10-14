import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { LlmError, type GenerateRequest, type LlmClient } from "./client";

type Options = {
  apiKey: string;
  model: string;
  // Injected in tests.
  client?: Anthropic;
};

// Claude via the official SDK with structured output. The SDK itself retries
// rate limits and server errors.
export function createAnthropicClient(options: Options): LlmClient {
  const client = options.client ?? new Anthropic({ apiKey: options.apiKey });

  return {
    async generate<T>(request: GenerateRequest<T>): Promise<T> {
      let response;
      try {
        response = await client.beta.messages.parse({
          model: options.model,
          max_tokens: 16000,
          // On a policy decline, let the API retry on its default fallback model.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: {
            effort: "medium",
            format: betaZodOutputFormat(request.schema),
          },
          system: request.system,
          messages: [{ role: "user", content: request.prompt }],
        });
      } catch (error) {
        if (error instanceof Anthropic.APIError) {
          throw new LlmError(
            "request_failed",
            `Anthropic request failed: ${error.message}`,
            { cause: error },
          );
        }
        throw new LlmError("invalid_output", "Could not parse Claude output", {
          cause: error,
        });
      }

      if (response.stop_reason === "refusal") {
        throw new LlmError(
          "refused",
          `Claude declined the request (${response.stop_details?.category ?? "no category"})`,
        );
      }
      if (response.parsed_output == null) {
        throw new LlmError(
          "invalid_output",
          `Claude returned no structured output (stop reason: ${response.stop_reason})`,
        );
      }
      return response.parsed_output;
    },
  };
}
