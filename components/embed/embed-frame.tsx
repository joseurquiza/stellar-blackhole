"use client"

import { useCallback, useEffect, useRef } from "react"
import { Orbit, ShieldCheck } from "lucide-react"
import { LiveWizard } from "@/components/demolish/live-wizard"

/**
 * Slim, chrome-free host for the demolition wizard, designed to run inside a
 * partner platform's iframe. It:
 *  - reports its content height to the parent so the iframe can auto-resize
 *  - emits lifecycle events (ready / stage / complete) via postMessage
 *
 * It stays fully non-custodial: the end user's Stellar key is entered and
 * signed here, on the BlackHole origin, and is never exposed to the host page.
 */
export function EmbedFrame() {
  const rootRef = useRef<HTMLDivElement>(null)

  const post = useCallback((message: Record<string, unknown>) => {
    // Parent origin is unknown (any partner site), so we broadcast to "*". No
    // sensitive data is ever included in these messages — only layout + status.
    window.parent?.postMessage({ source: "blackhole", ...message }, "*")
  }, [])

  useEffect(() => {
    post({ type: "ready" })

    const el = rootRef.current
    if (!el) return
    const report = () => post({ type: "resize", height: Math.ceil(el.getBoundingClientRect().height) })
    report()

    const ro = new ResizeObserver(report)
    ro.observe(el)
    return () => ro.disconnect()
  }, [post])

  return (
    <div ref={rootRef} className="mx-auto w-full max-w-2xl px-4 py-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/30">
            <Orbit className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Stellar BlackHole</p>
            <p className="text-xs text-muted-foreground">Non-custodial account cleanup &amp; merge</p>
          </div>
        </div>
      </header>

      <LiveWizard
        onStageChange={(stage) => {
          post({ type: "stage", stage })
          if (stage === "result") post({ type: "complete" })
        }}
      />

      <footer className="mt-6 flex items-center justify-center gap-1.5 border-t border-border pt-4 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
        <span>Keys are used only in this frame to sign. They never reach any server.</span>
      </footer>
    </div>
  )
}
