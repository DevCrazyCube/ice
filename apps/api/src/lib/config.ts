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

  // OIDC provider — required for login flow
  oidcIssuer: optional("OIDC_ISSUER", ""),
  oidcJwksUrl: optional("OIDC_JWKS_URL", ""),
  oidcAudience: optional("OIDC_AUDIENCE", "ice-api"),
  oidcClientId: optional("OIDC_CLIENT_ID", ""),
  oidcClientSecret: optional("OIDC_CLIENT_SECRET", ""),
  oidcRedirectUri: optional("OIDC_REDIRECT_URI", "http://localhost:3001/auth/callback"),
  oidcTokenUrl: optional("OIDC_TOKEN_URL", ""),
  oidcAuthorizationUrl: optional("OIDC_AUTHORIZATION_URL", ""),

  // Session — symmetric key for signing session JWTs (HS256, min 32 chars)
  sessionSecret: (() => {
    const val = process.env["SESSION_SECRET"] ?? "";
    if (val && val.length < 32) {
      throw new Error("SESSION_SECRET must be at least 32 characters");
    }
    return val;
  })(),

  // Twilio — required for webhook signature verification
  twilioAuthToken: optional("TWILIO_AUTH_TOKEN", ""),
  publicWebhookUrl: optional("PUBLIC_WEBHOOK_URL", ""),
} as const;
