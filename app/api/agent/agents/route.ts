import { NextRequest } from "next/server"
import { createAgent, listAgents } from "@/lib/agent/storage"

export async function GET() {
  try {
    const agents = await listAgents()
    return Response.json({ agents })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list agents"
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.name || typeof body.name !== "string") {
      return Response.json({ error: "Name is required" }, { status: 400 })
    }
    const agent = await createAgent({
      name: body.name,
      description: body.description,
      systemPrompt: body.systemPrompt,
      model: body.model,
    })
    return Response.json({ agent })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create agent"
    return Response.json({ error: message }, { status: 500 })
  }
}
