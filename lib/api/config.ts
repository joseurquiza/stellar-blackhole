import { StrKey } from "@stellar/stellar-sdk"
import { NATIVE_ASSET, makeAssetId } from "@/lib/stellar/network"
import type { DemolitionConfig, NetworkId } from "@/lib/stellar/types"

export function isValidPublicKey(v: unknown): v is string {
  return typeof v === "string" && StrKey.isValidEd25519PublicKey(v)
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback
}

type ParseOk = { ok: true; config: DemolitionConfig }
type ParseErr = { ok: false; message: string }

/**
 * Validates a partner-supplied JSON body and produces a canonical
 * DemolitionConfig. Defaults mirror the interactive tool (sell to XLM, claim
 * balances, withdraw pools, 1% slippage). The public API v1 intentionally does
 * not expose the experimental Soroban sweep, keeping partner behavior stable.
 */
export function parseDemolitionConfig(body: any): ParseOk | ParseErr {
  if (!body || typeof body !== "object") return { ok: false, message: "Request body must be a JSON object." }

  const network: NetworkId = body.network === "testnet" ? "testnet" : "public"

  if (!isValidPublicKey(body.publicKey)) {
    return { ok: false, message: "'publicKey' must be a valid Stellar account (G...)." }
  }
  if (!isValidPublicKey(body.destinationAddress)) {
    return { ok: false, message: "'destinationAddress' must be a valid Stellar account (G...)." }
  }

  const useMediator = asBool(body.useMediator, false)
  let mediatorAddress: string | undefined
  if (useMediator) {
    if (!isValidPublicKey(body.mediatorAddress)) {
      return { ok: false, message: "'mediatorAddress' must be a valid Stellar account when useMediator is true." }
    }
    mediatorAddress = body.mediatorAddress
  }

  let baseAsset = NATIVE_ASSET
  if (body.baseAsset && typeof body.baseAsset === "object") {
    const { code, issuer } = body.baseAsset
    if (code && code !== "XLM" && code !== "native") {
      if (!isValidPublicKey(issuer)) {
        return { ok: false, message: "'baseAsset.issuer' must be a valid account for non-native assets." }
      }
      baseAsset = makeAssetId(code, issuer)
    }
  }

  let slippageBps = 100
  if (body.slippageBps !== undefined) {
    const n = Number(body.slippageBps)
    if (!Number.isFinite(n) || n < 0 || n > 5000) {
      return { ok: false, message: "'slippageBps' must be between 0 and 5000." }
    }
    slippageBps = Math.round(n)
  }

  const config: DemolitionConfig = {
    publicKey: body.publicKey,
    network,
    destinationAddress: body.destinationAddress,
    useMediator,
    mediatorAddress,
    mediatorMemo: typeof body.mediatorMemo === "string" ? body.mediatorMemo.slice(0, 28) : undefined,
    sellToBase: asBool(body.sellToBase, true),
    baseAsset,
    slippageBps,
    claimBalances: asBool(body.claimBalances, true),
    withdrawPools: asBool(body.withdrawPools, true),
  }

  return { ok: true, config }
}
