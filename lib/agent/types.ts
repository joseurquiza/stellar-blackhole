export type TaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "paused"

export type ActionType =
  | "think"
  | "tool_call"
  | "tool_result"
  | "complete"
  | "error"

export interface Agent {
  id: string
  name: string
  description?: string | null
  systemPrompt?: string | null
  model: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  agentId: string
  title: string
  description?: string | null
  status: TaskStatus
  priority: string
  result?: string | null
  error?: string | null
  createdAt: string
  startedAt?: string | null
  completedAt?: string | null
}

export interface AgentAction {
  id: string
  agentId: string
  taskId?: string | null
  actionType: ActionType
  toolName?: string | null
  input?: unknown
  output?: unknown
  reasoning?: string | null
  durationMs?: number | null
  createdAt: string
}

export interface AgentContext {
  task: Task
  agent: Agent
  memory: Record<string, unknown>
  knowledgeBase: Array<{ title: string; result: string; completedAt?: string | null }>
}
