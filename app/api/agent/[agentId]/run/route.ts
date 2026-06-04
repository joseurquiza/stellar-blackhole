import { NextRequest } from "next/server"
import { runAgentTask } from "@/lib/agent/brain"
import {
  getAgent,
  getTask,
  listTasks,
  updateAgentStatus,
  updateTask,
} from "@/lib/agent/storage"

export const maxDuration = 120

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { agentId } = await params
    const agent = await getAgent(agentId)
    if (!agent) {
      return Response.json({ error: "Agent not found" }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))

    let task = null
    if (body.taskId) {
      task = await getTask(body.taskId)
    } else {
      const pending = await listTasks(agentId, "pending")
      task = pending[pending.length - 1] ?? null
    }

    if (!task) {
      return Response.json({ message: "No pending tasks" }, { status: 200 })
    }

    // Reset a previously failed task so it can be retried.
    if (task.status === "failed") {
      await updateTask(task.id, {
        status: "pending",
        error: null,
        startedAt: null,
        completedAt: null,
      })
      task = await getTask(task.id)
      if (!task) {
        return Response.json({ error: "Task not found after reset" }, { status: 404 })
      }
    }

    await updateTask(task.id, { status: "running", startedAt: new Date().toISOString() })
    await updateAgentStatus(agentId, "running")

    const stepResult = await runAgentTask(agent, task)

    let finalStatus: "completed" | "failed"
    if (stepResult.completed && !stepResult.error) {
      await updateTask(task.id, {
        status: "completed",
        result: stepResult.result ?? null,
        completedAt: new Date().toISOString(),
      })
      finalStatus = "completed"
    } else {
      await updateTask(task.id, {
        status: "failed",
        error: stepResult.error ?? "Agent did not produce a result",
        completedAt: new Date().toISOString(),
      })
      finalStatus = "failed"
    }

    await updateAgentStatus(agentId, "idle")

    return Response.json({
      taskId: task.id,
      status: finalStatus,
      result: stepResult.result,
      error: stepResult.error,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run agent"
    console.error("[v0] /run route error:", message)
    return Response.json({ error: "Failed to run agent", details: message }, { status: 500 })
  }
}
