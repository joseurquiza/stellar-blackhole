// Mock data for Demo Mode: lets the live wizard run end-to-end without any
// Horizon calls, signing, or network submission. Everything here is fabricated
// so users can rehearse the exact real flow risk-free.

import { NATIVE_ASSET, makeAssetId } from "@/lib/stellar/network"
import type {
  AccountAudit,
  DemolitionConfig,
  DemolitionPlan,
  ExecutionStep,
  NetworkId,
  PlannedTransaction,
} from "@/lib/stellar/types"

const DEMO_PUBLIC_KEY = "GDEMOACCOUNTBLACKHOLE7XSIMULATIONONLYDONOTSEND4242"

const USDC = makeAssetId("USDC", "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN")
const YXLM = makeAssetId("yXLM", "GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55")

export function buildMockAudit(publicKey: string, network: NetworkId): AccountAudit {
  const pk = publicKey && publicKey.startsWith("G") ? publicKey : DEMO_PUBLIC_KEY
  return {
    publicKey: pk,
    network,
    exists: true,
    nativeBalance: "152.5000000",
    minBalance: "4.5000000",
    baseReserve: "0.5000000",
    subentryCount: 8,
    balances: [
      {
        asset: NATIVE_ASSET,
        balance: "152.5000000",
        sellingLiabilities: "0.0000000",
        buyingLiabilities: "0.0000000",
        isDust: false,
      },
      {
        asset: USDC,
        balance: "42.7300000",
        limit: "1000000.0000000",
        authorized: true,
        sellingLiabilities: "0.0000000",
        buyingLiabilities: "0.0000000",
        isDust: false,
      },
      {
        asset: YXLM,
        balance: "0.0001500",
        limit: "1000000.0000000",
        authorized: true,
        sellingLiabilities: "0.0000000",
        buyingLiabilities: "0.0000000",
        isDust: true,
      },
    ],
    liquidityPools: [
      {
        poolId: "a468d41d8e9b8f3c7c2f0b1e6d5a4938271605f4e3d2c1b0a99887766554433",
        shares: "18.4500000",
        reserves: [
          { asset: NATIVE_ASSET, amount: "9.1200000" },
          { asset: USDC, amount: "9.0500000" },
        ],
      },
    ],
    openOffers: [
      {
        id: "1029384756",
        selling: USDC,
        buying: NATIVE_ASSET,
        amount: "12.0000000",
        price: "0.0830000",
      },
    ],
    dataEntries: [{ name: "wallet.app", value: "demo-export-v1" }],
    signers: [{ key: pk, weight: 1, type: "ed25519_public_key" }],
    thresholds: { low: 0, med: 0, high: 0, masterWeight: 1 },
    sponsorship: { numSponsoring: 0, numSponsored: 0 },
    claimableBalances: [
      {
        id: "00000000aa11bb22cc33dd44ee55ff66",
        asset: USDC,
        amount: "5.0000000",
        claimableNow: true,
        predicateSummary: "Unconditional",
      },
    ],
    sorobanTokens: [],
    sorobanAllowances: [],
    defiPositions: [],
    isMultisig: false,
    hasMasterKeyDisabled: false,
  }
}

export function buildMockPlan(audit: AccountAudit, config: DemolitionConfig): DemolitionPlan {
  const dest = config.destinationAddress || "GDEST…DEMO"
  const transactions: PlannedTransaction[] = [
    {
      label: "Cleanup transaction 1",
      requiresAdditionalSignatures: false,
      operations: [
        {
          kind: "remove-offer",
          description: "Cancel open offer",
          details: ["Sell 12.00 USDC → XLM @ 0.083"],
          reserveReclaimed: 0.5,
          destructive: false,
        },
        {
          kind: "withdraw-pool",
          description: "Withdraw from liquidity pool",
          details: ["18.45 shares → 9.12 XLM + 9.05 USDC"],
          reserveReclaimed: 0.5,
          destructive: false,
        },
        {
          kind: "claim-balance",
          description: "Claim claimable balance",
          details: ["5.00 USDC (unconditional)"],
          reserveReclaimed: 0,
          destructive: false,
        },
      ],
    },
    {
      label: "Cleanup transaction 2",
      requiresAdditionalSignatures: false,
      operations: [
        {
          kind: "sell-asset",
          description: "Sell non-XLM balances to XLM",
          details: ["56.78 USDC → ~58.1 XLM (≤1% slippage)"],
          reserveReclaimed: 0,
          destructive: false,
        },
        {
          kind: "remove-trustline",
          description: "Remove trustlines",
          details: ["USDC", "yXLM"],
          reserveReclaimed: 1.0,
          destructive: true,
        },
        {
          kind: "remove-data",
          description: "Remove data entries",
          details: ["wallet.app"],
          reserveReclaimed: 0.5,
          destructive: true,
        },
      ],
    },
    {
      label: "Account merge",
      requiresAdditionalSignatures: false,
      operations: [
        {
          kind: "account-merge",
          description: "Merge account and recover remaining XLM",
          details: [`Destination ${dest.slice(0, 8)}…${dest.slice(-4)}`],
          reserveReclaimed: 4.5,
          destructive: true,
        },
      ],
    },
  ]

  return {
    publicKey: audit.publicKey,
    network: config.network,
    transactions,
    estimatedRecoveredXlm: "148.2100000",
    blockers: [],
    warnings: ["Simulated plan — no transactions will be built or broadcast."],
    config,
  }
}

export function buildMockSteps(plan: DemolitionPlan): ExecutionStep[] {
  return plan.transactions.map((tx, i) => ({
    id: `tx-${i}`,
    label: tx.label,
    status: "pending",
  }))
}

function fakeTxHash(i: number): string {
  const seed = "9f3a7c2e1b6d4805f2a1c9e7d3b50a4836271605f4e3d2c1b0a998877665544"
  return (seed + i).slice(0, 64)
}

// Drives a believable signing → submitting → success animation through the
// provided step ids, calling onStep for each transition.
export async function runMockExecution(
  steps: ExecutionStep[],
  recoveredTo: string,
  onStep: (step: ExecutionStep) => void,
): Promise<{ success: boolean; recoveredTo: string }> {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
  for (let i = 0; i < steps.length; i++) {
    const base = steps[i]
    onStep({ ...base, status: "signing" })
    await wait(550)
    onStep({ ...base, status: "submitting" })
    await wait(750)
    onStep({ ...base, status: "success", txHash: fakeTxHash(i) })
    await wait(250)
  }
  return { success: true, recoveredTo: recoveredTo || DEMO_PUBLIC_KEY }
}
