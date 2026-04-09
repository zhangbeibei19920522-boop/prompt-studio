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
import { cn } from "@/lib/utils"
import type { TestSuiteRoutingConfig } from "@/types/database"
import {
  buildRoutesFromPrompts,
  findUniquePromptMatch,
} from "./routing-config-utils"

interface TestRoutingConfigDialogProps {
  open: boolean
  prompts: Array<{ id: string; title: string }>
  value: TestSuiteRoutingConfig
  onOpenChange: (open: boolean) => void
  onSave: (value: TestSuiteRoutingConfig) => void
}

interface TestRoutingConfigFormProps {
  prompts: Array<{ id: string; title: string }>
  entryPromptId: string
  routes: Array<{ id?: string; intent: string; promptId: string }>
  onEntryPromptChange: (value: string) => void
  onRouteIntentChange?: (index: number, intent: string) => void
  onRouteChange: (index: number, patch: { intent?: string; promptId?: string }) => void
  onGenerateRoutes?: () => void
  onAddRoute: () => void
  onRemoveRoute: (index: number) => void
}

interface RouteDraft {
  id: string
  intent: string
  promptId: string
}

let nextRouteDraftId = 0

function createRouteDraft(route?: Partial<Omit<RouteDraft, "id">>): RouteDraft {
  return {
    id: `route-${nextRouteDraftId++}`,
    intent: route?.intent ?? "",
    promptId: route?.promptId ?? "",
  }
}

function createRouteDrafts(routes: Array<{ intent: string; promptId: string }>) {
  return routes.length > 0 ? routes.map((route) => createRouteDraft(route)) : [createRouteDraft()]
}

function isEmptyRouteDraft(route: { intent: string; promptId: string }): boolean {
  return route.intent.trim().length === 0 && route.promptId.length === 0
}

function normalizeFormRoutes(routes: Array<{ id?: string; intent: string; promptId: string }>) {
  return routes.map((route, index) => ({
    id: route.id ?? `route-preview-${index}`,
    intent: route.intent,
    promptId: route.promptId,
  }))
}

interface PromptComboboxProps {
  prompts: Array<{ id: string; title: string }>
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

export function TestRoutingConfigDialog({
  open,
  prompts,
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
        const shouldReevaluate = route.promptId.length === 0 || route.promptId === nextEntryPromptId
        if (!shouldReevaluate) {
          return route
        }

        const matchedPrompt = findUniquePromptMatch(route.intent, prompts, nextEntryPromptId)
        return {
          ...route,
          promptId: matchedPrompt?.id ?? "",
        }
      })
    )
  }

  function updateRoute(index: number, patch: { intent?: string; promptId?: string }) {
    setRoutes((current) =>
      current.map((route, routeIndex) =>
        routeIndex === index ? { ...route, ...patch } : route
      )
    )
  }

  function handleRouteIntentChange(index: number, intent: string) {
    setRoutes((current) =>
      current.map((route, routeIndex) => {
        if (routeIndex !== index) {
          return route
        }

        if (route.promptId.length > 0) {
          return { ...route, intent }
        }

        const matchedPrompt = findUniquePromptMatch(intent, prompts, entryPromptId)
        return {
          ...route,
          intent,
          promptId: matchedPrompt?.id ?? "",
        }
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
    onSave({
      entryPromptId,
      routes: routes
        .map((route) => ({
          intent: route.intent.trim(),
          promptId: route.promptId,
        }))
        .filter((route) => route.intent.length > 0 && route.promptId.length > 0),
    })
  }

  const canSave =
    entryPromptId.length > 0 &&
    routes.length > 0 &&
    routes.every((route) => route.intent.trim().length > 0 && route.promptId.length > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl sm:max-h-[85vh] overflow-hidden p-0">
        <div className="flex max-h-[85vh] flex-col">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>配置业务流程</DialogTitle>
            <DialogDescription>
              选择固定入口 Prompt，并配置 intent 到目标 Prompt 的映射。
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <TestRoutingConfigForm
              prompts={prompts}
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
              用户自定义 intent 值，命中后跳转到对应 Prompt。
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
              className="grid gap-3 rounded-lg border bg-muted/30 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]"
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

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  目标 Prompt
                </label>
                <PromptCombobox
                  prompts={prompts}
                  entryPromptId={entryPromptId}
                  value={route.promptId}
                  onValueChange={(promptId) => onRouteChange(index, { promptId })}
                />
              </div>

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
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
