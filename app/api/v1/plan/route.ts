import { authenticate, jsonResponse, preflightResponse, errorResponse } from "@/lib/api/auth"
import { touchKeyUsage } from "@/lib/api/keys"
import { loadAccountAudit } from "@/lib/stellar/account"
import { buildDemolitionPlan } from "@/lib/stellar/plan"
import { buildUnsignedTransactions } from "@/lib/stellar/execute"
import { parseDemolitionConfig } from "@/lib/api/config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function OPTIONS(req: Request) {
  return preflightResponse(req.headers.get("origin"))
}

/**
 * POST /api/v1/plan
 * Builds a full demolition plan for an account and returns the ordered list of
 * UNSIGNED transaction envelopes (base64 XDR). The partner's user signs each
 * envelope with their own wallet and submits it (directly or via /submit).
 * Secret keys never touch this server.
 *
 * Body: DemolitionConfig-ish (see parseDemolitionConfig) — at minimum
 *   { publicKey, destinationAddress, network? }
 */
export async function POST(req: Request) {
  const auth = await authenticate(req, "plan")
  if (!auth.ok) return auth.response
  const { key, origin } = auth

  let body: any
  try {
    body = await req.json()
  } catch {
    await touchKeyUsage(key.id, "plan", 400)
    return errorResponse(400, "invalid_json", "Body must be valid JSON.", origin)
  }

  const parsed = parseDemolitionConfig(body)
  if (!parsed.ok) {
    await touchKeyUsage(key.id, "plan", 400)
    return errorResponse(400, "invalid_config", parsed.message, origin)
  }
  const config = parsed.config

  try {
    const audit = await loadAccountAudit(config.publicKey, config.network)
    if (!audit.exists) {
      await touchKeyUsage(key.id, "plan", 404)
      return errorResponse(404, "account_not_found", "Account does not exist or is unfunded.", origin)
    }

    const { plan, batches } = await buildDemolitionPlan(audit, config)
    const transactions = await buildUnsignedTransactions(batches, config, config.network)

    await touchKeyUsage(key.id, "plan", 200)
    return jsonResponse(
      {
        network: config.network,
        publicKey: config.publicKey,
        destinationAddress: config.destinationAddress,
        estimatedRecoveredXlm: plan.estimatedRecoveredXlm,
        blockers: plan.blockers,
        warnings: plan.warnings,
        // human-readable per-transaction preview (labels + operations)
        preview: plan.transactions,
        // unsigned envelopes to sign + submit IN ORDER
        transactions,
      },
      200,
      origin,
    )
  } catch (err: any) {
    await touchKeyUsage(key.id, "plan", 502)
    return errorResponse(502, "plan_error", err?.message ?? "Failed to build plan.", origin)
  }
}
