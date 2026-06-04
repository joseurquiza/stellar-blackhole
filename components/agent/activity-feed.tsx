"use client"

import { Brain, Wrench, CircleCheck, CircleX, ArrowDownToLine, Loader2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { AgentAction } from "@/lib/agent/types"

function iconFor(type: AgentAction["actionType"]) {
  switch (type) {
    case "think":
      return { Icon: Brain, color: "text-primary" }
    case "tool_call":
      return { Icon: Wrench, color: "text-amber-400" }
    case "tool_result":
      return { Icon: ArrowDownToLine, color: "text-sky-400" }
    case "complete":
      return { Icon: CircleCheck, color: "text-emerald-400" }
    case "error":
      return { Icon: CircleX, color: "text-destructive" }
    default:
      return { Icon: Brain, color: "text-muted-foreground" }
  }
}

function preview(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === "string") return value
  try {
    const str = JSON.stringify(value)
    return str === "{}" ? null : str
  } catch {
    return String(value)
  }
}

export function ActivityFeed({
  actions,
  running,
  emptyHint,
}: {
  actions: AgentAction[]
  running: boolean
  emptyHint: string
}) {
  if (actions.length === 0 && !running) {
    return (
      <div className="flex h-full min-h-40 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        {emptyHint}
      </div>
    )
  }

  return (
    <ScrollArea className="h-[clamp(20rem,calc(100vh-22rem),48rem)] pr-3">
      <ol className="relative space-y-4 py-1">
        {actions.map((action) => {
          const { Icon, color } = iconFor(action.actionType)
          const body = action.reasoning ?? preview(action.input ?? action.output)
          const label =
            action.actionType === "tool_call" || action.actionType === "tool_result"
              ? `${action.actionType === "tool_call" ? "Calling" : "Result from"} ${action.toolName ?? "tool"}`
              : action.actionType === "think"
                ? "Thinking"
                : action.actionType === "complete"
                  ? "Task complete"
                  : "Error"

          return (
            <li key={action.id} className="flex gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary">
                <Icon className={cn("h-4 w-4", color)} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-5">{label}</p>
                {body ? (
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                    {body}
                  </p>
                ) : null}
              </div>
            </li>
          )
        })}
        {running ? (
          <li className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary">
              <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
            </div>
            <span>Agent is working...</span>
          </li>
        ) : null}
      </ol>
    </ScrollArea>
  )
}
