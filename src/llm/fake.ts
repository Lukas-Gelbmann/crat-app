import { LlmError, type GenerateRequest, type LlmClient } from "./client";

type Reply = unknown | Error | ((request: GenerateRequest<unknown>) => unknown);

// Test double: returns scripted replies in order (an Error is thrown) and
// records every request. Replies are validated against the request schema like
// a real adapter would, so tests catch schema mismatches.
export function createFakeLlm(replies: Reply[]) {
  const requests: GenerateRequest<unknown>[] = [];
  const client: LlmClient = {
    async generate<T>(request: GenerateRequest<T>): Promise<T> {
      requests.push(request as GenerateRequest<unknown>);
      if (replies.length === 0) throw new Error("Fake LLM has no reply left");
      const next = replies.shift();
      const reply =
        typeof next === "function"
          ? next(request as GenerateRequest<unknown>)
          : next;
      if (reply instanceof Error) throw reply;
      const result = request.schema.safeParse(reply);
      if (!result.success) {
        throw new LlmError("invalid_output", result.error.message);
      }
      return result.data;
    },
  };
  return { client, requests };
}
