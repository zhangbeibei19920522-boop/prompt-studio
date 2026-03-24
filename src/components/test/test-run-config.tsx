"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TestSuiteConfig } from "@/types/database"

interface TestRunConfigProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: TestSuiteConfig
  promptId: string | null
  prompts: Array<{ id: string; title: string }>
  promptSelectionLocked?: boolean
  onSave: (config: TestSuiteConfig) => void | Promise<void>
  onRunWithPrompt: (promptId: string) => void
}

export function TestRunConfig({
  open,
  onOpenChange,
  config,
  promptId,
  prompts,
  promptSelectionLocked = false,
  onSave,
  onRunWithPrompt,
}: TestRunConfigProps) {
  const [provider, setProvider] = useState(config.provider)
  const [model, setModel] = useState(config.model)
  const [apiKey, setApiKey] = useState(config.apiKey)
  const [baseUrl, setBaseUrl] = useState(config.baseUrl)
  const [selectedPromptId, setSelectedPromptId] = useState(promptId ?? "")

  useEffect(() => {
    setProvider(config.provider)
    setModel(config.model)
    setApiKey(config.apiKey)
    setBaseUrl(config.baseUrl)
  }, [config])

  useEffect(() => {
    setSelectedPromptId(promptId ?? "")
  }, [promptId])

  const canRun = selectedPromptId.length > 0 && model.trim().length > 0 && apiKey.trim().length > 0

  function handleSave() {
    onSave({
      provider: provider.trim(),
      model: model.trim(),
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
    })
  }

  async function handleSaveAndRun() {
    await onSave({
      provider: provider.trim(),
      model: model.trim(),
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
    })
    onRunWithPrompt(selectedPromptId)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>测试配置</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">
              {promptSelectionLocked ? "入口 Prompt" : "目标 Prompt"}
            </label>
            {promptSelectionLocked ? (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {prompts.find((prompt) => prompt.id === selectedPromptId)?.title || "未配置入口 Prompt"}
              </div>
            ) : (
              <Select value={selectedPromptId} onValueChange={setSelectedPromptId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择要测试的 Prompt" />
                </SelectTrigger>
                <SelectContent>
                  {prompts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="cfg-provider">
              Provider
            </label>
            <Input
              id="cfg-provider"
              placeholder="openai / anthropic / deepseek ..."
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="cfg-model">
              模型
            </label>
            <Input
              id="cfg-model"
              placeholder="gpt-4o / claude-3-opus ..."
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="cfg-apikey">
              API Key
            </label>
            <Input
              id="cfg-apikey"
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="cfg-baseurl">
              Base URL
            </label>
            <Input
              id="cfg-baseurl"
              placeholder="https://api.openai.com/v1（可选）"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={handleSave}>
            保存配置
          </Button>
          <Button size="sm" onClick={handleSaveAndRun} disabled={!canRun}>
            保存并运行
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
