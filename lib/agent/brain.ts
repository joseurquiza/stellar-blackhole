import { generateText, tool, stepCountIs, hasToolCall } from "ai"
import { z } from "zod"
import {
  getAllMemory,
  setMemory,
  getMemory,
  listTasks,
  logAction,
} from "./storage"
import type { Agent, Task } from "./types"

const DEFAULT_SYSTEM_PROMPT = `You are an autonomous AI agent. You work independently to complete the task assigned by your human operator.

## How you work
- Think step by step about how to accomplish the task.
- Use the available tools to gather real information instead of guessing. Prefer fetch_url for live web content and calculate for any arithmetic.
- Use remember / recall to persist useful facts across tasks.
- When you have a final answer, you MUST call complete_task with a clear, well-structured result.
- If the task genuinely cannot be done, call fail_task with the reason.

## Rules
- NEVER claim to have done something without actually using the matching tool.
- Be thorough but efficient. Do not repeat identical tool calls.
- Always finish by calling complete_task or fail_task.`

/** Builds the system prompt with memory + knowledge base context. */
function buildSystemPrompt(agent: Agent, task: Task, memory: Record<string, unknown>, knowledge: string): string {
  const base = agent.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT
  const memorySection =
    Object.keys(memory).length > 0
      ? `\n\n## Your Memory\n${JSON.stringify(memory, null, 2)}`
      : ""
  const knowledgeSection = knowledge ? `\n\n## Knowledge from Completed Tasks\n${knowledge}` : ""
  return `${base}\n\n## Current Task\nTitle: ${task.title}${
    task.description ? `\nDescription: ${task.description}` : ""
  }${memorySection}${knowledgeSection}`
}

function safeCalculate(expression: string): number {
  if (!/^[\d\s+\-*/().%]+$/.test(expression)) {
    throw new Error("Expression contains invalid characters. Only numbers and + - * / % ( ) are allowed.")
  }
  // eslint-disable-next-line no-new-func
  const result = Function(`"use strict"; return (${expression})`)()
  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error("Expression did not evaluate to a finite number.")
  }
  return result
}

async function fetchUrlText(url: string): Promise<string> {
  if (!/^https?:\/\//i.test(url)) throw new Error("Only http(s) URLs are supported.")
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "ActionTokensAgent/1.0" },
    })
    const raw = await res.text()
    const text = raw
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    return text.slice(0, 4000)
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Runs the autonomous agent loop for a single task using the AI SDK + Vercel
 * AI Gateway. Logs every reasoning step, tool call and tool result to the
 * agent_actions table so the dashboard can render a live activity feed.
 */
export async function runAgentTask(
  agent: Agent,
  task: Task,
): Promise<{ completed: boolean; result?: string; error?: string }> {
  const start = Date.now()
  const memory = await getAllMemory(agent.id)

  let completedTasks: Task[] = []
  try {
    completedTasks = await listTasks(agent.id, "completed")
  } catch {
    completedTasks = []
  }
  const knowledge = completedTasks
    .filter((t) => t.result && t.result.length > 20 && t.id !== task.id)
    .slice(0, 8)
    .map((t) => `- ${t.title}: ${t.result}`)
    .join("\n")

  const outcome: { type: "complete" | "fail" | null; text?: string } = { type: null }

  const tools = {
    fetch_url: tool({
      description: "Fetch the text content of a public web page (http/https) to gather live information.",
      inputSchema: z.object({ url: z.string().describe("The full http(s) URL to fetch.") }),
      execute: async ({ url }) => {
        const text = await fetchUrlText(url)
        return { url, content: text }
      },
    }),
    calculate: tool({
      description: "Evaluate a basic arithmetic expression (numbers and + - * / % parentheses).",
      inputSchema: z.object({ expression: z.string().describe("e.g. (1200 * 0.07) + 35") }),
      execute: async ({ expression }) => ({ expression, result: safeCalculate(expression) }),
    }),
    get_current_time: tool({
      description: "Get the current date and time in ISO 8601 (UTC).",
      inputSchema: z.object({}),
      execute: async () => ({ now: new Date().toISOString() }),
    }),
    remember: tool({
      description: "Store a fact in long-term memory for future tasks.",
      inputSchema: z.object({
        key: z.string().describe("A short unique key."),
        value: z.string().describe("The information to remember."),
      }),
      execute: async ({ key, value }) => {
        await setMemory(agent.id, key, value)
        return { saved: true, key }
      },
    }),
    recall: tool({
      description: "Retrieve a previously stored memory value by key.",
      inputSchema: z.object({ key: z.string() }),
      execute: async ({ key }) => ({ key, value: await getMemory(agent.id, key) }),
    }),
    complete_task: tool({
      description: "Mark the current task as completed with the final result. Call this when you are done.",
      inputSchema: z.object({ result: z.string().describe("The final result or answer.") }),
      execute: async ({ result }) => {
        outcome.type = "complete"
        outcome.text = result
        return { acknowledged: true }
      },
    }),
    fail_task: tool({
      description: "Mark the current task as failed when it cannot be completed.",
      inputSchema: z.object({ error: z.string().describe("Why the task could not be completed.") }),
      execute: async ({ error }) => {
        outcome.type = "fail"
        outcome.text = error
        return { acknowledged: true }
      },
    }),
  }

  const system = buildSystemPrompt(agent, task, memory, knowledge)

  try {
    const { text } = await generateText({
      model: agent.model || "openai/gpt-5-mini",
      system,
      prompt:
        "Work on completing your assigned task. Use tools to gather any information you need, then call complete_task with your final answer.",
      tools,
      stopWhen: [stepCountIs(12), hasToolCall("complete_task"), hasToolCall("fail_task")],
      onStepFinish: async (step) => {
        const elapsed = Date.now() - start
        if (step.text && step.text.trim()) {
          await logAction({
            agentId: agent.id,
            taskId: task.id,
            actionType: "think",
            reasoning: step.text.trim(),
            durationMs: elapsed,
          })
        }
        for (const call of step.toolCalls ?? []) {
          await logAction({
            agentId: agent.id,
            taskId: task.id,
            actionType: "tool_call",
            toolName: call.toolName,
            input: call.input,
            durationMs: elapsed,
          })
        }
        for (const result of step.toolResults ?? []) {
          await logAction({
            agentId: agent.id,
            taskId: task.id,
            actionType: "tool_result",
            toolName: result.toolName,
            output: result.output,
            durationMs: elapsed,
          })
        }
      },
    })

    if (outcome.type === "complete") {
      await logAction({
        agentId: agent.id,
        taskId: task.id,
        actionType: "complete",
        output: { result: outcome.text },
        durationMs: Date.now() - start,
      })
      return { completed: true, result: outcome.text }
    }

    if (outcome.type === "fail") {
      await logAction({
        agentId: agent.id,
        taskId: task.id,
        actionType: "error",
        output: { error: outcome.text },
        durationMs: Date.now() - start,
      })
      return { completed: true, error: outcome.text }
    }

    // Model stopped without calling a terminal tool — treat its final text as the result.
    const fallback = text?.trim()
    if (fallback) {
      await logAction({
        agentId: agent.id,
        taskId: task.id,
        actionType: "complete",
        output: { result: fallback },
        durationMs: Date.now() - start,
      })
      return { completed: true, result: fallback }
    }

    return { completed: false, error: "Agent stopped without producing a result." }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[v0] runAgentTask error:", message)
    await logAction({
      agentId: agent.id,
      taskId: task.id,
      actionType: "error",
      output: { error: message },
      durationMs: Date.now() - start,
    })
    return { completed: false, error: message }
  }
}
