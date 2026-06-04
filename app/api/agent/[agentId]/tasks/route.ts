import { NextRequest } from "next/server"
import {
  createTask,
  deleteTask,
  getAgent,
  listTasks,
  updateTask,
} from "@/lib/agent/storage"

async function ensureAgent(agentId: string) {
  const agent = await getAgent(agentId)
  return agent
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params
  if (!(await ensureAgent(agentId))) {
    return Response.json({ error: "Agent not found" }, { status: 404 })
  }
  const status = request.nextUrl.searchParams.get("status") || undefined
  const tasks = await listTasks(agentId, status)
  return Response.json({ tasks })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { agentId } = await params
    if (!(await ensureAgent(agentId))) {
      return Response.json({ error: "Agent not found" }, { status: 404 })
    }
    const body = await request.json()
    if (!body.title) {
      return Response.json({ error: "Title is required" }, { status: 400 })
    }
    const task = await createTask(agentId, body.title, body.description, body.priority)
    return Response.json({ task })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create task"
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params
  if (!(await ensureAgent(agentId))) {
    return Response.json({ error: "Agent not found" }, { status: 404 })
  }
  const body = await request.json()
  if (!body.taskId) {
    return Response.json({ error: "Task ID is required" }, { status: 400 })
  }
  const task = await updateTask(body.taskId, {
    status: body.status,
    result: body.result,
    error: body.error,
  })
  return Response.json({ task })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params
  if (!(await ensureAgent(agentId))) {
    return Response.json({ error: "Agent not found" }, { status: 404 })
  }
  const body = await request.json()
  if (!body.taskId) {
    return Response.json({ error: "Task ID is required" }, { status: 400 })
  }
  await deleteTask(body.taskId)
  return Response.json({ success: true })
}
