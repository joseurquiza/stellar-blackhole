import { TransactionBuilder, Memo, type Account, type Transaction } from "@stellar/stellar-sdk"
import { getHorizonServer } from "./account"
import { getNetwork } from "./network"
import { signTransaction, type SignerSet } from "./signing"
import type { DemolitionConfig, ExecutionStep, NetworkId } from "./types"
import { BLACKHOLE_MEMO, type DemolitionUnit } from "./plan"

// 0.001 XLM per operation — comfortably above base fee to survive mild surge.
const FEE_PER_OP = "10000"

/** Human label for a batch, shared by the executor and the unsigned API build. */
function batchLabel(batch: DemolitionUnit[], cleanupIndex: number): string {
  if (batch.some((u) => u.isMerge)) return `Account merge · stamped "${BLACKHOLE_MEMO}"`
  if (batch.some((u) => u.kind === "mediator-payment")) return "Route balance through mediator"
  return `Cleanup transaction ${cleanupIndex}`
}

/**
 * Builds a single unsigned Stellar transaction from a batch of demolition
 * units against the given source account. The source's sequence number is
 * advanced by `.build()`, so reusing the same `source` across calls yields
 * correctly incrementing sequences for sequential submission.
 *
 * This is the ONE place transaction assembly (fee, ops, memo attribution)
 * happens — both the in-browser executor and the public API build identical
 * transactions through it, so what a user previews is exactly what is signed.
 */
export function buildUnsignedTransaction(
  source: Account,
  batch: DemolitionUnit[],
  config: DemolitionConfig,
  passphrase: string,
  timeout = 180,
): Transaction {
  const opCount = batch.reduce((n, u) => n + u.ops.length, 0)
  const fee = (Number.parseInt(FEE_PER_OP, 10) * opCount).toString()

  let builder = new TransactionBuilder(source, { fee, networkPassphrase: passphrase })
  for (const unit of batch) {
    for (const op of unit.ops) builder = builder.addOperation(op)
  }
  // Attach the mediator memo on the routing transaction when provided, and
  // stamp the standalone merge transaction with the BlackHole attribution.
  if (config.useMediator && config.mediatorMemo && batch.some((u) => u.kind === "mediator-payment")) {
    builder = builder.addMemo(Memo.text(config.mediatorMemo.slice(0, 28)))
  } else if (batch.some((u) => u.isMerge)) {
    builder = builder.addMemo(Memo.text(BLACKHOLE_MEMO))
  }
  return builder.setTimeout(timeout).build()
}

export interface UnsignedTransaction {
  index: number
  label: string
  opCount: number
  requiresAdditionalSignatures: boolean
  // base64-encoded unsigned transaction envelope, ready for wallet signing
  xdr: string
}

/**
 * Builds the full ordered set of UNSIGNED transaction envelopes for a plan.
 * The account is loaded once and its sequence advanced per transaction, so a
 * client can sign and submit them in order. No secret keys are involved — this
 * is the non-custodial primitive the public API returns to partner platforms.
 */
export async function buildUnsignedTransactions(
  batches: DemolitionUnit[][],
  config: DemolitionConfig,
  network: NetworkId,
  timeout = 900,
): Promise<UnsignedTransaction[]> {
  const server = getHorizonServer(network)
  const passphrase = getNetwork(network).networkPassphrase
  const source = await server.loadAccount(config.publicKey)

  const out: UnsignedTransaction[] = []
  let index = 0
  let cleanupIndex = 0
  for (const batch of batches) {
    const opCount = batch.reduce((n, u) => n + u.ops.length, 0)
    if (opCount === 0) continue
    const isCleanup = !batch.some((u) => u.isMerge || u.kind === "mediator-payment")
    if (isCleanup) cleanupIndex += 1
    const tx = buildUnsignedTransaction(source, batch, config, passphrase, timeout)
    out.push({
      index: index++,
      label: batchLabel(batch, cleanupIndex),
      opCount,
      requiresAdditionalSignatures: batch.some((u) => u.requiresAdditionalSignatures),
      xdr: tx.toXDR(),
    })
  }
  return out
}

export interface ExecuteCallbacks {
  onStepUpdate: (step: ExecutionStep) => void
}

export interface ExecuteResult {
  steps: ExecutionStep[]
  success: boolean
  recoveredTo: string
}

/**
 * Executes the demolition plan transaction-by-transaction. Each batch is
 * rebuilt from a freshly loaded account sequence, signed in memory, and
 * submitted. Execution stops on the first failure so nothing irreversible
 * runs after an error.
 */
export async function executeDemolition(
  batches: DemolitionUnit[][],
  config: DemolitionConfig,
  signers: SignerSet,
  network: NetworkId,
  callbacks: ExecuteCallbacks,
): Promise<ExecuteResult> {
  const server = getHorizonServer(network)
  const passphrase = getNetwork(network).networkPassphrase
  const steps: ExecutionStep[] = batches.map((batch, i) => ({
    id: `tx-${i}`,
    label: batch.some((u) => u.isMerge)
      ? `Account merge · stamped "${BLACKHOLE_MEMO}"`
      : batch.some((u) => u.kind === "mediator-payment")
        ? "Route balance through mediator"
        : `Cleanup transaction ${i + 1}`,
    status: "pending",
  }))

  const update = (i: number, patch: Partial<ExecutionStep>) => {
    steps[i] = { ...steps[i], ...patch }
    callbacks.onStepUpdate(steps[i])
  }

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    const opCount = batch.reduce((n, u) => n + u.ops.length, 0)
    if (opCount === 0) {
      update(i, { status: "skipped" })
      continue
    }

    try {
      update(i, { status: "signing" })

      // Fresh sequence number for every transaction.
      const source = await server.loadAccount(config.publicKey)
      const tx = buildUnsignedTransaction(source, batch, config, passphrase)

      const signed = await signTransaction(tx, signers, passphrase)

      update(i, { status: "submitting" })
      const res = await server.submitTransaction(signed)

      update(i, { status: "success", txHash: res.hash })
    } catch (err: any) {
      const resultCodes =
        err?.response?.data?.extras?.result_codes ?? err?.response?.extras?.result_codes
      const detail = resultCodes
        ? `${resultCodes.transaction ?? ""} ${(resultCodes.operations ?? []).join(", ")}`.trim()
        : err?.message ?? "Submission failed"
      update(i, { status: "failed", error: detail })
      return {
        steps,
        success: false,
        recoveredTo: config.useMediator && config.mediatorAddress ? config.mediatorAddress : config.destinationAddress,
      }
    }
  }

  return {
    steps,
    success: true,
    recoveredTo: config.useMediator && config.mediatorAddress ? config.mediatorAddress : config.destinationAddress,
  }
}
