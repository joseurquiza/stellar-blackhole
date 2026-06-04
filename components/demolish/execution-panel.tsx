"use client"

import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { CheckCircle2, XCircle, Circle, SkipForward, ExternalLink } from "lucide-react"
import { explorerTxUrl } from "@/lib/stellar/network"
import type { ExecutionStep, NetworkId } from "@/lib/stellar/types"

const STATUS_LABEL: Record<ExecutionStep["status"], string> = {
  pending: "Waiting",
  signing: "Signing",
  submitting: "Submitting",
  success: "Confirmed",
  failed: "Failed",
  skipped: "Skipped",
}

export function ExecutionPanel({ steps, network }: { steps: ExecutionStep[]; network: NetworkId }) {
  return (
    <ol className="space-y-2">
      {steps.map((step) => (
        <li key={step.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
          <div className="flex items-center gap-3">
            <StatusIcon status={step.status} />
            <div>
              <p className="text-sm font-medium">{step.label}</p>
              {step.error && <p className="text-xs text-destructive">{step.error}</p>}
              {step.txHash && (
                <a
                  href={explorerTxUrl(network, step.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {step.txHash.slice(0, 12)}… <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
          <Badge variant={badgeVariant(step.status)}>{STATUS_LABEL[step.status]}</Badge>
        </li>
      ))}
    </ol>
  )
}

function StatusIcon({ status }: { status: ExecutionStep["status"] }) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="h-5 w-5 text-primary" />
    case "failed":
      return <XCircle className="h-5 w-5 text-destructive" />
    case "skipped":
      return <SkipForward className="h-5 w-5 text-muted-foreground" />
    case "signing":
    case "submitting":
      return <Spinner className="h-5 w-5" />
    default:
      return <Circle className="h-5 w-5 text-muted-foreground" />
  }
}

function badgeVariant(status: ExecutionStep["status"]): "default" | "secondary" | "destructive" | "outline" {
  if (status === "success") return "secondary"
  if (status === "failed") return "destructive"
  if (status === "signing" || status === "submitting") return "default"
  return "outline"
}
