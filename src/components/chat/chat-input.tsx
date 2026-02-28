"use client"

import { useState, useRef, useCallback } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ReferenceTag } from "./reference-tag"
import { MentionPopover } from "./mention-popover"
import type { MessageReference } from "@/types/database"

interface ChatInputProps {
  onSend: (content: string, references: MessageReference[]) => void
  prompts: Array<{ id: string; title: string }>
  documents: Array<{ id: string; name: string }>
  disabled?: boolean
}

export function ChatInput({
  onSend,
  prompts,
  documents,
  disabled,
}: ChatInputProps) {
  const [content, setContent] = useState("")
  const [references, setReferences] = useState<MessageReference[]>([])
  const [showMention, setShowMention] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "@" && !e.shiftKey) {
      setShowMention(true)
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === "Escape") {
      setShowMention(false)
    }
  }

  const handleSend = useCallback(() => {
    const trimmed = content.trim()
    if (!trimmed && references.length === 0) return
    onSend(trimmed, references)
    setContent("")
    setReferences([])
    setShowMention(false)
  }, [content, references, onSend])

  const handleMentionSelect = (ref: MessageReference) => {
    const exists = references.some((r) => r.id === ref.id)
    if (!exists) {
      setReferences((prev) => [...prev, ref])
    }
    setShowMention(false)
    // Remove the @ character that triggered the popover
    setContent((prev) => {
      const lastAt = prev.lastIndexOf("@")
      if (lastAt >= 0) return prev.slice(0, lastAt)
      return prev
    })
    textareaRef.current?.focus()
  }

  const removeReference = (id: string) => {
    setReferences((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="border-t bg-white p-4">
      {/* Selected references */}
      {references.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {references.map((ref) => (
            <ReferenceTag
              key={ref.id}
              reference={ref}
              removable
              onRemove={() => removeReference(ref.id)}
            />
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="relative flex items-end gap-2">
        {showMention && (
          <MentionPopover
            prompts={prompts}
            documents={documents}
            onSelect={handleMentionSelect}
            onClose={() => setShowMention(false)}
          />
        )}

        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            if (e.target.value.endsWith("@")) {
              setShowMention(true)
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="输入需求描述，使用 @ 引用 Prompt 或知识库..."
          className="min-h-[44px] max-h-[160px] resize-none text-sm"
          rows={1}
          disabled={disabled}
        />

        <Button
          size="icon"
          onClick={handleSend}
          disabled={disabled || (!content.trim() && references.length === 0)}
          className="shrink-0"
        >
          <Send className="size-4" />
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground mt-1">
        Enter 发送，Shift+Enter 换行，@ 引用
      </p>
    </div>
  )
}
