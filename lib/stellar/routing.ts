import { Asset } from "@stellar/stellar-sdk"
import { getHorizonServer } from "./account"
import type { AssetId, NetworkId } from "./types"

/** Convert our AssetId into an SDK Asset. */
export function toSdkAsset(asset: AssetId): Asset {
  if (asset.isNative || !asset.issuer) return Asset.native()
  return new Asset(asset.code, asset.issuer)
}

export interface RouteQuote {
  source: AssetId
  destination: AssetId
  sourceAmount: string
  destinationAmount: string
  // minimum destination amount after slippage, used as destMin on the op
  destinationMin: string
  // ordered path of intermediary assets (may be empty for direct)
  path: AssetId[]
  // true when no route was found
  empty: boolean
}

function assetFromRecord(a: any): AssetId {
  if (a.asset_type === "native") return { code: "XLM", isNative: true, key: "native" }
  return {
    code: a.asset_code,
    issuer: a.asset_issuer,
    isNative: false,
    key: `${a.asset_code}:${a.asset_issuer}`,
  }
}

/**
 * Find the best strict-send route to convert the full `sourceAmount` of
 * `source` into `dest`, using Horizon's path-finding over SDEX + AMMs.
 * Returns the expected destination amount and a slippage-adjusted minimum.
 */
export async function quoteStrictSend(
  network: NetworkId,
  source: AssetId,
  dest: AssetId,
  sourceAmount: string,
  slippageBps: number,
): Promise<RouteQuote> {
  const server = getHorizonServer(network)
  const sendAsset = toSdkAsset(source)
  const destAsset = toSdkAsset(dest)

  const empty: RouteQuote = {
    source,
    destination: dest,
    sourceAmount,
    destinationAmount: "0",
    destinationMin: "0",
    path: [],
    empty: true,
  }

  if (Number.parseFloat(sourceAmount) <= 0) return empty

  try {
    const res = await server
      .strictSendPaths(sendAsset, sourceAmount, [destAsset])
      .call()

    if (!res.records.length) return empty

    // pick the path with the highest destination amount
    const best = res.records.reduce((a, b) =>
      Number.parseFloat(b.destination_amount) > Number.parseFloat(a.destination_amount) ? b : a,
    )

    const destinationAmount = best.destination_amount
    const minAmount = Number.parseFloat(destinationAmount) * (1 - slippageBps / 10_000)

    return {
      source,
      destination: dest,
      sourceAmount,
      destinationAmount,
      destinationMin: minAmount.toFixed(7),
      path: (best.path ?? []).map(assetFromRecord),
      empty: false,
    }
  } catch {
    return empty
  }
}
