"use client"

import { useState, useRef, useEffect } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { MessageCircle, X, Send, Sparkles } from "lucide-react"

function getMessageText(message: UIMessage): string {
  if (!message.parts || !Array.isArray(message.parts)) return ""
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

const SUGGESTIONS = [
  "What is Action Tokens?",
  "How do bounties work?",
  "What does the Demolish tool do?",
]

export function AiAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  })

  const isBusy = status === "submitted" || status === "streaming"

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, isOpen])

  // Push the rest of the site over while the assistant sidebar is open.
  useEffect(() => {
    document.body.classList.toggle("assistant-open", isOpen)
    return () => document.body.classList.remove("assistant-open")
  }, [isOpen])

  const submit = (text: string) => {
    const value = text.trim()
    if (!value || isBusy) return
    sendMessage({ text: value })
    setInput("")
  }

  return (
    <>
      {/* Launcher button */}
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open support assistant"
        className={`fixed bottom-5 right-5 z-[50] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg shadow-purple-900/40 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-black ${
          isOpen ? "pointer-events-none scale-90 opacity-0" : "opacity-100"
        }`}
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {/* Chat sidebar — non-modal so the rest of the site stays browsable */}
      <aside
        role="complementary"
        aria-label="Action Assistant"
        aria-hidden={!isOpen}
        className={`fixed inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col overflow-hidden border-l border-gray-800 bg-gray-950 text-white shadow-2xl shadow-black/60 transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-800 bg-gradient-to-r from-pink-600/20 to-purple-600/20 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-pink-600 to-purple-600">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Action Assistant</p>
            <p className="text-xs text-gray-400">Ask about the platform or get support</p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close assistant"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="space-y-4">
                <p className="text-sm text-gray-300">
                  Hi! I&apos;m the Action Tokens assistant. I can answer questions about bounties, rewards, the map,
                  the Demolish tool, and help with support requests.
                </p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => submit(s)}
                      className="rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-left text-sm text-gray-300 transition-colors hover:border-purple-600/60 hover:text-white"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => {
              const text = getMessageText(message)
              const isUser = message.role === "user"
              return (
                <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      isUser
                        ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white"
                        : "bg-gray-900 text-gray-100"
                    }`}
                  >
                    {text || (isBusy ? "…" : "")}
                  </div>
                </div>
              )
            })}

            {status === "submitted" && (
              <div className="flex justify-start">
                <div className="flex gap-1 rounded-2xl bg-gray-900 px-3.5 py-3">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500" />
                </div>
              </div>
            )}
          </div>

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit(input)
          }}
          className="border-t border-gray-800 p-3"
        >
          <div className="flex items-end gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              className="flex-1 rounded-full border border-gray-800 bg-gray-900 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-purple-600/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || isBusy}
              aria-label="Send message"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-pink-600 to-purple-600 text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </aside>
    </>
  )
}
