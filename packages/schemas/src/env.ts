import { z } from "zod";

// Base env schema shared across apps.
// Each app extends this with its own required vars.
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;
