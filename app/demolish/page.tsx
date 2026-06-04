"use client"

import { useState } from "react"
import { Skull, FlaskConical, ShieldCheck, Radio } from "lucide-react"
import { LiveWizard } from "@/components/demolish/live-wizard"
import { DemoModeSimulation } from "@/components/demolish/demo-mode"
import { DemolishFaq } from "@/components/demolish/demolish-faq"

export default function DemolishPage() {
  const [demoMode, setDemoMode] = useState(false)

  return (
    <main className="demolish-theme relative min-h-screen overflow-hidden bg-background">
      {/* supernova shockwave band: blue-white core bursting into amber */}
      <div
        className="h-1 w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, hsl(var(--nova-shock)) 20%, hsl(var(--nova-core)) 50%, hsl(var(--nova-shock)) 80%, transparent 100%)",
        }}
        aria-hidden
      />
      {/* radial supernova glow behind the header */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 -z-0 h-[420px] w-[680px] max-w-[120vw] -translate-x-1/2 opacity-60"
        style={{
          background:
            "radial-gradient(circle at 50% 30%, hsl(var(--nova-core) / 0.28) 0%, hsl(var(--primary) / 0.14) 30%, hsl(var(--nova-shock) / 0.10) 55%, transparent 72%)",
        }}
        aria-hidden
      />

      <div className="relative mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <header className="mb-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/30">
              <div
                className="absolute inset-0 rounded-xl blur-md"
                style={{ background: "radial-gradient(circle, hsl(var(--nova-core) / 0.5), transparent 70%)" }}
                aria-hidden
              />
              <Skull className="relative h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
                Stellar BlackHole
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground text-pretty">
                Non-custodial cleanup and account merge.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-pretty">
              Your secret keys are used only in this browser tab to sign transactions. They are never sent to any
              server.
            </span>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                {demoMode ? (
                  <FlaskConical className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Radio className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium leading-tight">
                  {demoMode ? "Demo Mode" : "Live Mode"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {demoMode
                    ? "Simulated walkthrough — no real network calls"
                    : "Signs and submits real transactions on Stellar"}
                </span>
              </div>
            </div>

            <div
              role="tablist"
              aria-label="Tool mode"
              className="inline-flex shrink-0 rounded-lg border bg-muted/50 p-0.5 text-xs font-medium"
            >
              <button
                type="button"
                role="tab"
                aria-selected={!demoMode}
                onClick={() => setDemoMode(false)}
                className={`rounded-md px-4 py-1.5 transition-colors ${
                  !demoMode
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Live
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={demoMode}
                onClick={() => setDemoMode(true)}
                className={`rounded-md px-4 py-1.5 transition-colors ${
                  demoMode
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Demo
              </button>
            </div>
          </div>
        </header>

        {demoMode ? <DemoModeSimulation /> : <LiveWizard />}

        <DemolishFaq />
      </div>
    </main>
  )
}
