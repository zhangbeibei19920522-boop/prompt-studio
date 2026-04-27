"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getTestRouteTargetId,
  getTestRouteTargetType,
  isTestSuiteRouteComplete,
  normalizeTestSuiteRoute,
} from "@/lib/test-suite-routing"
import { cn } from "@/lib/utils"
import type {
  TestRoutingTargetType,
  TestSuiteRoute,
  TestSuiteRoutingConfig,
} from "@/types/database"
import {
  buildRoutesFromPrompts,
  findUniquePromptMatch,
} from "./routing-config-utils"

interface TestRoutingConfigDialogProps {
  open: boolean
  prompts: Array<{ id: string; title: string; content?: string }>
  indexVersions: Array<{ id: string; title: string }>
  value: TestSuiteRoutingConfig
  onOpenChange: (open: boolean) => void
  onSave: (value: TestSuiteRoutingConfig) => void
}

interface TestRoutingConfigFormProps {
  prompts: Array<{ id: string; title: string; content?: string }>
  indexVersions: Array<{ id: string; title: string }>
  entryPromptId: string
  routes: Array<TestSuiteRoute & { id?: string }>
  onEntryPromptChange: (value: string) => void
  onRouteIntentChange?: (index: number, intent: string) => void
  onRouteChange: (
    index: number,
    patch: {
      intent?: string
      promptId?: string
      targetType?: TestRoutingTargetType
      targetId?: string
      ragPromptId?: string
      ragIndexVersionId?: string
    }
  ) => void
  onGenerateRoutes?: () => void
  onAddRoute: () => void
  onRemoveRoute: (index: number) => void
}

interface RouteDraft {
  id: string
  intent: string
  promptId: string
  targetType: TestRoutingTargetType
  targetId: string
  ragPromptId: string
  ragIndexVersionId: string
}

let nextRouteDraftId = 0

function createRouteDraft(route?: Partial<RouteDraft>): RouteDraft {
  const normalizedRoute = normalizeTestSuiteRoute({
    intent: route?.intent ?? "",
    promptId: route?.promptId ?? "",
    targetType: route?.targetType,
    targetId: route?.targetId,
    ragPromptId: route?.ragPromptId ?? "",
    ragIndexVersionId: route?.ragIndexVersionId ?? "",
  })

  return {
    id: route?.id ?? `route-${nextRouteDraftId++}`,
    intent: normalizedRoute.intent,
    promptId: normalizedRoute.promptId,
    targetType: normalizedRoute.targetType ?? "prompt",
    targetId: getTestRouteTargetId(normalizedRoute),
    ragPromptId: normalizedRoute.ragPromptId ?? "",
    ragIndexVersionId: normalizedRoute.ragIndexVersionId ?? "",
  }
}

function createRouteDrafts(routes: TestSuiteRoute[]) {
  return routes.length > 0 ? routes.map((route) => createRouteDraft(route)) : [createRouteDraft()]
}

function isEmptyRouteDraft(route: RouteDraft): boolean {
  return (
    route.intent.trim().length === 0 &&
    getTestRouteTargetId(route).length === 0 &&
    route.ragPromptId.trim().length === 0 &&
    route.ragIndexVersionId.trim().length === 0
  )
}

function normalizeFormRoutes(routes: Array<RouteDraft | (TestSuiteRoute & { id?: string })>) {
  return routes.map((route, index) => ({
    id: route.id ?? `route-preview-${index}`,
    intent: route.intent,
    promptId: route.promptId,
    targetType: getTestRouteTargetType(route),
    targetId: getTestRouteTargetId(route),
    ragPromptId: route.ragPromptId ?? "",
    ragIndexVersionId: route.ragIndexVersionId ?? "",
  }))
}

interface PromptComboboxProps {
  prompts: Array<{ id: string; title: string; content?: string }>
  entryPromptId: string
  value: string
  onValueChange: (value: string) => void
}

function PromptCombobox({
  prompts,
  entryPromptId,
  value,
  onValueChange,
}: PromptComboboxProps) {
  const [open, setOpen] = useState(false)
  const availablePrompts = useMemo(
    () => prompts.filter((prompt) => prompt.id !== entryPromptId),
    [entryPromptId, prompts]
  )
  const selectedPrompt = availablePrompts.find((prompt) => prompt.id === value) ?? null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selectedPrompt && "text-muted-foreground")}>
            {selectedPrompt?.title ?? "搜索并选择 Prompt"}
          </span>
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="搜索 Prompt..." />
          <CommandList className="max-h-[220px]">
            <CommandEmpty>无匹配 Prompt</CommandEmpty>
            <CommandGroup>
              {availablePrompts.map((prompt) => {
                const selected = prompt.id === value

                return (
                  <CommandItem
                    key={prompt.id}
                    value={prompt.title}
                    onSelect={() => {
                      onValueChange(prompt.id)
                      setOpen(false)
                    }}
                  >
                    <Check className={cn("size-4", selected ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{prompt.title}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function getRagRouteValidationError(
  route: Pick<TestSuiteRoute, "intent" | "ragPromptId" | "ragIndexVersionId">,
  prompts: Array<{ id: string; title: string; content?: string }>
): string | null {
  if (route.intent.trim() !== "R") {
    return null
  }

  if (!route.ragPromptId?.trim() || !route.ragIndexVersionId?.trim()) {
    return null
  }

  const selectedPrompt = prompts.find((prompt) => prompt.id === route.ragPromptId)
  if (!selectedPrompt) {
    return "未找到所选 RAG Prompt"
  }

  if (!selectedPrompt.content?.includes("{rag_qas_text}")) {
    return "RAG Prompt 必须包含 {rag_qas_text}"
  }

  return null
}

export function TestRoutingConfigDialog({
  open,
  prompts,
  indexVersions,
  value,
  onOpenChange,
  onSave,
}: TestRoutingConfigDialogProps) {
  const [entryPromptId, setEntryPromptId] = useState(value.entryPromptId)
  const [routes, setRoutes] = useState<RouteDraft[]>(() => createRouteDrafts(value.routes))

  useEffect(() => {
    setEntryPromptId(value.entryPromptId)
    setRoutes(createRouteDrafts(value.routes))
  }, [value])

  function handleEntryPromptChange(nextEntryPromptId: string) {
    setEntryPromptId(nextEntryPromptId)
    setRoutes((current) =>
      current.map((route) => {
        const shouldReevaluate =
          route.targetType === "prompt" &&
          (route.targetId.length === 0 || route.targetId === nextEntryPromptId)
        if (!shouldReevaluate) {
          return route
        }

        const matchedPrompt = findUniquePromptMatch(route.intent, prompts, nextEntryPromptId)
        return createRouteDraft({
          ...route,
          targetType: "prompt",
          targetId: matchedPrompt?.id ?? "",
          promptId: matchedPrompt?.id ?? "",
        })
      })
    )
  }

  function updateRoute(
    index: number,
    patch: {
      intent?: string
      promptId?: string
      targetType?: TestRoutingTargetType
      targetId?: string
      ragPromptId?: string
      ragIndexVersionId?: string
    }
  ) {
    setRoutes((current) =>
      current.map((route, routeIndex) =>
        routeIndex === index
          ? createRouteDraft({
              ...route,
              ...patch,
              promptId:
                patch.targetType === "index-version"
                  ? ""
                  : patch.promptId ?? route.promptId,
            })
          : route
      )
    )
  }

  function handleRouteIntentChange(index: number, intent: string) {
    setRoutes((current) =>
      current.map((route, routeIndex) => {
        if (routeIndex !== index) {
          return route
        }

        if (intent.trim() === "R") {
          const defaultRagPromptId =
            route.ragPromptId ||
            prompts.find((prompt) => prompt.id !== entryPromptId)?.id ||
            ""
          return createRouteDraft({
            ...route,
            intent,
            promptId: "",
            targetType: "prompt",
            targetId: "",
            ragPromptId: defaultRagPromptId,
            ragIndexVersionId: route.ragIndexVersionId || indexVersions[0]?.id || "",
          })
        }

        if (route.targetType !== "prompt" || route.targetId.length > 0) {
          return createRouteDraft({
            ...route,
            intent,
            ragPromptId: "",
            ragIndexVersionId: "",
          })
        }

        const matchedPrompt = findUniquePromptMatch(intent, prompts, entryPromptId)
        return createRouteDraft({
          ...route,
          intent,
          targetType: "prompt",
          targetId: matchedPrompt?.id ?? "",
          promptId: matchedPrompt?.id ?? "",
          ragPromptId: "",
          ragIndexVersionId: "",
        })
      })
    )
  }

  function handleGenerateRoutes() {
    if (!entryPromptId) {
      return
    }

    const generatedRoutes = buildRoutesFromPrompts(prompts, entryPromptId)
    if (generatedRoutes.length === 0) {
      return
    }

    const shouldConfirmReplacement =
      routes.some((route) => !isEmptyRouteDraft(route)) &&
      !(routes.length === 1 && isEmptyRouteDraft(routes[0]))

    if (
      shouldConfirmReplacement &&
      typeof window !== "undefined" &&
      !window.confirm("将覆盖当前路由配置，是否继续？")
    ) {
      return
    }

    setRoutes(createRouteDrafts(generatedRoutes))
  }

  function handleSave() {
    const normalizedRoutes = routes.map((route) =>
      normalizeTestSuiteRoute({
        intent: route.intent.trim(),
        promptId: route.promptId,
        targetType: route.targetType,
        targetId: route.targetId,
        ragPromptId: route.ragPromptId,
        ragIndexVersionId: route.ragIndexVersionId,
      })
    )
    const hasValidationError = normalizedRoutes.some((route) => getRagRouteValidationError(route, prompts))
    if (hasValidationError) {
      return
    }

    onSave({
      entryPromptId,
      routes: normalizedRoutes
        .filter((route) => isTestSuiteRouteComplete(route)),
    })
  }

  const canSave =
    entryPromptId.length > 0 &&
    routes.length > 0 &&
    routes.every((route) => {
      const normalizedRoute = normalizeTestSuiteRoute(route)
      return (
        isTestSuiteRouteComplete(normalizedRoute) &&
        !getRagRouteValidationError(normalizedRoute, prompts)
      )
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl sm:max-h-[85vh] overflow-hidden p-0">
        <div className="flex max-h-[85vh] flex-col">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>配置业务流程</DialogTitle>
            <DialogDescription>
              选择固定入口 Prompt，并配置 intent 到 Prompt 或索引版本的映射。
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <TestRoutingConfigForm
              prompts={prompts}
              indexVersions={indexVersions}
              entryPromptId={entryPromptId}
              routes={routes}
              onEntryPromptChange={handleEntryPromptChange}
              onRouteIntentChange={handleRouteIntentChange}
              onRouteChange={updateRoute}
              onGenerateRoutes={handleGenerateRoutes}
              onAddRoute={() => setRoutes((current) => [...current, createRouteDraft()])}
              onRemoveRoute={(index) =>
                setRoutes((current) =>
                  current.length === 1
                    ? [createRouteDraft()]
                    : current.filter((_, routeIndex) => routeIndex !== index)
                )
              }
            />
          </div>

          <div className="border-t px-6 py-4">
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button onClick={handleSave} disabled={!canSave}>
                保存并继续
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function TestRoutingConfigForm({
  prompts,
  indexVersions,
  entryPromptId,
  routes,
  onEntryPromptChange,
  onRouteIntentChange = (index, intent) => onRouteChange(index, { intent }),
  onRouteChange,
  onGenerateRoutes = () => {},
  onAddRoute,
  onRemoveRoute,
}: TestRoutingConfigFormProps) {
  const normalizedRoutes = normalizeFormRoutes(routes)
  const routeErrors = normalizedRoutes.map((route) => getRagRouteValidationError(route, prompts))
  const canGenerateRoutes =
    entryPromptId.length > 0 && prompts.some((prompt) => prompt.id !== entryPromptId)

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-medium">入口 Prompt</label>
        <Select value={entryPromptId} onValueChange={onEntryPromptChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="选择入口 Prompt" />
          </SelectTrigger>
          <SelectContent>
            {prompts.map((prompt) => (
              <SelectItem key={prompt.id} value={prompt.id}>
                {prompt.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">路由规则</p>
            <p className="text-xs text-muted-foreground">
              用户自定义 intent 值，命中后跳转到对应 Prompt 或索引版本。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onGenerateRoutes}
              disabled={!canGenerateRoutes}
            >
              从 Prompts 生成路由
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onAddRoute}
            >
              <Plus className="mr-1 size-4" />
              添加路由
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {normalizedRoutes.map((route, index) => (
            <div
              key={route.id}
              className={
                route.intent.trim() === "R"
                  ? "grid gap-3 rounded-lg border bg-muted/30 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_auto]"
                  : "grid gap-3 rounded-lg border bg-muted/30 p-3 md:grid-cols-[minmax(0,1fr)_160px_minmax(0,1.2fr)_auto]"
              }
            >
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  intent 值
                </label>
                <Input
                  value={route.intent}
                  onChange={(event) => onRouteIntentChange(index, event.target.value)}
                  placeholder="例如 after_sale"
                />
              </div>

              {route.intent.trim() === "R" ? (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      RAG Prompt
                    </label>
                    <PromptCombobox
                      prompts={prompts}
                      entryPromptId={entryPromptId}
                      value={route.ragPromptId}
                      onValueChange={(ragPromptId) =>
                        onRouteChange(index, {
                          promptId: "",
                          targetType: "prompt",
                          targetId: "",
                          ragPromptId,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      索引版本
                    </label>
                    <Select
                      value={route.ragIndexVersionId}
                      onValueChange={(ragIndexVersionId) =>
                        onRouteChange(index, {
                          promptId: "",
                          targetType: "prompt",
                          targetId: "",
                          ragIndexVersionId,
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="选择索引版本" />
                      </SelectTrigger>
                      <SelectContent>
                        {indexVersions.map((indexVersion) => (
                          <SelectItem key={indexVersion.id} value={indexVersion.id}>
                            {indexVersion.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      目标类型
                    </label>
                    <Select
                      value={route.targetType}
                      onValueChange={(value) => {
                        const nextTargetType = value as TestRoutingTargetType
                        if (nextTargetType === "prompt") {
                          const matchedPrompt = findUniquePromptMatch(route.intent, prompts, entryPromptId)
                          onRouteChange(index, {
                            targetType: nextTargetType,
                            targetId: matchedPrompt?.id ?? "",
                            promptId: matchedPrompt?.id ?? "",
                            ragPromptId: "",
                            ragIndexVersionId: "",
                          })
                          return
                        }

                        onRouteChange(index, {
                          targetType: nextTargetType,
                          targetId: indexVersions[0]?.id ?? "",
                          promptId: "",
                          ragPromptId: "",
                          ragIndexVersionId: "",
                        })
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="选择目标类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prompt">Prompt</SelectItem>
                        <SelectItem value="index-version">索引版本</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      目标内容
                    </label>
                    {route.targetType === "prompt" ? (
                      <PromptCombobox
                        prompts={prompts}
                        entryPromptId={entryPromptId}
                        value={route.targetId}
                        onValueChange={(promptId) =>
                          onRouteChange(index, {
                            targetType: "prompt",
                            targetId: promptId,
                            promptId,
                            ragPromptId: "",
                            ragIndexVersionId: "",
                          })
                        }
                      />
                    ) : (
                      <Select
                        value={route.targetId}
                        onValueChange={(targetId) =>
                          onRouteChange(index, {
                            targetType: "index-version",
                            targetId,
                            promptId: "",
                            ragPromptId: "",
                            ragIndexVersionId: "",
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="选择索引版本" />
                        </SelectTrigger>
                        <SelectContent>
                          {indexVersions.map((indexVersion) => (
                            <SelectItem key={indexVersion.id} value={indexVersion.id}>
                              {indexVersion.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </>
              )}

              <div className="flex items-end">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => onRemoveRoute(index)}
                  aria-label={`删除第 ${index + 1} 条路由`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              {routeErrors[index] ? (
                <div className="md:col-span-full text-xs text-destructive">
                  {routeErrors[index]}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
