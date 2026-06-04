"use client"

import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ShieldAlert, AlertTriangle, ArrowRight, Flame } from "lucide-react"
import type { DemolitionPlan } from "@/lib/stellar/types"

export function PreviewPanel({ plan }: { plan: DemolitionPlan }) {
  const opCount = plan.transactions.reduce((n, t) => n + t.operations.length, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Metric label="Transactions" value={String(plan.transactions.length)} />
        <Metric label="Operations" value={String(opCount)} />
        <Metric label="Est. recovered XLM" value={plan.estimatedRecoveredXlm} accent />
      </div>

      {plan.blockers.length > 0 &&
        plan.blockers.map((b) => (
          <Alert variant="destructive" key={b.code}>
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>{b.title}</AlertTitle>
            <AlertDescription>{b.detail}</AlertDescription>
          </Alert>
        ))}

      {plan.warnings.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Review before continuing</AlertTitle>
          <AlertDescription>
            <ul className="ml-4 list-disc space-y-1">
              {plan.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Accordion type="multiple" className="w-full">
        {plan.transactions.map((tx, i) => (
          <AccordionItem value={`tx-${i}`} key={i}>
            <AccordionTrigger>
              <div className="flex flex-1 items-center justify-between pr-3">
                <span className="text-left font-medium">{tx.label}</span>
                <div className="flex items-center gap-2">
                  {tx.requiresAdditionalSignatures && <Badge variant="outline">multisig</Badge>}
                  <Badge variant="secondary">{tx.operations.length} ops</Badge>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ol className="space-y-2">
                {tx.operations.map((op, j) => (
                  <li key={j} className="rounded-md border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        {op.destructive ? (
                          <Flame className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                        ) : (
                          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{op.description}</p>
                          {op.details.map((d, k) => (
                            <p key={k} className="text-xs text-muted-foreground">
                              {d}
                            </p>
                          ))}
                        </div>
                      </div>
                      {op.reserveReclaimed > 0 && (
                        <Badge variant="secondary" className="shrink-0">
                          +{op.reserveReclaimed} XLM
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <Alert variant="destructive">
        <Flame className="h-4 w-4" />
        <AlertTitle>This plan permanently closes the account</AlertTitle>
        <AlertDescription>
          The final operation is an account merge. Once executed, the account ceases to exist and the action cannot be
          undone. Rehearse on Testnet first if you are unsure.
        </AlertDescription>
      </Alert>
    </div>
  )
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${accent ? "border-primary/40 bg-primary/5" : "bg-card"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-base font-semibold ${accent ? "text-primary" : ""}`}>{value}</p>
    </div>
  )
}
