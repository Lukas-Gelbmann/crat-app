import { describe, it, expect, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createAnthropicClient } from "./anthropic";
import { LlmError } from "./client";

const schema = z.object({ decision: z.enum(["yes", "no"]) });
const request = { name: "check", system: "sys", prompt: "hi", schema };

function fakeClient(parse: ReturnType<typeof vi.fn>) {
  return { beta: { messages: { parse } } } as unknown as Anthropic;
}

async function expectLlmError(promise: Promise<unknown>, code: LlmError["code"]) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(LlmError);
  expect((error as LlmError).code).toBe(code);
}

describe("Anthropic client", () => {
  it("requests structured output with fallbacks and returns the parsed object", async () => {
    const parse = vi.fn().mockResolvedValue({
      stop_reason: "end_turn",
      parsed_output: { decision: "yes" },
    });
    const client = createAnthropicClient({
      apiKey: "key",
      model: "claude-opus-5-5",
      client: fakeClient(parse),
    });

    await expect(client.generate(request)).resolves.toEqual({ decision: "yes" });
    expect(parse.mock.calls[0][0]).toMatchObject({
      model: "claude-opus-5-5",
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(parse.mock.calls[0][0].output_config.format).toBeDefined();
  });

  it("reports refusals", async () => {
    const parse = vi.fn().mockResolvedValue({
      stop_reason: "refusal",
      stop_details: { type: "refusal", category: "cyber" },
      parsed_output: null,
    });
    const client = createAnthropicClient({ apiKey: "k", model: "m", client: fakeClient(parse) });
    await expectLlmError(client.generate(request), "refused");
  });

  it("reports missing structured output", async () => {
    const parse = vi.fn().mockResolvedValue({ stop_reason: "max_tokens", parsed_output: null });
    const client = createAnthropicClient({ apiKey: "k", model: "m", client: fakeClient(parse) });
    await expectLlmError(client.generate(request), "invalid_output");
  });

  it("maps API errors to failed requests", async () => {
    const parse = vi
      .fn()
      .mockRejectedValue(new Anthropic.APIError(500, undefined, "server error", undefined));
    const client = createAnthropicClient({ apiKey: "k", model: "m", client: fakeClient(parse) });
    await expectLlmError(client.generate(request), "request_failed");
  });
});
