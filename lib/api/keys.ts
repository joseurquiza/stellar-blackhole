import "server-only"
import { createHash, randomBytes } from "node:crypto"
import { sql } from "@/lib/db"

/**
 * API key model + store for partner platforms.
 *
 * Keys are shown to the operator exactly once at creation time. We persist only
 * the SHA-256 hash of the secret (never the secret itself), plus a short,
 * non-sensitive prefix for display. Authentication hashes the presented key and
 * looks up the row by hash.
 */
export interface ApiKeyRow {
  id: string
  name: string
  key_prefix: string
  allowed_origins: string[]
  rate_limit_per_min: number
  active: boolean
  created_at: string
  last_used_at: string | null
}

const LIVE_PREFIX = "bh_live_"

export function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex")
}

/** Generates a new opaque API key: `bh_live_<43-char base64url>`. */
function generateRawKey(): string {
  return LIVE_PREFIX + randomBytes(32).toString("base64url")
}

/** A short, safe-to-display fingerprint, e.g. `bh_live_abcd…wxyz`. */
function fingerprint(rawKey: string): string {
  const body = rawKey.slice(LIVE_PREFIX.length)
  return `${LIVE_PREFIX}${body.slice(0, 4)}…${body.slice(-4)}`
}

export async function listApiKeys(): Promise<ApiKeyRow[]> {
  const rows = await sql`
    SELECT id, name, key_prefix, allowed_origins, rate_limit_per_min, active, created_at, last_used_at
    FROM bh_api_keys
    ORDER BY created_at DESC
  `
  return rows as ApiKeyRow[]
}

/**
 * Creates a key and returns BOTH the stored row and the one-time raw secret.
 * The raw secret is never persisted and cannot be retrieved again.
 */
export async function createApiKey(input: {
  name: string
  allowedOrigins: string[]
  rateLimitPerMin: number
}): Promise<{ row: ApiKeyRow; rawKey: string }> {
  const rawKey = generateRawKey()
  const keyHash = hashKey(rawKey)
  const keyPrefix = fingerprint(rawKey)

  const rows = await sql`
    INSERT INTO bh_api_keys (name, key_hash, key_prefix, allowed_origins, rate_limit_per_min)
    VALUES (${input.name}, ${keyHash}, ${keyPrefix}, ${input.allowedOrigins}, ${input.rateLimitPerMin})
    RETURNING id, name, key_prefix, allowed_origins, rate_limit_per_min, active, created_at, last_used_at
  `
  return { row: rows[0] as ApiKeyRow, rawKey }
}

export async function setApiKeyActive(id: string, active: boolean): Promise<void> {
  await sql`UPDATE bh_api_keys SET active = ${active} WHERE id = ${id}`
}

export async function deleteApiKey(id: string): Promise<void> {
  await sql`DELETE FROM bh_api_keys WHERE id = ${id}`
}

/** Looks up an active key by the raw secret presented in a request. */
export async function findActiveKeyByRaw(rawKey: string): Promise<ApiKeyRow | null> {
  if (!rawKey.startsWith(LIVE_PREFIX)) return null
  const keyHash = hashKey(rawKey)
  const rows = await sql`
    SELECT id, name, key_prefix, allowed_origins, rate_limit_per_min, active, created_at, last_used_at
    FROM bh_api_keys
    WHERE key_hash = ${keyHash} AND active = true
    LIMIT 1
  `
  return (rows[0] as ApiKeyRow) ?? null
}

export async function touchKeyUsage(keyId: string, endpoint: string, status: number): Promise<void> {
  // Best-effort: log usage + bump last_used_at. Never throw into the request path.
  try {
    await sql`INSERT INTO bh_api_usage (key_id, endpoint, status) VALUES (${keyId}, ${endpoint}, ${status})`
    await sql`UPDATE bh_api_keys SET last_used_at = now() WHERE id = ${keyId}`
  } catch (err) {
    console.error("[v0] usage log failed:", err)
  }
}

/** Rolling per-minute rate limit: counts this key's usage rows in the last 60s. */
export async function isRateLimited(keyId: string, limitPerMin: number): Promise<boolean> {
  const rows = await sql`
    SELECT count(*)::int AS n
    FROM bh_api_usage
    WHERE key_id = ${keyId} AND created_at > now() - interval '1 minute'
  `
  const n = (rows[0] as { n: number })?.n ?? 0
  return n >= limitPerMin
}
