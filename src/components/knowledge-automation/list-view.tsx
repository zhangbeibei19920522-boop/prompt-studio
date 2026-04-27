import { BookOpen, Plus, Search } from "lucide-react"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
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
import type { KnowledgePushRecord, KnowledgeTaskRow, KnowledgeVersionRow } from "./model"
import {
  knowledgeVersionBadgeVariant,
  type CustomerState,
  type DetailMode,
} from "./prototype-data"

export type KnowledgeListSection = "versions" | "tasks"

export function ListView({
  customer,
  versionRows = [],
  taskRows = [],
  pushRecords = [],
  notice = null,
  isMutatingVersionId = null,
  onCreate,
  onOpenDetail,
  onOpenVersionDetail,
  onPushToStg,
  onPushToProd,
  onRollback,
  section = "versions",
}: {
  customer: CustomerState
  versionRows?: KnowledgeVersionRow[]
  taskRows?: KnowledgeTaskRow[]
  pushRecords?: KnowledgePushRecord[]
  notice?: string | null
  isMutatingVersionId?: string | null
  onCreate: () => void
  onOpenDetail: (taskId: string) => void
  onOpenVersionDetail?: (knowledgeVersionId: string, mode?: DetailMode) => void
  onPushToStg?: (knowledgeVersionId: string) => Promise<void> | void
  onPushToProd?: (knowledgeVersionId: string) => Promise<void> | void
  onRollback?: (knowledgeVersionId: string) => Promise<void> | void
  section?: KnowledgeListSection
}) {
  const [localNotice, setLocalNotice] = useState<string | null>(null)
  const [historyKeyword, setHistoryKeyword] = useState("")
  const [rollbackTarget, setRollbackTarget] = useState<KnowledgeVersionRow | null>(null)
  const [pushTarget, setPushTarget] = useState<{
    row: KnowledgeVersionRow
    environment: "STG" | "PROD"
  } | null>(null)
  const [pushHistoryOpen, setPushHistoryOpen] = useState(false)

  const effectiveNotice = notice ?? localNotice
  const historyVersions = useMemo(() => {
    const keyword = historyKeyword.trim().toLowerCase()
    if (!keyword) return versionRows
    return versionRows.filter((row) =>
      `${row.knowledgeVersionId} ${row.indexVersionId} ${row.auditStatus}`.toLowerCase().includes(keyword)
    )
  }, [historyKeyword, versionRows])

  async function confirmRollback() {
    if (!rollbackTarget || !onRollback) return
    await onRollback(rollbackTarget.knowledgeVersionId)
    setLocalNotice(`已提交回滚：${rollbackTarget.knowledgeVersionId}`)
    setRollbackTarget(null)
  }

  async function confirmPushTarget() {
    if (!pushTarget) return
    if (pushTarget.environment === "PROD") {
      await onPushToProd?.(pushTarget.row.knowledgeVersionId)
      setLocalNotice(`已 Push Prod：${pushTarget.row.knowledgeVersionId}`)
    } else {
      await onPushToStg?.(pushTarget.row.knowledgeVersionId)
      setLocalNotice(`已 Push STG：${pushTarget.row.knowledgeVersionId}`)
    }
    setPushTarget(null)
  }

  if (!customer.hasKnowledgeBase) {
    return (
      <section className="grid min-h-[70vh] place-items-center">
        <div className="w-full max-w-2xl rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-md bg-blue-50">
            <BookOpen className="size-7 text-blue-700" />
          </div>
          <Badge variant="outline" className="mb-4 rounded-md">
            尚未创建知识库
          </Badge>
          <h2 className="text-2xl font-semibold">当前客户还没有知识库</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
            先创建第一版全量构建任务。选择文档库原文件后，系统会进入解析、清洗、metadata 确认和索引版本构建流程。
          </p>
          <div className="mt-6 flex justify-center">
            <Button onClick={onCreate}>
              <Plus className="size-4" />
              创建知识库
            </Button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">{section === "versions" ? "版本管理" : "清洗任务"}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {section === "versions" ? "查看版本列表。" : "查看当前清洗任务和处理状态。"}
          </p>
        </div>
        {section === "tasks" ? (
          <div>
            <Button onClick={onCreate}>
              <Plus className="size-4" />
              新建任务
            </Button>
          </div>
        ) : section === "versions" ? (
          <div>
            <Button variant="outline" onClick={() => setPushHistoryOpen(true)}>
              推送记录
            </Button>
          </div>
        ) : null}
      </section>

      {section === "versions" ? (
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <h3 className="font-semibold">版本列表</h3>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
              <Input
                className="w-72 pl-9"
                placeholder="搜索知识版本或索引版本"
                value={historyKeyword}
                onChange={(event) => setHistoryKeyword(event.target.value)}
              />
            </div>
          </div>

          {effectiveNotice ? (
            <div className="border-b border-slate-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-700">{effectiveNotice}</div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-5 py-3">知识版本 ID</th>
                  <th className="px-5 py-3">索引版本 ID</th>
                  <th className="px-5 py-3">状态</th>
                  <th className="px-5 py-3">发布时间</th>
                  <th className="px-5 py-3">覆盖率</th>
                  <th className="px-5 py-3">审计状态</th>
                  <th className="px-5 py-3">问答对数</th>
                  <th className="px-5 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {historyVersions.length > 0 ? (
                  historyVersions.map((row) => (
                    <tr key={row.knowledgeVersionId} className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-4 font-medium text-slate-950">{row.knowledgeVersionId}</td>
                      <td className="px-5 py-4 text-slate-600">{row.indexVersionId}</td>
                      <td className="px-5 py-4">
                        <Badge variant={knowledgeVersionBadgeVariant(row.status)} className="rounded-md">
                          {row.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{row.publishedAt}</td>
                      <td className="px-5 py-4 text-slate-600">{row.coverage}</td>
                      <td className="px-5 py-4 text-slate-600">{row.auditStatus}</td>
                      <td className="px-5 py-4 text-slate-600">{row.qaPairCount}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Button
                            variant="link"
                            className="h-auto px-0"
                            onClick={() => onOpenVersionDetail?.(row.knowledgeVersionId, row.status === "STG" ? "stg" : "history")}
                          >
                            查看
                          </Button>
                          {row.status === "草稿" ? (
                            <Button
                              variant="link"
                              className="h-auto px-0"
                              disabled={isMutatingVersionId === row.knowledgeVersionId}
                              onClick={() => setPushTarget({ row, environment: "STG" })}
                            >
                              Push STG
                            </Button>
                          ) : row.status === "STG" ? (
                            <Button
                              variant="link"
                              className="h-auto px-0"
                              disabled={isMutatingVersionId === row.knowledgeVersionId}
                              onClick={() => setPushTarget({ row, environment: "PROD" })}
                            >
                              Push Prod
                            </Button>
                          ) : row.status === "已归档" ? (
                            <Button
                              variant="link"
                              className="h-auto px-0"
                              disabled={isMutatingVersionId === row.knowledgeVersionId}
                              onClick={() => setRollbackTarget(row)}
                            >
                              回滚
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-slate-500">
                      还没有知识版本记录。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="font-semibold">任务列表</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-5 py-3">记录名称</th>
                  <th className="px-5 py-3">记录类型</th>
                  <th className="px-5 py-3">负责人</th>
                  <th className="px-5 py-3">当前阶段</th>
                  <th className="px-5 py-3">状态</th>
                  <th className="px-5 py-3">进度</th>
                  <th className="px-5 py-3">最近更新</th>
                  <th className="px-5 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {taskRows.length > 0 ? (
                  taskRows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-4 font-medium text-slate-950">{row.name}</td>
                      <td className="px-5 py-4 text-slate-600">{row.type}</td>
                      <td className="px-5 py-4 text-slate-600">{row.owner}</td>
                      <td className="px-5 py-4 text-slate-600">{row.stage}</td>
                      <td className="px-5 py-4">
                        <Badge variant={knowledgeVersionBadgeVariant(row.status)} className="rounded-md">
                          {row.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        <div className="w-40 space-y-1">
                          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full rounded-full transition-all ${row.isRunning ? "bg-blue-600" : "bg-emerald-500"}`}
                              style={{ width: `${Math.max(0, Math.min(100, row.isRunning && row.progress === 0 ? 8 : row.progress))}%` }}
                            />
                          </div>
                          <div className="text-xs text-slate-500">{row.progress}%</div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{row.updatedAt}</td>
                      <td className="px-5 py-4">
                        <Button
                          variant="link"
                          className="h-auto px-0"
                          onClick={() => onOpenDetail(row.id)}
                        >
                          查看记录
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-slate-500">
                      还没有清洗任务记录。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Dialog open={section === "versions" && pushHistoryOpen} onOpenChange={setPushHistoryOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>版本推送记录</DialogTitle>
            <DialogDescription>查看整个项目的版本推送和回滚记录。</DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-4 py-3">时间</th>
                  <th className="px-4 py-3">动作</th>
                  <th className="px-4 py-3">知识版本 ID</th>
                  <th className="px-4 py-3">目标环境</th>
                  <th className="px-4 py-3">操作人</th>
                </tr>
              </thead>
              <tbody>
                {pushRecords.length > 0 ? (
                  pushRecords.map((record) => (
                    <tr key={`${record.operatedAt}-${record.action}-${record.knowledgeVersionId}`} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 text-slate-600">{record.operatedAt}</td>
                      <td className="px-4 py-3 font-medium text-slate-950">{record.action}</td>
                      <td className="px-4 py-3 text-slate-600">{record.knowledgeVersionId}</td>
                      <td className="px-4 py-3 text-slate-600">{record.targetEnvironment}</td>
                      <td className="px-4 py-3 text-slate-600">{record.operator}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      当前还没有推送记录。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={section === "versions" && pushTarget !== null} onOpenChange={(open) => !open && setPushTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pushTarget?.environment === "PROD" ? "确认 Push Prod" : "确认 Push STG"}</DialogTitle>
            <DialogDescription>Push 后，当前环境会切换到所选版本。</DialogDescription>
          </DialogHeader>
          {pushTarget ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">知识版本 ID</span>
                <strong className="text-slate-950">{pushTarget.row.knowledgeVersionId}</strong>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-slate-500">目标环境</span>
                <strong className="text-slate-950">{pushTarget.environment}</strong>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPushTarget(null)}>
              取消
            </Button>
            <Button onClick={() => void confirmPushTarget()} disabled={isMutatingVersionId === pushTarget?.row.knowledgeVersionId}>
              {pushTarget?.environment === "PROD" ? "确认 Push Prod" : "确认 Push STG"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={section === "versions" && rollbackTarget !== null} onOpenChange={(open) => !open && setRollbackTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认回滚</DialogTitle>
            <DialogDescription>回滚后，当前环境会切换到所选版本。</DialogDescription>
          </DialogHeader>
          {rollbackTarget ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">知识版本 ID</span>
                <strong className="text-slate-950">{rollbackTarget.knowledgeVersionId}</strong>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-slate-500">目标环境</span>
                <strong className="text-slate-950">PROD</strong>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRollbackTarget(null)}>
              取消
            </Button>
            <Button onClick={() => void confirmRollback()} disabled={isMutatingVersionId === rollbackTarget?.knowledgeVersionId}>
              确认回滚
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
