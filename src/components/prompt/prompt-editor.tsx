"use client"

import { useState, KeyboardEvent } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"

interface Variable {
  name: string
  description: string
  defaultValue?: string
}

interface Prompt {
  id: string
  title: string
  content: string
  description: string
  tags: string[]
  variables: Variable[]
  status: string
}

interface SaveData {
  title: string
  content: string
  description: string
  tags: string[]
  status: 'draft' | 'active' | 'archived'
}

interface PromptEditorProps {
  prompt: Prompt | null
  onSave: (data: SaveData) => void
  onCancel: () => void
}

interface FormState {
  title: string
  content: string
  description: string
  tags: string[]
  status: 'draft' | 'active' | 'archived'
  tagInput: string
}

function buildInitialState(prompt: Prompt | null): FormState {
  return {
    title: prompt?.title ?? "",
    content: prompt?.content ?? "",
    description: prompt?.description ?? "",
    tags: prompt?.tags ?? [],
    status: (prompt?.status as FormState['status']) ?? "draft",
    tagInput: "",
  }
}

export function PromptEditor({ prompt, onSave, onCancel }: PromptEditorProps) {
  const [form, setForm] = useState<FormState>(() => buildInitialState(prompt))

  function updateField<K extends keyof FormState>(
    field: K,
    value: FormState[K]
  ): void {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleTagInputKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTagsFromInput(form.tagInput)
    }
  }

  function handleTagInputBlur(): void {
    if (form.tagInput.trim()) {
      addTagsFromInput(form.tagInput)
    }
  }

  function addTagsFromInput(raw: string): void {
    const newTags = raw
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && !form.tags.includes(t))

    if (newTags.length === 0) {
      setForm((prev) => ({ ...prev, tagInput: "" }))
      return
    }

    setForm((prev) => ({
      ...prev,
      tags: [...prev.tags, ...newTags],
      tagInput: "",
    }))
  }

  function removeTag(tag: string): void {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }))
  }

  function handleSave(): void {
    const data: SaveData = {
      title: form.title.trim(),
      content: form.content,
      description: form.description.trim(),
      tags: form.tags,
      status: form.status,
    }
    onSave(data)
  }

  const isValid = form.title.trim().length > 0 && form.content.trim().length > 0

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {prompt ? "编辑 Prompt" : "新建 Prompt"}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={!isValid}
          >
            保存
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>
            取消
          </Button>
        </div>
      </div>

      <Separator />

      {/* Title */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="editor-title">
          标题 <span className="text-destructive">*</span>
        </label>
        <Input
          id="editor-title"
          placeholder="输入 Prompt 标题"
          value={form.title}
          onChange={(e) => updateField("title", e.target.value)}
        />
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="editor-content">
          内容 <span className="text-destructive">*</span>
        </label>
        <Textarea
          id="editor-content"
          placeholder="输入 Prompt 内容，使用 {{变量名}} 定义变量"
          value={form.content}
          onChange={(e) => updateField("content", e.target.value)}
          rows={12}
          className="font-mono text-sm resize-none"
        />
        <p className="text-xs text-muted-foreground">
          使用 {"{{变量名}}"} 语法定义变量占位符
        </p>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="editor-description">
          描述
        </label>
        <Textarea
          id="editor-description"
          placeholder="输入 Prompt 的使用说明或背景描述"
          value={form.description}
          onChange={(e) => updateField("description", e.target.value)}
          rows={3}
          className="text-sm resize-none"
        />
      </div>

      {/* Tags */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="editor-tags">
          标签
        </label>
        <Input
          id="editor-tags"
          placeholder="输入标签后按 Enter 或逗号添加"
          value={form.tagInput}
          onChange={(e) => updateField("tagInput", e.target.value)}
          onKeyDown={handleTagInputKeyDown}
          onBlur={handleTagInputBlur}
        />
        {form.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {form.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                onClick={() => removeTag(tag)}
              >
                {tag}
                <span className="ml-1 text-xs">×</span>
              </Badge>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">点击标签可将其删除</p>
      </div>

      {/* Status */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="editor-status">
          状态
        </label>
        <select
          id="editor-status"
          value={form.status}
          onChange={(e) => updateField("status", e.target.value as FormState['status'])}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="draft">草稿</option>
          <option value="active">已发布</option>
          <option value="archived">已归档</option>
        </select>
      </div>
    </div>
  )
}
