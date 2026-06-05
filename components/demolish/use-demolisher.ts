"use client"

import { useCallback, useMemo, useState } from "react"
import { loadAccountAudit } from "@/lib/stellar/account"
import { buildDemolitionPlan, type DemolitionUnit } from "@/lib/stellar/plan"
import { createSignerSet, availableWeight, type SignerSet } from "@/lib/stellar/signing"
import { executeDemolition } from "@/lib/stellar/execute"
import { isValidPublicKey, isValidDestination } from "@/lib/stellar/analysis"
import { NATIVE_ASSET } from "@/lib/stellar/network"
import { buildMockSteps, runMockExecution } from "@/lib/stellar/mock"
import type {
  AccountAudit,
  DemolitionConfig,
  DemolitionPlan,
  ExecutionStep,
  NetworkId,
} from "@/lib/stellar/types"

export type WizardStage = "connect" | "audit" | "configure" | "preview" | "execute" | "result"

export interface DemolisherState {
  stage: WizardStage
  network: NetworkId
  publicKey: string
  audit: AccountAudit | null
  plan: DemolitionPlan | null
  batches: DemolitionUnit[][]
  steps: ExecutionStep[]
  loading: boolean
  error: string | null
  success: boolean | null
  recoveredTo: string
}

const DEFAULT_CONFIG: Omit<DemolitionConfig, "publicKey" | "network"> = {
  destinationAddress: "",
  useMediator: false,
  mediatorAddress: "",
  mediatorMemo: "",
  sellToBase: true,
  baseAsset: NATIVE_ASSET,
  slippageBps: 100,
  claimBalances: true,
  withdrawPools: true,
}

export function useDemolisher(options?: { simulate?: boolean }) {
  const simulate = options?.simulate ?? false
  const [network, setNetwork] = useState<NetworkId>("testnet")
  const [publicKey, setPublicKey] = useState("")
  const [stage, setStage] = useState<WizardStage>("connect")
  const [audit, setAudit] = useState<AccountAudit | null>(null)
  const [plan, setPlan] = useState<DemolitionPlan | null>(null)
  const [batches, setBatches] = useState<DemolitionUnit[][]>([])
  const [steps, setSteps] = useState<ExecutionStep[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<boolean | null>(null)
  const [recoveredTo, setRecoveredTo] = useState("")

  // configuration
  const [config, setConfig] = useState(DEFAULT_CONFIG)

  // signing material — secret keys held only in memory
  const [secretKeys, setSecretKeys] = useState<string[]>([""])

  const updateConfig = useCallback((patch: Partial<typeof DEFAULT_CONFIG>) => {
    setConfig((c) => ({ ...c, ...patch }))
  }, [])

  const reset = useCallback(() => {
    setStage("connect")
    setAudit(null)
    setPlan(null)
    setBatches([])
    setSteps([])
    setError(null)
    setSuccess(null)
    setRecoveredTo("")
    setSecretKeys([""])
    setConfig(DEFAULT_CONFIG)
  }, [])

  // ---- Run the on-chain audit ----
  const runAudit = useCallback(
    async (pk?: string) => {
      const target = (pk ?? publicKey).trim()

      // Demo mode reads the REAL account from Horizon — it only simulates the
      // destructive execution later. So the audit path is identical to live.
      if (!isValidPublicKey(target)) {
        setError("Enter a valid Stellar public key (starts with G).")
        return
      }
      setError(null)
      setLoading(true)
      try {
        const result = await loadAccountAudit(target, network)
        setAudit(result)
        setPublicKey(target)
        setConfig((c) => ({ ...c, destinationAddress: c.destinationAddress }))
        setStage("audit")
      } catch (err: any) {
        setError(err?.message ?? "Failed to load account from Horizon.")
      } finally {
        setLoading(false)
      }
    },
    [publicKey, network, simulate],
  )

  // ---- Build the dry-run plan ----
  const buildPlan = useCallback(async () => {
    if (!audit) return

    // Demo mode builds the REAL plan from the REAL audit (planning + path
    // quoting are read-only; nothing is signed or broadcast here).
    if (!isValidDestination(config.destinationAddress)) {
      setError("Enter a valid destination address for the final merge.")
      return
    }
    if (config.useMediator && !isValidDestination(config.mediatorAddress ?? "")) {
      setError("Enter a valid mediator address, or disable mediator routing.")
      return
    }
    setError(null)
    setLoading(true)
    try {
      const fullConfig: DemolitionConfig = { ...config, publicKey: audit.publicKey, network }
      const { plan: built, batches: built_batches } = await buildDemolitionPlan(audit, fullConfig)
      setPlan(built)
      setBatches(built_batches)
      setStage("preview")
    } catch (err: any) {
      setError(err?.message ?? "Failed to build demolition plan.")
    } finally {
      setLoading(false)
    }
  }, [audit, config, network, simulate])

  // ---- Execute the plan ----
  const execute = useCallback(async () => {
    if (!audit || !plan) return
    setError(null)

    if (simulate) {
      // No signing, no submission — animate a believable run.
      setStage("execute")
      setLoading(true)
      const initialSteps = buildMockSteps(plan)
      setSteps(initialSteps)
      const result = await runMockExecution(
        initialSteps,
        config.destinationAddress,
        (step) => setSteps((prev) => prev.map((s) => (s.id === step.id ? step : s))),
      )
      setSuccess(result.success)
      setRecoveredTo(result.recoveredTo)
      setLoading(false)
      setStage("result")
      return
    }

    let signers: SignerSet
    try {
      const keys = secretKeys.map((k) => k.trim()).filter(Boolean)
      if (keys.length === 0) {
        setError("Provide at least one secret key to sign.")
        return
      }
      signers = createSignerSet(keys)
    } catch (err: any) {
      setError(err?.message ?? "Invalid signing keys.")
      return
    }

    // multisig weight pre-check
    if (audit.isMultisig) {
      const weight = availableWeight(signers.publicKeys, audit.signers)
      if (weight < audit.thresholds.high) {
        setError(
          `Insufficient signing weight: have ${weight}, need ${audit.thresholds.high} (high threshold) for the merge. Add more signers.`,
        )
        return
      }
    }

    setStage("execute")
    setLoading(true)
    const fullConfig: DemolitionConfig = { ...config, publicKey: audit.publicKey, network }
    const initialSteps: ExecutionStep[] = batches.map((batch, i) => ({
      id: `tx-${i}`,
      label: batch.some((u) => u.isMerge) ? "Mediator + account merge" : `Cleanup transaction ${i + 1}`,
      status: "pending",
    }))
    setSteps(initialSteps)

    try {
      const result = await executeDemolition(batches, fullConfig, signers, network, {
        onStepUpdate: (step) => {
          setSteps((prev) => prev.map((s) => (s.id === step.id ? step : s)))
        },
      })
      setSuccess(result.success)
      setRecoveredTo(result.recoveredTo)
      setSteps(result.steps)
    } catch (err: any) {
      setSuccess(false)
      setError(err?.message ?? "Execution failed.")
    } finally {
      setLoading(false)
      setStage("result")
    }
  }, [audit, plan, batches, config, network, secretKeys, simulate])

  const multisigWeight = useMemo(() => {
    if (!audit) return 0
    const keys = secretKeys.map((k) => k.trim()).filter(Boolean)
    let pubs: string[] = []
    try {
      pubs = createSignerSet(keys).publicKeys
    } catch {
      pubs = []
    }
    return availableWeight(pubs, audit.signers)
  }, [audit, secretKeys])

  const state: DemolisherState = {
    stage,
    network,
    publicKey,
    audit,
    plan,
    batches,
    steps,
    loading,
    error,
    success,
    recoveredTo,
  }

  return {
    state,
    config,
    secretKeys,
    multisigWeight,
    setNetwork,
    setPublicKey,
    setStage,
    setSecretKeys,
    updateConfig,
    runAudit,
    buildPlan,
    execute,
    reset,
  }
}
