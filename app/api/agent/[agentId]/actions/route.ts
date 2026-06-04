import { NextRequest } from "next/server"
import { getAgent, getRecentActions, getTaskActions } from "@/lib/agent/storage"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params
  if (!(await getAgent(agentId))) {
    return Response.json({ error: "Agent not found" }, { status: 404 })
  }
  const taskId = request.nextUrl.searchParams.get("taskId")
  const limit = Number.parseInt(request.nextUrl.searchParams.get("limit") || "50", 10)
  const actions = taskId
    ? await getTaskActions(taskId)
    : await getRecentActions(agentId, limit)
  return Response.json({ actions })
}
