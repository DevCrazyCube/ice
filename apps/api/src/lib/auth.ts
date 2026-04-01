import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Request, Response, NextFunction } from "express";
import { config } from "./config.js";
import { logger } from "./logger.js";

// Augment Express Request with ICE identity fields
declare global {
  namespace Express {
    interface Request {
      orgId: string;
      userId: string;
      roles: string[];
    }
  }
}

// JWKS set is created once and cached — it handles JWKS rotation automatically
const jwks =
  config.oidcJwksUrl
    ? createRemoteJWKSet(new URL(config.oidcJwksUrl))
    : null;

/**
 * Express middleware: validate the Bearer JWT and attach orgId, userId, roles.
 *
 * Returns 503 if OIDC is not yet configured (dev without an identity provider).
 * Returns 401 if the token is missing or invalid.
 *
 * JWT payload must contain:
 *   sub   — user ID
 *   org   — organisation ID
 *   roles — string array
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!jwks) {
    // OIDC not configured — return 503, not 401, to distinguish from auth failure
    res.status(503).json({ error: { code: "AUTH_NOT_CONFIGURED" } });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: { code: "UNAUTHORIZED" } });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: config.oidcIssuer || undefined,
      audience: config.oidcAudience || undefined,
    });

    req.orgId = payload.org as string;
    req.userId = payload.sub!;
    req.roles = (payload.roles as string[]) ?? [];
    next();
  } catch (err) {
    logger.warn({ err }, "JWT verification failed");
    res.status(401).json({ error: { code: "INVALID_TOKEN" } });
  }
}
