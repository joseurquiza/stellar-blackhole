"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import {
  Bot,
  Play,
  Loader2,
  Trash2,
  CircleCheck,
  CircleX,
  Clock,
  CircleDot,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { Agent, Task, AgentAction, TaskStatus } from "@/lib/agent/types"
import { CreateAgentDialog } from "./create-agent-dialog"
import { ActivityFeed } from "./activity-feed"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const STATUS_META: Record<TaskStatus, { label: string; className: string; Icon: typeof Clock }> = {
  pending: { label: "Pending", className: "text-muted-foreground", Icon: Clock },
  running: { label: "Running", className: "text-primary", Icon: CircleDot },
  completed: { label: "Completed", className: "text-emerald-400", Icon: CircleCheck },
  failed: { label: "Failed", className: "text-destructive", Icon: CircleX },
  paused: { label: "Paused", className: "text-muted-foreground", Icon: Clock },
}

export function AgentDashboard() {
  const {
    data: agentsData,
    error: agentsError,
    isLoading: agentsLoading,
    mutate: mutateAgents,
  } = useSWR<{ agents?: Agent[]; error?: string }>("/api/agent/agents", fetcher)

  const agents = agentsData?.agents ?? []
  const setupError = agentsData?.error || (agentsError ? "Could not reach the agent backend." : null)

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null)

  // Default-select the first agent once loaded.
  useEffect(() => {
    if (!selectedAgentId && agents.length > 0) {
      setSelectedAgentId(agents[0].id)
    }
  }, [agents, selectedAgentId])

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  )

  const tasksKey = selectedAgentId ? `/api/agent/${selectedAgentId}/tasks` : null
  const {
    data: tasksData,
    isLoading: tasksLoading,
    mutate: mutateTasks,
  } = useSWR<{ tasks?: Task[] }>(tasksKey, fetcher, {
    refreshInterval: runningTaskId ? 2000 : 0,
  })
  const tasks = tasksData?.tasks ?? []

  const actionsKey =
    selectedAgentId && selectedTaskId
      ? `/api/agent/${selectedAgentId}/actions?taskId=${selectedTaskId}`
      : null
  const { data: actionsData, mutate: mutateActions } = useSWR<{ actions?: AgentAction[] }>(
    actionsKey,
    fetcher,
    { refreshInterval: runningTaskId === selectedTaskId && runningTaskId ? 1500 : 0 },
  )
  const actions = actionsData?.actions ?? []

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  )

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [creatingTask, setCreatingTask] = useState(false)
  const [taskError, setTaskError] = useState<string | null>(null)

  async function createTask() {
    if (!selectedAgentId || !title.trim()) {
      setTaskError("Enter a task for the agent to work on.")
      return
    }
    setCreatingTask(true)
    setTaskError(null)
    try {
      const res = await fetch(`/api/agent/${selectedAgentId}/tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create task")
      setTitle("")
      setDescription("")
      await mutateTasks()
      // Auto-run the freshly created task.
      runTask(data.task.id)
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : "Failed to create task")
    } finally {
      setCreatingTask(false)
    }
  }

  async function runTask(taskId: string) {
    if (!selectedAgentId) return
    setSelectedTaskId(taskId)
    setRunningTaskId(taskId)
    try {
      const res = await fetch(`/api/agent/${selectedAgentId}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId }),
      })
      await res.json().catch(() => ({}))
    } catch {
      /* errors surface in task status/activity */
    } finally {
      setRunningTaskId(null)
      await Promise.all([mutateTasks(), mutateActions(), mutateAgents()])
    }
  }

  async function deleteTask(taskId: string) {
    if (!selectedAgentId) return
    await fetch(`/api/agent/${selectedAgentId}/tasks`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId }),
    })
    if (selectedTaskId === taskId) setSelectedTaskId(null)
    await mutateTasks()
  }

  /* ------------------------------ Render -------------------------------- */

  if (setupError) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <Card className="border-border bg-card p-8 text-center">
          <Bot className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-semibold">Agent backend not ready</h1>
          <p className="mx-auto mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
            {setupError} Make sure the Supabase agent tables have been created. If you just set this
            up, the database may still be initializing — try refreshing in a moment.
          </p>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm font-medium">Agent Workspace</span>
          </div>
          <h1 className="mt-1 text-pretty text-3xl font-bold tracking-tight">
            Autonomous AI agents
          </h1>
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
            Give an agent a task. It plans, calls real tools, and reports back — running on the
            Vercel AI Gateway.
          </p>
        </div>
        <CreateAgentDialog
          onCreated={async (agent) => {
            await mutateAgents()
            setSelectedAgentId(agent.id)
          }}
        />
      </div>

      {agentsLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading agents...
        </div>
      ) : agents.length === 0 ? (
        <Card className="border-dashed border-border bg-card p-10 text-center">
          <Bot className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold">No agents yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Create your first autonomous agent to start assigning tasks.
          </p>
          <div className="mt-5 flex justify-center">
            <CreateAgentDialog
              triggerLabel="Create your first agent"
              onCreated={async (agent) => {
                await mutateAgents()
                setSelectedAgentId(agent.id)
              }}
            />
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          {/* Agent list */}
          <aside className="flex flex-col gap-2">
            <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Agents
            </p>
            {agents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => {
                  setSelectedAgentId(agent.id)
                  setSelectedTaskId(null)
                }}
                className={cn(
                  "flex items-start gap-2 rounded-lg border p-3 text-left transition-colors",
                  agent.id === selectedAgentId
                    ? "border-primary/60 bg-accent"
                    : "border-border bg-card hover:bg-secondary",
                )}
              >
                <Bot className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{agent.name}</span>
                  {agent.description ? (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {agent.description}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </aside>

          {/* Main panel */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Tasks column */}
            <section className="flex flex-col gap-4">
              <Card className="border-border bg-card p-4">
                <h2 className="text-sm font-semibold">New task</h2>
                <div className="mt-3 space-y-3">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Summarize the latest Stellar network news"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        createTask()
                      }
                    }}
                  />
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional details or constraints..."
                    rows={2}
                  />
                  {taskError ? <p className="text-sm text-destructive">{taskError}</p> : null}
                  <Button
                    onClick={createTask}
                    disabled={creatingTask || !!runningTaskId}
                    className="w-full gap-1.5"
                  >
                    {creatingTask ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Assign &amp; run
                  </Button>
                </div>
              </Card>

              <div className="flex flex-col gap-2">
                <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Tasks
                </p>
                {tasksLoading ? (
                  <p className="px-1 text-sm text-muted-foreground">Loading tasks...</p>
                ) : tasks.length === 0 ? (
                  <p className="px-1 text-sm text-muted-foreground">
                    No tasks yet. Assign one above.
                  </p>
                ) : (
                  tasks.map((task) => {
                    const meta = STATUS_META[task.status]
                    const isRunning = runningTaskId === task.id || task.status === "running"
                    return (
                      <Card
                        key={task.id}
                        className={cn(
                          "cursor-pointer border-border bg-card p-3 transition-colors hover:bg-secondary",
                          selectedTaskId === task.id && "border-primary/60 bg-accent",
                        )}
                        onClick={() => setSelectedTaskId(task.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 flex-1 text-sm font-medium leading-5">
                            {task.title}
                          </p>
                          <div className="flex items-center gap-1">
                            {(task.status === "pending" || task.status === "failed") &&
                            !runningTaskId ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  runTask(task.id)
                                }}
                                aria-label="Run task"
                              >
                                <Play className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteTask(task.id)
                              }}
                              aria-label="Delete task"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-2">
                          <Badge
                            variant="secondary"
                            className={cn("gap-1 bg-secondary", meta.className)}
                          >
                            {isRunning ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <meta.Icon className="h-3 w-3" />
                            )}
                            {isRunning && task.status !== "running" ? "Running" : meta.label}
                          </Badge>
                        </div>
                      </Card>
                    )
                  })
                )}
              </div>
            </section>

            {/* Activity / result column */}
            <section className="flex flex-col">
              <Card className="flex flex-1 flex-col border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">
                    {selectedTask ? "Activity" : "Activity feed"}
                  </h2>
                  {selectedAgent ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      {selectedAgent.model}
                    </span>
                  ) : null}
                </div>

                {selectedTask?.result ? (
                  <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-emerald-400">
                      Result
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {selectedTask.result}
                    </p>
                  </div>
                ) : null}
                {selectedTask?.error ? (
                  <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-destructive">
                      Error
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {selectedTask.error}
                    </p>
                  </div>
                ) : null}

                <Separator className="my-3" />

                <ActivityFeed
                  actions={actions}
                  running={runningTaskId === selectedTaskId && !!runningTaskId}
                  emptyHint={
                    selectedTask
                      ? "No activity recorded for this task yet."
                      : "Select a task to see how the agent worked through it."
                  }
                />
              </Card>
            </section>
          </div>
        </div>
      )}
    </main>
  )
}
