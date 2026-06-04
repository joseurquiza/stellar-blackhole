import { getAdminSupabase } from "@/lib/supabase/admin"
import type { Agent, AgentAction, Task } from "./types"

/* ------------------------------- Agents -------------------------------- */

export async function listAgents(): Promise<Agent[]> {
  const db = getAdminSupabase()
  const { data, error } = await db
    .from("agents")
    .select("*")
    .order("created_at", { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapAgent)
}

export async function getAgent(agentId: string): Promise<Agent | null> {
  const db = getAdminSupabase()
  const { data, error } = await db.from("agents").select("*").eq("id", agentId).single()
  if (error || !data) return null
  return mapAgent(data)
}

export async function createAgent(input: {
  name: string
  description?: string
  systemPrompt?: string
  model?: string
}): Promise<Agent> {
  const db = getAdminSupabase()
  const { data, error } = await db
    .from("agents")
    .insert({
      name: input.name,
      description: input.description ?? null,
      system_prompt: input.systemPrompt ?? null,
      model: input.model ?? "openai/gpt-5-mini",
    })
    .select()
    .single()
  if (error) throw error
  return mapAgent(data)
}

export async function updateAgentStatus(agentId: string, status: string): Promise<void> {
  const db = getAdminSupabase()
  await db
    .from("agents")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", agentId)
}

export async function deleteAgent(agentId: string): Promise<void> {
  const db = getAdminSupabase()
  await db.from("agents").delete().eq("id", agentId)
}

/* -------------------------------- Tasks --------------------------------- */

export async function createTask(
  agentId: string,
  title: string,
  description?: string,
  priority = "medium",
): Promise<Task> {
  const db = getAdminSupabase()
  const { data, error } = await db
    .from("agent_tasks")
    .insert({
      agent_id: agentId,
      title,
      description: description ?? null,
      status: "pending",
      priority,
    })
    .select()
    .single()
  if (error) throw error
  return mapTask(data)
}

export async function getTask(taskId: string): Promise<Task | null> {
  const db = getAdminSupabase()
  const { data, error } = await db.from("agent_tasks").select("*").eq("id", taskId).single()
  if (error || !data) return null
  return mapTask(data)
}

export async function listTasks(agentId: string, status?: string): Promise<Task[]> {
  const db = getAdminSupabase()
  let query = db
    .from("agent_tasks")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
  if (status) query = query.eq("status", status)
  const { data, error } = await query
  if (error) return []
  return (data ?? []).map(mapTask)
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<Task | null> {
  const db = getAdminSupabase()
  const dbUpdates: Record<string, unknown> = {}
  if (updates.status !== undefined) dbUpdates.status = updates.status
  if (updates.result !== undefined) dbUpdates.result = updates.result
  if (updates.error !== undefined) dbUpdates.error = updates.error
  if (updates.startedAt !== undefined) dbUpdates.started_at = updates.startedAt
  if (updates.completedAt !== undefined) dbUpdates.completed_at = updates.completedAt
  const { data, error } = await db
    .from("agent_tasks")
    .update(dbUpdates)
    .eq("id", taskId)
    .select()
    .single()
  if (error || !data) return null
  return mapTask(data)
}

export async function deleteTask(taskId: string): Promise<void> {
  const db = getAdminSupabase()
  await db.from("agent_tasks").delete().eq("id", taskId)
}

/* ------------------------------- Memory --------------------------------- */

export async function getAllMemory(agentId: string): Promise<Record<string, unknown>> {
  const db = getAdminSupabase()
  const { data, error } = await db
    .from("agent_memory")
    .select("key, value")
    .eq("agent_id", agentId)
  if (error || !data) return {}
  return Object.fromEntries(data.map((m) => [m.key, m.value]))
}

export async function getMemory(agentId: string, key: string): Promise<unknown | null> {
  const db = getAdminSupabase()
  const { data, error } = await db
    .from("agent_memory")
    .select("value")
    .eq("agent_id", agentId)
    .eq("key", key)
    .single()
  if (error || !data) return null
  return data.value
}

export async function setMemory(agentId: string, key: string, value: unknown): Promise<void> {
  const db = getAdminSupabase()
  await db.from("agent_memory").upsert(
    {
      agent_id: agentId,
      key,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "agent_id,key" },
  )
}

export async function clearMemory(agentId: string): Promise<void> {
  const db = getAdminSupabase()
  await db.from("agent_memory").delete().eq("agent_id", agentId)
}

/* ------------------------------- Actions -------------------------------- */

export async function logAction(action: Omit<AgentAction, "id" | "createdAt">): Promise<void> {
  const db = getAdminSupabase()
  const { error } = await db.from("agent_actions").insert({
    agent_id: action.agentId,
    task_id: action.taskId ?? null,
    action_type: action.actionType,
    tool_name: action.toolName ?? null,
    input: action.input ?? null,
    output: action.output ?? null,
    reasoning: action.reasoning ?? null,
    duration_ms: action.durationMs ?? null,
  })
  if (error) console.error("[v0] logAction error:", error.message)
}

export async function getRecentActions(agentId: string, limit = 50): Promise<AgentAction[]> {
  const db = getAdminSupabase()
  const { data, error } = await db
    .from("agent_actions")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) return []
  return (data ?? []).map(mapAction).reverse()
}

export async function getTaskActions(taskId: string): Promise<AgentAction[]> {
  const db = getAdminSupabase()
  const { data, error } = await db
    .from("agent_actions")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true })
  if (error) return []
  return (data ?? []).map(mapAction)
}

/* ------------------------------- Mappers -------------------------------- */

function mapAgent(row: any): Agent {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    systemPrompt: row.system_prompt,
    model: row.model,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapTask(row: any): Task {
  return {
    id: row.id,
    agentId: row.agent_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    result: row.result,
    error: row.error,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  }
}

function mapAction(row: any): AgentAction {
  return {
    id: row.id,
    agentId: row.agent_id,
    taskId: row.task_id,
    actionType: row.action_type,
    toolName: row.tool_name,
    input: row.input,
    output: row.output,
    reasoning: row.reasoning,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
  }
}
