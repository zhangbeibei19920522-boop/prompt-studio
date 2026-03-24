"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"

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
import type { TestSuiteRoutingConfig } from "@/types/database"

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
  onRouteChange: (index: number, patch: { intent?: string; promptId?: string }) => void
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

  function updateRoute(index: number, patch: { intent?: string; promptId?: string }) {
    setRoutes((current) =>
      current.map((route, routeIndex) =>
        routeIndex === index ? { ...route, ...patch } : route
      )
    )
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>配置业务流程</DialogTitle>
          <DialogDescription>
            选择固定入口 Prompt，并配置 intent 到目标 Prompt 的映射。
          </DialogDescription>
        </DialogHeader>

        <TestRoutingConfigForm
          prompts={prompts}
          entryPromptId={entryPromptId}
          routes={routes}
          onEntryPromptChange={setEntryPromptId}
          onRouteChange={updateRoute}
          onAddRoute={() => setRoutes((current) => [...current, createRouteDraft()])}
          onRemoveRoute={(index) =>
            setRoutes((current) =>
              current.length === 1
                ? [createRouteDraft()]
                : current.filter((_, routeIndex) => routeIndex !== index)
            )
          }
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            保存并继续
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TestRoutingConfigForm({
  prompts,
  entryPromptId,
  routes,
  onEntryPromptChange,
  onRouteChange,
  onAddRoute,
  onRemoveRoute,
}: TestRoutingConfigFormProps) {
  return (
    <div className="space-y-5 py-2">
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

        <div className="space-y-3">
          {routes.map((route, index) => (
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
                  onChange={(event) =>
                    onRouteChange(index, { intent: event.target.value })
                  }
                  placeholder="例如 after_sale"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  目标 Prompt
                </label>
                <Select
                  value={route.promptId}
                  onValueChange={(promptId) => onRouteChange(index, { promptId })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择目标 Prompt" />
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
