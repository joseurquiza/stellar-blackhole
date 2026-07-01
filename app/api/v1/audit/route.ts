import { authenticate, jsonResponse, preflightResponse, errorResponse } from "@/lib/api/auth"
import { touchKeyUsage } from "@/lib/api/keys"
import { loadAccountAudit } from "@/lib/stellar/account"
import { isValidPublicKey } from "@/lib/api/config"
import type { NetworkId } from "@/lib/stellar/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function OPTIONS(req: Request) {
  return preflightResponse(req.headers.get("origin"))
}

/**
 * POST /api/v1/audit
 * Read-only inspection of a Stellar account: balances, trustlines, offers,
 * pools, claimable balances, signers, data entries and merge blockers.
 * Body: { publicKey: string, network?: "public" | "testnet" }
 */
export async function POST(req: Request) {
  const auth = await authenticate(req, "audit")
  if (!auth.ok) return auth.response
  const { key, origin } = auth

  let body: any
  try {
    body = await req.json()
  } catch {
    await touchKeyUsage(key.id, "audit", 400)
    return errorResponse(400, "invalid_json", "Body must be valid JSON.", origin)
  }

  if (!isValidPublicKey(body?.publicKey)) {
    await touchKeyUsage(key.id, "audit", 400)
    return errorResponse(400, "invalid_public_key", "'publicKey' must be a valid Stellar account (G...).", origin)
  }
  const network: NetworkId = body.network === "testnet" ? "testnet" : "public"

  try {
    const audit = await loadAccountAudit(body.publicKey, network)
    await touchKeyUsage(key.id, "audit", 200)
    return jsonResponse({ audit }, 200, origin)
  } catch (err: any) {
    await touchKeyUsage(key.id, "audit", 502)
    return errorResponse(502, "horizon_error", err?.message ?? "Failed to load account.", origin)
  }
}
