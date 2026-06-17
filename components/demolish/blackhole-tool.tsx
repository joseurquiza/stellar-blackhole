"use client"

import { useState } from "react"
import { Orbit, FlaskConical, ShieldCheck, Radio, Wrench, AlertTriangle, Activity, Search, HelpCircle } from "lucide-react"
import { LiveWizard } from "@/components/demolish/live-wizard"
import { DemoModeSimulation } from "@/components/demolish/demo-mode"
import { DemolishFaq } from "@/components/demolish/demolish-faq"
import { ThemeToggle } from "@/components/theme-toggle"

type ToolMode = "live" | "simulate" | "toolkit" | "faq"
type ToolkitTool = "sandbox" | "live"

const MODE_META: Record<
  ToolMode,
  {
    label: string
    description: string
    badge: string
    /** classes for the status bar + framing accent */
    iconWrap: string
    icon: string
    statusBar: string
    badgeClass: string
    frame: string
    banner: { wrap: string; text: string } | null
  }
> = {
  live: {
    label: "Live Mode",
    description: "Signs and submits real transactions on Stellar",
    badge: "LIVE",
    iconWrap: "bg-destructive/15 ring-1 ring-destructive/40",
    icon: "text-destructive",
    statusBar: "border-destructive/40 bg-destructive/5",
    badgeClass: "bg-destructive text-destructive-foreground",
    frame: "rounded-xl border-2 border-destructive/50 bg-destructive/[0.03] p-4 shadow-[0_0_0_1px_hsl(var(--destructive)/0.1)] sm:p-6",
    banner: {
      wrap: "border-destructive/40 bg-destructive/10",
      text: "Live mode — real keys sign real transactions and funds move irreversibly on Stellar.",
    },
  },
  simulate: {
    label: "Simulate Mode",
    description: "Reads your real account, simulates the demolish — nothing signed or broadcast",
    badge: "SIMULATE",
    iconWrap: "bg-muted ring-1 ring-border",
    icon: "text-muted-foreground",
    statusBar: "border-border bg-muted/40",
    badgeClass: "bg-muted-foreground/15 text-muted-foreground",
    frame: "rounded-xl border-2 border-dashed border-border bg-muted/20 p-4 sm:p-6",
    banner: {
      wrap: "border-border bg-muted/40",
      text: "Simulate mode — real account read live from Horizon; only the destructive execution is simulated, never signed or broadcast.",
    },
  },
  toolkit: {
    label: "Toolkit",
    description: "Sandbox scenarios and a read-only account explorer",
    badge: "TOOLKIT",
    iconWrap: "bg-muted ring-1 ring-border",
    icon: "text-muted-foreground",
    statusBar: "border-border bg-muted/40",
    badgeClass: "bg-muted-foreground/15 text-muted-foreground",
    frame: "",
    banner: null,
  },
  faq: {
    label: "FAQ",
    description: "Answers to common questions about closing and merging Stellar accounts",
    badge: "HELP",
    iconWrap: "bg-primary/10 ring-1 ring-primary/30",
    icon: "text-primary",
    statusBar: "border-border bg-muted/40",
    badgeClass: "bg-muted-foreground/15 text-muted-foreground",
    frame: "",
    banner: null,
  },
}

export function BlackholeTool() {
  const [mode, setMode] = useState<ToolMode>("live")
  const [toolkitTool, setToolkitTool] = useState<ToolkitTool>("live")

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

      <div className="relative flex w-full flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14 lg:flex-row lg:gap-8 lg:px-10 xl:px-16 2xl:px-24">
        {/* ===================== LEFT SIDEBAR ===================== */}
        <aside className="lg:sticky lg:top-10 lg:h-fit lg:w-64 lg:shrink-0">
          <div className="flex items-center gap-3 px-1 pb-5">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/30">
              <div
                className="absolute inset-0 rounded-xl blur-md"
                style={{ background: "radial-gradient(circle, hsl(var(--nova-core) / 0.5), transparent 70%)" }}
                aria-hidden
              />
              <Orbit className="relative h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight">Stellar BlackHole</h1>
              <p className="truncate text-xs text-muted-foreground">Non-custodial account demolition</p>
            </div>
          </div>

          <nav aria-label="Tool mode" className="space-y-1">
            {(["live", "simulate", "toolkit", "faq"] as ToolMode[]).map((m) => {
              const active = mode === m
              const Icon =
                m === "live" ? Radio : m === "simulate" ? FlaskConical : m === "toolkit" ? Wrench : HelpCircle
              return (
                <div key={m}>
                  <button
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMode(m)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? m === "live"
                          ? "bg-destructive/10 text-destructive ring-1 ring-destructive/30"
                          : "bg-foreground/5 text-foreground ring-1 ring-border"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">{MODE_META[m].label}</span>
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wider ${MODE_META[m].badgeClass}`}
                    >
                      {MODE_META[m].badge}
                    </span>
                  </button>

                  {/* Toolkit submenu: each available tool */}
                  {m === "toolkit" && mode === "toolkit" && (
                    <ul className="mt-1 space-y-0.5 border-l border-border pl-3 ml-4">
                      {(
                        [
                          { id: "sandbox" as ToolkitTool, label: "Simulation Sandbox", icon: Activity },
                          { id: "live" as ToolkitTool, label: "Account Explorer", icon: Search },
                        ]
                      ).map((tool) => {
                        const toolActive = toolkitTool === tool.id
                        const ToolIcon = tool.icon
                        return (
                          <li key={tool.id}>
                            <button
                              type="button"
                              aria-current={toolActive ? "page" : undefined}
                              onClick={() => setToolkitTool(tool.id)}
                              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                                toolActive
                                  ? "bg-muted font-medium text-foreground"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <ToolIcon className="h-3.5 w-3.5 shrink-0" />
                              <span className="text-left">{tool.label}</span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })}
          </nav>

          <div className="mt-5 flex items-center justify-between gap-2 border-t border-border px-1 pt-4">
            <span className="text-xs text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>
        </aside>

        {/* ===================== MAIN CONTENT ===================== */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-muted-foreground mb-5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-pretty">
              Your secret keys are used only in this browser tab to sign transactions. They are never sent to any
              server.
            </span>
          </div>

          <div
            className={`mb-6 flex flex-col gap-3 rounded-xl border p-3 shadow-sm transition-colors sm:flex-row sm:items-center sm:justify-between ${MODE_META[mode].statusBar}`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${MODE_META[mode].iconWrap}`}>
                {mode === "live" ? (
                  <Radio className={`h-4 w-4 ${MODE_META[mode].icon}`} />
                ) : mode === "simulate" ? (
                  <FlaskConical className={`h-4 w-4 ${MODE_META[mode].icon}`} />
                ) : mode === "toolkit" ? (
                  <Wrench className={`h-4 w-4 ${MODE_META[mode].icon}`} />
                ) : (
                  <HelpCircle className={`h-4 w-4 ${MODE_META[mode].icon}`} />
                )}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium leading-tight">{MODE_META[mode].label}</span>
                  <span
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wider ${MODE_META[mode].badgeClass}`}
                  >
                    {MODE_META[mode].badge}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{MODE_META[mode].description}</span>
              </div>
            </div>
          </div>

          {mode === "toolkit" ? (
            <DemoModeSimulation explorerMode={toolkitTool} onExplorerModeChange={setToolkitTool} hideModeToggle />
          ) : mode === "faq" ? (
            <DemolishFaq embedded />
          ) : (
            <div className={MODE_META[mode].frame}>
              {MODE_META[mode].banner && (
                <div
                  className={`mb-4 flex items-center gap-2.5 rounded-lg border px-3 py-2.5 ${MODE_META[mode].banner!.wrap}`}
                >
                  {mode === "live" ? (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                  ) : (
                    <FlaskConical className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <p
                    className={`text-xs font-medium text-pretty ${
                      mode === "live" ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {MODE_META[mode].banner!.text}
                  </p>
                </div>
              )}
              <LiveWizard simulate={mode === "simulate"} />
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
