import { randomBytes, createHash } from "node:crypto";
import express, { type Router } from "express";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { getDb, recordAuditEvent } from "@ice/core";
import { config } from "../../lib/config.js";
import { logger } from "../../lib/logger.js";
import { requireAuth } from "../../lib/auth.js";

export const authRouter: Router = express.Router();

// Remote JWKS for validating OIDC provider ID tokens (used only in callback)
const oidcJwks = config.oidcJwksUrl
  ? createRemoteJWKSet(new URL(config.oidcJwksUrl))
  : null;

const sessionKey = config.sessionSecret
  ? new TextEncoder().encode(config.sessionSecret)
  : null;

const SESSION_MAX_AGE_S = 28_800; // 8 hours
const AUTH_STATE_MAX_AGE_S = 600; // 10 minutes

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

/**
 * Sign a temporary cookie value with SESSION_SECRET using HMAC-SHA256.
 * Format: payload.signature — prevents tampering of the auth state cookie.
 */
function signCookieValue(value: string): string {
  if (!sessionKey) throw new Error("SESSION_SECRET not configured");
  const sig = createHash("sha256")
    .update(value + config.sessionSecret)
    .digest("base64url");
  return `${value}.${sig}`;
}

function verifyCookieValue(signed: string): string | null {
  const lastDot = signed.lastIndexOf(".");
  if (lastDot === -1) return null;
  const value = signed.slice(0, lastDot);
  const expected = signCookieValue(value);
  if (expected !== signed) return null;
  return value;
}

function parseCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.split(";").find((c) => c.trimStart().startsWith(`${name}=`));
  if (!match) return undefined;
  return match.split("=").slice(1).join("=").trim();
}

const isProduction = config.env === "production";

// ---------------------------------------------------------------------------
// GET /auth/login — redirect to OIDC authorization endpoint
// ---------------------------------------------------------------------------
authRouter.get("/auth/login", (_req, res) => {
  if (
    !config.oidcAuthorizationUrl ||
    !config.oidcClientId ||
    !sessionKey
  ) {
    res.status(503).json({ error: { code: "AUTH_NOT_CONFIGURED" } });
    return;
  }

  // CSRF state
  const state = randomBytes(32).toString("hex");

  // PKCE (RFC 7636) — required by RFC 9700 for all clients
  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(
    createHash("sha256").update(codeVerifier).digest()
  );

  // Store state + code_verifier in a signed, short-lived cookie
  const statePayload = JSON.stringify({ state, codeVerifier });
  const signedState = signCookieValue(
    Buffer.from(statePayload).toString("base64url")
  );

  res.cookie("ice-auth-state", signedState, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/auth/callback",
    maxAge: AUTH_STATE_MAX_AGE_S * 1000,
  });

  const authUrl = new URL(config.oidcAuthorizationUrl);
  authUrl.searchParams.set("client_id", config.oidcClientId);
  authUrl.searchParams.set("redirect_uri", config.oidcRedirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  res.redirect(302, authUrl.toString());
});

// ---------------------------------------------------------------------------
// GET /auth/callback — exchange code for tokens, issue session cookie
// ---------------------------------------------------------------------------
authRouter.get("/auth/callback", async (req, res) => {
  if (!oidcJwks || !sessionKey || !config.oidcTokenUrl) {
    res.status(503).json({ error: { code: "AUTH_NOT_CONFIGURED" } });
    return;
  }

  const code = req.query["code"] as string | undefined;
  const stateParam = req.query["state"] as string | undefined;
  const errorParam = req.query["error"] as string | undefined;

  if (errorParam) {
    logger.warn({ error: errorParam, description: req.query["error_description"] }, "OIDC provider returned error");
    res.status(400).json({ error: { code: "OIDC_ERROR", message: errorParam } });
    return;
  }

  if (!code || !stateParam) {
    res.status(400).json({ error: { code: "MISSING_PARAMS" } });
    return;
  }

  // Validate state (CSRF)
  const stateCookie = parseCookie(req.headers.cookie, "ice-auth-state");
  if (!stateCookie) {
    res.status(400).json({ error: { code: "MISSING_STATE_COOKIE" } });
    return;
  }

  const rawPayload = verifyCookieValue(stateCookie);
  if (!rawPayload) {
    res.status(400).json({ error: { code: "INVALID_STATE_COOKIE" } });
    return;
  }

  let storedState: { state: string; codeVerifier: string };
  try {
    storedState = JSON.parse(
      Buffer.from(rawPayload, "base64url").toString("utf-8")
    );
  } catch {
    res.status(400).json({ error: { code: "INVALID_STATE_COOKIE" } });
    return;
  }

  if (stateParam !== storedState.state) {
    res.status(400).json({ error: { code: "STATE_MISMATCH" } });
    return;
  }

  // Clear the auth-state cookie
  res.clearCookie("ice-auth-state", { path: "/auth/callback" });

  // Exchange code for tokens at OIDC provider
  let tokenData: { id_token?: string; access_token?: string };
  try {
    const tokenRes = await fetch(config.oidcTokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: config.oidcRedirectUri,
        client_id: config.oidcClientId,
        client_secret: config.oidcClientSecret,
        code_verifier: storedState.codeVerifier,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      logger.error({ status: tokenRes.status, body }, "OIDC token exchange failed");
      res.status(502).json({ error: { code: "TOKEN_EXCHANGE_FAILED" } });
      return;
    }

    tokenData = (await tokenRes.json()) as { id_token?: string; access_token?: string };
  } catch (err) {
    logger.error({ err }, "OIDC token exchange network error");
    res.status(502).json({ error: { code: "TOKEN_EXCHANGE_FAILED" } });
    return;
  }

  if (!tokenData.id_token) {
    res.status(502).json({ error: { code: "NO_ID_TOKEN" } });
    return;
  }

  // Validate ID token against OIDC JWKS
  let idPayload: { sub?: string; email?: string };
  try {
    const { payload } = await jwtVerify(tokenData.id_token, oidcJwks, {
      issuer: config.oidcIssuer || undefined,
      audience: config.oidcClientId || undefined,
    });
    idPayload = payload as { sub?: string; email?: string };
  } catch (err) {
    logger.warn({ err }, "OIDC ID token verification failed");
    res.status(401).json({ error: { code: "INVALID_ID_TOKEN" } });
    return;
  }

  const externalId = idPayload.sub;
  if (!externalId) {
    res.status(401).json({ error: { code: "MISSING_SUB_CLAIM" } });
    return;
  }

  // Look up user by external_id (OIDC sub claim)
  const db = getDb();
  const { rows: userRows } = await db.query<{
    id: string;
    organisation_id: string;
    email: string;
  }>(
    `SELECT id, organisation_id, email FROM users WHERE external_id = $1`,
    [externalId]
  );

  if (userRows.length === 0) {
    // Phase 1: no self-service signup — user must be pre-provisioned
    logger.warn({ externalId }, "Login attempt for unprovisioned user");
    res.status(403).json({ error: { code: "USER_NOT_PROVISIONED" } });
    return;
  }

  const user = userRows[0]!;

  // Look up roles
  const { rows: roleRows } = await db.query<{ name: string }>(
    `SELECT r.name FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND ur.organisation_id = $2`,
    [user.id, user.organisation_id]
  );

  const roles = roleRows.map((r) => r.name);

  // Issue session JWT (HS256, 8h expiry)
  const sessionJwt = await new SignJWT({
    org: user.organisation_id,
    roles,
    email: user.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_S}s`)
    .sign(sessionKey);

  res.cookie("ice-session", sessionJwt, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S * 1000,
  });

  // Audit
  recordAuditEvent({
    organisationId: user.organisation_id,
    actorId: user.id,
    action: "user.login",
    metadata: { email: user.email },
    ipAddress: req.ip ?? null,
  }).catch((err) => logger.error({ err }, "Failed to record user.login audit event"));

  logger.info({ userId: user.id, organisationId: user.organisation_id }, "User logged in");

  res.redirect(302, "/dashboard");
});

// ---------------------------------------------------------------------------
// POST /auth/logout — clear session cookie
// ---------------------------------------------------------------------------
authRouter.post("/auth/logout", requireAuth, async (req, res) => {
  recordAuditEvent({
    organisationId: req.orgId,
    actorId: req.userId,
    action: "user.logout",
    ipAddress: req.ip ?? null,
  }).catch((err) => logger.error({ err }, "Failed to record user.logout audit event"));

  res.clearCookie("ice-session", { path: "/" });
  res.status(200).json({ success: true });
});
