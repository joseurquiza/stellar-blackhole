import { Operation, Asset, type xdr } from "@stellar/stellar-sdk"
import { computeBlockers, computeWarnings } from "./analysis"
import { quoteStrictSend, toSdkAsset, type RouteQuote } from "./routing"
import type {
  AccountAudit,
  DemolitionConfig,
  DemolitionPlan,
  PlannedOperation,
  PlannedTransaction,
  StepKind,
} from "./types"

const BASE_RESERVE = 0.5
const MAX_OPS_PER_TX = 95

/**
 * On-chain attribution stamp written as the text memo of the final merge
 * transaction. Stellar text memos are capped at 28 UTF-8 bytes; this is 13.
 * Block explorers (stellar.expert, etc.) surface it on the transaction page,
 * permanently marking that the merge was performed with this tool.
 */
export const BLACKHOLE_MEMO = "via BlackHole"

/**
 * A demolition unit couples the human-readable preview with the exact SDK
 * operations that will be submitted. The planner and the executor BOTH derive
 * their behavior from these units, guaranteeing that what the user previews is
 * exactly what they sign.
 */
export interface DemolitionUnit extends PlannedOperation {
  kind: StepKind
  ops: xdr.Operation[]
  requiresAdditionalSignatures: boolean
  // merge must be the final operation across the whole plan
  isMerge?: boolean
}

/**
 * Build the ordered set of demolition units for the account. Path-payment
 * quotes are resolved up front so the previewed minimums are the ones signed.
 */
export async function buildDemolitionUnits(
  audit: AccountAudit,
  config: DemolitionConfig,
): Promise<{ units: DemolitionUnit[]; quotes: Record<string, RouteQuote> }> {
  const units: DemolitionUnit[] = []
  const quotes: Record<string, RouteQuote> = {}
  const multisig = audit.isMultisig

  // 1. Withdraw all liquidity pool stakes (subentries that block merge)
  if (config.withdrawPools) {
    for (const pool of audit.liquidityPools) {
      units.push({
        kind: "withdraw-pool",
        description: `Withdraw liquidity pool shares`,
        details: [`Pool ${pool.poolId.slice(0, 8)}…`, `Shares: ${pool.shares}`],
        reserveReclaimed: BASE_RESERVE,
        destructive: false,
        requiresAdditionalSignatures: multisig,
        ops: [
          Operation.liquidityPoolWithdraw({
            liquidityPoolId: pool.poolId,
            amount: pool.shares,
            minAmountA: "0",
            minAmountB: "0",
          }),
        ],
      })
    }
  }

  // 2. Claim all claimable balances that are claimable now
  if (config.claimBalances) {
    for (const cb of audit.claimableBalances) {
      if (!cb.claimableNow) continue
      units.push({
        kind: "claim-balance",
        description: `Claim ${cb.amount} ${cb.asset.code}`,
        details: [`Balance ${cb.id.slice(0, 12)}…`, cb.predicateSummary],
        reserveReclaimed: 0,
        destructive: false,
        requiresAdditionalSignatures: multisig,
        ops: [Operation.claimClaimableBalance({ balanceId: cb.id })],
      })
    }
  }

  // 3. Cancel all open offers (they lock liabilities and are subentries)
  for (const offer of audit.openOffers) {
    units.push({
      kind: "remove-offer",
      description: `Cancel offer ${offer.id}`,
      details: [`Selling ${offer.selling.code} → buying ${offer.buying.code}`],
      reserveReclaimed: BASE_RESERVE,
      destructive: false,
      requiresAdditionalSignatures: multisig,
      ops: [
        Operation.manageSellOffer({
          selling: toSdkAsset(offer.selling),
          buying: toSdkAsset(offer.buying),
          amount: "0",
          price: offer.price || "1",
          offerId: offer.id,
        }),
      ],
    })
  }

  // 4. Sell every non-native balance to the base asset via strict-send paths
  if (config.sellToBase) {
    for (const line of audit.balances) {
      if (line.asset.isNative) continue
      const amount = Number.parseFloat(line.balance)
      if (amount <= 0) continue
      if (line.asset.key === config.baseAsset.key) continue

      const quote = await quoteStrictSend(
        config.network,
        line.asset,
        config.baseAsset,
        line.balance,
        config.slippageBps,
      )
      quotes[line.asset.key] = quote

      if (quote.empty) {
        units.push({
          kind: "sell-asset",
          description: `No route found to sell ${line.asset.code}`,
          details: [
            `Balance ${line.balance} ${line.asset.code} cannot be auto-sold (no DEX path).`,
            `It will be left in place; remove its trustline only after emptying it manually.`,
          ],
          reserveReclaimed: 0,
          destructive: false,
          requiresAdditionalSignatures: multisig,
          ops: [],
        })
        continue
      }

      units.push({
        kind: "sell-asset",
        description: `Sell ${line.balance} ${line.asset.code} → ~${quote.destinationAmount} ${config.baseAsset.code}`,
        details: [
          `Min received: ${quote.destinationMin} ${config.baseAsset.code}`,
          quote.path.length ? `Path: ${quote.path.map((p) => p.code).join(" → ")}` : "Direct route",
          `Slippage tolerance: ${(config.slippageBps / 100).toFixed(2)}%`,
        ],
        reserveReclaimed: 0,
        destructive: false,
        requiresAdditionalSignatures: multisig,
        ops: [
          Operation.pathPaymentStrictSend({
            sendAsset: toSdkAsset(line.asset),
            sendAmount: line.balance,
            destination: audit.publicKey,
            destAsset: toSdkAsset(config.baseAsset),
            destMin: quote.destinationMin,
            path: quote.path.map(toSdkAsset),
          }),
        ],
      })
    }
  }

  // 5. Remove trustlines (only valid once balances are zero)
  for (const line of audit.balances) {
    if (line.asset.isNative) continue
    if (!config.sellToBase && Number.parseFloat(line.balance) > 0) {
      // keep the trustline if we are not emptying it; cannot remove non-zero line
      continue
    }
    units.push({
      kind: "remove-trustline",
      description: `Remove trustline ${line.asset.code}`,
      details: [`Issuer ${line.asset.issuer?.slice(0, 8)}…`, "Reclaims 0.5 XLM reserve"],
      reserveReclaimed: BASE_RESERVE,
      destructive: false,
      requiresAdditionalSignatures: multisig,
      ops: [
        Operation.changeTrust({
          asset: new Asset(line.asset.code, line.asset.issuer),
          limit: "0",
        }),
      ],
    })
  }

  // 6. Remove all data entries
  for (const entry of audit.dataEntries) {
    units.push({
      kind: "remove-data",
      description: `Remove data entry "${entry.name}"`,
      details: ["Reclaims 0.5 XLM reserve"],
      reserveReclaimed: BASE_RESERVE,
      destructive: false,
      requiresAdditionalSignatures: multisig,
      ops: [Operation.manageData({ name: entry.name, value: null })],
    })
  }

  // 7. Remove additional (non-master) signers to clear subentries
  for (const signer of audit.signers) {
    if (signer.key === audit.publicKey) continue
    if (signer.weight === 0) continue
    units.push({
      kind: "reconfigure-signers",
      description: `Remove signer ${signer.key.slice(0, 8)}…`,
      details: ["Sets signer weight to 0", "Reclaims 0.5 XLM reserve"],
      reserveReclaimed: BASE_RESERVE,
      destructive: true,
      requiresAdditionalSignatures: multisig,
      ops: [
        Operation.setOptions({
          signer: { ed25519PublicKey: signer.key, weight: 0 },
        }),
      ],
    })
  }

  // 8. Optional mediator payment (route XLM through an intermediary first)
  if (config.useMediator && config.mediatorAddress) {
    units.push({
      kind: "mediator-payment",
      description: `Route balance through mediator ${config.mediatorAddress.slice(0, 8)}…`,
      details: [
        config.mediatorMemo ? `Memo: ${config.mediatorMemo}` : "No memo",
        "Sends spendable XLM to the mediator before the final merge.",
      ],
      reserveReclaimed: 0,
      destructive: true,
      requiresAdditionalSignatures: multisig,
      ops: [
        Operation.payment({
          destination: config.mediatorAddress,
          asset: Asset.native(),
          amount: spendableXlm(audit),
        }),
      ],
    })
  }

  // 9. Final account merge — must be the last operation in the plan
  const mergeDestination = config.useMediator && config.mediatorAddress
    ? config.mediatorAddress
    : config.destinationAddress
  units.push({
    kind: "account-merge",
    description: `Merge account into ${mergeDestination.slice(0, 8)}…`,
    details: [
      "Transfers all remaining XLM and permanently closes this account.",
      "This action is irreversible.",
    ],
    reserveReclaimed: BASE_RESERVE * 2,
    destructive: true,
    requiresAdditionalSignatures: multisig,
    isMerge: true,
    ops: [Operation.accountMerge({ destination: mergeDestination })],
  })

  return { units, quotes }
}

/** Spendable XLM = native balance minus current min reserve. */
function spendableXlm(audit: AccountAudit): string {
  const spend = Number.parseFloat(audit.nativeBalance) - Number.parseFloat(audit.minBalance)
  return Math.max(0, spend).toFixed(7)
}

/**
 * Groups units into valid Stellar transactions (<= MAX_OPS_PER_TX), keeping the
 * mediator payment + merge together in the final transaction and in order.
 */
export function groupUnitsIntoTransactions(units: DemolitionUnit[]): {
  display: PlannedTransaction[]
  batches: DemolitionUnit[][]
} {
  const cleanup = units.filter((u) => u.kind !== "account-merge" && u.kind !== "mediator-payment")
  // The mediator payment and the merge are kept in separate transactions: the
  // merge must ride alone so it can carry the BlackHole attribution memo without
  // colliding with the user's mediator memo (a tx can hold only one memo).
  const mediatorUnits = units.filter((u) => u.kind === "mediator-payment")
  const mergeUnits = units.filter((u) => u.kind === "account-merge")

  const batches: DemolitionUnit[][] = []
  let current: DemolitionUnit[] = []
  let opCount = 0

  for (const unit of cleanup) {
    if (unit.ops.length === 0) continue
    if (opCount + unit.ops.length > MAX_OPS_PER_TX) {
      if (current.length) batches.push(current)
      current = []
      opCount = 0
    }
    current.push(unit)
    opCount += unit.ops.length
  }
  if (current.length) batches.push(current)
  if (mediatorUnits.length) batches.push(mediatorUnits)
  if (mergeUnits.length) batches.push(mergeUnits)

  let cleanupCounter = 0
  const display: PlannedTransaction[] = batches.map((batch) => {
    let label: string
    if (batch.some((u) => u.kind === "account-merge")) {
      label = `Final: account merge · stamped "${BLACKHOLE_MEMO}"`
    } else if (batch.some((u) => u.kind === "mediator-payment")) {
      label = "Route balance through mediator"
    } else {
      cleanupCounter += 1
      label = `Cleanup transaction ${cleanupCounter}`
    }
    return {
      label,
      operations: batch.map((u) => ({
        kind: u.kind,
        description: u.description,
        details: u.details,
        reserveReclaimed: u.reserveReclaimed,
        destructive: u.destructive,
      })),
      requiresAdditionalSignatures: batch.some((u) => u.requiresAdditionalSignatures),
    }
  })

  return { display, batches }
}

/** Build the full demolition plan (display + grouped batches) for an account. */
export async function buildDemolitionPlan(
  audit: AccountAudit,
  config: DemolitionConfig,
): Promise<{ plan: DemolitionPlan; batches: DemolitionUnit[][] }> {
  const { units } = await buildDemolitionUnits(audit, config)
  const { display, batches } = groupUnitsIntoTransactions(units)

  const totalReserve = units.reduce((sum, u) => sum + u.reserveReclaimed, 0)
  const spendable = Number.parseFloat(spendableXlm(audit))
  const estimatedRecoveredXlm = (spendable + totalReserve).toFixed(7)

  const plan: DemolitionPlan = {
    publicKey: audit.publicKey,
    network: audit.network,
    transactions: display,
    estimatedRecoveredXlm,
    blockers: computeBlockers(audit),
    warnings: computeWarnings(audit),
    config,
  }

  return { plan, batches }
}
