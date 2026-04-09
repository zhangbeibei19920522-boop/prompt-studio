"use client"

import { useState, useRef } from "react"
import { Check, FileText, FolderOpen, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { ReferenceTag } from "./reference-tag"
import {
  applyMentionSelection,
  findMentionMatch,
  type MentionMatch,
} from "./chat-input-mentions"
import {
  areAllReferencesSelected,
  toggleAllReferencesForType,
} from "./chat-reference-selection"
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
  const [mentionMatch, setMentionMatch] = useState<MentionMatch | null>(null)
  const [activeMentionIndex, setActiveMentionIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const mentionItems = [
    ...prompts.map((prompt) => ({
      id: prompt.id,
      label: prompt.title,
      type: "prompt" as const,
    })),
    ...documents.map((document) => ({
      id: document.id,
      label: document.name,
      type: "document" as const,
    })),
  ].filter((item) =>
    mentionMatch ? item.label.toLowerCase().includes(mentionMatch.query.toLowerCase()) : false
  )

  const syncMentionState = (nextContent: string, cursor: number | null) => {
    const nextMatch = findMentionMatch(nextContent, cursor ?? nextContent.length)
    setMentionMatch(nextMatch)
    setActiveMentionIndex(0)
  }

  const focusTextareaAt = (cursor: number) => {
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(cursor, cursor)
    })
  }

  const addReference = (
    type: "prompt" | "document",
    id: string,
    label: string
  ) => {
    setReferences((prev) => {
      if (prev.some((ref) => ref.id === id)) {
        return prev
      }
      return [...prev, { type, id, title: label }]
    })
  }

  const selectMentionItem = (index: number) => {
    const item = mentionItems[index]
    if (!item || !mentionMatch) return

    addReference(item.type, item.id, item.label)

    const next = applyMentionSelection(content, mentionMatch)
    setContent(next.content)
    setMentionMatch(null)
    setActiveMentionIndex(0)
    focusTextareaAt(next.cursor)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionMatch && mentionItems.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveMentionIndex((prev) => (prev + 1) % mentionItems.length)
        return
      }

      if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveMentionIndex((prev) => (prev - 1 + mentionItems.length) % mentionItems.length)
        return
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        selectMentionItem(activeMentionIndex)
        return
      }
    }

    if (e.key === "Escape" && mentionMatch) {
      e.preventDefault()
      setMentionMatch(null)
      setActiveMentionIndex(0)
      return
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = () => {
    const trimmed = content.trim()
    if (!trimmed && references.length === 0) return
    onSend(trimmed, references)
    setContent("")
    setReferences([])
    setMentionMatch(null)
    setActiveMentionIndex(0)
  }

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

  const handleToggleAllReferences = (
    type: "prompt" | "document",
    items: Array<{ id: string; label: string }>
  ) => {
    setReferences((prev) => toggleAllReferencesForType(prev, type, items))
  }

  const promptItems = prompts.map((prompt) => ({ id: prompt.id, label: prompt.title }))
  const documentItems = documents.map((document) => ({ id: document.id, label: document.name }))

  const selectedPromptIds = references
    .filter((r) => r.type === "prompt")
    .map((r) => r.id)
  const selectedDocIds = references
    .filter((r) => r.type === "document")
    .map((r) => r.id)
  const allPromptsSelected = areAllReferencesSelected(references, "prompt", promptItems)
  const allDocumentsSelected = areAllReferencesSelected(references, "document", documentItems)

  return (
    <div className="shrink-0 bg-stone-50 px-6 pb-5">
      <div className="mx-auto max-w-[720px] rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow focus-within:border-blue-400 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]">
        {references.length > 0 && (
          <div className="flex flex-wrap gap-1 px-3 pt-3">
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

        <div className="flex items-end gap-1 px-3 py-3">
          <ReferenceSelector
            type="prompt"
            items={promptItems}
            selectedIds={selectedPromptIds}
            onToggle={(id, label) => handleToggleReference("prompt", id, label)}
            onToggleAll={() => handleToggleAllReferences("prompt", promptItems)}
            allSelected={allPromptsSelected}
            icon={<FileText className="size-4" />}
            label="Prompt"
          />
          <ReferenceSelector
            type="document"
            items={documentItems}
            selectedIds={selectedDocIds}
            onToggle={(id, label) => handleToggleReference("document", id, label)}
            onToggleAll={() => handleToggleAllReferences("document", documentItems)}
            allSelected={allDocumentsSelected}
            icon={<FolderOpen className="size-4" />}
            label="知识库"
          />

          <div className="relative flex-1">
            {mentionMatch && (
              <div className="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
                <div className="border-b border-zinc-100 px-3 py-2 text-xs text-zinc-500">
                  引用 Prompt 或知识库: <span className="font-medium text-zinc-800">@{mentionMatch.query}</span>
                </div>

                {mentionItems.length > 0 ? (
                  <div className="max-h-64 overflow-y-auto py-1">
                    <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-400">
                      Prompt
                    </div>
                    {mentionItems
                      .filter((item) => item.type === "prompt")
                      .map((item) => {
                        const optionIndex = mentionItems.findIndex((option) => option.id === item.id && option.type === item.type)
                        const selected = references.some((ref) => ref.id === item.id)
                        return (
                          <button
                            key={`prompt-${item.id}`}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectMentionItem(optionIndex)}
                            className={cn(
                              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                              activeMentionIndex === optionIndex ? "bg-blue-50 text-blue-900" : "hover:bg-zinc-50"
                            )}
                          >
                            <FileText className="size-4 text-zinc-400" />
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            <Check className={cn("size-4", selected ? "opacity-100 text-blue-600" : "opacity-0")} />
                          </button>
                        )
                      })}

                    <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-400">
                      知识库
                    </div>
                    {mentionItems
                      .filter((item) => item.type === "document")
                      .map((item) => {
                        const optionIndex = mentionItems.findIndex((option) => option.id === item.id && option.type === item.type)
                        const selected = references.some((ref) => ref.id === item.id)
                        return (
                          <button
                            key={`document-${item.id}`}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectMentionItem(optionIndex)}
                            className={cn(
                              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                              activeMentionIndex === optionIndex ? "bg-blue-50 text-blue-900" : "hover:bg-zinc-50"
                            )}
                          >
                            <FolderOpen className="size-4 text-zinc-400" />
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            <Check className={cn("size-4", selected ? "opacity-100 text-blue-600" : "opacity-0")} />
                          </button>
                        )
                      })}
                  </div>
                ) : (
                  <div className="px-3 py-3 text-sm text-zinc-500">没有匹配的 Prompt 或知识库文档</div>
                )}
              </div>
            )}

            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                const nextContent = e.target.value
                setContent(nextContent)
                syncMentionState(nextContent, e.target.selectionStart)
              }}
              onSelect={(e) => {
                const target = e.target as HTMLTextAreaElement
                syncMentionState(target.value, target.selectionStart)
              }}
              onKeyDown={handleKeyDown}
              placeholder="输入需求描述，输入 @ 或点击左侧按钮引用 Prompt / 知识库..."
              className="min-h-[44px] max-h-[160px] resize-none border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
              rows={1}
              disabled={disabled}
            />
          </div>

          <Button
            size="icon"
            onClick={handleSend}
            disabled={disabled || (!content.trim() && references.length === 0)}
            className="h-8 w-8 shrink-0 rounded-md bg-zinc-950 hover:bg-zinc-800"
          >
            <Send className="size-4" />
          </Button>
        </div>

        <p className="px-3 pb-3 text-[10px] text-muted-foreground">
          Enter 发送，Shift+Enter 换行
        </p>
      </div>
    </div>
  )
}
