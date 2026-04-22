"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Database } from "lucide-react"

import type {
  KnowledgeBase,
  KnowledgeBuildTask,
  KnowledgeIndexVersion,
  KnowledgeVersion,
} from "@/types/database"
import { knowledgeApi } from "@/lib/utils/api-client"

import { CreateView, type CreateKnowledgeTaskPayload } from "./create-view"
import { DetailView } from "./detail-view"
import { ListView, type KnowledgeListSection } from "./list-view"
import {
  buildKnowledgePushRecords,
  buildKnowledgeTaskRows,
  buildKnowledgeVersionRows,
  type KnowledgePushRecord,
} from "./model"
import { VersionDetailView } from "./version-detail-view"
import { type DetailMode, type DetailState, type DetailTab, type PrototypeView } from "./prototype-data"

export interface KnowledgeAutomationSourceDocument {
  id: string
  name: string
  type: string
}

interface KnowledgeAutomationPanelProps {
  projectId: string | null
  projectName: string
  documents: KnowledgeAutomationSourceDocument[]
  section?: KnowledgeListSection
  initialData?: {
    knowledgeBase: KnowledgeBase | null
    tasks: KnowledgeBuildTask[]
    versions: KnowledgeVersion[]
    indexVersions: KnowledgeIndexVersion[]
  }
}

export function KnowledgeAutomationPanel({
  projectId,
  projectName,
  documents,
  section = "versions",
  initialData,
}: KnowledgeAutomationPanelProps) {
  const [view, setView] = useState<PrototypeView | "version-detail">("list")
  const [detailState, setDetailState] = useState<DetailState>("risk")
  const [detailMode, setDetailMode] = useState<DetailMode>("candidate")
  const [activeTab, setActiveTab] = useState<DetailTab>("risk")
  const [selectedKnowledgeVersionId, setSelectedKnowledgeVersionId] = useState<string | null>(null)
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(initialData?.knowledgeBase ?? null)
  const [tasks, setTasks] = useState<KnowledgeBuildTask[]>(initialData?.tasks ?? [])
  const [versions, setVersions] = useState<KnowledgeVersion[]>(initialData?.versions ?? [])
  const [indexVersions, setIndexVersions] = useState<KnowledgeIndexVersion[]>(initialData?.indexVersions ?? [])
  const [versionDetails, setVersionDetails] = useState<Record<string, KnowledgeVersion>>({})
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [actionRecords, setActionRecords] = useState<KnowledgePushRecord[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(projectId) && !initialData)
  const [isSubmittingTask, setIsSubmittingTask] = useState(false)
  const [isMutatingVersionId, setIsMutatingVersionId] = useState<string | null>(null)

  const versionRows = useMemo(() => buildKnowledgeVersionRows(versions, indexVersions), [versions, indexVersions])
  const taskRows = useMemo(() => buildKnowledgeTaskRows(tasks), [tasks])
  const generatedPushRecords = useMemo(() => buildKnowledgePushRecords(versions), [versions])
  const pushRecords = useMemo(() => {
    return [...actionRecords, ...generatedPushRecords.filter((record) => {
      return !actionRecords.some((action) =>
        action.action === record.action &&
        action.knowledgeVersionId === record.knowledgeVersionId &&
        action.targetEnvironment === record.targetEnvironment
      )
    })]
  }, [actionRecords, generatedPushRecords])
  const selectedVersion = selectedKnowledgeVersionId
    ? versionDetails[selectedKnowledgeVersionId] ?? versions.find((version) => version.id === selectedKnowledgeVersionId) ?? null
    : null

  const hasKnowledgeBase = Boolean(knowledgeBase)
  const currentVersionLabel =
    versionRows.find((row) => row.status === "PROD")?.knowledgeVersionId ??
    versionRows.find((row) => row.status === "STG")?.knowledgeVersionId ??
    versionRows[0]?.knowledgeVersionId ??
    ""
  const customer = {
    id: "acme" as const,
    name: projectName,
    hasKnowledgeBase,
    knowledgeBaseName: knowledgeBase?.name ?? `${projectName} 知识库`,
    currentVersion: currentVersionLabel,
  }

  const loadKnowledgeData = useCallback(async () => {
    if (!projectId) return

    setIsLoading(true)
    try {
      const [nextKnowledgeBase, nextTasks, nextVersions, nextIndexVersions] = await Promise.all([
        knowledgeApi.getKnowledgeBase(projectId),
        knowledgeApi.listKnowledgeTasks(projectId),
        knowledgeApi.listKnowledgeVersions(projectId),
        knowledgeApi.listKnowledgeIndexVersions(projectId),
      ])

      setKnowledgeBase(nextKnowledgeBase)
      setTasks(nextTasks)
      setVersions(nextVersions)
      setIndexVersions(nextIndexVersions)
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : "加载知识库数据失败")
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (!projectId) return
    void loadKnowledgeData()
  }, [loadKnowledgeData, projectId])

  function openDetail(nextState: DetailState = "risk", nextTab?: DetailTab, nextMode: DetailMode = "candidate") {
    setDetailState(nextState)
    setDetailMode(nextMode)
    setActiveTab(nextTab ?? (nextState === "ready" || nextState === "indexed" ? "rounds" : "risk"))
    setView("detail")
  }

  async function openVersionDetail(knowledgeVersionId: string, nextMode: DetailMode = "history") {
    setSelectedKnowledgeVersionId(knowledgeVersionId)
    setDetailMode(nextMode)
    setView("version-detail")

    if (versionDetails[knowledgeVersionId]) return

    try {
      const version = await knowledgeApi.getKnowledgeVersion(knowledgeVersionId)
      setVersionDetails((current) => ({ ...current, [knowledgeVersionId]: version }))
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : "加载知识版本详情失败")
    }
  }

  async function handleSubmitTask(payload: CreateKnowledgeTaskPayload) {
    if (!projectId) return

    setIsSubmittingTask(true)
    try {
      let ensuredKnowledgeBase = knowledgeBase
      if (!ensuredKnowledgeBase) {
        ensuredKnowledgeBase = await knowledgeApi.createKnowledgeBase(projectId, {
          name: `${projectName} 知识库`,
        })
        setKnowledgeBase(ensuredKnowledgeBase)
      }

      const result = await knowledgeApi.createKnowledgeTask(projectId, {
        name: payload.name,
        taskType: payload.taskType,
        baseVersionId: payload.baseVersionId,
        documentIds: payload.documentIds,
        manualDrafts: payload.manualDrafts,
        repairQuestions: payload.repairQuestions,
      })

      await loadKnowledgeData()
      setVersionDetails((current) => ({ ...current, [result.version.id]: result.version }))
      setActionNotice(`已启动任务：${result.task.name}`)
      await openVersionDetail(result.version.id, "history")
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : "启动任务失败")
      throw error
    } finally {
      setIsSubmittingTask(false)
    }
  }

  async function handlePushStg(knowledgeVersionId: string) {
    setIsMutatingVersionId(knowledgeVersionId)
    try {
      await knowledgeApi.pushStg(knowledgeVersionId)
      setActionRecords((current) => [
        {
          action: "Push STG",
          knowledgeVersionId,
          targetEnvironment: "STG",
          operator: "当前操作",
          operatedAt: "刚刚",
        },
        ...current,
      ])
      setActionNotice(`已 Push STG：${knowledgeVersionId}`)
      await loadKnowledgeData()
      const version = await knowledgeApi.getKnowledgeVersion(knowledgeVersionId)
      setVersionDetails((current) => ({ ...current, [knowledgeVersionId]: version }))
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : "Push STG 失败")
    } finally {
      setIsMutatingVersionId(null)
    }
  }

  async function handlePushProd(knowledgeVersionId: string) {
    setIsMutatingVersionId(knowledgeVersionId)
    try {
      await knowledgeApi.pushProd(knowledgeVersionId)
      setActionRecords((current) => [
        {
          action: "Push Prod",
          knowledgeVersionId,
          targetEnvironment: "PROD",
          operator: "当前操作",
          operatedAt: "刚刚",
        },
        ...current,
      ])
      setActionNotice(`已 Push Prod：${knowledgeVersionId}`)
      await loadKnowledgeData()
      const version = await knowledgeApi.getKnowledgeVersion(knowledgeVersionId)
      setVersionDetails((current) => ({ ...current, [knowledgeVersionId]: version }))
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : "Push Prod 失败")
    } finally {
      setIsMutatingVersionId(null)
    }
  }

  async function handleRollback(knowledgeVersionId: string) {
    setIsMutatingVersionId(knowledgeVersionId)
    try {
      await knowledgeApi.rollback(knowledgeVersionId)
      setActionRecords((current) => [
        {
          action: "回滚",
          knowledgeVersionId,
          targetEnvironment: "PROD",
          operator: "当前操作",
          operatedAt: "刚刚",
        },
        ...current,
      ])
      setActionNotice(`已提交回滚：${knowledgeVersionId}`)
      await loadKnowledgeData()
      const version = await knowledgeApi.getKnowledgeVersion(knowledgeVersionId)
      setVersionDetails((current) => ({ ...current, [knowledgeVersionId]: version }))
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : "回滚失败")
    } finally {
      setIsMutatingVersionId(null)
    }
  }

  return (
    <div className="space-y-5">
      {!hasKnowledgeBase && !isLoading && documents.length === 0 && view === "list" ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
          <Database className="mx-auto mb-3 size-8 text-zinc-500" />
          <h3 className="text-base font-semibold text-zinc-900">文档库暂无可选文档</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-600">
            清洗与索引任务会基于当前项目的文档库创建。请先在文档库补充资料，再进入这里选择来源并生成索引。
          </p>
        </div>
      ) : null}

      {isLoading && view === "list" ? (
        <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-500">
          正在加载知识库数据...
        </div>
      ) : null}

      {(!isLoading || view !== "list") && (documents.length > 0 || hasKnowledgeBase || view !== "list") && (
        <>
          {view === "list" && (
            <ListView
              customer={customer}
              section={section}
              versionRows={versionRows}
              taskRows={taskRows}
              pushRecords={pushRecords}
              notice={actionNotice}
              isMutatingVersionId={isMutatingVersionId}
              onCreate={() => setView("create")}
              onOpenDetail={openDetail}
              onOpenVersionDetail={(knowledgeVersionId, mode) => void openVersionDetail(knowledgeVersionId, mode)}
              onPushToStg={(knowledgeVersionId) => handlePushStg(knowledgeVersionId)}
              onPushToProd={(knowledgeVersionId) => handlePushProd(knowledgeVersionId)}
              onRollback={(knowledgeVersionId) => handleRollback(knowledgeVersionId)}
            />
          )}
          {view === "create" && (
            <CreateView
              customer={customer}
              sourceDocuments={documents}
              versionOptions={versionRows
                .filter((row) => row.status !== "草稿")
                .map((row) => ({
                  value: row.knowledgeVersionId,
                  label: `${row.knowledgeVersionId} / ${row.status}`,
                }))}
              isSubmitting={isSubmittingTask}
              onBack={() => setView("list")}
              onSubmit={(payload) => handleSubmitTask(payload)}
            />
          )}
          {view === "detail" && (
            <DetailView
              customer={customer}
              detailState={detailState}
              detailMode={detailMode}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onBack={() => setView("list")}
              onSetState={setDetailState}
            />
          )}
          {view === "version-detail" && (
            <VersionDetailView version={selectedVersion} onBack={() => setView("list")} />
          )}
        </>
      )}
    </div>
  )
}
