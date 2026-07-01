import "server-only"
import { isDbConfigured } from "@/lib/db"
import { findActiveKeyByRaw, isRateLimited, touchKeyUsage, type ApiKeyRow } from "@/lib/api/keys"

/**
 * Public API auth + CORS layer.
 *
 * Every partner request carries `Authorization: Bearer bh_live_…`. We resolve
 * the key, enforce its origin allowlist (when set) and per-minute rate limit,
 * then log usage. Secret keys never enter here — this is purely the platform's
 * credential, distinct from any end-user Stellar key.
 */

export function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  }
}

export function jsonResponse(data: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  })
}

export function errorResponse(status: number, code: string, message: string, origin: string | null): Response {
  return jsonResponse({ error: { code, message } }, status, origin)
}

/** Handles a CORS preflight request. */
export function preflightResponse(origin: string | null): Response {
  return new Response(null, { status: 204, headers: corsHeaders(origin) })
}

type AuthOk = { ok: true; key: ApiKeyRow; origin: string | null }
type AuthErr = { ok: false; response: Response }

function originAllowed(key: ApiKeyRow, origin: string | null): boolean {
  // Empty allowlist = key works from any origin (e.g. server-to-server).
  if (!key.allowed_origins || key.allowed_origins.length === 0) return true
  if (!origin) return true // non-browser callers omit Origin
  return key.allowed_origins.includes(origin)
}

/**
 * Authenticates a request. On success returns the resolved key; on failure
 * returns a ready-to-send error Response (already CORS-tagged).
 */
export async function authenticate(req: Request, endpoint: string): Promise<AuthOk | AuthErr> {
  const origin = req.headers.get("origin")

  if (!isDbConfigured()) {
    return { ok: false, response: errorResponse(503, "not_configured", "API is not configured.", origin) }
  }

  const authz = req.headers.get("authorization") ?? ""
  const match = authz.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    return {
      ok: false,
      response: errorResponse(401, "missing_key", "Provide an API key as 'Authorization: Bearer <key>'.", origin),
    }
  }

  const key = await findActiveKeyByRaw(match[1].trim())
  if (!key) {
    return { ok: false, response: errorResponse(401, "invalid_key", "API key is invalid or revoked.", origin) }
  }

  if (!originAllowed(key, origin)) {
    return { ok: false, response: errorResponse(403, "origin_not_allowed", `Origin ${origin} is not allowed for this key.`, origin) }
  }

  if (await isRateLimited(key.id, key.rate_limit_per_min)) {
    await touchKeyUsage(key.id, endpoint, 429)
    return {
      ok: false,
      response: errorResponse(429, "rate_limited", `Rate limit of ${key.rate_limit_per_min}/min exceeded.`, origin),
    }
  }

  return { ok: true, key, origin }
}
