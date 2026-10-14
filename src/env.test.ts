import { describe, it, expect } from "vitest";
import { parseServerEnv } from "./env";

describe("parseServerEnv", () => {
  it("applies local Ollama defaults when nothing is set", () => {
    expect(parseServerEnv({})).toEqual({
      LLM_PROVIDER: "openai-compatible",
      LLM_BASE_URL: "http://localhost:11434/v1",
      LLM_MODEL: "llama3.1:8b",
    });
  });

  it("treats empty strings as unset", () => {
    expect(parseServerEnv({ LLM_MODEL: "" }).LLM_MODEL).toBe("llama3.1:8b");
  });

  it("accepts a custom OpenAI-compatible endpoint", () => {
    const env = parseServerEnv({
      LLM_BASE_URL: "http://localhost:1234/v1",
      LLM_MODEL: "qwen/qwen3-4b-2507",
    });
    expect(env.LLM_BASE_URL).toBe("http://localhost:1234/v1");
    expect(env.LLM_MODEL).toBe("qwen/qwen3-4b-2507");
  });

  it("rejects an invalid base URL", () => {
    expect(() => parseServerEnv({ LLM_BASE_URL: "not a url" })).toThrow(
      /LLM_BASE_URL/,
    );
  });

  it("rejects an unknown provider", () => {
    expect(() => parseServerEnv({ LLM_PROVIDER: "foo" })).toThrow(
      /LLM_PROVIDER/,
    );
  });

  it("requires an API key for the anthropic provider", () => {
    expect(() => parseServerEnv({ LLM_PROVIDER: "anthropic" })).toThrow(
      /ANTHROPIC_API_KEY/,
    );
    expect(
      parseServerEnv({ LLM_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "key" })
        .LLM_PROVIDER,
    ).toBe("anthropic");
  });
});
