"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Search,
  ArrowRight,
  ArrowLeft,
  Flame,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FlaskConical,
} from "lucide-react"
import { useDemolisher } from "./use-demolisher"
import { AuditDashboard } from "./audit-dashboard"
import { ConfigurePanel } from "./configure-panel"
import { PreviewPanel } from "./preview-panel"
import { SigningPanel } from "./signing-panel"
import { ExecutionPanel } from "./execution-panel"
import { explorerAccountUrl } from "@/lib/stellar/network"

const STAGES = ["connect", "audit", "configure", "preview", "execute", "result"] as const
const STAGE_LABELS: Record<(typeof STAGES)[number], string> = {
  connect: "Connect",
  audit: "Audit",
  configure: "Configure",
  preview: "Preview",
  execute: "Execute",
  result: "Result",
}

export function LiveWizard({ simulate = false }: { simulate?: boolean }) {
  const d = useDemolisher({ simulate })
  const { state } = d
  const [pubInput, setPubInput] = useState("")
  const [confirmText, setConfirmText] = useState("")

  const stageIndex = STAGES.indexOf(state.stage)
  const hasBlockers = (state.plan?.blockers.length ?? 0) > 0

  return (
    <div className="space-y-6">
      {simulate && (
        <div className="flex items-start gap-2.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-xs">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-pretty text-muted-foreground">
            <span className="font-medium text-foreground">Simulation.</span> This reads your real account from Horizon
            and builds the real demolition plan from those live balances. Only the final step is simulated — no key is
            ever requested, nothing is signed, and no transaction is broadcast.
          </p>
        </div>
      )}

      {/* progress */}
      <div>
        <div className="flex items-center gap-1.5">
          {STAGES.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                i < stageIndex ? "bg-primary" : i === stageIndex ? "bg-primary" : "bg-muted"
              }`}
              aria-hidden
            />
          ))}
        </div>
        <div className="mt-2 hidden justify-between sm:flex">
          {STAGES.map((s, i) => (
            <span
              key={s}
              className={`text-[11px] font-medium tracking-wide ${
                i === stageIndex ? "text-primary" : i < stageIndex ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {STAGE_LABELS[s]}
            </span>
          ))}
        </div>
        <p className="mt-2 text-center text-xs uppercase tracking-wide text-muted-foreground sm:hidden">
          Step {stageIndex + 1} of {STAGES.length}: {STAGE_LABELS[state.stage]}
        </p>
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* CONNECT */}
      {state.stage === "connect" && (
        <Card>
          <CardHeader>
            <CardTitle>Connect an account</CardTitle>
            <CardDescription>
              Choose a network, then paste the public key of the account you want to audit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Network</Label>
              <div className="grid grid-cols-2 gap-2">
                <NetworkButton
                  active={state.network === "testnet"}
                  onClick={() => d.setNetwork("testnet")}
                  title="Testnet"
                  subtitle="Rehearse safely"
                />
                <NetworkButton
                  active={state.network === "public"}
                  onClick={() => d.setNetwork("public")}
                  title="Public"
                  subtitle="Real mainnet funds"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pubkey">Account public key</Label>
              <div className="flex gap-2">
                <Input
                  id="pubkey"
                  placeholder="G..."
                  value={pubInput}
                  onChange={(e) => setPubInput(e.target.value.trim())}
                  className="font-mono text-sm"
                />
                <Button onClick={() => d.runAudit(pubInput)} disabled={state.loading || !pubInput}>
                  {state.loading ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                  <span className="ml-1 hidden sm:inline">Audit</span>
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {simulate
                ? "Paste the public key (starts with G) of the account you want to inspect. It's read live from Horizon — no secret key is ever needed in demo mode."
                : "Paste the account's public key (starts with G). You'll provide the secret key only at the signing step, right before execution."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* AUDIT */}
      {state.stage === "audit" && state.audit && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Account audit</CardTitle>
                <CardDescription className="font-mono text-xs">
                  {state.audit.publicKey.slice(0, 12)}…{state.audit.publicKey.slice(-6)}
                </CardDescription>
              </div>
              <Badge variant={state.network === "public" ? "destructive" : "secondary"}>{state.network}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <AuditDashboard audit={state.audit} />
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => d.setStage("connect")}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button onClick={() => d.setStage("configure")}>
                Configure demolition <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CONFIGURE */}
      {state.stage === "configure" && (
        <Card>
          <CardHeader>
            <CardTitle>Configure demolition</CardTitle>
            <CardDescription>Choose where funds go and which cleanup steps to include.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ConfigurePanel config={d.config} updateConfig={d.updateConfig} />
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => d.setStage("audit")}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button onClick={d.buildPlan} disabled={state.loading}>
                {state.loading ? <Spinner className="mr-1 h-4 w-4" /> : null}
                Build dry-run plan <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PREVIEW */}
      {state.stage === "preview" && state.plan && (
        <Card>
          <CardHeader>
            <CardTitle>Dry-run preview</CardTitle>
            <CardDescription>
              This is the exact ordered plan that will be signed and submitted. Nothing has been sent yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <PreviewPanel plan={state.plan} />

            <div className="rounded-lg border p-4">
              <h4 className="mb-3 text-sm font-semibold">Sign</h4>
              {simulate ? (
                <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-pretty">
                    In the live tool you would paste your secret key here to sign locally in this tab. In the
                    simulation, signing is skipped — just continue to watch the execution play out.
                  </p>
                </div>
              ) : (
                state.audit && (
                  <SigningPanel
                    audit={state.audit}
                    secretKeys={d.secretKeys}
                    setSecretKeys={d.setSecretKeys}
                    multisigWeight={d.multisigWeight}
                  />
                )
              )}
            </div>

            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => d.setStage("configure")}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={hasBlockers}>
                    <Flame className="mr-1 h-4 w-4" /> Demolish account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="demolish-theme bg-background">
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {simulate ? "Confirm the simulated demolition" : "This permanently destroys the account"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {simulate
                        ? "Nothing is broadcast — this just plays the execution animation so you can see the real flow."
                        : state.network === "public"
                          ? "You are on PUBLIC mainnet. Real funds will move and the account will be closed forever."
                          : "You are on Testnet. This rehearses the irreversible flow."}{" "}
                      Type <span className="font-mono font-semibold">DEMOLISH</span> to confirm.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="DEMOLISH"
                    className="font-mono"
                  />
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setConfirmText("")}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={confirmText !== "DEMOLISH"}
                      onClick={() => {
                        setConfirmText("")
                        d.execute()
                      }}
                    >
                      Execute demolition
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {hasBlockers && (
              <p className="text-center text-xs text-destructive">
                Resolve the blockers above before the account can be demolished.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* EXECUTE */}
      {state.stage === "execute" && (
        <Card>
          <CardHeader>
            <CardTitle>Executing demolition</CardTitle>
            <CardDescription>Signing and submitting each transaction in order. Do not close this tab.</CardDescription>
          </CardHeader>
          <CardContent>
            <ExecutionPanel steps={state.steps} network={state.network} />
          </CardContent>
        </Card>
      )}

      {/* RESULT */}
      {state.stage === "result" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {state.success ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-primary" /> Demolition complete
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-destructive" /> Demolition stopped
                </>
              )}
            </CardTitle>
            <CardDescription>
              {state.success
                ? `Remaining XLM was recovered to ${state.recoveredTo.slice(0, 10)}…${state.recoveredTo.slice(-6)}.`
                : "Execution halted on an error. No further transactions were sent. Review and retry."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ExecutionPanel steps={state.steps} network={state.network} />
            {state.success && state.recoveredTo && (
              <a
                href={explorerAccountUrl(state.network, state.recoveredTo)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View destination on explorer <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <Button variant="outline" onClick={d.reset}>
              <RotateCcw className="mr-1 h-4 w-4" /> Start over
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function NetworkButton({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean
  onClick: () => void
  title: string
  subtitle: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border p-3 text-left transition-colors ${
        active ? "border-primary bg-primary/5" : "hover:bg-muted/50"
      }`}
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </button>
  )
}
