import { z } from "zod";

const defaultModels = {
  "openai-compatible": "llama3.1:8b",
  anthropic: "claude-opus-5-5",
} as const;

const serverEnvSchema = z
  .object({
    LLM_PROVIDER: z
      .enum(["openai-compatible", "anthropic"])
      .default("openai-compatible"),
    // OpenAI-compatible endpoint: Ollama, LM Studio, OpenRouter, ...
    LLM_BASE_URL: z.url().default("http://localhost:11434/v1"),
    // Defaults depend on the provider, see defaultModels.
    LLM_MODEL: z.string().min(1).optional(),
    // Bearer token for OpenAI-compatible endpoints that need one (e.g. OpenRouter).
    LLM_API_KEY: z.string().min(1).optional(),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
  })
  .refine(
    (env) => env.LLM_PROVIDER !== "anthropic" || env.ANTHROPIC_API_KEY,
    {
      message: "ANTHROPIC_API_KEY is required when LLM_PROVIDER is anthropic",
      path: ["ANTHROPIC_API_KEY"],
    },
  )
  .transform((env) => ({
    ...env,
    LLM_MODEL: env.LLM_MODEL ?? defaultModels[env.LLM_PROVIDER],
  }));

export type ServerEnv = z.output<typeof serverEnvSchema>;

export function parseServerEnv(
  source: Record<string, string | undefined>,
): ServerEnv {
  // Treat empty strings from .env files as unset so defaults apply.
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== ""),
  );
  const result = serverEnvSchema.safeParse(cleaned);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

// Server-only: none of these variables are exposed to the browser.
export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
