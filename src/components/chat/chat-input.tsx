"use client"

import { useState, useRef, useCallback } from "react"
import { Send, FileText, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ReferenceTag } from "./reference-tag"
import { ReferenceSelector } from "./reference-selector"
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = useCallback(() => {
    const trimmed = content.trim()
    if (!trimmed && references.length === 0) return
    onSend(trimmed, references)
    setContent("")
    setReferences([])
  }, [content, references, onSend])

  const handleToggleReference = (
    type: "prompt" | "document",
    id: string,
    label: string
  ) => {
    setReferences((prev) => {
      const exists = prev.some((r) => r.id === id)
      if (exists) {
        return prev.filter((r) => r.id !== id)
      }
      return [...prev, { type, id, title: label }]
    })
  }

  const removeReference = (id: string) => {
    setReferences((prev) => prev.filter((r) => r.id !== id))
  }

  const selectedPromptIds = references
    .filter((r) => r.type === "prompt")
    .map((r) => r.id)
  const selectedDocIds = references
    .filter((r) => r.type === "document")
    .map((r) => r.id)

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
      <div className="flex items-end gap-1">
        <ReferenceSelector
          type="prompt"
          items={prompts.map((p) => ({ id: p.id, label: p.title }))}
          selectedIds={selectedPromptIds}
          onToggle={(id, label) => handleToggleReference("prompt", id, label)}
          icon={<FileText className="size-4" />}
          label="Prompt"
        />
        <ReferenceSelector
          type="document"
          items={documents.map((d) => ({ id: d.id, label: d.name }))}
          selectedIds={selectedDocIds}
          onToggle={(id, label) => handleToggleReference("document", id, label)}
          icon={<FolderOpen className="size-4" />}
          label="知识库"
        />

        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入需求描述，点击左侧按钮引用 Prompt 或知识库..."
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
        Enter 发送，Shift+Enter 换行
      </p>
    </div>
  )
}
