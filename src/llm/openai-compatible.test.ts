import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { LlmError } from "./client";
import { createOpenAiCompatibleClient } from "./openai-compatible";

const schema = z.object({ decision: z.enum(["yes", "no"]) });
const request = { name: "check", system: "sys", prompt: "hi", schema };

function respond(body: unknown, status = 200) {
  return vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  );
}

function completion(content: string | null) {
  return { choices: [{ message: { content } }] };
}

async function expectLlmError(promise: Promise<unknown>, code: LlmError["code"]) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(LlmError);
  expect((error as LlmError).code).toBe(code);
}

describe("OpenAI-compatible client", () => {
  it("sends a structured-output chat request and parses the result", async () => {
    const fetch = respond(completion('{"decision":"yes"}'));
    const client = createOpenAiCompatibleClient({
      baseUrl: "http://localhost:11434/v1/",
      model: "llama3.1:8b",
      fetch,
    });

    await expect(client.generate(request)).resolves.toEqual({ decision: "yes" });

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("http://localhost:11434/v1/chat/completions");
    expect(init?.headers).not.toHaveProperty("Authorization");
    const body = JSON.parse(init?.body as string);
    expect(body).toMatchObject({
      model: "llama3.1:8b",
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "hi" },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "check",
          strict: true,
          schema: {
            type: "object",
            properties: { decision: { type: "string", enum: ["yes", "no"] } },
            required: ["decision"],
            additionalProperties: false,
          },
        },
      },
    });
    expect(body.response_format.json_schema.schema).not.toHaveProperty("$schema");
  });

  it("sends the API key as bearer token (e.g. OpenRouter)", async () => {
    const fetch = respond(completion('{"decision":"no"}'));
    const client = createOpenAiCompatibleClient({
      baseUrl: "https://openrouter.ai/api/v1",
      model: "some/model",
      apiKey: "sk-or-key",
      fetch,
    });
    await client.generate(request);
    expect(fetch.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer sk-or-key",
    });
  });

  it("rejects output that is not JSON or does not match the schema", async () => {
    const base = { baseUrl: "http://x/v1", model: "m" };
    await expectLlmError(
      createOpenAiCompatibleClient({ ...base, fetch: respond(completion("Sure! yes")) })
        .generate(request),
      "invalid_output",
    );
    await expectLlmError(
      createOpenAiCompatibleClient({ ...base, fetch: respond(completion('{"decision":"maybe"}')) })
        .generate(request),
      "invalid_output",
    );
    await expectLlmError(
      createOpenAiCompatibleClient({ ...base, fetch: respond(completion(null)) })
        .generate(request),
      "invalid_output",
    );
    await expectLlmError(
      createOpenAiCompatibleClient({ ...base, fetch: respond({ unexpected: true }) })
        .generate(request),
      "invalid_output",
    );
  });

  it("reports HTTP and network errors as failed requests", async () => {
    const base = { baseUrl: "http://x/v1", model: "m" };
    await expectLlmError(
      createOpenAiCompatibleClient({ ...base, fetch: respond({ error: "model not found" }, 404) })
        .generate(request),
      "request_failed",
    );
    const offline = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    await expectLlmError(
      createOpenAiCompatibleClient({ ...base, fetch: offline }).generate(request),
      "request_failed",
    );
  });
});
