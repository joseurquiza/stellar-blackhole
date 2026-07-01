import { TransactionBuilder } from "@stellar/stellar-sdk"
import { authenticate, jsonResponse, preflightResponse, errorResponse } from "@/lib/api/auth"
import { touchKeyUsage } from "@/lib/api/keys"
import { getHorizonServer } from "@/lib/stellar/account"
import { getNetwork, explorerTxUrl } from "@/lib/stellar/network"
import type { NetworkId } from "@/lib/stellar/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function OPTIONS(req: Request) {
  return preflightResponse(req.headers.get("origin"))
}

/**
 * POST /api/v1/submit
 * Optional relay: forwards an ALREADY-SIGNED transaction envelope to Horizon
 * and returns the result. Still non-custodial — the envelope arrives signed and
 * we never see any secret key. Partners may skip this and submit to Horizon
 * themselves.
 *
 * Body: { signedXdr: string, network?: "public" | "testnet" }
 */
export async function POST(req: Request) {
  const auth = await authenticate(req, "submit")
  if (!auth.ok) return auth.response
  const { key, origin } = auth

  let body: any
  try {
    body = await req.json()
  } catch {
    await touchKeyUsage(key.id, "submit", 400)
    return errorResponse(400, "invalid_json", "Body must be valid JSON.", origin)
  }

  if (typeof body?.signedXdr !== "string" || body.signedXdr.length < 20) {
    await touchKeyUsage(key.id, "submit", 400)
    return errorResponse(400, "invalid_xdr", "'signedXdr' must be a signed transaction envelope (base64 XDR).", origin)
  }
  const network: NetworkId = body.network === "testnet" ? "testnet" : "public"
  const passphrase = getNetwork(network).networkPassphrase

  let tx
  try {
    tx = TransactionBuilder.fromXDR(body.signedXdr, passphrase)
  } catch {
    await touchKeyUsage(key.id, "submit", 400)
    return errorResponse(400, "malformed_xdr", "Could not parse the transaction envelope for this network.", origin)
  }

  try {
    const server = getHorizonServer(network)
    const res = await server.submitTransaction(tx as any)
    await touchKeyUsage(key.id, "submit", 200)
    return jsonResponse(
      { hash: res.hash, ledger: res.ledger, successful: true, explorerUrl: explorerTxUrl(network, res.hash) },
      200,
      origin,
    )
  } catch (err: any) {
    const resultCodes = err?.response?.data?.extras?.result_codes ?? err?.response?.extras?.result_codes
    const detail = resultCodes
      ? `${resultCodes.transaction ?? ""} ${(resultCodes.operations ?? []).join(", ")}`.trim()
      : (err?.message ?? "Submission failed")
    await touchKeyUsage(key.id, "submit", 400)
    return jsonResponse({ error: { code: "submit_failed", message: detail }, resultCodes: resultCodes ?? null }, 400, origin)
  }
}
