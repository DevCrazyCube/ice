import { jwtVerify, type JWTPayload } from "jose";
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

/**
 * Symmetric key for verifying API-issued session JWTs.
 * Created lazily on first use — null if SESSION_SECRET is not configured.
 */
const sessionKey = config.sessionSecret
  ? new TextEncoder().encode(config.sessionSecret)
  : null;

/**
 * Parse a cookie value from the raw Cookie header.
 * Returns undefined if the cookie is not present.
 */
function parseCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  const match = header.split(";").find((c) => c.trimStart().startsWith(`${name}=`));
  if (!match) return undefined;
  return match.split("=").slice(1).join("=").trim();
}

/**
 * Express middleware: validate the session JWT and attach orgId, userId, roles.
 *
 * Token sources (checked in order):
 *   1. "ice-session" HttpOnly cookie (browser sessions)
 *   2. "Authorization: Bearer <token>" header (API-to-API)
 *
 * The JWT is signed by this API using HS256 with SESSION_SECRET.
 * It contains: sub (user DB id), org (organisation_id), roles (string[]).
 *
 * Returns 503 if SESSION_SECRET is not configured.
 * Returns 401 if the token is missing or invalid.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!sessionKey) {
    res.status(503).json({ error: { code: "AUTH_NOT_CONFIGURED" } });
    return;
  }

  // Try cookie first, then Bearer header
  const token =
    parseCookie(req, "ice-session") ??
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : undefined);

  if (!token) {
    res.status(401).json({ error: { code: "UNAUTHORIZED" } });
    return;
  }

  try {
    const { payload } = await jwtVerify(token, sessionKey, {
      issuer: "ice-api",
      audience: "ice-api",
    });

    const orgId = payload.org as string | undefined;
    const userId = payload.sub;
    const roles = payload.roles as string[] | undefined;

    if (!orgId || !userId) {
      res.status(401).json({ error: { code: "INVALID_TOKEN" } });
      return;
    }

    req.orgId = orgId;
    req.userId = userId;
    req.roles = roles ?? [];
    next();
  } catch (err) {
    logger.warn({ err }, "Session JWT verification failed");
    res.status(401).json({ error: { code: "INVALID_TOKEN" } });
  }
}

/**
 * Express middleware factory: require that the authenticated user holds
 * at least one of the specified roles.
 *
 * Must be applied AFTER requireAuth (req.roles must be populated).
 * platform_admin always passes regardless of the allowed list.
 *
 * Returns 403 FORBIDDEN if the user lacks all listed roles.
 */
export function requireRole(
  ...allowed: string[]
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const hasRole = req.roles.some(
      (r) => allowed.includes(r) || r === "platform_admin"
    );
    if (!hasRole) {
      res.status(403).json({ error: { code: "FORBIDDEN" } });
      return;
    }
    next();
  };
}
