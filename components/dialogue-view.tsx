"use client"

import { useMemo } from "react"
import { Headset, User } from "lucide-react"

interface DialogueMessage {
  speaker: "agent" | "customer"
  text: string
}

// Parse the raw historyDialogue string into structured messages.
// Lines are prefixed with "r:" (agent/representative) or "c:" (customer).
function parseDialogue(raw: string): DialogueMessage[] {
  if (!raw) return []

  const messages: DialogueMessage[] = []
  // Split on the speaker prefixes while keeping them. We normalize line breaks first.
  const normalized = raw.replace(/\r/g, "")
  // Use regex to capture each segment starting with r: or c:
  const regex = /([rc]):\s*([\s\S]*?)(?=(?:\n?[rc]:)|$)/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(normalized)) !== null) {
    const prefix = match[1]
    const text = match[2].trim()
    if (!text) continue
    messages.push({
      speaker: prefix === "r" ? "agent" : "customer",
      text,
    })
  }

  return messages
}

export function DialogueView({ dialogue }: { dialogue: string }) {
  const messages = useMemo(() => parseDialogue(dialogue), [dialogue])

  if (messages.length === 0) {
    return (
      <div className="rounded-md bg-muted/40 px-3 py-4 text-center text-xs text-muted-foreground">
        No conversation record available
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.map((msg, index) => {
        const isAgent = msg.speaker === "agent"
        return (
          <div
            key={index}
            className={`flex items-start gap-2 ${isAgent ? "flex-row" : "flex-row-reverse"}`}
          >
            {/* Speaker avatar */}
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                isAgent
                  ? "bg-sky-500/15 text-sky-400"
                  : "bg-emerald-500/15 text-emerald-400"
              }`}
            >
              {isAgent ? <Headset className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
            </div>

            {/* Message bubble */}
            <div
              className={`flex max-w-[80%] flex-col gap-1 ${isAgent ? "items-start" : "items-end"}`}
            >
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {isAgent ? "Agent" : "Customer"}
              </span>
              <div
                className={`rounded-lg px-3 py-2 text-sm leading-relaxed break-words ${
                  isAgent
                    ? "bg-sky-500/10 text-foreground"
                    : "bg-emerald-500/10 text-foreground"
                }`}
                dir="auto"
              >
                {msg.text}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
