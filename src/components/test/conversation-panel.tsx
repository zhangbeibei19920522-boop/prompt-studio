"use client"

import { Badge } from "@/components/ui/badge"
import type { ConversationTurn } from "./conversation-output"

interface ConversationPanelProps {
  title: string
  turns: ConversationTurn[]
  showIntentBadges?: boolean
}

export function ConversationPanel({
  title,
  turns,
  showIntentBadges = false,
}: ConversationPanelProps) {
  if (turns.length === 0) {
    return null
  }

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1">{title}</p>
      <div className="rounded border bg-muted/20 divide-y">
        {turns.map((turn, idx) => (
          <div key={idx} className="p-2">
            <span
              className={`inline-block text-xs font-medium rounded px-1.5 py-0.5 mb-1 ${
                turn.role === "user"
                  ? "text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/40"
                  : "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40"
              }`}
            >
              {turn.role === "user" ? "用户" : "助手"}
            </span>
            <div className="flex flex-wrap items-start gap-2">
              {showIntentBadges && turn.role === "assistant" && turn.intent && (
                <Badge
                  variant="secondary"
                  className="bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em]"
                >
                  {turn.intent}
                </Badge>
              )}
              <p className="text-sm whitespace-pre-wrap break-words flex-1 min-w-0">
                {turn.content}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
