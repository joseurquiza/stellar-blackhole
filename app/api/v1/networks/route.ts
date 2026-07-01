import { authenticate, jsonResponse, preflightResponse } from "@/lib/api/auth"
import { touchKeyUsage } from "@/lib/api/keys"
import { NETWORKS } from "@/lib/stellar/network"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function OPTIONS(req: Request) {
  return preflightResponse(req.headers.get("origin"))
}

/**
 * GET /api/v1/networks
 * Lists the Stellar networks the API supports (id, label, passphrase, explorer).
 * Also a convenient endpoint to verify an API key is valid.
 */
export async function GET(req: Request) {
  const auth = await authenticate(req, "networks")
  if (!auth.ok) return auth.response
  const { key, origin } = auth

  const networks = Object.values(NETWORKS).map((n) => ({
    id: n.id,
    label: n.label,
    networkPassphrase: n.networkPassphrase,
    horizonUrl: n.horizonUrl,
    explorerBase: n.explorerBase,
  }))

  await touchKeyUsage(key.id, "networks", 200)
  return jsonResponse({ networks }, 200, origin)
}
