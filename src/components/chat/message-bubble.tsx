"use client"

import { cn } from "@/lib/utils"
import { ReferenceTag } from "./reference-tag"
import { PlanCard } from "./plan-card"
import { PreviewCard } from "./preview-card"
import { DiffCard } from "./diff-card"
import type { Message, PlanData, PreviewData, DiffData } from "@/types/database"

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user"

  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[80%] space-y-2",
          isUser ? "items-end" : "items-start"
        )}
      >
        {/* References */}
        {message.references.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {message.references.map((ref) => (
              <ReferenceTag key={ref.id} reference={ref} />
            ))}
          </div>
        )}

        {/* Text content */}
        {message.content && (
          <div
            className={cn(
              "rounded-lg px-3 py-2 text-sm leading-relaxed",
              isUser
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            )}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        )}

        {/* Special cards */}
        {message.metadata?.type === "plan" && (
          <PlanCard data={message.metadata.data as PlanData} />
        )}
        {message.metadata?.type === "preview" && (
          <PreviewCard data={message.metadata.data as PreviewData} />
        )}
        {message.metadata?.type === "diff" && (
          <DiffCard data={message.metadata.data as DiffData} />
        )}

        {/* Timestamp */}
        <p
          className={cn(
            "text-[10px] text-muted-foreground mt-1",
            isUser ? "text-right" : "text-left"
          )}
        >
          {new Date(message.createdAt).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  )
}
