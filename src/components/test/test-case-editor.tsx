"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface TestCaseEditorProps {
  initialData?: { title: string; context: string; input: string; expectedOutput: string }
  onSave: (data: { title: string; context: string; input: string; expectedOutput: string }) => void
  onCancel: () => void
}

export function TestCaseEditor({ initialData, onSave, onCancel }: TestCaseEditorProps) {
  const [title, setTitle] = useState(initialData?.title ?? "")
  const [context, setContext] = useState(initialData?.context ?? "")
  const [input, setInput] = useState(initialData?.input ?? "")
  const [expectedOutput, setExpectedOutput] = useState(initialData?.expectedOutput ?? "")

  const isValid = title.trim().length > 0 && input.trim().length > 0 && expectedOutput.trim().length > 0

  function handleSave() {
    onSave({
      title: title.trim(),
      context: context.trim(),
      input: input.trim(),
      expectedOutput: expectedOutput.trim(),
    })
  }

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="tc-title">
          标题 <span className="text-destructive">*</span>
        </label>
        <Input
          id="tc-title"
          placeholder="测试用例标题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="tc-context">
          上下文
        </label>
        <Textarea
          id="tc-context"
          placeholder="可选的测试上下文信息"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={2}
          className="text-sm resize-none"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="tc-input">
          输入 <span className="text-destructive">*</span>
        </label>
        <Textarea
          id="tc-input"
          placeholder="测试输入内容"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          className="text-sm resize-none"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="tc-expected">
          期望输出 <span className="text-destructive">*</span>
        </label>
        <Textarea
          id="tc-expected"
          placeholder="期望的输出结果"
          value={expectedOutput}
          onChange={(e) => setExpectedOutput(e.target.value)}
          rows={3}
          className="text-sm resize-none"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={handleSave} disabled={!isValid}>
          保存
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          取消
        </Button>
      </div>
    </div>
  )
}
