import type { z } from "zod";

export type GenerateRequest<T> = {
  // Short identifier for the output schema, e.g. "completeness_check".
  name: string;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
};

// Provider-neutral interface: one prompt in, one schema-validated object out.
export interface LlmClient {
  generate<T>(request: GenerateRequest<T>): Promise<T>;
}

export class LlmError extends Error {
  constructor(
    readonly code: "request_failed" | "invalid_output" | "refused",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "LlmError";
  }
}

// Retries failed requests and invalid outputs; refusals are final.
export async function withRetries<T>(
  fn: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!(error instanceof LlmError) || error.code === "refused") throw error;
      lastError = error;
    }
  }
  throw lastError;
}
