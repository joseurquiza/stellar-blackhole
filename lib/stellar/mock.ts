// Demo Mode execution helpers: the audit and plan are now built from the REAL
// account (read-only Horizon + path quoting), so only the destructive
// execution is simulated here — no signing and no network submission. This
// file just animates a believable signing → submitting → success run.

import type { DemolitionPlan, ExecutionStep } from "@/lib/stellar/types"

const DEMO_PUBLIC_KEY = "GDEMOACCOUNTBLACKHOLE7XSIMULATIONONLYDONOTSEND4242"

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
