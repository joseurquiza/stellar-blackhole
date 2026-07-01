import { TransactionBuilder, Memo } from "@stellar/stellar-sdk"
import { getHorizonServer } from "./account"
import { getNetwork } from "./network"
import { signTransaction, type SignerSet } from "./signing"
import type { DemolitionConfig, ExecutionStep, NetworkId } from "./types"
import { BLACKHOLE_MEMO, type DemolitionUnit } from "./plan"

// 0.001 XLM per operation — comfortably above base fee to survive mild surge.
const FEE_PER_OP = "10000"

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
      const fee = (Number.parseInt(FEE_PER_OP, 10) * opCount).toString()

      let builder = new TransactionBuilder(source, { fee, networkPassphrase: passphrase })
      for (const unit of batch) {
        for (const op of unit.ops) builder = builder.addOperation(op)
      }
      // Attach mediator memo on the routing transaction when provided, and
      // stamp the standalone merge transaction with the BlackHole attribution.
      if (config.useMediator && config.mediatorMemo && batch.some((u) => u.kind === "mediator-payment")) {
        builder = builder.addMemo(Memo.text(config.mediatorMemo.slice(0, 28)))
      } else if (batch.some((u) => u.isMerge)) {
        builder = builder.addMemo(Memo.text(BLACKHOLE_MEMO))
      }
      const tx = builder.setTimeout(180).build()

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
