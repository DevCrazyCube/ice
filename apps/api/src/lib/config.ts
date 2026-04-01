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

  // Database — required when DB is initialised
  databaseUrl: optional("DATABASE_URL", ""),

  // OIDC — required for auth middleware
  oidcIssuer: optional("OIDC_ISSUER", ""),
  oidcJwksUrl: optional("OIDC_JWKS_URL", ""),
  oidcAudience: optional("OIDC_AUDIENCE", "ice-api"),

  // Twilio — required for webhook signature verification
  twilioAuthToken: optional("TWILIO_AUTH_TOKEN", ""),
  publicWebhookUrl: optional("PUBLIC_WEBHOOK_URL", ""),
} as const;
