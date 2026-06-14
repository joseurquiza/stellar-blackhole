// Soroban sweep planning (additive; only used when SOROBAN_SWEEP_ENABLED).
//
// Builds the ordered list of Soroban units that must run BEFORE the classic
// demolition so contract-held value is recovered into the destination:
//   1. withdraw closeable DeFi positions (Blend / Phoenix / Soroswap adapters)
//   2. transfer remaining SAC / Soroban token balances to the destination
//   3. revoke dangling allowances
//
// This module is pure planning — no signing, no submission. The executor
// (soroban-execute.ts) turns these units into prepared, signed transactions.

import { buildAllCloseUnits } from "./defiAdapters"
import { labelContract } from "./soroban"
import type { AccountAudit, DemolitionConfig, PlannedTransaction, SorobanUnit } from "./types"

/**
 * Build the ordered Soroban sweep units for an audited account.
 * Returns an empty array when there is nothing to sweep.
 */
export async function buildSorobanUnits(
  network: AccountAudit["network"],
  audit: AccountAudit,
  config: DemolitionConfig,
): Promise<SorobanUnit[]> {
  if (!config.sweepSoroban) return []
  const destination = (config.destinationAddress || "").trim()
  if (!destination) return []

  const units: SorobanUnit[] = []

  // 1) Close DeFi positions that an adapter can confidently exit. Positions
  // that remain manual (closeable:false) yield no units here.
  units.push(...(await buildAllCloseUnits(network, audit, destination)))

  // 2) Transfer every non-zero Soroban/SAC token balance to the destination.
  for (const token of audit.sorobanTokens) {
    if (!token.rawBalance || token.rawBalance === "0") continue
    const label =
      token.protocolLabel ?? labelContract(network, token.contractId)?.name ?? "Soroban token"
    units.push({
      kind: "soroban-transfer",
      contractId: token.contractId,
      method: "transfer",
      description: `Transfer ${token.displayBalance}${token.symbol ? ` ${token.symbol}` : ""} to destination`,
      details: [
        `${label} ${token.contractId.slice(0, 6)}…${token.contractId.slice(-4)}`,
        `Amount ${token.displayBalance}${token.symbol ? ` ${token.symbol}` : ""}`,
        `To ${destination.slice(0, 6)}…${destination.slice(-4)}`,
      ],
      build: { op: "transfer", rawAmount: token.rawBalance, destination },
      recoversTo: destination,
    })
  }

  // 3) Revoke dangling allowances so no spender retains access post-merge.
  for (const allowance of audit.sorobanAllowances) {
    if (!allowance.amount || allowance.amount === "0") continue
    units.push({
      kind: "soroban-revoke-allowance",
      contractId: allowance.contractId,
      method: "approve",
      description: `Revoke allowance${allowance.symbol ? ` for ${allowance.symbol}` : ""}`,
      details: [
        `Token ${allowance.contractId.slice(0, 6)}…`,
        `Spender ${allowance.spenderLabel ?? `${allowance.spender.slice(0, 6)}…`}`,
        `Current allowance ${allowance.amount}`,
      ],
      build: { op: "approve-zero", spender: allowance.spender },
    })
  }

  return units
}

/**
 * Summarize Soroban units as preview transactions (one tx per unit, since each
 * holds a single InvokeHostFunction op). Rendered as its own group in the UI.
 */
export function summarizeSorobanUnits(units: SorobanUnit[]): PlannedTransaction[] {
  return units.map((u) => ({
    label: `Soroban: ${u.description}`,
    operations: [
      {
        kind: "remove-data", // closest classic StepKind for display typing; UI uses description
        description: u.description,
        details: u.details,
        reserveReclaimed: 0,
        destructive: u.kind === "soroban-withdraw" || u.kind === "soroban-transfer",
      },
    ],
    requiresAdditionalSignatures: false,
  }))
}
