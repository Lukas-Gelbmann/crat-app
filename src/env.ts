import { z } from "zod";

const serverEnvSchema = z
  .object({
    LLM_PROVIDER: z
      .enum(["openai-compatible", "anthropic"])
      .default("openai-compatible"),
    LLM_BASE_URL: z.url().default("http://localhost:11434/v1"),
    LLM_MODEL: z.string().min(1).default("llama3.1:8b"),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
  })
  .refine(
    (env) => env.LLM_PROVIDER !== "anthropic" || env.ANTHROPIC_API_KEY,
    {
      message: "ANTHROPIC_API_KEY is required when LLM_PROVIDER is anthropic",
      path: ["ANTHROPIC_API_KEY"],
    },
  );

export type ServerEnv = z.infer<typeof serverEnvSchema>;

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
