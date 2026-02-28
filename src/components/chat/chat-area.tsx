"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageBubble } from "./message-bubble"
import { ChatInput } from "./chat-input"
import { streamChat } from "@/lib/utils/sse-client"
import type { Message, MessageReference } from "@/types/database"
import type { StreamEvent } from "@/types/ai"

interface ChatAreaProps {
  messages: Message[]
  sessionId: string | null
  prompts: Array<{ id: string; title: string }>
  documents: Array<{ id: string; name: string }>
  onMessagesChange: () => void
}

export function ChatArea({
  messages,
  sessionId,
  prompts,
  documents,
  onMessagesChange,
}: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [streamingText, setStreamingText] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, streamingText])

  const handleSend = useCallback(
    async (content: string, references: MessageReference[]) => {
      if (!sessionId) return

      setIsStreaming(true)
      setStreamingText("")

      try {
        for await (const event of streamChat({
          sessionId,
          content,
          references,
        })) {
          switch (event.type) {
            case "text":
              setStreamingText((prev) => prev + event.content)
              break
            case "plan":
            case "preview":
            case "diff":
            case "done":
              // Refresh messages from server
              setStreamingText("")
              onMessagesChange()
              break
            case "error":
              console.error("Stream error:", event.message)
              setStreamingText("")
              onMessagesChange()
              break
          }
        }
      } catch (error) {
        console.error("Chat error:", error)
      } finally {
        setIsStreaming(false)
        setStreamingText("")
        onMessagesChange()
      }
    },
    [sessionId, onMessagesChange]
  )

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 p-4 max-w-3xl mx-auto">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-1 items-center justify-center py-20">
              <div className="text-center space-y-2">
                <p className="text-lg font-medium text-muted-foreground">
                  开始新对话
                </p>
                <p className="text-sm text-muted-foreground">
                  使用 @ 引用 Prompt 或知识库文档，描述您的需求
                </p>
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {streamingText && (
            <div className="flex w-full justify-start">
              <div className="max-w-[80%]">
                <div className="rounded-lg px-3 py-2 text-sm leading-relaxed bg-muted text-foreground">
                  <p className="whitespace-pre-wrap">{streamingText}</p>
                  <span className="inline-block w-1.5 h-4 bg-foreground/60 animate-pulse ml-0.5" />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <ChatInput
        onSend={handleSend}
        prompts={prompts}
        documents={documents}
        disabled={isStreaming || !sessionId}
      />
    </div>
  )
}
