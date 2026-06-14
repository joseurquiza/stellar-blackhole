// Soroban execution pipeline (additive; only used when SOROBAN_SWEEP_ENABLED).
//
// Soroban transactions need a different flow than classic Horizon submission:
//   build (1 InvokeHostFunction op)
//     -> rpc.Server.prepareTransaction (simulate + assemble footprint/fees)
//     -> sign (full tx signing; single-account auth needs nothing more)
//     -> rpc.Server.sendTransaction
//     -> poll getTransaction until SUCCESS / FAILED / timeout
// Execution stops on the first failure so nothing irreversible runs after an
// error. Each unit is simulated during prepare, surfacing failures BEFORE the
// signature is applied.

import { TransactionBuilder, BASE_FEE, rpc } from "@stellar/stellar-sdk"
import { getNetwork } from "./network"
import { rpcServer, buildTransferOp, buildApproveZeroOp } from "./soroban"
import { getAdapter } from "./defiAdapters"
import { signTransaction, type SignerSet } from "./signing"
import type { DemolitionConfig, ExecutionStep, NetworkId, SorobanUnit } from "./types"

export interface SorobanExecuteCallbacks {
  onStepUpdate: (step: ExecutionStep) => void
}

export interface SorobanExecuteResult {
  steps: ExecutionStep[]
  success: boolean
}

const POLL_INTERVAL_MS = 2000
const MAX_POLLS = 30

/** Reconstruct the raw operation for a unit against the live source account. */
function opForUnit(unit: SorobanUnit, from: string) {
  switch (unit.build.op) {
    case "transfer":
      return buildTransferOp(unit.contractId, from, unit.build.destination ?? from, unit.build.rawAmount ?? "0")
    case "approve-zero":
      return buildApproveZeroOp(unit.contractId, from, unit.build.spender ?? from)
    case "adapter-invoke": {
      const adapter = unit.build.adapterId ? getAdapter(unit.build.adapterId) : undefined
      const builder = adapter && (adapter as any).buildOp
      if (typeof builder === "function") {
        return builder(unit, from) as ReturnType<typeof buildTransferOp>
      }
      throw new Error(`Adapter ${unit.build.adapterId ?? "?"} cannot build an on-chain op yet`)
    }
    default:
      throw new Error(`Unknown Soroban op: ${(unit.build as any).op}`)
  }
}

/**
 * Execute Soroban sweep units one transaction at a time. Returns success only
 * when every unit confirmed. Designed to run BEFORE the classic demolition.
 */
export async function executeSorobanUnits(
  units: SorobanUnit[],
  config: DemolitionConfig,
  signers: SignerSet,
  network: NetworkId,
  callbacks: SorobanExecuteCallbacks,
): Promise<SorobanExecuteResult> {
  const server = rpcServer(network)
  const passphrase = getNetwork(network).networkPassphrase
  const from = config.publicKey

  const steps: ExecutionStep[] = units.map((u, i) => ({
    id: `soroban-${i}`,
    label: `Soroban: ${u.description}`,
    status: "pending",
  }))

  const update = (i: number, patch: Partial<ExecutionStep>) => {
    steps[i] = { ...steps[i], ...patch }
    callbacks.onStepUpdate(steps[i])
  }

  for (let i = 0; i < units.length; i++) {
    const unit = units[i]
    try {
      update(i, { status: "signing" })

      const account = await server.getAccount(from)
      const op = opForUnit(unit, from)
      const raw = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: passphrase })
        .addOperation(op)
        .setTimeout(180)
        .build()

      // Simulate + assemble footprint and resource fees. Throws on sim error.
      const prepared = await server.prepareTransaction(raw)

      const signed = await signTransaction(prepared, signers, passphrase)

      update(i, { status: "submitting" })
      const sent = await server.sendTransaction(signed)

      if (sent.status === "ERROR") {
        throw new Error(`send failed: ${JSON.stringify(sent.errorResult ?? sent)}`)
      }

      // Poll for final status.
      let result = await server.getTransaction(sent.hash)
      let polls = 0
      while (result.status === rpc.Api.GetTransactionStatus.NOT_FOUND && polls < MAX_POLLS) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
        result = await server.getTransaction(sent.hash)
        polls++
      }

      if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        update(i, { status: "success", txHash: sent.hash })
      } else if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`transaction failed on-chain (${sent.hash})`)
      } else {
        throw new Error(`timed out waiting for confirmation (${sent.hash})`)
      }
    } catch (err: any) {
      update(i, { status: "failed", error: err?.message ?? "Soroban submission failed" })
      return { steps, success: false }
    }
  }

  return { steps, success: true }
}
