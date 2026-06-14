"use client"

import { useCallback, useMemo, useState } from "react"
import { loadAccountAudit } from "@/lib/stellar/account"
import { buildDemolitionPlan, type DemolitionUnit } from "@/lib/stellar/plan"
import { createSignerSet, availableWeight, type SignerSet } from "@/lib/stellar/signing"
import { executeDemolition } from "@/lib/stellar/execute"
import { executeSorobanUnits } from "@/lib/stellar/soroban-execute"
import { isValidPublicKey, isValidDestination } from "@/lib/stellar/analysis"
import { NATIVE_ASSET } from "@/lib/stellar/network"
import { buildMockSteps, runMockExecution } from "@/lib/stellar/mock"
import { SOROBAN_SWEEP_ENABLED, SOROBAN_REHEARSED_KEY } from "@/lib/stellar/flags"
import type {
  AccountAudit,
  DemolitionConfig,
  DemolitionPlan,
  ExecutionStep,
  NetworkId,
  SorobanUnit,
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
  // Soroban sweep (additive; only meaningful when the feature flag is on)
  sorobanEnabled: boolean
  sorobanUnits: SorobanUnit[]
  rehearsed: boolean
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
  // Soroban sweep defaults on WHEN the feature is enabled; when the flag is off
  // this field is ignored by the planner so the classic flow is unchanged.
  sweepSoroban: SOROBAN_SWEEP_ENABLED,
  rehearsalConfirmed: false,
}

export function useDemolisher(options?: { simulate?: boolean }) {
  const simulate = options?.simulate ?? false
  const [network, setNetwork] = useState<NetworkId>("public")
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
  // Soroban sweep units planned for the current account (flag-gated; stays [])
  const [sorobanUnits, setSorobanUnits] = useState<SorobanUnit[]>([])

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
    setSorobanUnits([])
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

      // Simulate mode reads the REAL account from Horizon — it only simulates
      // the destructive execution later. So the audit path is identical to live.
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

    // Simulate mode builds the REAL plan from the REAL audit (planning + path
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
      const { plan: built, batches: built_batches, sorobanUnits: built_soroban } =
        await buildDemolitionPlan(audit, fullConfig)
      setPlan(built)
      setBatches(built_batches)
      setSorobanUnits(built_soroban)
      // The testnet-rehearsal gate is tied to a specific plan; rebuilding the
      // plan invalidates any prior rehearsal so mainnet must be re-rehearsed.
      if (SOROBAN_SWEEP_ENABLED && typeof window !== "undefined") {
        window.localStorage.removeItem(SOROBAN_REHEARSED_KEY)
      }
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
      // No signing, no submission — animate a believable run. The mock steps
      // are derived from plan.transactions, which already includes the Soroban
      // group when the feature is on, so the rehearsal exercises the same shape.
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
      // A successful Simulate run that included Soroban units satisfies the
      // mainnet rehearsal gate for the current plan.
      if (SOROBAN_SWEEP_ENABLED && result.success && sorobanUnits.length > 0 && typeof window !== "undefined") {
        window.localStorage.setItem(SOROBAN_REHEARSED_KEY, "1")
      }
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

    // Soroban-sweep mainnet gate: contract writes are irreversible value moves,
    // so on public network we require a successful Simulate/testnet rehearsal of
    // the current plan before allowing them.
    const runSoroban = SOROBAN_SWEEP_ENABLED && sorobanUnits.length > 0
    if (runSoroban && network === "public") {
      const rehearsed =
        typeof window !== "undefined" && window.localStorage.getItem(SOROBAN_REHEARSED_KEY) === "1"
      if (!rehearsed) {
        setError(
          "Rehearse this Soroban sweep in Simulate (or on testnet) before running it on mainnet. Run a Simulate pass of this exact plan first.",
        )
        return
      }
    }

    setStage("execute")
    setLoading(true)
    let fullConfig: DemolitionConfig = { ...config, publicKey: audit.publicKey, network }

    // Soroban steps (if any) are shown first, followed by the classic batches.
    const sorobanInitial: ExecutionStep[] = runSoroban
      ? sorobanUnits.map((u, i) => ({ id: `soroban-${i}`, label: `Soroban: ${u.description}`, status: "pending" }))
      : []
    const classicInitial: ExecutionStep[] = batches.map((batch, i) => ({
      id: `tx-${i}`,
      label: batch.some((u) => u.isMerge) ? "Mediator + account merge" : `Cleanup transaction ${i + 1}`,
      status: "pending",
    }))
    setSteps([...sorobanInitial, ...classicInitial])

    try {
      // Phase 1: Soroban sweep (withdraw positions, transfer tokens, revoke
      // allowances). Runs before classic cleanup so recovered value lands in the
      // account and is then handled by the classic plan.
      if (runSoroban) {
        const sorobanResult = await executeSorobanUnits(sorobanUnits, fullConfig, signers, network, {
          onStepUpdate: (step) => setSteps((prev) => prev.map((s) => (s.id === step.id ? step : s))),
        })
        if (!sorobanResult.success) {
          setSuccess(false)
          setError("Soroban sweep failed before the classic cleanup; nothing irreversible ran. Resolve and retry.")
          setLoading(false)
          setStage("result")
          return
        }
        // Phase 2: re-audit — Soroban withdrawals can deposit classic assets
        // back (e.g. a Blend withdraw returns USDC), changing balances the
        // classic plan was built from. Rebuild it from fresh state.
        const freshAudit = await loadAccountAudit(audit.publicKey, network)
        setAudit(freshAudit)
        const rebuilt = await buildDemolitionPlan(freshAudit, fullConfig)
        setBatches(rebuilt.batches)
        setPlan(rebuilt.plan)
        fullConfig = { ...fullConfig }
        // refresh the classic step labels to match the rebuilt batches
        setSteps((prev) => [
          ...prev.filter((s) => s.id.startsWith("soroban-")),
          ...rebuilt.batches.map((batch, i) => ({
            id: `tx-${i}`,
            label: batch.some((u) => u.isMerge) ? "Mediator + account merge" : `Cleanup transaction ${i + 1}`,
            status: "pending" as const,
          })),
        ])

        const result = await executeDemolition(rebuilt.batches, fullConfig, signers, network, {
          onStepUpdate: (step) => setSteps((prev) => prev.map((s) => (s.id === step.id ? step : s))),
        })
        setSuccess(result.success)
        setRecoveredTo(result.recoveredTo)
        setSteps((prev) => [...prev.filter((s) => s.id.startsWith("soroban-")), ...result.steps])
        return
      }

      // No Soroban phase — classic flow exactly as before.
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
  }, [audit, plan, batches, sorobanUnits, config, network, secretKeys, simulate])

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
    sorobanEnabled: SOROBAN_SWEEP_ENABLED,
    sorobanUnits,
    rehearsed:
      typeof window !== "undefined" && window.localStorage.getItem(SOROBAN_REHEARSED_KEY) === "1",
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
