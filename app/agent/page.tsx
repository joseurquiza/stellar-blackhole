import type { Metadata } from "next"
import { Header } from "@/components/header"
import { AgentDashboard } from "@/components/agent/agent-dashboard"

export const metadata: Metadata = {
  title: "Agent Workspace | Action Tokens",
  description:
    "Autonomous AI agents that plan, use tools, and complete tasks on their own — powered by the Vercel AI Gateway.",
}

export const dynamic = "force-dynamic"

export default function AgentPage() {
  return (
    <div className="agent-theme min-h-screen bg-background text-foreground">
      <Header />
      <AgentDashboard />
    </div>
  )
}
