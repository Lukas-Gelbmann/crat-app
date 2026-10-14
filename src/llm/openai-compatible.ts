import { z } from "zod";
import { LlmError, type GenerateRequest, type LlmClient } from "./client";

type Options = {
  baseUrl: string;
  model: string;
  // Bearer token, e.g. for OpenRouter. Ollama and LM Studio need none.
  apiKey?: string;
  fetch?: typeof fetch;
};

const responseSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string().nullable() }) }))
    .min(1),
});

// Chat Completions API as served by Ollama, LM Studio, OpenRouter and others,
// using JSON-schema structured output.
export function createOpenAiCompatibleClient(options: Options): LlmClient {
  const fetchFn = options.fetch ?? fetch;
  const url = `${options.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  return {
    async generate<T>(request: GenerateRequest<T>): Promise<T> {
      const schema = z.toJSONSchema(request.schema);
      delete schema.$schema;
      let response: Response;
      try {
        response = await fetchFn(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(options.apiKey
              ? { Authorization: `Bearer ${options.apiKey}` }
              : {}),
          },
          body: JSON.stringify({
            model: options.model,
            temperature: 0.2,
            messages: [
              { role: "system", content: request.system },
              { role: "user", content: request.prompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: { name: request.name, strict: true, schema },
            },
          }),
        });
      } catch (error) {
        throw new LlmError("request_failed", `LLM request to ${url} failed`, {
          cause: error,
        });
      }

      if (!response.ok) {
        const body = (await response.text()).slice(0, 300);
        throw new LlmError(
          "request_failed",
          `LLM request failed with HTTP ${response.status}: ${body}`,
        );
      }

      const parsedResponse = responseSchema.safeParse(await response.json());
      const content = parsedResponse.success
        ? parsedResponse.data.choices[0].message.content
        : null;
      if (!content) {
        throw new LlmError("invalid_output", "LLM response has no content");
      }
      return parseOutput(content, request.schema);
    },
  };
}

function parseOutput<T>(content: string, schema: z.ZodType<T>): T {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch (error) {
    throw new LlmError("invalid_output", "LLM output is not valid JSON", {
      cause: error,
    });
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    throw new LlmError(
      "invalid_output",
      `LLM output does not match the schema: ${result.error.message}`,
    );
  }
  return result.data;
}
