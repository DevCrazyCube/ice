const required = (key: string): string => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
};

const optional = (key: string, fallback: string): string =>
  process.env[key] ?? fallback;

export const config = {
  env: optional("NODE_ENV", "development"),
  port: parseInt(optional("PORT", "3001"), 10),
  logLevel: optional("LOG_LEVEL", "info"),
  // These will be required once the services are wired
  // databaseUrl: required("DATABASE_URL"),
  // redisUrl: required("REDIS_URL"),
} as const;
