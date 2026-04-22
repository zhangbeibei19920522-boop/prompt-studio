"use client"

import { useMemo, useState } from "react"
import { Check, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getTestRouteTargetId,
  isTestSuiteRouteComplete,
  normalizeTestSuiteRoute,
} from "@/lib/test-suite-routing"
import { cn } from "@/lib/utils"
import type { TestSuiteRoutingConfig } from "@/types/database"
import { TestRoutingConfigForm } from "./test-routing-config-dialog"
import { buildRoutesFromPrompts, findUniquePromptMatch } from "./routing-config-utils"

export type TestSuiteConfigDrawerSection = "full-flow" | "unit"
type TestStructure = "single" | "multi"
type TestConversationMode = "single-turn" | "multi-turn"
type UnitTestTarget = "prompt" | "index-version"

export interface TestSuiteConfigSubmitPayload {
  section: TestSuiteConfigDrawerSection
  structure: TestStructure
  promptId: string | null
  routingConfig: TestSuiteRoutingConfig | null
  targetType: UnitTestTarget
  targetId: string | null
  caseCount: number
  conversationMode: TestConversationMode
  minTurns: number | null
  maxTurns: number | null
  generationSourceIds: string[]
}

interface TestSuiteConfigDrawerProps {
  open: boolean
  section: TestSuiteConfigDrawerSection
  prompts: Array<{ id: string; title: string }>
  documents: Array<{ id: string; name: string }>
  indexVersions: Array<{ id: string; title: string }>
  onClose: () => void
  onSubmit: (payload: TestSuiteConfigSubmitPayload) => void
}

function getDrawerTitle(section: TestSuiteConfigDrawerSection) {
  return section === "unit" ? "新建单元测试集" : "新建全流程测试集"
}

function getDrawerDescription(section: TestSuiteConfigDrawerSection) {
  return section === "unit"
    ? "配置测试目标、用例范围和生成来源。"
    : "配置业务流程、对话范围和用例生成来源。"
}

function isRoutingConfigComplete(routingConfig: TestSuiteRoutingConfig) {
  return (
    routingConfig.entryPromptId.trim().length > 0 &&
    routingConfig.routes.length > 0 &&
    routingConfig.routes.every((route) => isTestSuiteRouteComplete(normalizeTestSuiteRoute(route)))
  )
}

type GenerationSourceOption = {
  id: string
  label: string
  group: "Prompt" | "文档库"
}

export function TestSuiteConfigDrawer({
  open,
  section,
  prompts,
  documents,
  indexVersions,
  onClose,
  onSubmit,
}: TestSuiteConfigDrawerProps) {
  const [routingConfig, setRoutingConfig] = useState<TestSuiteRoutingConfig>({
    entryPromptId: prompts[0]?.id ?? "",
    routes: [{ intent: "", promptId: "", targetType: "prompt", targetId: "" }],
  })
  const [targetType, setTargetType] = useState<UnitTestTarget>("prompt")
  const [targetId, setTargetId] = useState(prompts[0]?.id ?? indexVersions[0]?.id ?? "")
  const [caseCount, setCaseCount] = useState("10")
  const [conversationMode, setConversationMode] = useState<TestConversationMode>("single-turn")
  const [minTurns, setMinTurns] = useState("2")
  const [maxTurns, setMaxTurns] = useState("4")
  const [generationSourcePickerOpen, setGenerationSourcePickerOpen] = useState(false)
  const [generationSourceQuery, setGenerationSourceQuery] = useState("")
  const generationSourceOptions = useMemo<GenerationSourceOption[]>(
    () => [
      ...prompts.map((prompt) => ({
        id: `prompt:${prompt.id}`,
        label: prompt.title,
        group: "Prompt",
      })),
      ...documents.map((document) => ({
        id: `document:${document.id}`,
        label: document.name,
        group: "文档库",
      })),
    ],
    [documents, prompts]
  )
  const [generationSourceIds, setGenerationSourceIds] = useState<string[]>([])
  const structure: TestStructure = section === "full-flow" ? "multi" : "single"

  if (!open) {
    return null
  }

  const numericCaseCount = Number.parseInt(caseCount, 10)
  const numericMinTurns = Number.parseInt(minTurns, 10)
  const numericMaxTurns = Number.parseInt(maxTurns, 10)
  const needsTurnRange = conversationMode === "multi-turn"

  const isBaseValid =
    Number.isFinite(numericCaseCount) &&
    numericCaseCount > 0 &&
    generationSourceIds.length > 0 &&
    (!needsTurnRange ||
      (Number.isFinite(numericMinTurns) &&
        Number.isFinite(numericMaxTurns) &&
        numericMinTurns > 1 &&
        numericMaxTurns >= numericMinTurns))

  const selectedGenerationSources = generationSourceOptions.filter((option) =>
    generationSourceIds.includes(option.id)
  )
  const filteredGenerationSourceOptions = generationSourceOptions.filter((option) =>
    option.label.toLowerCase().includes(generationSourceQuery.trim().toLowerCase())
  )
  const filteredPromptSources = filteredGenerationSourceOptions.filter((option) => option.group === "Prompt")
  const filteredDocumentSources = filteredGenerationSourceOptions.filter((option) => option.group === "文档库")
  const generationSourceSummary =
    selectedGenerationSources.length === 0
      ? "未选择来源"
      : selectedGenerationSources.length === 1
        ? `已选择：${selectedGenerationSources[0]?.label ?? "1 个来源"}`
        : `已选择 ${selectedGenerationSources.length} 个来源`

  function toggleGenerationSource(optionId: string) {
    setGenerationSourceIds((current) =>
      current.includes(optionId)
        ? current.filter((currentId) => currentId !== optionId)
        : [...current, optionId]
    )
  }

  const canSubmit =
    section === "full-flow"
      ? isBaseValid && isRoutingConfigComplete(routingConfig)
      : isBaseValid && targetId.length > 0

  function handleSubmit() {
    if (!canSubmit) return

    onSubmit({
      section,
      structure,
      promptId: null,
      routingConfig: section === "full-flow" ? routingConfig : null,
      targetType,
      targetId: section === "unit" ? targetId : null,
      caseCount: numericCaseCount,
      conversationMode,
      minTurns: needsTurnRange ? numericMinTurns : null,
      maxTurns: needsTurnRange ? numericMaxTurns : null,
      generationSourceIds,
    })
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/10 transition-opacity",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          "fixed right-0 bottom-0 top-[52px] z-50 flex w-[min(720px,100vw)] flex-col border-l border-zinc-200 bg-white shadow-2xl transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-start gap-3 border-b border-zinc-200 px-6 py-5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-zinc-950">{getDrawerTitle(section)}</p>
            <p className="mt-1 text-sm text-zinc-500">{getDrawerDescription(section)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="关闭测试集配置"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            {section === "full-flow" ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">多 Prompt 业务流程</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    配置入口 Prompt，并为每条 intent 选择 Prompt 或索引版本。
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                  <TestRoutingConfigForm
                    prompts={prompts}
                    indexVersions={indexVersions}
                    entryPromptId={routingConfig.entryPromptId}
                    routes={routingConfig.routes}
                    onEntryPromptChange={(entryPromptId) =>
                      setRoutingConfig((current) => ({
                        ...current,
                        entryPromptId,
                        routes: current.routes.map((route) => {
                          const currentTargetId = getTestRouteTargetId(route)
                          const shouldReevaluate =
                            (route.targetType ?? "prompt") === "prompt" &&
                            (currentTargetId.trim().length === 0 || currentTargetId === entryPromptId)
                          if (!shouldReevaluate) {
                            return route
                          }

                          const matchedPrompt = findUniquePromptMatch(route.intent, prompts, entryPromptId)
                          return normalizeTestSuiteRoute({
                            ...route,
                            targetType: "prompt",
                            targetId: matchedPrompt?.id ?? "",
                            promptId: matchedPrompt?.id ?? "",
                          })
                        }),
                      }))
                    }
                    onRouteIntentChange={(index, intent) =>
                      setRoutingConfig((current) => ({
                        ...current,
                        routes: current.routes.map((route, routeIndex) => {
                          if (routeIndex !== index) {
                            return route
                          }
                          const currentTargetId = getTestRouteTargetId(route)
                          if ((route.targetType ?? "prompt") !== "prompt" || currentTargetId.trim().length > 0) {
                            return { ...route, intent }
                          }

                          const matchedPrompt = findUniquePromptMatch(
                            intent,
                            prompts,
                            current.entryPromptId
                          )
                          return normalizeTestSuiteRoute({
                            ...route,
                            intent,
                            targetType: "prompt",
                            targetId: matchedPrompt?.id ?? "",
                            promptId: matchedPrompt?.id ?? "",
                          })
                        }),
                      }))
                    }
                    onRouteChange={(index, patch) =>
                      setRoutingConfig((current) => ({
                        ...current,
                        routes: current.routes.map((route, routeIndex) =>
                          routeIndex === index ? normalizeTestSuiteRoute({ ...route, ...patch }) : route
                        ),
                      }))
                    }
                    onGenerateRoutes={() =>
                      setRoutingConfig((current) => ({
                        ...current,
                        routes:
                          current.entryPromptId.trim().length > 0
                            ? buildRoutesFromPrompts(prompts, current.entryPromptId)
                            : current.routes,
                      }))
                    }
                    onAddRoute={() =>
                      setRoutingConfig((current) => ({
                        ...current,
                        routes: [
                          ...current.routes,
                          { intent: "", promptId: "", targetType: "prompt", targetId: "" },
                        ],
                      }))
                    }
                    onRemoveRoute={(index) =>
                      setRoutingConfig((current) => ({
                        ...current,
                        routes:
                          current.routes.length === 1
                            ? [{ intent: "", promptId: "", targetType: "prompt", targetId: "" }]
                            : current.routes.filter((_, routeIndex) => routeIndex !== index),
                      }))
                    }
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">测试目标</label>
                  <Select value={targetType} onValueChange={(value) => setTargetType(value as UnitTestTarget)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="选择测试目标" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prompt">Prompt</SelectItem>
                      <SelectItem value="index-version">索引版本</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">测试内容</label>
                  <Select value={targetId} onValueChange={setTargetId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={targetType === "prompt" ? "选择 Prompt" : "选择索引版本"} />
                    </SelectTrigger>
                    <SelectContent>
                      {targetType === "prompt"
                        ? prompts.map((prompt) => (
                            <SelectItem key={prompt.id} value={prompt.id}>
                              {prompt.title}
                            </SelectItem>
                          ))
                        : indexVersions.map((indexVersion) => (
                            <SelectItem key={indexVersion.id} value={indexVersion.id}>
                              {indexVersion.title}
                            </SelectItem>
                          ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">测试用例数量</label>
              <Input
                type="number"
                min="1"
                value={caseCount}
                onChange={(event) => setCaseCount(event.target.value)}
                placeholder="输入测试用例数量"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">测试用例形式</label>
              <Select
                value={conversationMode}
                onValueChange={(value) => setConversationMode(value as TestConversationMode)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择测试用例形式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single-turn">单轮对话</SelectItem>
                  <SelectItem value="multi-turn">多轮对话</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {needsTurnRange ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">对话轮次区间</label>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    type="number"
                    min="2"
                    value={minTurns}
                    onChange={(event) => setMinTurns(event.target.value)}
                    placeholder="最少轮次"
                  />
                  <Input
                    type="number"
                    min="2"
                    value={maxTurns}
                    onChange={(event) => setMaxTurns(event.target.value)}
                    placeholder="最多轮次"
                  />
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-sm font-medium">测试用例生成来源</label>
              <div className="rounded-lg border border-zinc-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-950">{generationSourceSummary}</p>
                    <p className="mt-1 text-xs text-zinc-500">支持混选 Prompt 和文档库内容。</p>
                  </div>
                  <Button type="button" variant="outline" onClick={() => setGenerationSourcePickerOpen(true)}>
                    选择来源
                  </Button>
                </div>

                {selectedGenerationSources.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedGenerationSources.slice(0, 4).map((option) => (
                      <span
                        key={option.id}
                        className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-600"
                      >
                        {option.label}
                      </span>
                    ))}
                    {selectedGenerationSources.length > 4 ? (
                      <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-600">
                        +{selectedGenerationSources.length - 4}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-200 px-6 py-4">
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              生成测试集
            </Button>
          </div>
        </div>
      </aside>

      <Dialog open={generationSourcePickerOpen} onOpenChange={setGenerationSourcePickerOpen}>
        <DialogContent className="max-w-2xl p-0 sm:max-w-2xl" showCloseButton={false}>
          <DialogHeader className="border-b border-zinc-200 px-6 py-5">
            <DialogTitle>选择测试用例生成来源</DialogTitle>
            <DialogDescription>支持混选 Prompt 和文档库内容，可搜索后批量勾选。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            <Input
              value={generationSourceQuery}
              onChange={(event) => setGenerationSourceQuery(event.target.value)}
              placeholder="搜索 Prompt 或文档"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-zinc-500">{generationSourceSummary}</span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setGenerationSourceIds([])}>
                  清空
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setGenerationSourceIds(
                      filteredGenerationSourceOptions.map((option) => option.id)
                    )
                  }
                >
                  全选当前结果
                </Button>
              </div>
            </div>

            <div className="max-h-[420px] space-y-5 overflow-y-auto pr-1">
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-950">Prompt</p>
                <div className="space-y-2">
                  {filteredPromptSources.length > 0 ? (
                    filteredPromptSources.map((option) => {
                      const selected = generationSourceIds.includes(option.id)
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggleGenerationSource(option.id)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                            selected
                              ? "border-zinc-300 bg-zinc-50 text-zinc-950"
                              : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                          )}
                        >
                          <span className="truncate">{option.label}</span>
                          <span
                            className={cn(
                              "ml-3 flex size-5 shrink-0 items-center justify-center rounded border",
                              selected
                                ? "border-zinc-950 bg-zinc-950 text-white"
                                : "border-zinc-300 bg-white text-transparent"
                            )}
                            aria-hidden="true"
                          >
                            <Check className="size-3.5" />
                          </span>
                        </button>
                      )
                    })
                  ) : (
                    <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-4 text-sm text-zinc-500">
                      未找到匹配的 Prompt。
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-950">文档库</p>
                <div className="space-y-2">
                  {filteredDocumentSources.length > 0 ? (
                    filteredDocumentSources.map((option) => {
                      const selected = generationSourceIds.includes(option.id)
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggleGenerationSource(option.id)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                            selected
                              ? "border-zinc-300 bg-zinc-50 text-zinc-950"
                              : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                          )}
                        >
                          <span className="truncate">{option.label}</span>
                          <span
                            className={cn(
                              "ml-3 flex size-5 shrink-0 items-center justify-center rounded border",
                              selected
                                ? "border-zinc-950 bg-zinc-950 text-white"
                                : "border-zinc-300 bg-white text-transparent"
                            )}
                            aria-hidden="true"
                          >
                            <Check className="size-3.5" />
                          </span>
                        </button>
                      )
                    })
                  ) : (
                    <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-4 text-sm text-zinc-500">
                      未找到匹配的文档。
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-zinc-200 px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setGenerationSourcePickerOpen(false)}>
              完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
