import {
  ArrowLeft,
  ChevronRight,
  CircleAlert,
  ShieldAlert,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { KnowledgeBuildTask, KnowledgeIndexVersion, KnowledgeVersion } from "@/types/database"
import { MetricCard } from "./metric-card"
import {
  cleanedDrafts,
  pipelineStages,
  pipelineState,
  stateCopy,
  type CustomerState,
  type DetailMode,
  type DetailState,
  type DetailTab,
} from "./prototype-data"

interface GeneratedIndexVersion {
  indexVersionName: string
  indexVersionId: string
  buildTime: string
}

type VersionDetailsMap = Record<string, KnowledgeVersion>

function formatAuditStatus(version?: KnowledgeVersion | null) {
  if (!version) return "待确认"
  if (version.coverageAudit.auditStatus === "normal") return "正常"
  return `需关注：${version.coverageAudit.reasons.join("；") || "覆盖率或内容完整性待确认"}`
}

function formatTimestamp(value?: string | null) {
  if (!value) return "-"
  return value.replace("T", " ").slice(0, 16)
}

function toStringValue(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join("、")
  if (typeof value === "boolean") return value ? "true" : "false"
  return typeof value === "string" || typeof value === "number" ? String(value) : ""
}

function findMetadataValue(metadata: Record<string, unknown> | undefined, keys: string[]) {
  for (const key of keys) {
    const value = metadata?.[key]
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value
    }
  }
  return ""
}

function humanizeReason(reason: string | undefined, fallback: string) {
  if (!reason) return fallback
  if (reason.includes("Conflicting answers were detected")) return "同一问题检测到不同答案，需要人工确认最终口径。"
  if (reason.includes("Matched generic high-risk policy keywords")) return "命中高风险规则，需要人工确认是否保留。"
  if (reason.includes("Repair requests remain pending")) return "修复请求暂未形成可发布答案，需要继续确认。"
  if (reason.includes("Missing answer content")) return "抽取后缺少可用答案内容，需要补充或确认。"
  return reason
}

function buildListKey(prefix: string, value: string, index: number) {
  return `${prefix}-${index}-${value}`
}

function normalizeQuestion(value: string | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/^\d+[\.\)]\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
}

function findMatchingParent(version: KnowledgeVersion | null | undefined, question: string) {
  const normalizedQuestion = normalizeQuestion(question)
  if (!normalizedQuestion) return null

  return (
    version?.parents?.find((parent) => {
      if (normalizeQuestion(parent.question) === normalizedQuestion) return true
      return parent.questionAliases.some((alias) => normalizeQuestion(alias) === normalizedQuestion)
    }) ?? null
  )
}

function resolveReferenceVersion(
  task: KnowledgeBuildTask | null | undefined,
  currentVersion: KnowledgeVersion | null | undefined,
  versions: KnowledgeVersion[],
  versionDetails: VersionDetailsMap,
) {
  if (task?.baseVersionId) {
    return versionDetails[task.baseVersionId] ?? versions.find((item) => item.id === task.baseVersionId) ?? null
  }

  if (!currentVersion) {
    return null
  }

  const orderedVersions = [...versions].sort((left, right) => (right.createdAt || "").localeCompare(left.createdAt || ""))
  const currentIndex = orderedVersions.findIndex((item) => item.id === currentVersion.id)
  if (currentIndex >= 0) {
    return orderedVersions.slice(currentIndex + 1).find((item) => item.id !== currentVersion.id) ?? null
  }

  return orderedVersions.find((item) => item.id !== currentVersion.id) ?? null
}

function buildVersionSourceLabel(version: KnowledgeVersion | null | undefined, sourceFiles: string[]) {
  const fileLabel = sourceFiles.filter(Boolean).join("、")
  if (version?.id && fileLabel) return `${version.id} · ${fileLabel}`
  if (fileLabel) return fileLabel
  return version?.id ?? "当前知识版本"
}

function buildRuntimeCopy(
  detailState: DetailState,
  task?: KnowledgeBuildTask | null,
  version?: KnowledgeVersion | null,
) {
  const fallback = stateCopy(detailState)
  if (!task && !version) return fallback

  const isExecuting =
    task?.status === "running" ||
    ((task?.currentStep === "queued" || task?.currentStep === "building_artifacts") && !task?.completedAt)

  if (isExecuting) {
    return {
      status: "执行中",
      nextAction: "任务执行中",
      pendingCount: 0,
      indexReady: false,
      description: fallback.description,
    }
  }

  const pendingCount =
    (version?.stageSummary.highRiskCount ?? 0) +
    (version?.stageSummary.blockedCount ?? 0) +
    (version?.stageSummary.pendingCount ?? 0)
  const indexReady = version?.status === "stg" || version?.status === "prod"

  return {
    status:
      detailState === "risk"
        ? "待人工确认"
        : detailState === "review"
          ? "待发布 STG"
          : detailState === "indexed"
            ? "STG 测试通过"
            : "已发布 PROD",
    nextAction:
      detailState === "risk"
        ? "处理风险与冲突"
        : detailState === "indexed"
          ? "发布到 PROD"
          : detailState === "ready"
            ? "当前为 PROD 版本"
            : "发布到 STG",
    pendingCount,
    indexReady,
    description: fallback.description,
  }
}

export function DetailView({
  customer,
  detailState,
  detailMode,
  activeTab,
  task,
  version,
  isVersionLoading = false,
  hasVersionDetailLoaded = true,
  versions = [],
  indexVersions = [],
  versionDetails = {},
  onTabChange,
  onBack,
  onSetState,
  onLoadVersionDetail,
}: {
  customer: CustomerState
  detailState: DetailState
  detailMode: DetailMode
  activeTab: DetailTab
  task?: KnowledgeBuildTask | null
  version?: KnowledgeVersion | null
  isVersionLoading?: boolean
  hasVersionDetailLoaded?: boolean
  versions?: KnowledgeVersion[]
  indexVersions?: KnowledgeIndexVersion[]
  versionDetails?: VersionDetailsMap
  onTabChange: (tab: DetailTab) => void
  onBack: () => void
  onSetState: (state: DetailState) => void
  onLoadVersionDetail?: (knowledgeVersionId: string) => Promise<void> | void
}) {
  const hasRuntimeData = Boolean(task || version)
  const copy = useMemo(() => buildRuntimeCopy(detailState, task, version), [detailState, task, version])
  const detailTitle =
    detailMode === "prod"
      ? "当前 PROD 版本"
      : detailMode === "stg"
        ? "当前 STG 版本"
        : detailMode === "history"
          ? "历史版本"
          : "进行中的候选版本"
  const detailContext =
    detailMode === "prod"
      ? "PROD 版本查看"
      : detailMode === "stg"
        ? "STG 发布与验证"
        : detailMode === "history"
          ? "历史版本查看"
          : "候选版本维护"
  const [detailNotice, setDetailNotice] = useState<string | null>(null)
  const [generatedIndexVersions, setGeneratedIndexVersions] = useState<GeneratedIndexVersion[]>([])
  const isTaskExecuting =
    task?.status === "running" ||
    ((task?.currentStep === "queued" || task?.currentStep === "building_artifacts") && !task?.completedAt)

  function resolveRisks(message = "本轮风险已处理，可继续确认问答对草稿") {
    setDetailNotice(message)
    onSetState("review")
    onTabChange("cleaned")
  }

  function createPublishedIndexVersion() {
    const nextSequence = generatedIndexVersions.length + 3
    const nextIndexVersion: GeneratedIndexVersion = {
      indexVersionName: `Q4 政策批量更新索引 v${nextSequence}`,
      indexVersionId: `kb-index-2024-04-20-${String(nextSequence).padStart(2, "0")}`,
      buildTime: "刚刚",
    }

    setGeneratedIndexVersions((current) => [nextIndexVersion, ...current])
  }

  function publishToStg() {
    createPublishedIndexVersion()
    setDetailNotice("已发布到 STG，可继续验证后发布到 PROD")
    onSetState("indexed")
    onTabChange("rounds")
  }

  function publishToProd() {
    setDetailNotice("已发布到 PROD，当前线上版本已更新")
    onSetState("ready")
    onTabChange("rounds")
  }

  function rollbackVersion() {
    setDetailNotice(detailMode === "stg" ? "已回滚到上一 STG 稳定版本" : "已回滚到上一 PROD 稳定版本")
    onTabChange("rounds")
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="size-4" />
        返回版本首页
      </Button>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold">{detailTitle}</h2>
              <Badge
                variant={detailState === "ready" ? "default" : detailState === "risk" ? "destructive" : "secondary"}
                className="rounded-md"
              >
                {copy.status}
              </Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {customer.name} / {customer.knowledgeBaseName || "新知识库"} / {detailContext}
            </p>
          </div>
          {!isTaskExecuting && detailState === "risk" ? (
            <Button
              onClick={() => {
                resolveRisks()
              }}
            >
              {copy.nextAction}
              <ChevronRight className="size-4" />
            </Button>
          ) : detailState === "indexed" ? (
            <Button
              onClick={() => {
                publishToProd()
              }}
            >
              {copy.nextAction}
              <ChevronRight className="size-4" />
            </Button>
          ) : detailMode === "prod" || detailMode === "stg" ? (
            <Button variant="outline" onClick={rollbackVersion}>
              回滚版本
            </Button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <MetricCard
            label="当前轮次"
            value={version?.name || task?.name || "第 2 轮"}
            helper={version?.id ? `知识版本：${version.id}` : "本轮内容草稿可查看"}
            tone="blue"
            size="mini"
          />
          <MetricCard
            label="待确认"
            value={`${copy.pendingCount}`}
            helper="风险项和内容确认项"
            tone={copy.pendingCount > 0 ? "rose" : "green"}
            size="mini"
          />
          <MetricCard
            label="发布状态"
            value={detailState === "ready" ? "已到 PROD" : detailState === "indexed" ? "已到 STG" : "候选版本"}
            helper={detailState === "ready" ? "当前线上版本" : detailState === "indexed" ? "等待发布到 PROD" : "待发布到 STG"}
            tone={detailState === "ready" ? "green" : detailState === "indexed" ? "blue" : "amber"}
            size="mini"
          />
        </div>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-950">处理进度</p>
            <p className="text-xs text-slate-500">当前阶段：{copy.status}</p>
          </div>
          <PipelineView detailState={detailState} />
        </div>

        {detailNotice ? (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {detailNotice}
          </div>
        ) : null}
      </section>

      {isTaskExecuting && !version ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-950">任务执行进度</h3>
              <span className="text-sm font-medium text-blue-700">{task.progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${Math.max(0, Math.min(100, task.progress === 0 ? 8 : task.progress))}%` }}
              />
            </div>
            <p className="text-sm text-slate-600">
              当前阶段：{task.currentStep === "queued" ? "排队中" : "清洗处理中"}。系统正在执行 Stage 1-11 清洗链路。
            </p>
          </div>
        </section>
      ) : null}

      {!isTaskExecuting || version ? (
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as DetailTab)}>
        <TabsList variant="line" className="w-full justify-start overflow-x-auto border-b border-slate-200">
          <TabsTrigger value="risk">风险与确认</TabsTrigger>
          <TabsTrigger value="cleaned" disabled={detailState === "risk"}>
            清洗结果确认
          </TabsTrigger>
          <TabsTrigger value="rounds">知识版本</TabsTrigger>
          <TabsTrigger value="recall" disabled={detailState === "risk" || detailState === "review"}>
            索引版本
          </TabsTrigger>
        </TabsList>
        {isVersionLoading || !hasVersionDetailLoaded ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
            正在加载任务详情...
          </div>
        ) : null}
        <TabsContent value="risk" className="mt-4">
          {isVersionLoading || !hasVersionDetailLoaded ? null : hasRuntimeData ? (
            <RuntimeRiskView
              detailState={detailState}
              task={task}
              version={version}
              versions={versions}
              versionDetails={versionDetails}
              onLoadVersionDetail={onLoadVersionDetail}
              onResolve={resolveRisks}
            />
          ) : (
            <RiskView detailState={detailState} onResolve={resolveRisks} />
          )}
        </TabsContent>
        <TabsContent value="cleaned" className="mt-4">
          {isVersionLoading || !hasVersionDetailLoaded ? null : hasRuntimeData ? (
            <RuntimeCleanedView
              key={version?.id ?? "runtime-cleaned"}
              detailState={detailState}
              version={version}
              onPublishToStg={publishToStg}
            />
          ) : (
            <CleanedView detailState={detailState} onPublishToStg={publishToStg} />
          )}
        </TabsContent>
        <TabsContent value="rounds" className="mt-4">
          {isVersionLoading || !hasVersionDetailLoaded ? null : hasRuntimeData ? (
            <RuntimeRoundsView
              currentVersionId={version?.id ?? null}
              versions={versions}
              versionDetails={versionDetails}
              onLoadVersionDetail={onLoadVersionDetail}
            />
          ) : (
            <RoundsView />
          )}
        </TabsContent>
        <TabsContent value="recall" className="mt-4">
          {isVersionLoading || !hasVersionDetailLoaded ? null : hasRuntimeData ? (
            <RuntimeIndexVersionView
              detailState={detailState}
              currentVersionId={version?.id ?? null}
              versions={versions}
              indexVersions={indexVersions}
              versionDetails={versionDetails}
              onLoadVersionDetail={onLoadVersionDetail}
            />
          ) : (
            <IndexVersionView detailState={detailState} generatedIndexVersions={generatedIndexVersions} />
          )}
        </TabsContent>
      </Tabs>
      ) : null}

    </div>
  )
}

function PipelineView({ detailState }: { detailState: DetailState }) {
  return (
    <section className="relative grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
      <div aria-hidden className="absolute left-4 right-4 top-3 hidden h-px bg-slate-200 xl:block" />
      {pipelineStages.map((stage, index) => {
        const state = pipelineState(index, detailState)
        return (
          <div
            key={stage}
            className={cn(
              "relative z-10 inline-flex min-h-7 w-full items-center justify-center gap-1.5 rounded-md border px-2 text-xs whitespace-nowrap",
              state === "done" && "border-emerald-200 bg-emerald-50 text-emerald-700",
              state === "active" && "border-blue-200 bg-blue-50 text-blue-700",
              state === "pending" && "border-slate-200 bg-white text-slate-500"
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                state === "done" && "bg-emerald-500",
                state === "active" && "bg-blue-500",
                state === "pending" && "bg-slate-300"
              )}
            />
            <span className="text-[11px] opacity-70">0{index + 1}</span>
            <span className="font-medium">{stage}</span>
          </div>
        )
      })}
    </section>
  )
}

function buildRuntimeConflictItems(
  version?: KnowledgeVersion | null,
  referenceVersion?: KnowledgeVersion | null,
): ConflictRiskItem[] {
  if (!version?.manifest) return []
  const conflictArtifacts = version.manifest.stageArtifacts.conflictRecords ?? []
  const comparisonVersion = referenceVersion ?? version
  const items = new Map<string, ConflictRiskItem>()

  version.manifest.blockedRecords.forEach((record) => {
    const artifact = conflictArtifacts.find((item) => item.id === record.id) ?? {}
    const sourceFiles = Array.isArray(record.sourceFiles) ? record.sourceFiles : []
    const currentQuestion = toStringValue(record.question) || toStringValue(artifact.question)
    const matchedParent = findMatchingParent(comparisonVersion, currentQuestion)
    const currentSourceFiles = matchedParent?.sourceFiles ?? []
    const siblingArtifact =
      conflictArtifacts.find((item) => {
        const siblingQuestion = toStringValue(item.canonicalQuestion) || toStringValue(item.question)
        return item.id !== record.id && normalizeQuestion(siblingQuestion) === normalizeQuestion(currentQuestion)
      }) ?? null
    const siblingSourceFiles = Array.isArray(siblingArtifact?.sourceFiles) ? siblingArtifact.sourceFiles : []
    const currentText = matchedParent?.answer
      ? matchedParent.answer
      : toStringValue(siblingArtifact?.answerPreview) ||
        "当前没有可直接对比的已发布知识版本内容。"
    const currentSource = matchedParent
      ? buildVersionSourceLabel(comparisonVersion, currentSourceFiles)
      : toStringValue(siblingArtifact?.sourceDocumentName) || siblingSourceFiles.join("、")

    const nextItem: ConflictRiskItem = {
      id: toStringValue(record.id),
      title: currentQuestion || "待确认冲突",
      currentSource,
      currentText,
      incomingSource:
        toStringValue(artifact.sourceDocumentName) || (sourceFiles.length > 0 ? sourceFiles.join("、") : "本次文档库"),
      incomingText:
        toStringValue(artifact.answerPreview) ||
        "当前仅检测到冲突，需要进一步查看来源内容后确认。",
      suggestion: humanizeReason(toStringValue(record.reason) || toStringValue(artifact.blockedReason), "存在冲突，需要人工确认。"),
      suggestionTone: "amber",
    }
    const dedupeKey = [
      normalizeQuestion(nextItem.title),
      normalizeQuestion(nextItem.currentSource),
      normalizeQuestion(nextItem.currentText),
      normalizeQuestion(nextItem.incomingSource),
      normalizeQuestion(nextItem.incomingText),
    ].join("::")

    if (!items.has(dedupeKey)) {
      items.set(dedupeKey, nextItem)
    }
  })

  return Array.from(items.values())
}

function buildRuntimeDeleteItems(version?: KnowledgeVersion | null): DeleteRiskItem[] {
  if (!version?.manifest) return []
  const promotedArtifacts = version.manifest.stageArtifacts.promotedRecords ?? []

  return version.manifest.highRiskRecords.map((record) => {
    const artifact = promotedArtifacts.find((item) => item.id === record.id) ?? {}
    const sourceFiles = Array.isArray(record.sourceFiles) ? record.sourceFiles : []
    const originalText =
      toStringValue(artifact.answerPreview) ||
      toStringValue(record.answer) ||
      "当前记录命中高风险规则，系统已暂时阻止其进入本轮知识版本。"

    return {
      id: toStringValue(record.id),
      title: toStringValue(record.question) || "高风险内容",
      source:
        toStringValue(artifact.sourceDocumentName) || (sourceFiles.length > 0 ? sourceFiles.join("、") : "文档库来源"),
      originalText,
      keptText: originalText,
      category: "高风险内容",
      reason: humanizeReason(toStringValue(record.reason) || toStringValue(artifact.riskReason), "命中高风险规则，需要人工确认。"),
      stage: "清洗阶段",
    }
  })
}

function buildRuntimeSupplementItems(version?: KnowledgeVersion | null): SupplementRiskItem[] {
  if (!version?.manifest) return []

  const items = new Map<string, SupplementRiskItem>()
  const excludedKeys = new Set<string>()

  version.manifest.highRiskRecords.forEach((record) => {
    const questionKey = normalizeQuestion(toStringValue(record.question))
    const idKey = normalizeQuestion(toStringValue(record.id))
    if (questionKey) excludedKeys.add(questionKey)
    if (idKey) excludedKeys.add(idKey)
  })

  version.manifest.blockedRecords.forEach((record) => {
    const questionKey = normalizeQuestion(toStringValue(record.question))
    const idKey = normalizeQuestion(toStringValue(record.id))
    if (questionKey) excludedKeys.add(questionKey)
    if (idKey) excludedKeys.add(idKey)
  })

  function upsertItem(key: string, nextItem: SupplementRiskItem) {
    if (excludedKeys.has(key)) return
    const current = items.get(key)
    if (!current) {
      items.set(key, nextItem)
      return
    }

    if (current.kind === nextItem.kind) return
    items.set(key, {
      id: current.id,
      title: current.title,
      kind: "combined",
      description: `${current.title} 尚未归入问答对，且当前还缺少可发布答案，需要先补充内容再确认归类。`,
    })
  }

  version.coverageAudit.orphanRecords.forEach((record, index) => {
    const title = record.trim()
    const key = normalizeQuestion(title)
    if (!key) return
    upsertItem(key, {
      id: `orphan-${index}`,
      title,
      kind: "orphan",
      description: `${title} 尚未归入问答对，需要先确认归类方式。`,
    })
  })

  version.manifest.pendingRecords.forEach((record, index) => {
    const title = toStringValue(record.question).trim()
    const key = normalizeQuestion(title)
    if (!key) return
    upsertItem(key, {
      id: `pending-${index}`,
      title,
      kind: "pending",
      description: `${title} ${humanizeReason(toStringValue(record.reason), "当前还缺少可发布答案，需要先补充后再进入本轮知识版本。")}`,
    })
  })

  return Array.from(items.values())
}

function buildRuntimeDrafts(version?: KnowledgeVersion | null) {
  if (!version?.parents) return []

  return version.parents.map((parent) => {
    const metadata = parent.metadata ?? {}
    return {
      title: parent.question,
      body: parent.answer,
      source: parent.sourceFiles.join("、") || "当前版本",
      status: parent.reviewStatus,
      question_aliases: parent.questionAliases,
      intent: toStringValue(findMetadataValue(metadata, ["intent"])),
      domain: toStringValue(findMetadataValue(metadata, ["domain", "businessDomain"])),
      subject: toStringValue(findMetadataValue(metadata, ["subject"])),
      device: toStringValue(findMetadataValue(metadata, ["device"])),
      product_model: toStringValue(findMetadataValue(metadata, ["product_model", "productModel"])),
      scope_terms: Array.isArray(findMetadataValue(metadata, ["scope_terms", "scopeTerms"]))
        ? (findMetadataValue(metadata, ["scope_terms", "scopeTerms"]) as string[])
        : toStringValue(findMetadataValue(metadata, ["scope_terms", "scopeTerms"]))
            .split(/[、,]/)
            .map((item) => item.trim())
            .filter(Boolean),
      is_exact_faq: toStringValue(findMetadataValue(metadata, ["is_exact_faq", "isExactFaq"])),
      question_signature: toStringValue(findMetadataValue(metadata, ["questionSignature"])),
    }
  })
}

function RuntimeRiskView({
  detailState,
  task,
  version,
  versions,
  versionDetails,
  onLoadVersionDetail,
  onResolve,
}: {
  detailState: DetailState
  task?: KnowledgeBuildTask | null
  version?: KnowledgeVersion | null
  versions: KnowledgeVersion[]
  versionDetails: VersionDetailsMap
  onLoadVersionDetail?: (knowledgeVersionId: string) => Promise<void> | void
  onResolve: (message?: string) => void
}) {
  const locked = detailState === "ready"
  const [activeRiskTab, setActiveRiskTab] = useState<RiskTab>("summary")
  const [resolvedResults, setResolvedResults] = useState<Record<string, string>>({})
  const [editableContents, setEditableContents] = useState<Record<string, string>>({})
  const [supplementResults, setSupplementResults] = useState<Record<string, string>>({})
  const [activeSupplementEditId, setActiveSupplementEditId] = useState<string | null>(null)
  const [supplementDraft, setSupplementDraft] = useState("")
  const [allRisksResolved, setAllRisksResolved] = useState(false)
  const [riskNotice, setRiskNotice] = useState<string | null>(null)

  const referenceVersion = useMemo(
    () => resolveReferenceVersion(task, version, versions, versionDetails),
    [task, version, versions, versionDetails],
  )
  const conflictItems = useMemo(() => buildRuntimeConflictItems(version, referenceVersion), [version, referenceVersion])
  const deleteItems = useMemo(() => buildRuntimeDeleteItems(version), [version])
  const supplementItems = useMemo(() => buildRuntimeSupplementItems(version), [version])
  const pendingRecords = version?.manifest?.pendingRecords ?? []
  const supplementCount = supplementItems.length
  const pendingCount = allRisksResolved ? 0 : pendingRecords.length + conflictItems.length + deleteItems.length

  useEffect(() => {
    if (!referenceVersion?.id || referenceVersion.parents !== undefined) return
    void onLoadVersionDetail?.(referenceVersion.id)
  }, [onLoadVersionDetail, referenceVersion])

  function saveRiskResult(itemId: string, result: string) {
    setResolvedResults((current) => ({ ...current, [itemId]: result }))
    setAllRisksResolved(false)
    setRiskNotice(`${result}，处理结果只影响当前任务`)
  }

  function markAllResolved() {
    const nextResults = Object.fromEntries([...conflictItems, ...deleteItems].map((item) => [item.id, "已处理"]))
    setResolvedResults(nextResults)
    setAllRisksResolved(true)
    setRiskNotice("风险与冲突已处理完成，可以进入清洗结果确认")
  }

  function updateEditableContent(itemId: string, content: string) {
    setEditableContents((current) => ({ ...current, [itemId]: content }))
    setRiskNotice("本次内容已更新，后续处理会基于编辑后的内容")
  }

  function openSupplementEditor(item: SupplementRiskItem) {
    setSupplementDraft(item.title)
    setActiveSupplementEditId(item.id)
  }

  function saveSupplementDraft(itemId: string) {
    setSupplementResults((current) => ({ ...current, [itemId]: `已补充答案：${supplementDraft}` }))
    setActiveSupplementEditId(null)
    setSupplementDraft("")
    setRiskNotice("待补充内容已更新，后续可继续进入问答对确认")
  }

  function resolveSupplement(itemId: string, result: string) {
    setSupplementResults((current) => ({ ...current, [itemId]: result }))
    setActiveSupplementEditId(null)
    setSupplementDraft("")
    setRiskNotice(result)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          ["summary", "待处理事项"],
          ["supplement", `待归类与待补充（${supplementCount}）`],
          ["conflict", `合并冲突（${conflictItems.length}）`],
          ["delete", `高风险删除（${deleteItems.length}）`],
        ].map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant={activeRiskTab === value ? "default" : "outline"}
            className="rounded-md"
            onClick={() => setActiveRiskTab(value as RiskTab)}
          >
            {label}
          </Button>
        ))}
      </div>

      {riskNotice ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {riskNotice}
        </div>
      ) : null}

      <section className="space-y-4">
        {activeRiskTab === "summary" ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">风险与冲突处理</h3>
                <p className="mt-1 text-sm text-slate-600">先处理本轮待归类、合并冲突和高风险删除，再进入清洗结果确认。</p>
              </div>
              <Button size="sm" onClick={markAllResolved} disabled={locked}>
                全部标记已处理
              </Button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-4">
              <MetricCard label="待处理事项" value={`${pendingCount}`} helper="风险与人工确认项" tone={pendingCount > 0 ? "rose" : "green"} size="compact" />
              <MetricCard label="待归类与待补充" value={`${supplementCount}`} helper="尚未形成正式问答对" tone="blue" size="compact" />
              <MetricCard label="合并冲突" value={`${conflictItems.length}`} helper="同一问题存在不同口径" tone="amber" size="compact" />
              <MetricCard label="高风险删除" value={`${deleteItems.length}`} helper="清洗删除需人工确认" tone="amber" size="compact" />
            </div>

            <div className="mt-5">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-950">本轮待处理摘要</p>
                <div className="mt-3 space-y-3">
                  <div className="rounded-md border border-white bg-white px-4 py-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-950">待归类与待补充</p>
                        <p className="mt-1 text-slate-600">
                          {supplementCount > 0
                            ? `${supplementItems[0]?.title ?? "当前内容"}${supplementCount > 1 ? ` 等 ${supplementCount} 条内容` : ""} 尚未形成正式问答对，需要继续处理。`
                            : "当前没有待归类或待补充确认的内容。"}
                        </p>
                      </div>
                      {supplementCount > 0 ? (
                        <Button size="sm" variant="outline" onClick={() => setActiveRiskTab("supplement")}>
                          去处理
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="rounded-md border border-white bg-white px-4 py-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-950">合并冲突确认</p>
                        <p className="mt-1 text-slate-600">
                          {conflictItems.length > 0
                            ? `${conflictItems[0].title} 等 ${conflictItems.length} 条内容需要确认最终口径。`
                            : "当前没有需要人工确认的合并冲突。"}
                        </p>
                      </div>
                      {conflictItems.length > 0 ? (
                        <Button size="sm" variant="outline" onClick={() => setActiveRiskTab("conflict")}>
                          去处理
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="rounded-md border border-white bg-white px-4 py-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-950">高风险删除确认</p>
                        <p className="mt-1 text-slate-600">
                          {deleteItems.length > 0
                            ? `${deleteItems[0].title} 等 ${deleteItems.length} 条内容需要确认是否恢复到本轮版本。`
                            : "当前没有需要人工确认的高风险删除内容。"}
                        </p>
                      </div>
                      {deleteItems.length > 0 ? (
                        <Button size="sm" variant="outline" onClick={() => setActiveRiskTab("delete")}>
                          去处理
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {pendingCount === 0 ? (
              <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                风险与冲突已处理完成，可以进入清洗结果确认。
                <Button size="sm" className="ml-3" onClick={() => onResolve("风险与冲突已处理，可以进入清洗结果确认")}>
                  进入清洗结果确认
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}

        {activeRiskTab === "supplement" ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div>
              <h3 className="font-semibold">待归类与待补充</h3>
              <p className="mt-1 text-sm text-slate-600">这些内容还没有形成正式问答对，需要先完成归类或补充，后续才能进入知识版本。</p>
            </div>

            <div className="mt-5 space-y-4">
              {supplementItems.length > 0 ? (
                supplementItems.map((item) => {
                  const result = supplementResults[item.id]
                  const isEditing = activeSupplementEditId === item.id
                  return (
                    <article key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-medium text-slate-950">{item.title}</p>
                        <Badge variant={result ? "default" : "secondary"} className="rounded-md">
                          {result ?? "待处理"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{item.description}</p>

                      {result ? (
                        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                          {result}
                        </div>
                      ) : null}

                      {isEditing ? (
                        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
                          <p className="text-sm font-semibold text-slate-950">补充答案</p>
                          <Textarea className="mt-3 min-h-28 bg-white" value={supplementDraft} onChange={(event) => setSupplementDraft(event.target.value)} />
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => saveSupplementDraft(item.id)}>
                              保存补充内容
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setActiveSupplementEditId(null)}>
                              取消
                            </Button>
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {(item.kind === "orphan" || item.kind === "combined") ? (
                          <>
                            <Button size="sm" variant="outline" onClick={() => resolveSupplement(item.id, "已标记归入现有问答对，后续会进入问答对确认")} disabled={locked || Boolean(result)}>
                              归入现有问答对
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => resolveSupplement(item.id, "已标记新建问答对，后续会进入问答对确认")} disabled={locked || Boolean(result)}>
                              新建问答对
                            </Button>
                          </>
                        ) : null}
                        {(item.kind === "pending" || item.kind === "combined") ? (
                          <>
                            <Button size="sm" onClick={() => openSupplementEditor(item)} disabled={locked || Boolean(result)}>
                              补充答案
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => resolveSupplement(item.id, "已标记暂不纳入本轮知识版本")} disabled={locked || Boolean(result)}>
                              暂不纳入本轮
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </article>
                  )
                })
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                  当前没有待归类或待补充内容。
                </div>
              )}
            </div>
          </section>
        ) : null}

        {activeRiskTab === "conflict" ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div>
              <h3 className="font-semibold">合并冲突确认</h3>
              <p className="mt-1 text-sm text-slate-600">同一个问题出现多个不同口径时，需要运营选择本轮采用哪一版。选择只影响当前任务。</p>
            </div>
            <div className="mt-5 space-y-4">
              {conflictItems.length > 0 ? (
                conflictItems.map((item) => (
                  <ConflictRiskCard
                    key={item.id}
                    item={item}
                    resolvedResult={resolvedResults[item.id]}
                    editableContent={editableContents[item.id]}
                    locked={locked}
                    onResolve={saveRiskResult}
                    onUpdateEditableContent={updateEditableContent}
                  />
                ))
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                  当前没有需要人工确认的冲突内容。
                </div>
              )}
            </div>
          </section>
        ) : null}

        {activeRiskTab === "delete" ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div>
              <h3 className="font-semibold">高风险内容删除明细</h3>
              <p className="mt-1 text-sm text-slate-600">这些内容暂未进入本轮问答对草稿，需要确认保持删除还是恢复到本轮内容。</p>
            </div>
            <div className="mt-5 space-y-4">
              {deleteItems.length > 0 ? (
                deleteItems.map((item) => (
                  <DeleteRiskCard
                    key={item.id}
                    item={item}
                    resolvedResult={resolvedResults[item.id]}
                    editableContent={editableContents[item.id]}
                    locked={locked}
                    onResolve={saveRiskResult}
                    onUpdateEditableContent={updateEditableContent}
                  />
                ))
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                  当前没有需要人工确认的高风险删除内容。
                </div>
              )}
            </div>
          </section>
        ) : null}
      </section>
    </div>
  )
}

function RuntimeCleanedView({
  detailState,
  version,
  onPublishToStg,
}: {
  detailState: DetailState
  version?: KnowledgeVersion | null
  onPublishToStg: () => void
}) {
  const copy = buildRuntimeCopy(detailState, null, version)
  const canEdit = detailState !== "risk"
  const canPublishToStg = detailState === "review" && !copy.indexReady
  const runtimeDrafts = useMemo(() => buildRuntimeDrafts(version), [version])
  const [drafts, setDrafts] = useState(runtimeDrafts)
  const [selectedTitle, setSelectedTitle] = useState(runtimeDrafts[0]?.title ?? "")
  const [activeDraftAction, setActiveDraftAction] = useState<{
    type: "edit" | "lock" | "regenerate" | "delete"
    title: string
  } | null>(null)
  const [editDraft, setEditDraft] = useState({ title: runtimeDrafts[0]?.title ?? "", body: runtimeDrafts[0]?.body ?? "" })
  const [lockedTitles, setLockedTitles] = useState<Record<string, string[]>>({})
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const lockableFields = [
    "问题",
    "答案",
    "question_aliases",
    "intent",
    "domain",
    "subject",
    "device",
    "product_model",
    "scope_terms",
    "is_exact_faq",
  ]

  function showDraftNotice(message: string) {
    setActionNotice(message)
  }

  function openDraftAction(type: "edit" | "lock" | "regenerate" | "delete", item: (typeof runtimeDrafts)[number]) {
    setSelectedTitle(item.title)
    setActiveDraftAction({ type, title: item.title })
    if (type === "edit") {
      setEditDraft({ title: item.title, body: item.body })
    }
  }

  function handleDraftAction(action: string, item: (typeof runtimeDrafts)[number]) {
    if (action === "编辑问答对") return openDraftAction("edit", item)
    if (action === "锁定字段") return openDraftAction("lock", item)
    if (action === "重新生成") return openDraftAction("regenerate", item)
    if (action === "删除") return openDraftAction("delete", item)
  }

  function saveQuestionPair(originalTitle: string) {
    const nextTitle = editDraft.title.trim() || originalTitle
    const nextBody = editDraft.body.trim() || "暂无答案内容"
    setDrafts((current) =>
      current.map((draft) =>
        draft.title === originalTitle
          ? {
              ...draft,
              title: nextTitle,
              body: nextBody,
            }
          : draft,
      ),
    )
    setSelectedTitle(nextTitle)
    setActiveDraftAction(null)
    showDraftNotice(`问答对已保存：${nextTitle}`)
  }

  function saveLockedFields(title: string, fields: string[]) {
    setLockedTitles((current) => ({ ...current, [title]: fields }))
    setActiveDraftAction(null)
    showDraftNotice(`字段已锁定：${title} 的 ${fields.join("、")} 不会被重新生成覆盖`)
  }

  function applyRegeneratedDraft(item: (typeof runtimeDrafts)[number]) {
    const regeneratedBody = `${item.body} 已补充适用范围、操作入口和例外说明。`
    setDrafts((current) =>
      current.map((draft) =>
        draft.title === item.title
          ? {
              ...draft,
              body: regeneratedBody,
            }
          : draft,
      ),
    )
    setActiveDraftAction(null)
    showDraftNotice(`问答对已重新生成：${item.title}`)
  }

  function confirmDeleteDraft(item: (typeof runtimeDrafts)[number]) {
    setDrafts((current) => {
      const next = current.filter((draft) => draft.title !== item.title)
      if (selectedTitle === item.title) {
        setSelectedTitle(next[0]?.title ?? "")
      }
      return next
    })
    setActiveDraftAction(null)
    showDraftNotice(`已从草稿列表移除：${item.title}`)
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <p className="font-semibold">问答对草稿</p>
          <Badge variant={copy.indexReady ? "default" : "secondary"} className="rounded-md">
            {copy.indexReady ? "已发布到 STG" : "待发布到 STG"}
          </Badge>
        </div>
        <div className="mt-4 space-y-2">
          {drafts.map((item) => {
            const selected = item.title === selectedTitle
            return (
              <button
                key={item.title}
                type="button"
                className={cn(
                  "w-full rounded-md border px-3 py-3 text-left text-sm transition-colors hover:bg-slate-50",
                  selected ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white",
                )}
                onClick={() => {
                  setSelectedTitle(item.title)
                  setActiveDraftAction(null)
                  showDraftNotice(`已切换到问答对：${item.title}`)
                }}
              >
                <span className="block font-medium">{item.title}</span>
                <span className="mt-1 block text-xs text-slate-500">{item.source}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          运营确认完成后，系统会在发布到 STG 时同步生成索引版本。
        </div>
        {canPublishToStg ? (
          <Button className="mt-4 w-full" onClick={onPublishToStg}>
            生成索引并发布到 STG
          </Button>
        ) : (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
            索引会在发布到 STG 时同步生成。
          </div>
        )}
      </aside>

      <section className="space-y-4">
        {actionNotice ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {actionNotice}
          </div>
        ) : null}

        {drafts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
            当前没有问答对草稿。
          </div>
        ) : null}

        {drafts.map((item) => (
          <div key={item.title} className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-slate-500">来源：{item.source}</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <MetadataFieldBox label="问法别名" fieldKey="question_aliases" value={item.question_aliases.join("、")} />
                  <MetadataFieldBox label="intent" fieldKey="intent" value={item.intent} />
                  <MetadataFieldBox label="业务域" fieldKey="domain" value={item.domain} />
                  <MetadataFieldBox label="主题" fieldKey="subject" value={item.subject} />
                  <MetadataFieldBox label="适用设备" fieldKey="device" value={item.device} />
                  <MetadataFieldBox label="产品型号" fieldKey="product_model" value={item.product_model} />
                  <MetadataFieldBox label="范围词" fieldKey="scope_terms" value={item.scope_terms.join("、")} />
                  <MetadataFieldBox label="标准 FAQ" fieldKey="is_exact_faq" value={item.is_exact_faq === "true" ? "是" : item.is_exact_faq === "false" ? "否" : ""} />
                </div>
              </div>
            </div>
            <Textarea className="mt-4 min-h-24" value={item.body} readOnly />
            {item.question_signature ? (
              <p className="mt-3 text-sm text-slate-500">questionSignature：{item.question_signature}</p>
            ) : null}
            {lockedTitles[item.title]?.length ? (
              <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                已锁定字段：{lockedTitles[item.title].join("、")}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {["编辑问答对", "锁定字段", "重新生成", "删除"].map((action) => (
                <Button key={action} variant="outline" disabled={!canEdit} onClick={() => handleDraftAction(action, item)}>
                  {action}
                </Button>
              ))}
            </div>
            {activeDraftAction?.title === item.title && activeDraftAction.type === "edit" ? (
              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm">
                <p className="font-semibold text-slate-950">编辑问答对内容</p>
                <label className="mt-3 block space-y-1">
                  <span className="text-xs font-medium text-slate-500">问题</span>
                  <input
                    value={editDraft.title}
                    onChange={(event) => setEditDraft((current) => ({ ...current, title: event.target.value }))}
                    className="h-9 w-full rounded-md border border-blue-100 bg-white px-3 text-sm"
                  />
                </label>
                <label className="mt-3 block space-y-1">
                  <span className="text-xs font-medium text-slate-500">答案</span>
                  <Textarea
                    className="min-h-28 bg-white"
                    value={editDraft.body}
                    onChange={(event) => setEditDraft((current) => ({ ...current, body: event.target.value }))}
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => saveQuestionPair(item.title)}>
                    保存问答对
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setActiveDraftAction(null)}>
                    取消编辑
                  </Button>
                </div>
              </div>
            ) : null}
            {activeDraftAction?.title === item.title && activeDraftAction.type === "lock" ? (
              <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm">
                <p className="font-semibold text-slate-950">锁定字段设置</p>
                <p className="mt-2 text-slate-600">锁定后，重新生成不会覆盖这些字段。</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {lockableFields.map((field) => (
                    <span key={field} className="rounded-md border border-emerald-200 bg-white px-3 py-2 text-emerald-700">
                      {field}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => saveLockedFields(item.title, lockableFields)}>
                    保存锁定字段
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setActiveDraftAction(null)}>
                    取消
                  </Button>
                </div>
              </div>
            ) : null}
            {activeDraftAction?.title === item.title && activeDraftAction.type === "regenerate" ? (
              <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm">
                <p className="font-semibold text-slate-950">重新生成预览</p>
                <p className="mt-2 leading-6 text-slate-700">{item.body} 已补充适用范围、操作入口和例外说明。</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => applyRegeneratedDraft(item)}>
                    应用生成结果
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setActiveDraftAction(null)}>
                    取消
                  </Button>
                </div>
              </div>
            ) : null}
            {activeDraftAction?.title === item.title && activeDraftAction.type === "delete" ? (
              <div className="mt-4 rounded-lg border border-rose-100 bg-rose-50 p-4 text-sm">
                <p className="font-semibold text-slate-950">删除确认</p>
                <p className="mt-2 text-slate-600">删除后，本条问答对不会进入本轮索引。</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="destructive" onClick={() => confirmDeleteDraft(item)}>
                    确认删除
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setActiveDraftAction(null)}>
                    取消
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </section>
    </div>
  )
}

function RuntimeRoundsView({
  currentVersionId,
  versions,
  versionDetails,
  onLoadVersionDetail,
}: {
  currentVersionId: string | null
  versions: KnowledgeVersion[]
  versionDetails: VersionDetailsMap
  onLoadVersionDetail?: (knowledgeVersionId: string) => Promise<void> | void
}) {
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null)
  const [selectedRoundTab, setSelectedRoundTab] = useState<"basic" | "items">("basic")
  const [selectedScope, setSelectedScope] = useState("全部索引内容")
  const [filterNotice, setFilterNotice] = useState<string | null>(null)
  const scopes = ["全部索引内容", "已修改内容", "已删除内容", "高风险处理内容", "人工新增内容"]
  const orderedVersions = useMemo(
    () => [...versions].sort((left, right) => (right.createdAt || "").localeCompare(left.createdAt || "")),
    [versions],
  )
  const selectedVersion =
    (selectedRoundId ? versionDetails[selectedRoundId] ?? orderedVersions.find((item) => item.id === selectedRoundId) : null) ?? null
  const selectedParents = selectedVersion?.parents ?? []

  async function openRound(versionId: string) {
    setSelectedRoundId(versionId)
    setSelectedRoundTab("basic")
    setSelectedScope(scopes[0])
    setFilterNotice(null)
    await onLoadVersionDetail?.(versionId)
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h3 className="font-semibold">清洗轮次记录</h3>
          <p className="text-sm text-slate-500">点击查看每一轮清洗后生成的问答对内容。</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-5 py-3">轮次</th>
                <th className="px-5 py-3">本轮内容</th>
                <th className="px-5 py-3">本轮清洗策略</th>
                <th className="px-5 py-3">来源文件数</th>
                <th className="px-5 py-3">原始记录数</th>
                <th className="px-5 py-3">覆盖率</th>
                <th className="px-5 py-3">审计状态</th>
                <th className="px-5 py-3">状态</th>
                <th className="px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orderedVersions.map((row, index) => {
                const auditStatus = formatAuditStatus(row)
                const status =
                  row.status === "draft" ? "草稿" : row.status === "stg" ? "STG" : row.status === "prod" ? "PROD" : "已归档"
                return (
                  <tr key={row.id} className={row.id === selectedVersion?.id ? "bg-sky-50/70" : "bg-white"}>
                    <td className="px-5 py-4 font-medium text-slate-950">{`第 ${orderedVersions.length - index} 轮`}</td>
                    <td className="px-5 py-4 text-slate-600">
                      <div>{row.name}</div>
                      <div className="text-xs text-slate-400">{row.id}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{row.buildProfile}</td>
                    <td className="px-5 py-4 text-slate-600">{row.stageSummary.sourceCount}</td>
                    <td className="px-5 py-4 text-slate-600">{row.stageSummary.rawRecordCount}</td>
                    <td className="px-5 py-4 text-slate-600">{row.coverageAudit.coverage}%</td>
                    <td className="px-5 py-4">
                      <Badge variant={row.coverageAudit.auditStatus === "normal" ? "outline" : "secondary"} className="rounded-md">
                        {auditStatus}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={row.id === currentVersionId ? "secondary" : "outline"} className="rounded-md">
                        {status}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => void openRound(row.id)}>
                          查看问答对
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {selectedVersion ? (
        <>
          <button type="button" aria-label="关闭索引内容抽屉" className="fixed inset-0 z-40 bg-slate-950/30" onClick={() => setSelectedRoundId(null)} />
          <aside role="dialog" aria-modal="true" aria-label={`${selectedVersion.id}知识版本详情`} className="fixed inset-y-0 right-0 z-50 flex w-full max-w-4xl flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="font-semibold">知识版本详情</h3>
                <Badge variant="outline" className="mt-2 rounded-md">
                  {selectedVersion.name || selectedVersion.id}
                </Badge>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedRoundId(null)}>
                关闭
              </Button>
            </div>
            <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[280px_minmax(0,1fr)]">
              <nav className="border-b border-slate-200 bg-slate-50/70 py-3 md:border-b-0 md:border-r">
                <div className="space-y-1 px-3">
                  {[
                    ["basic", "基础信息"],
                    ["items", "问答对详情"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={cn(
                        "w-full rounded-md px-3 py-2 text-left text-sm transition",
                        value === selectedRoundTab ? "bg-white font-medium text-slate-950 shadow-sm" : "text-slate-600 hover:bg-white",
                      )}
                      onClick={() => setSelectedRoundTab(value as "basic" | "items")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </nav>
              <div className="min-h-0 overflow-y-auto p-5">
                {selectedRoundTab === "basic" ? (
                  <>
                    <section className={cn("rounded-lg border p-4", selectedVersion.coverageAudit.auditStatus === "normal" ? "border-slate-200 bg-slate-50" : "border-rose-200 bg-rose-50")}>
                      <h4 className="font-semibold text-slate-950">覆盖率审计摘要</h4>
                      <div className="mt-3 space-y-2 rounded-md border border-white/80 bg-white px-4 py-3 text-sm">
                        <GateRow label="覆盖率" value={`${selectedVersion.coverageAudit.coverage}%`} />
                        <GateRow
                          label="审计状态"
                          value={formatAuditStatus(selectedVersion)}
                          active={selectedVersion.coverageAudit.auditStatus === "normal"}
                        />
                      </div>
                    </section>

                    <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                      <h4 className="font-semibold text-slate-950">异常明细</h4>
                      <div className="mt-4 space-y-4 text-sm">
                        <div>
                          <p className="font-semibold text-slate-950">本轮未纳入内容</p>
                          <div className="mt-2 space-y-2">
                            <GateRow label="高风险内容" value={`${selectedVersion.stageSummary.highRiskCount}`} />
                            <GateRow label="待处理内容" value={`${selectedVersion.stageSummary.pendingCount}`} />
                            <GateRow label="阻断问题" value={`${selectedVersion.stageSummary.blockedCount}`} />
                            <GateRow label="排除内容" value={`${selectedVersion.stageSummary.excludedCount}`} />
                          </div>
                        </div>
                        <div className="border-t border-slate-100 pt-4">
                          <p className="font-semibold text-slate-950">待归类内容</p>
                          <div className="mt-2 space-y-2 leading-6 text-slate-700">
                            {selectedVersion.coverageAudit.orphanRecords.length > 0 ? selectedVersion.coverageAudit.orphanRecords.map((item, index) => <p key={buildListKey("coverage-orphan", item, index)}>{item}</p>) : <p>当前没有需要补充归类的内容。</p>}
                          </div>
                        </div>
                        <div className="border-t border-slate-100 pt-4">
                          <p className="font-semibold text-slate-950">可能重复的内容</p>
                          <div className="mt-2 space-y-2 leading-6 text-slate-700">
                            {selectedVersion.coverageAudit.ambiguityRecords.length > 0 ? selectedVersion.coverageAudit.ambiguityRecords.map((item, index) => <p key={buildListKey("coverage-ambiguity", item, index)}>{item}</p>) : <p>当前没有需要进一步确认的重复内容。</p>}
                          </div>
                        </div>
                      </div>
                    </section>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {scopes.map((scope) => (
                        <button
                          key={scope}
                          type="button"
                          className={cn(
                            "rounded-md border px-3 py-2 text-sm transition",
                            scope === selectedScope ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                          )}
                          onClick={() => {
                            setSelectedScope(scope)
                            setFilterNotice(`已切换到${scope}`)
                          }}
                        >
                          {scope}
                        </button>
                      ))}
                    </div>
                    {filterNotice ? <div className="mt-3 rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-700">{filterNotice}</div> : null}
                    <div className="mt-4 space-y-3">
                      {selectedParents.length > 0 ? (
                        selectedParents.map((parent) => (
                          <article key={parent.id} className="rounded-lg border border-slate-200 bg-white">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
                              <p className="font-medium text-slate-950">{parent.question}</p>
                              <Badge variant="outline" className="rounded-md">
                                {parent.reviewStatus}
                              </Badge>
                            </div>
                            <div className="px-4 py-3 text-sm leading-6 text-slate-600">
                              <p className="mb-2 text-slate-500">来源：{parent.sourceFiles.join("、") || "-"}</p>
                              <p>{parent.answer}</p>
                            </div>
                          </article>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">当前版本还没有加载问答对详情。</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  )
}

function RuntimeIndexVersionView({
  detailState,
  currentVersionId,
  versions,
  indexVersions,
  versionDetails,
  onLoadVersionDetail,
}: {
  detailState: DetailState
  currentVersionId: string | null
  versions: KnowledgeVersion[]
  indexVersions: KnowledgeIndexVersion[]
  versionDetails: VersionDetailsMap
  onLoadVersionDetail?: (knowledgeVersionId: string) => Promise<void> | void
}) {
  const copy = buildRuntimeCopy(detailState, null, versions.find((item) => item.id === currentVersionId) ?? null)
  const [selectedIndexVersionId, setSelectedIndexVersionId] = useState<string | null>(null)
  const [selectedIndexTab, setSelectedIndexTab] = useState<"overview" | "build" | "content">("overview")
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null)
  const [indexSearch, setIndexSearch] = useState("")
  const [indexNotice, setIndexNotice] = useState<string | null>(null)
  const [expandedChunkIds, setExpandedChunkIds] = useState<Record<string, boolean>>({})
  const selectedIndexVersion = indexVersions.find((item) => item.id === selectedIndexVersionId) ?? null
  const linkedVersion =
    (selectedIndexVersion ? versionDetails[selectedIndexVersion.knowledgeVersionId] ?? versions.find((item) => item.id === selectedIndexVersion.knowledgeVersionId) : null) ?? null
  const searchText = indexSearch.trim().toLowerCase()
  const filteredParents =
    linkedVersion?.parents?.filter((parent) => {
      const chunkText = (linkedVersion.chunks ?? [])
        .filter((chunk) => chunk.parentId === parent.id)
        .map((chunk) => `${chunk.id} ${chunk.chunkText} ${chunk.embeddingText}`)
        .join(" ")
      const haystack = `${parent.id} ${parent.question} ${parent.answer} ${parent.questionAliases.join(" ")} ${chunkText}`
      return !searchText || haystack.toLowerCase().includes(searchText)
    }) ?? []
  const selectedParent = filteredParents.find((parent) => parent.id === selectedParentId) ?? filteredParents[0] ?? null

  async function openIndexVersion(record: KnowledgeIndexVersion) {
    setSelectedIndexVersionId(record.id)
    setSelectedIndexTab("overview")
    setSelectedParentId(null)
    setIndexSearch("")
    setIndexNotice(null)
    setExpandedChunkIds({})
    await onLoadVersionDetail?.(record.knowledgeVersionId)
  }

  function toggleChunkDetails(chunkId: string) {
    setExpandedChunkIds((current) => ({ ...current, [chunkId]: !current[chunkId] }))
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="font-semibold">索引版本列表</h3>
            <p className="mt-1 text-sm text-slate-600">每个知识版本对应一个索引版本。这里是工程师查看索引内容的入口。</p>
          </div>
          <Badge variant={copy.indexReady ? "default" : "secondary"} className="rounded-md">
            {copy.indexReady ? "ready" : "building"}
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-5 py-3">知识版本 ID</th>
                <th className="px-5 py-3">索引版本名称</th>
                <th className="px-5 py-3">索引版本 ID</th>
                <th className="px-5 py-3">Profile</th>
                <th className="px-5 py-3">Embedding</th>
                <th className="px-5 py-3">Parent 数</th>
                <th className="px-5 py-3">Chunk 数</th>
                <th className="px-5 py-3">状态</th>
                <th className="px-5 py-3">构建时间</th>
                <th className="px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {indexVersions.map((record) => (
                <tr key={record.id} className="bg-white">
                  <td className="px-5 py-4 font-medium text-slate-950">{record.knowledgeVersionId}</td>
                  <td className="px-5 py-4 font-medium text-slate-950">{record.name}</td>
                  <td className="px-5 py-4 font-medium text-slate-950">{record.id}</td>
                  <td className="px-5 py-4 text-slate-600">{record.profileKey}</td>
                  <td className="px-5 py-4 text-slate-600">-</td>
                  <td className="px-5 py-4 font-medium text-slate-950">{record.parentCount}</td>
                  <td className="px-5 py-4 font-medium text-slate-950">{record.chunkCount}</td>
                  <td className="px-5 py-4">
                    <Badge variant={record.status === "ready" ? "default" : "outline"} className="rounded-md">
                      {record.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{formatTimestamp(record.builtAt ?? record.createdAt)}</td>
                  <td className="px-5 py-4">
                    <Button size="sm" variant="outline" onClick={() => void openIndexVersion(record)}>
                      查看
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedIndexVersion && linkedVersion ? (
        <>
          <button type="button" aria-label="关闭索引版本抽屉" className="fixed inset-0 z-40 bg-slate-950/30" onClick={() => setSelectedIndexVersionId(null)} />
          <aside role="dialog" aria-modal="true" aria-label={`${selectedIndexVersion.id}索引版本详情`} className="fixed inset-y-0 right-0 z-50 flex w-full max-w-5xl flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="font-semibold">索引版本详情</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-md">知识版本：{selectedIndexVersion.knowledgeVersionId}</Badge>
                  <Badge variant="outline" className="rounded-md">索引版本：{selectedIndexVersion.id}</Badge>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedIndexVersionId(null)}>关闭</Button>
            </div>
            <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[280px_minmax(0,1fr)]">
              <nav className="overflow-y-auto border-b border-slate-200 bg-slate-50/70 py-3 md:border-b-0 md:border-r">
                <div className="space-y-1 px-3">
                  {[
                    ["overview", "基础信息"],
                    ["build", "构建摘要"],
                    ["content", "Parent / Chunks"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={cn(
                        "w-full rounded-md px-3 py-2 text-left text-sm transition",
                        value === selectedIndexTab ? "bg-white font-medium text-slate-950 shadow-sm" : "text-slate-600 hover:bg-white",
                      )}
                      onClick={() => {
                        setSelectedIndexTab(value as "overview" | "build" | "content")
                        setIndexNotice(null)
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {selectedIndexTab === "content" ? (
                  <div className="mt-4 border-t border-slate-200 px-3 pt-4">
                    <p className="text-xs font-semibold text-slate-500">Parent 列表</p>
                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        className="min-h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                        placeholder="搜索 parent / chunk"
                        aria-label="搜索 parent / chunk"
                        value={indexSearch}
                        onChange={(event) => {
                          setIndexSearch(event.target.value)
                          setIndexNotice(null)
                        }}
                      />
                      <Button size="sm" variant="outline" onClick={() => setIndexNotice("已筛选 parent / chunk")}>搜索</Button>
                    </div>
                    <div className="mt-4 space-y-2">
                      {filteredParents.map((parent) => (
                        <button
                          key={parent.id}
                          type="button"
                          className={cn(
                            "w-full rounded-md border px-3 py-3 text-left text-sm transition",
                            selectedParent?.id === parent.id ? "border-blue-200 bg-white text-slate-950 shadow-sm" : "border-transparent text-slate-600 hover:bg-white",
                          )}
                          onClick={() => setSelectedParentId(parent.id)}
                        >
                          <span className="block font-medium">{parent.question}</span>
                          <span className="mt-1 block text-xs text-slate-500">{parent.id}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </nav>
              <div className="min-h-0 overflow-y-auto p-5">
                {selectedIndexTab === "overview" ? (
                  <section className="space-y-4">
                    <section className="rounded-lg border border-slate-200 bg-white p-4">
                      <h4 className="font-semibold text-slate-950">索引版本信息</h4>
                      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                        <GateRow label="知识版本 ID" value={selectedIndexVersion.knowledgeVersionId} />
                        <GateRow label="索引版本 ID" value={selectedIndexVersion.id} />
                        <GateRow label="Profile" value={selectedIndexVersion.profileKey} />
                        <GateRow label="Embedding" value="-" />
                        <GateRow label="构建时间" value={formatTimestamp(selectedIndexVersion.builtAt ?? selectedIndexVersion.createdAt)} />
                        <GateRow label="状态" value={selectedIndexVersion.status} />
                      </div>
                    </section>
                    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <h4 className="font-semibold text-slate-950">Stage 10 产物规模</h4>
                      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <GateBox label="Parent 数" value={`${selectedIndexVersion.parentCount}`} />
                        <GateBox label="Chunk 数" value={`${selectedIndexVersion.chunkCount}`} />
                        <GateBox label="待归类内容" value={`${linkedVersion.coverageAudit.orphanRecords.length}`} />
                        <GateBox label="可能重复内容" value={`${linkedVersion.coverageAudit.ambiguityRecords.length}`} />
                      </div>
                    </section>
                  </section>
                ) : null}
                {selectedIndexTab === "build" ? (
                  <section className="space-y-4">
                    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <h4 className="font-semibold text-slate-950">Stage 1-9 清洗摘要</h4>
                      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <GateBox label="source 数" value={`${linkedVersion.stageSummary.sourceCount}`} />
                        <GateBox label="排除数" value={`${linkedVersion.stageSummary.excludedCount}`} />
                        <GateBox label="高风险数" value={`${linkedVersion.stageSummary.highRiskCount}`} />
                        <GateBox label="approved for stage10" value={`${linkedVersion.stageSummary.approvedCount}`} />
                        <GateBox label="pending / blocked 数" value={`${linkedVersion.stageSummary.pendingCount} / ${linkedVersion.stageSummary.blockedCount}`} />
                        <GateBox label="原始记录数" value={`${linkedVersion.stageSummary.rawRecordCount}`} />
                      </div>
                    </section>
                    <section className="rounded-lg border border-slate-200 bg-white p-4">
                      <h4 className="font-semibold text-slate-950">Stage 1-11 数量快照</h4>
                      <div className="mt-3 space-y-2">
                        {linkedVersion.stageSummary.stageCounts.map((item) => (
                          <div key={item.stage} className="flex flex-wrap justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                            <span className="font-medium text-slate-700">{item.stage}</span>
                            <span className="text-slate-600">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                    <section className={cn("rounded-lg border p-4", linkedVersion.coverageAudit.auditStatus === "normal" ? "border-slate-200 bg-white" : "border-rose-200 bg-rose-50")}>
                      <h4 className="font-semibold text-slate-950">Stage 11 覆盖率审计</h4>
                      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <GateBox label="覆盖率结果" value={`${linkedVersion.coverageAudit.coverage}%`} />
                        <GateBox label="审计状态" value={formatAuditStatus(linkedVersion)} />
                        <GateBox label="待归类内容（orphan）" value={`${linkedVersion.coverageAudit.orphanRecords.length}`} />
                        <GateBox label="可能重复内容（ambiguity）" value={`${linkedVersion.coverageAudit.ambiguityRecords.length}`} />
                      </div>
                    </section>
                  </section>
                ) : null}
                {selectedIndexTab === "content" ? (
                  <section>
                    <div className="space-y-5">
                      {indexNotice ? <div className="rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-700">{indexNotice}</div> : null}
                      {selectedParent ? (
                        <>
                          <section className="space-y-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-950">Parent 信息</p>
                              <p className="mt-1 text-xs text-slate-500">一个 KnowledgeParent 对应一条完整问答和字段信息。</p>
                            </div>
                            <article className="rounded-lg border border-slate-200 bg-white">
                              <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
                                <div>
                                  <p className="text-xs font-semibold text-slate-500">KnowledgeParent</p>
                                  <h4 className="mt-1 font-semibold text-slate-950">{selectedParent.question}</h4>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <Badge variant="outline" className="rounded-md">{selectedParent.recordKind}</Badge>
                                    <Badge variant="outline" className="rounded-md">{selectedParent.reviewStatus}</Badge>
                                  </div>
                                </div>
                                <div className="text-right text-xs text-slate-500">
                                  <div>来源文件：{selectedParent.sourceFiles.join("、") || "-"}</div>
                                  <div>问法别名：{selectedParent.questionAliases.length}</div>
                                </div>
                              </div>
                              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                                {selectedParent.answer}
                              </div>
                            </article>
                          </section>
                          <section className="space-y-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-950">Chunks 信息</p>
                              <p className="mt-1 text-xs text-slate-500">当前 Parent 下的索引片段。</p>
                            </div>
                            {(linkedVersion.chunks ?? []).filter((chunk) => chunk.parentId === selectedParent.id).map((chunk) => {
                              const expanded = expandedChunkIds[chunk.id] ?? false
                              return (
                                <article key={chunk.id} className="rounded-lg border border-slate-200 bg-white p-4">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="space-y-1 text-sm">
                                      <p className="font-medium text-slate-950">{chunk.sectionTitle}</p>
                                      <p className="text-xs text-slate-500">chunkOrder：{chunk.chunkOrder} / chunkType：{chunk.chunkType}</p>
                                    </div>
                                    <Button size="sm" variant="outline" onClick={() => toggleChunkDetails(chunk.id)}>
                                      {expanded ? "收起详情" : "详情"}
                                    </Button>
                                  </div>
                                  <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                                    {chunk.chunkText}
                                  </div>
                                  {expanded ? (
                                    <div className="mt-3 space-y-3 text-sm">
                                      <div>
                                        <div className="mb-1 font-semibold text-slate-950">embeddingText</div>
                                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 whitespace-pre-wrap text-slate-700">{chunk.embeddingText}</div>
                                      </div>
                                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-slate-700">
                                        metadata：{Object.keys(chunk.metadata ?? {}).length > 0 ? JSON.stringify(chunk.metadata) : "无"}
                                      </div>
                                    </div>
                                  ) : null}
                                </article>
                              )
                            })}
                          </section>
                        </>
                      ) : (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">当前版本还没有加载 Parent / Chunks 详情。</div>
                      )}
                    </div>
                  </section>
                ) : null}
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  )
}

type RiskTab = "summary" | "supplement" | "conflict" | "delete"

interface ConflictRiskItem {
  id: string
  title: string
  currentSource: string
  currentText: string
  incomingSource: string
  incomingText: string
  suggestion: string
  suggestionTone: "blue" | "amber"
}

interface DeleteRiskItem {
  id: string
  title: string
  source: string
  originalText: string
  keptText: string
  category: string
  reason: string
  stage: string
}

interface SupplementRiskItem {
  id: string
  title: string
  description: string
  kind: "orphan" | "pending" | "combined"
}

const supplementRiskItems = [
  {
    id: "pending-routing",
    title: "待归类内容",
    description: "Agent Assist.xlsx 的平台说明尚未归入问答对，需要确认归类方式。",
  },
  {
    id: "pending-answer",
    title: "待补充内容",
    description: "维修申请说明缺少可发布答案，需要补充后再进入本轮知识版本。",
  },
]

const conflictRiskItems: ConflictRiskItem[] = [
  {
    id: "warranty",
    title: "设备保修期口径不一致",
    currentSource: "产品手册 v2 / 保修政策",
    currentText: "问：设备保修期多久？\n\n答：标准保修期为 12 个月，可在购买后 30 天内申请延保。",
    incomingSource: "产品手册 v3 / 保修政策",
    incomingText: "问：设备保修期多久？\n\n答：标准保修期为 24 个月，延保服务以销售订单中的服务条款为准。",
    suggestion: "本次文档库文件时间更新，建议采用本次文档库内容；保存前仍需人工确认。",
    suggestionTone: "blue",
  },
  {
    id: "invoice",
    title: "发票抬头修改规则不一致",
    currentSource: "财务 FAQ 2023.pdf",
    currentText: "问：发票开具后能修改抬头吗？\n\n答：发票开具后不支持修改抬头，如需变更请重新提交开票申请。",
    incomingSource: "售后政策 2024.docx",
    incomingText: "问：发票开具后能修改抬头吗？\n\n答：发票开具后如需修改抬头，请联系客户成功经理提交更正申请。",
    suggestion: "两份内容来源不同，需要运营确认是否已有新的财务处理口径。",
    suggestionTone: "blue",
  },
  {
    id: "loaner-device",
    title: "备用机申请条件冲突",
    currentSource: "售后服务说明.pdf",
    currentText: "问：维修期间可以申请备用机吗？\n\n答：维修预计超过 5 个工作日时，可向服务中心咨询备用机申请。",
    incomingSource: "售后 FAQ 补充.xlsx",
    incomingText: "问：维修期间可以申请备用机吗？\n\n答：维修预计超过 3 个工作日时，可向服务中心咨询备用机申请。",
    suggestion: "新旧口径差异会影响用户承诺，请确认后再进入清洗结果确认。",
    suggestionTone: "amber",
  },
]

const deleteRiskItems: DeleteRiskItem[] = [
  {
    id: "chemical-warning",
    title: "安全警告可能被误删",
    source: "实验室安全规程.pdf",
    originalText:
      "问：如何安全处理化学品泄漏事故？\n\n答：立即疏散泄漏区域内的人员。【警告：请勿使用清水冲洗钠类化学品泄漏，以免引发爆炸。】请立即联系危险品处理部门介入。",
    keptText: "问：如何安全处理化学品泄漏事故？\n\n答：立即疏散泄漏区域内的人员。请立即联系危险品处理部门介入。",
    category: "合规风险",
    reason: "关键安全警告可能被误删，需要人工确认是否恢复。",
    stage: "清洗阶段",
  },
]

function RiskView({ detailState, onResolve }: { detailState: DetailState; onResolve: (message?: string) => void }) {
  const locked = detailState === "ready"
  const [activeRiskTab, setActiveRiskTab] = useState<RiskTab>("summary")
  const [resolvedResults, setResolvedResults] = useState<Record<string, string>>({})
  const [editableContents, setEditableContents] = useState<Record<string, string>>({})
  const [allRisksResolved, setAllRisksResolved] = useState(false)
  const [riskNotice, setRiskNotice] = useState<string | null>(null)
  const resolvedCount = Object.keys(resolvedResults).length
  const pendingCount = allRisksResolved ? 0 : Math.max(0, 24 - resolvedCount)
  const supplementCount = supplementRiskItems.length

  function saveRiskResult(itemId: string, result: string) {
    setResolvedResults((current) => ({ ...current, [itemId]: result }))
    setAllRisksResolved(false)
    setRiskNotice(`${result}，处理结果只影响当前任务`)
  }

  function markAllResolved() {
    const nextResults = Object.fromEntries(
      [...conflictRiskItems, ...deleteRiskItems].map((item) => [item.id, "已处理"])
    )
    setResolvedResults(nextResults)
    setAllRisksResolved(true)
    setRiskNotice("风险与冲突已处理完成，可以进入清洗结果确认")
  }

  function updateEditableContent(itemId: string, content: string) {
    setEditableContents((current) => ({ ...current, [itemId]: content }))
    setRiskNotice("本次内容已更新，后续处理会基于编辑后的内容")
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          ["summary", "待处理事项"],
          ["supplement", `待归类与待补充（${supplementCount}）`],
          ["conflict", `合并冲突（${conflictRiskItems.length}）`],
          ["delete", `高风险删除（${deleteRiskItems.length}）`],
        ].map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant={activeRiskTab === value ? "default" : "outline"}
            className="rounded-md"
            onClick={() => setActiveRiskTab(value as RiskTab)}
          >
            {label}
          </Button>
        ))}
      </div>

      {riskNotice ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {riskNotice}
        </div>
      ) : null}

      <section className="space-y-4">
        {activeRiskTab === "summary" ? (
          <RiskSummaryPanel
            pendingCount={pendingCount}
            supplementCount={supplementCount}
            locked={locked}
            onMarkAllResolved={markAllResolved}
            onEnterCleaned={() => onResolve("风险与冲突已处理，可以进入清洗结果确认")}
          />
        ) : null}

        {activeRiskTab === "supplement" ? <SupplementRiskPanel items={supplementRiskItems} /> : null}

        {activeRiskTab === "conflict" ? (
          <ConflictRiskPanel
            locked={locked}
            resolvedResults={resolvedResults}
            editableContents={editableContents}
            onResolve={saveRiskResult}
            onUpdateEditableContent={updateEditableContent}
          />
        ) : null}

        {activeRiskTab === "delete" ? (
          <DeleteRiskPanel
            locked={locked}
            resolvedResults={resolvedResults}
            editableContents={editableContents}
            onResolve={saveRiskResult}
            onUpdateEditableContent={updateEditableContent}
          />
        ) : null}
      </section>
    </div>
  )
}

function RiskSummaryPanel({
  pendingCount,
  supplementCount,
  locked,
  onMarkAllResolved,
  onEnterCleaned,
}: {
  pendingCount: number
  supplementCount: number
  locked: boolean
  onMarkAllResolved: () => void
  onEnterCleaned: () => void
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">风险与冲突处理</h3>
          <p className="mt-1 text-sm text-slate-600">存在风险项时，先处理这里的事项；处理完成后才进入清洗结果确认。</p>
        </div>
        <Button size="sm" onClick={onMarkAllResolved} disabled={locked}>
          全部标记已处理
        </Button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <MetricCard label="待处理事项" value={`${pendingCount}`} helper="风险与人工确认项" tone={pendingCount > 0 ? "rose" : "green"} size="compact" />
        <MetricCard label="待归类与待补充" value={`${supplementCount}`} helper="尚未形成正式问答对" tone="blue" size="compact" />
        <MetricCard label="合并冲突" value="12" helper="同一问题存在不同口径" tone="amber" size="compact" />
        <MetricCard label="高风险删除" value="8" helper="清洗删除需人工确认" tone="amber" size="compact" />
      </div>

      <div className="mt-5">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="font-semibold text-slate-950">本轮待处理摘要</p>
          <div className="mt-3 space-y-3">
            <div className="rounded-md border border-white bg-white px-4 py-3 text-sm">
              <p className="font-medium text-slate-950">待归类与待补充</p>
              <p className="mt-1 text-slate-600">存在 {supplementCount} 条内容尚未形成正式问答对，需要补充或归类。</p>
            </div>
            <div className="rounded-md border border-white bg-white px-4 py-3 text-sm">
              <p className="font-medium text-slate-950">合并冲突确认</p>
              <p className="mt-1 text-slate-600">设备保修期口径不一致等 {conflictRiskItems.length} 条内容需要确认最终口径。</p>
            </div>
            <div className="rounded-md border border-white bg-white px-4 py-3 text-sm">
              <p className="font-medium text-slate-950">高风险删除确认</p>
              <p className="mt-1 text-slate-600">存在 {deleteRiskItems.length} 条高风险内容需要确认是否恢复到本轮版本。</p>
            </div>
          </div>
        </div>
      </div>

      {pendingCount === 0 ? (
        <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          风险与冲突已处理完成，可以进入清洗结果确认。
          <Button size="sm" className="ml-3" onClick={onEnterCleaned}>
            进入清洗结果确认
          </Button>
        </div>
      ) : null}
    </section>
  )
}

function SupplementRiskPanel({
  items,
}: {
  items: Array<{ id: string; title: string; description: string }>
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div>
        <h3 className="font-semibold">待归类与待补充</h3>
        <p className="mt-1 text-sm text-slate-600">这些内容还没有形成正式问答对，需要先完成归类或补充，后续才能进入知识版本。</p>
      </div>

      <div className="mt-5 space-y-4">
        {items.map((item) => (
          <article key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="font-medium text-slate-950">{item.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function ConflictRiskPanel({
  locked,
  resolvedResults,
  editableContents,
  onResolve,
  onUpdateEditableContent,
}: {
  locked: boolean
  resolvedResults: Record<string, string>
  editableContents: Record<string, string>
  onResolve: (itemId: string, result: string) => void
  onUpdateEditableContent: (itemId: string, content: string) => void
}) {
  const [filterNotice, setFilterNotice] = useState<string | null>(null)

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">合并冲突确认</h3>
          <p className="mt-1 text-sm text-slate-600">同一个问题出现多个不同口径时，需要运营选择本轮采用哪一版。选择只影响当前任务。</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setFilterNotice("已筛选待确认冲突")}>
          只看待确认
        </Button>
      </div>

      {filterNotice ? (
        <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          {filterNotice}
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        {conflictRiskItems.map((item) => (
          <ConflictRiskCard
            key={item.id}
            item={item}
            resolvedResult={resolvedResults[item.id]}
            editableContent={editableContents[item.id]}
            locked={locked}
            onResolve={onResolve}
            onUpdateEditableContent={onUpdateEditableContent}
          />
        ))}
      </div>
    </section>
  )
}

function DeleteRiskPanel({
  locked,
  resolvedResults,
  editableContents,
  onResolve,
  onUpdateEditableContent,
}: {
  locked: boolean
  resolvedResults: Record<string, string>
  editableContents: Record<string, string>
  onResolve: (itemId: string, result: string) => void
  onUpdateEditableContent: (itemId: string, content: string) => void
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div>
        <h3 className="font-semibold">高风险内容删除明细</h3>
        <p className="mt-1 text-sm text-slate-600">这些内容暂未进入本轮问答对草稿，需要确认保持删除还是恢复到本轮内容。</p>
      </div>

      <div className="mt-5 space-y-4">
        {deleteRiskItems.map((item) => (
          <DeleteRiskCard
            key={item.id}
            item={item}
            resolvedResult={resolvedResults[item.id]}
            editableContent={editableContents[item.id]}
            locked={locked}
            onResolve={onResolve}
            onUpdateEditableContent={onUpdateEditableContent}
          />
        ))}
      </div>
    </section>
  )
}

function ConflictRiskCard({
  item,
  resolvedResult,
  editableContent,
  locked,
  compact,
  onResolve,
  onUpdateEditableContent,
}: {
  item: ConflictRiskItem
  resolvedResult?: string
  editableContent?: string
  locked: boolean
  compact?: boolean
  onResolve: (itemId: string, result: string) => void
  onUpdateEditableContent: (itemId: string, content: string) => void
}) {
  const currentRoundContent = editableContent ?? item.incomingText
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(currentRoundContent)

  function openEditor() {
    setDraft(currentRoundContent)
    setEditing(true)
  }

  function saveEditor() {
    onUpdateEditableContent(item.id, draft)
    setEditing(false)
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CircleAlert className="size-4 text-amber-600" />
          <span className="font-medium">{compact ? `合并冲突确认：${item.title}` : item.title}</span>
        </div>
        <Badge variant={resolvedResult ? "default" : "secondary"} className="rounded-md">
          {resolvedResult ?? "待处理"}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <RiskTextBox title="当前知识版本内容" source={item.currentSource} content={item.currentText} />
        <RiskTextBox title="本次文档库内容" source={item.incomingSource} content={currentRoundContent} accent="add" />
      </div>

      {editing ? (
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-slate-950">编辑本次内容</p>
          <Textarea
            className="mt-3 min-h-32 bg-white"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={saveEditor}>
              保存本次内容
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDraft(currentRoundContent)
                setEditing(false)
              }}
            >
              取消编辑
            </Button>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "mt-4 rounded-md border p-3 text-sm leading-6",
          item.suggestionTone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-blue-100 bg-blue-50 text-blue-800"
        )}
      >
        <b>系统建议：</b> {item.suggestion}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={locked} onClick={openEditor}>
          编辑本次内容
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={locked || Boolean(resolvedResult)}
          onClick={() => onResolve(item.id, "已保留当前知识版本内容")}
        >
          保留当前知识版本内容
        </Button>
        <Button
          size="sm"
          disabled={locked || Boolean(resolvedResult)}
          onClick={() => onResolve(item.id, "已采用本次文档库内容")}
        >
          使用本次文档库内容
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={locked || Boolean(resolvedResult)}
          onClick={() => onResolve(item.id, "已加入本轮忽略")}
        >
          本轮忽略
        </Button>
      </div>
    </div>
  )
}

function DeleteRiskCard({
  item,
  resolvedResult,
  editableContent,
  locked,
  compact,
  onResolve,
  onUpdateEditableContent,
}: {
  item: DeleteRiskItem
  resolvedResult?: string
  editableContent?: string
  locked: boolean
  compact?: boolean
  onResolve: (itemId: string, result: string) => void
  onUpdateEditableContent: (itemId: string, content: string) => void
}) {
  const hasResultContent = Boolean(resolvedResult) || Boolean(editableContent)
  const defaultSuggestion = "当前建议删除这条内容，不纳入本轮知识版本。"
  const currentRoundContent = editableContent ?? item.keptText
  const resultContent =
    editableContent ??
    (resolvedResult === "已保持删除"
      ? "本轮继续保持删除，不纳入知识版本。"
      : resolvedResult === "已恢复到本轮内容"
        ? item.originalText
        : currentRoundContent)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(currentRoundContent)

  function openEditor() {
    setDraft(currentRoundContent)
    setEditing(true)
  }

  function saveEditor() {
    onUpdateEditableContent(item.id, draft)
    setEditing(false)
  }

  return (
    <div className="rounded-lg border border-rose-100 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-rose-600" />
          <span className="font-medium">{compact ? `高风险内容删除：${item.title}` : item.title}</span>
        </div>
        <Badge variant={resolvedResult ? "default" : "destructive"} className="rounded-md">
          {resolvedResult ?? "待处理"}
        </Badge>
      </div>

      <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-700">
        <b>为什么需要确认：</b> {item.reason} 你的决定只对当前任务生效，不会变成全局规则。
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <RiskTextBox title="原始内容" source={item.source} content={item.originalText} accent="remove" />
        <RiskTextBox title={hasResultContent ? "处理结果" : "系统建议删除"} content={hasResultContent ? resultContent : defaultSuggestion} accent="add" />
      </div>

      {editing ? (
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-slate-950">编辑本次内容</p>
          <Textarea
            className="mt-3 min-h-32 bg-white"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={saveEditor}>
              保存本次内容
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDraft(currentRoundContent)
                setEditing(false)
              }}
            >
              取消编辑
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={locked} onClick={openEditor}>
          编辑本次内容
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={locked || Boolean(resolvedResult)}
          onClick={() => onResolve(item.id, "已保持删除")}
        >
          保持删除
        </Button>
        <Button
          size="sm"
          disabled={locked || Boolean(resolvedResult)}
          onClick={() => onResolve(item.id, "已恢复到本轮内容")}
        >
          恢复到本轮内容
        </Button>
      </div>
    </div>
  )
}

function RiskTextBox({
  title,
  source,
  content,
  accent,
}: {
  title: string
  source?: string
  content: string
  accent?: "add" | "remove"
}) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
        {title}
      </div>
      <div
        className={cn(
          "whitespace-pre-line p-3 text-sm leading-6 text-slate-700",
          accent === "add" && "bg-emerald-50 text-emerald-800",
          accent === "remove" && "bg-rose-50 text-rose-800 line-through decoration-rose-500"
        )}
      >
        {source ? <p className="mb-2 text-xs text-slate-500">来源：{source}</p> : null}
        {content}
      </div>
    </div>
  )
}

function MetadataFieldBox({ label, fieldKey, value }: { label: string; fieldKey: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-500">
        {label}
        <span className="ml-1 font-normal text-slate-400">{fieldKey}</span>
      </p>
      <p className="mt-1 text-sm leading-6 text-slate-700">{value || "未生成"}</p>
    </div>
  )
}

function CleanedView({
  detailState,
  onPublishToStg,
}: {
  detailState: DetailState
  onPublishToStg: () => void
}) {
  const copy = stateCopy(detailState)
  const canEdit = detailState !== "risk"
  const canPublishToStg = detailState === "review" && !copy.indexReady
  const [drafts, setDrafts] = useState(cleanedDrafts)
  const [selectedTitle, setSelectedTitle] = useState(cleanedDrafts[0]?.title ?? "")
  const [activeDraftAction, setActiveDraftAction] = useState<{
    type: "edit" | "lock" | "regenerate" | "delete"
    title: string
  } | null>(null)
  const [editDraft, setEditDraft] = useState({ title: cleanedDrafts[0]?.title ?? "", body: cleanedDrafts[0]?.body ?? "" })
  const [lockedTitles, setLockedTitles] = useState<Record<string, string[]>>({})
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const lockableFields = [
    "问题",
    "答案",
    "question_aliases",
    "intent",
    "domain",
    "subject",
    "device",
    "product_model",
    "scope_terms",
    "is_exact_faq",
  ]

  function showDraftNotice(message: string) {
    setActionNotice(message)
  }

  function openDraftAction(type: "edit" | "lock" | "regenerate" | "delete", item: (typeof cleanedDrafts)[number]) {
    setSelectedTitle(item.title)
    setActiveDraftAction({ type, title: item.title })
    if (type === "edit") {
      setEditDraft({ title: item.title, body: item.body })
    }
  }

  function handleDraftAction(action: string, item: (typeof cleanedDrafts)[number]) {
    if (action === "编辑问答对") {
      openDraftAction("edit", item)
      return
    }

    if (action === "锁定字段") {
      openDraftAction("lock", item)
      return
    }

    if (action === "重新生成") {
      openDraftAction("regenerate", item)
      return
    }

    if (action === "删除") {
      openDraftAction("delete", item)
    }
  }

  function saveQuestionPair(originalTitle: string) {
    const nextTitle = editDraft.title.trim() || originalTitle
    const nextBody = editDraft.body.trim() || "暂无答案内容"
    setDrafts((current) =>
      current.map((draft) =>
        draft.title === originalTitle
          ? {
              ...draft,
              title: nextTitle,
              body: nextBody,
            }
          : draft
      )
    )
    setSelectedTitle(nextTitle)
    setActiveDraftAction(null)
    showDraftNotice(`问答对已保存：${nextTitle}`)
  }

  function saveLockedFields(title: string, fields: string[]) {
    setLockedTitles((current) => ({ ...current, [title]: fields }))
    setActiveDraftAction(null)
    showDraftNotice(`字段已锁定：${title} 的 ${fields.join("、")} 不会被重新生成覆盖`)
  }

  function applyRegeneratedDraft(item: (typeof cleanedDrafts)[number]) {
    const regeneratedBody = `${item.body} 已补充适用范围、操作入口和例外说明。`
    setDrafts((current) =>
      current.map((draft) =>
        draft.title === item.title
          ? {
              ...draft,
              body: regeneratedBody,
            }
          : draft
      )
    )
    setActiveDraftAction(null)
    showDraftNotice(`问答对已重新生成：${item.title}`)
  }

  function confirmDeleteDraft(item: (typeof cleanedDrafts)[number]) {
    setDrafts((current) => {
      const next = current.filter((draft) => draft.title !== item.title)
      if (selectedTitle === item.title) {
        setSelectedTitle(next[0]?.title ?? "")
      }
      return next
    })
    setActiveDraftAction(null)
    showDraftNotice(`已从草稿列表移除：${item.title}`)
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <p className="font-semibold">问答对草稿</p>
          <Badge variant={copy.indexReady ? "default" : "secondary"} className="rounded-md">
            {copy.indexReady ? "已发布到 STG" : "待发布到 STG"}
          </Badge>
        </div>
        <div className="mt-4 space-y-2">
          {drafts.map((item) => {
            const selected = item.title === selectedTitle
            return (
              <button
                key={item.title}
                type="button"
                className={cn(
                  "w-full rounded-md border px-3 py-3 text-left text-sm transition-colors hover:bg-slate-50",
                  selected ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"
                )}
                onClick={() => {
                  setSelectedTitle(item.title)
                  setActiveDraftAction(null)
                  showDraftNotice(`已切换到问答对：${item.title}`)
                }}
              >
                <span className="block font-medium">{item.title}</span>
                <span className="mt-1 block text-xs text-slate-500">{item.source}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          运营确认完成后，系统会在发布到 STG 时同步生成索引版本。
        </div>
        {canPublishToStg ? (
          <Button className="mt-4 w-full" onClick={onPublishToStg}>
            生成索引并发布到 STG
          </Button>
        ) : (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
            索引会在发布到 STG 时同步生成。
          </div>
        )}
      </aside>

      <section className="space-y-4">
        {actionNotice ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {actionNotice}
          </div>
        ) : null}

        {drafts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
            当前没有问答对草稿。
          </div>
        ) : null}

        {drafts.map((item) => (
          <div key={item.title} className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-slate-500">来源：{item.source}</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <MetadataFieldBox label="问法别名" fieldKey="question_aliases" value={item.question_aliases.join("、")} />
                  <MetadataFieldBox label="intent" fieldKey="intent" value={item.intent} />
                  <MetadataFieldBox label="业务域" fieldKey="domain" value={item.domain} />
                  <MetadataFieldBox label="主题" fieldKey="subject" value={item.subject} />
                  <MetadataFieldBox label="适用设备" fieldKey="device" value={item.device} />
                  <MetadataFieldBox label="产品型号" fieldKey="product_model" value={item.product_model} />
                  <MetadataFieldBox label="范围词" fieldKey="scope_terms" value={item.scope_terms.join("、")} />
                  <MetadataFieldBox
                    label="标准 FAQ"
                    fieldKey="is_exact_faq"
                    value={item.is_exact_faq === "true" ? "是" : "否"}
                  />
                </div>
              </div>
            </div>
            <Textarea className="mt-4 min-h-24" value={item.body} readOnly />
            {lockedTitles[item.title]?.length ? (
              <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                已锁定字段：{lockedTitles[item.title].join("、")}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {["编辑问答对", "锁定字段", "重新生成", "删除"].map((action) => (
                <Button key={action} variant="outline" disabled={!canEdit} onClick={() => handleDraftAction(action, item)}>
                  {action}
                </Button>
              ))}
            </div>
            {activeDraftAction?.title === item.title && activeDraftAction.type === "edit" ? (
              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm">
                <p className="font-semibold text-slate-950">编辑问答对内容</p>
                <label className="mt-3 block space-y-1">
                  <span className="text-xs font-medium text-slate-500">问题</span>
                  <input
                    value={editDraft.title}
                    onChange={(event) => setEditDraft((current) => ({ ...current, title: event.target.value }))}
                    className="h-9 w-full rounded-md border border-blue-100 bg-white px-3 text-sm"
                  />
                </label>
                <label className="mt-3 block space-y-1">
                  <span className="text-xs font-medium text-slate-500">答案</span>
                  <Textarea
                    className="min-h-28 bg-white"
                    value={editDraft.body}
                    onChange={(event) => setEditDraft((current) => ({ ...current, body: event.target.value }))}
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => saveQuestionPair(item.title)}>
                    保存问答对
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setActiveDraftAction(null)}>
                    取消编辑
                  </Button>
                </div>
              </div>
            ) : null}
            {activeDraftAction?.title === item.title && activeDraftAction.type === "lock" ? (
              <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm">
                <p className="font-semibold text-slate-950">锁定字段设置</p>
                <p className="mt-2 text-slate-600">锁定后，重新生成不会覆盖这些字段。</p>
              <div className="mt-3 flex flex-wrap gap-2">
                  {lockableFields.map((field) => (
                    <span key={field} className="rounded-md border border-emerald-200 bg-white px-3 py-2 text-emerald-700">
                      {field}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => saveLockedFields(item.title, lockableFields)}>
                    保存锁定字段
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setActiveDraftAction(null)}>
                    取消
                  </Button>
                </div>
              </div>
            ) : null}
            {activeDraftAction?.title === item.title && activeDraftAction.type === "regenerate" ? (
              <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm">
                <p className="font-semibold text-slate-950">重新生成预览</p>
                <p className="mt-2 leading-6 text-slate-700">
                  {item.body} 已补充适用范围、操作入口和例外说明。
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => applyRegeneratedDraft(item)}>
                    应用生成结果
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setActiveDraftAction(null)}>
                    取消
                  </Button>
                </div>
              </div>
            ) : null}
            {activeDraftAction?.title === item.title && activeDraftAction.type === "delete" ? (
              <div className="mt-4 rounded-lg border border-rose-100 bg-rose-50 p-4 text-sm">
                <p className="font-semibold text-slate-950">删除确认</p>
                <p className="mt-2 text-slate-600">删除后，本条问答对不会进入本轮索引。</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="destructive" onClick={() => confirmDeleteDraft(item)}>
                    确认删除
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setActiveDraftAction(null)}>
                    取消
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </section>
    </div>
  )
}

function RoundsView() {
  const rounds = [
    {
      round: "第 2 轮（当前）",
      drawerRound: "第 2 轮",
      content: "Q4 第 2 轮内容草稿",
      strategy: "激进清洗 + V1 修复规则",
      status: "待试查",
      sourceFileCount: 28,
      rawRecordCount: 312,
      releaseReadyCount: 186,
      parentCount: 186,
      chunkCount: 512,
      pendingCount: 3,
      blockedCount: 1,
      coverage: "96.8%",
      auditStatus: "需关注：存在待归类内容",
      stageSummary: [
        { stage: "Stage 1 source_manifest", value: "28 个来源文件 / 4 个排除文件" },
        { stage: "Stage 2 raw_records", value: "312 条原始记录" },
        { stage: "Stage 3 cleaned_records", value: "298 条可继续清洗记录" },
        { stage: "Stage 4 routing / reclassify", value: "262 条 include / 18 条 high risk / 18 条 exclude" },
        { stage: "Stage 5 structure", value: "146 条 explicit FAQ / 54 条 composite doc" },
        { stage: "Stage 6 promotion", value: "42 条 promoted FAQ / 12 条 residual doc" },
        { stage: "Stage 7 merge", value: "198 条 merge ready / 7 组冲突候选" },
        { stage: "Stage 8 conflict detection", value: "4 组 cleared / 1 组 blocked" },
        { stage: "Stage 9 release gating", value: "186 条 release-ready / 3 条 pending / 1 条 blocked" },
        { stage: "Stage 10 parents / chunks", value: "186 个 parent / 512 个 chunk" },
        { stage: "Stage 11 coverage audit", value: "覆盖率 96.8% / 2 条 orphan / 1 条 ambiguity" },
      ],
      auditDistribution: [
        { label: "excluded", value: "18" },
        { label: "high risk", value: "18" },
        { label: "pending", value: "3" },
        { label: "blocked", value: "1" },
      ],
      orphanRecords: [
        "FAQ 手册中的旧版报销说明尚未归入任何问答对。",
        "运营补充文件中的资格说明尚未归入任何问答对。",
      ],
      ambiguityRecords: ["“发票抬头修改”和“更正申请”内容可能重复，建议确认是否合并。"],
      missingRecords: [
        "售后 FAQ 补充.xlsx 中有 1 条内容暂未处理完成，本轮未纳入知识版本。",
        "财务 FAQ 2023.pdf 中有 1 条口径冲突待确认，本轮未纳入知识版本。",
      ],
      indexItems: [
        {
          title: "设备保修期说明",
          status: "已入索引",
          source: "产品手册 v3.docx / 保修政策",
          body: "标准保修期为 24 个月，延保服务以销售订单中的服务条款为准。购买后如需申请延保，请联系客户成功经理。",
        },
        {
          title: "路由器密码重置步骤",
          status: "已入索引",
          source: "路由器设置文档.pdf / 常见问题",
          body: "要重置路由器密码，请找到设备背面的 Reset 按钮，按住 10 秒钟后等待设备重启，再使用默认管理员账号登录。",
        },
        {
          title: "人工补充：延保申请入口",
          status: "本轮新增",
          source: "人工新增 / 运营补充",
          body: "客户如需申请延保，可在购买后 30 天内联系客户成功经理，由客户成功经理根据销售订单中的服务条款协助处理。",
        },
      ],
    },
    {
      round: "第 1 轮",
      drawerRound: "第 1 轮",
      content: "Q4 第 1 轮内容草稿",
      strategy: "系统默认基线",
      status: "已完成",
      sourceFileCount: 24,
      rawRecordCount: 284,
      releaseReadyCount: 174,
      parentCount: 174,
      chunkCount: 468,
      pendingCount: 1,
      blockedCount: 0,
      coverage: "98.4%",
      auditStatus: "正常",
      stageSummary: [
        { stage: "Stage 1 source_manifest", value: "24 个来源文件 / 3 个排除文件" },
        { stage: "Stage 2 raw_records", value: "284 条原始记录" },
        { stage: "Stage 3 cleaned_records", value: "276 条可继续清洗记录" },
        { stage: "Stage 4 routing / reclassify", value: "248 条 include / 12 条 high risk / 16 条 exclude" },
        { stage: "Stage 5 structure", value: "138 条 explicit FAQ / 39 条 composite doc" },
        { stage: "Stage 6 promotion", value: "31 条 promoted FAQ / 8 条 residual doc" },
        { stage: "Stage 7 merge", value: "180 条 merge ready / 3 组冲突候选" },
        { stage: "Stage 8 conflict detection", value: "3 组 cleared / 0 组 blocked" },
        { stage: "Stage 9 release gating", value: "174 条 release-ready / 1 条 pending / 0 条 blocked" },
        { stage: "Stage 10 parents / chunks", value: "174 个 parent / 468 个 chunk" },
        { stage: "Stage 11 coverage audit", value: "覆盖率 98.4% / 0 条 orphan / 0 条 ambiguity" },
      ],
      auditDistribution: [
        { label: "excluded", value: "16" },
        { label: "high risk", value: "12" },
        { label: "pending", value: "1" },
        { label: "blocked", value: "0" },
      ],
      orphanRecords: [],
      ambiguityRecords: [],
      missingRecords: ["活动规则汇总.docx：因时效性不足被标记为 pending，未进入最终知识版本。"],
      indexItems: [
        {
          title: "保修期说明（旧版）",
          status: "已入索引",
          source: "产品手册 v2.docx / 保修政策",
          body: "标准保修期为 12 个月，可在购买后 30 天内申请延保。",
        },
        {
          title: "延保申请说明（旧版）",
          status: "已入索引",
          source: "运营 FAQ 2024.xlsx / 延保",
          body: "购买后 30 天内可申请延保，需提供销售订单和设备序列号。",
        },
      ],
    },
  ]
  const scopes = ["全部索引内容（1,204）", "已修改内容（6）", "已删除内容（20）", "高风险处理内容（8）", "人工新增内容（1）"]
  const auditLabelMap: Record<string, string> = {
    excluded: "未纳入当前版本",
    "high risk": "需人工确认",
    pending: "暂未处理完成",
    blocked: "存在阻断问题",
  }
  const [selectedRound, setSelectedRound] = useState<(typeof rounds)[number] | null>(null)
  const [selectedRoundTab, setSelectedRoundTab] = useState<"basic" | "items">("basic")
  const [selectedScope, setSelectedScope] = useState(scopes[0])
  const [filterNotice, setFilterNotice] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h3 className="font-semibold">清洗轮次记录</h3>
          <p className="text-sm text-slate-500">点击查看每一轮清洗后生成的索引内容。</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-5 py-3">轮次</th>
                <th className="px-5 py-3">本轮内容</th>
                <th className="px-5 py-3">本轮清洗策略</th>
                <th className="px-5 py-3">来源文件数</th>
                <th className="px-5 py-3">原始记录数</th>
                <th className="px-5 py-3">覆盖率</th>
                <th className="px-5 py-3">审计状态</th>
                <th className="px-5 py-3">状态</th>
                <th className="px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rounds.map((row) => (
                <tr key={row.round} className={row.round === selectedRound?.round ? "bg-sky-50/70" : "bg-white"}>
                  <td className="px-5 py-4 font-medium text-slate-950">{row.round}</td>
                  <td className="px-5 py-4 text-slate-600">{row.content}</td>
                  <td className="px-5 py-4 text-slate-600">{row.strategy}</td>
                  <td className="px-5 py-4 text-slate-600">{row.sourceFileCount}</td>
                  <td className="px-5 py-4 text-slate-600">{row.rawRecordCount}</td>
                  <td className="px-5 py-4 text-slate-600">{row.coverage}</td>
                  <td className="px-5 py-4">
                    <Badge variant={row.auditStatus === "正常" ? "outline" : "secondary"} className="rounded-md">
                      {row.auditStatus}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={row.status === "已完成" ? "outline" : "secondary"} className="rounded-md">
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedRound(row)
                          setSelectedRoundTab("basic")
                          setSelectedScope(scopes[0])
                          setFilterNotice(null)
                        }}
                      >
                        查看问答对
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedRound ? (
        <>
          <button
            type="button"
            aria-label="关闭索引内容抽屉"
            className="fixed inset-0 z-40 bg-slate-950/30"
            onClick={() => setSelectedRound(null)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedRound.drawerRound}知识版本详情`}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-4xl flex-col border-l border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="font-semibold">{selectedRound.drawerRound}知识版本详情</h3>
                <Badge variant="outline" className="mt-2 rounded-md">
                  {selectedRound.content}
                </Badge>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedRound(null)}>
                关闭
              </Button>
            </div>
            <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[280px_minmax(0,1fr)]">
              <nav className="border-b border-slate-200 bg-slate-50/70 py-3 md:border-b-0 md:border-r">
                <div className="space-y-1 px-3">
                  {[
                    ["basic", "基础信息"],
                    ["items", "问答对详情"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={cn(
                        "w-full rounded-md px-3 py-2 text-left text-sm transition",
                        value === selectedRoundTab
                          ? "bg-white font-medium text-slate-950 shadow-sm"
                          : "text-slate-600 hover:bg-white"
                      )}
                      onClick={() => {
                        setSelectedRoundTab(value as "basic" | "items")
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </nav>
              <div className="min-h-0 overflow-y-auto p-5">
                {selectedRoundTab === "basic" ? (
                  <>
                    <section
                      className={cn(
                        "rounded-lg border p-4",
                        selectedRound.auditStatus === "正常"
                          ? "border-slate-200 bg-slate-50"
                          : "border-rose-200 bg-rose-50"
                      )}
                    >
                      <h4 className="font-semibold text-slate-950">覆盖率审计摘要</h4>
                      <div className="mt-3 space-y-2 rounded-md border border-white/80 bg-white px-4 py-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="text-slate-500">覆盖率</span>
                          <strong className="text-slate-950">{selectedRound.coverage}</strong>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="text-slate-500">审计状态</span>
                          <strong
                            className={selectedRound.auditStatus === "正常" ? "text-emerald-700" : "text-rose-700"}
                          >
                            {selectedRound.auditStatus}
                          </strong>
                        </div>
                      </div>
                    </section>

                    <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                      <h4 className="font-semibold text-slate-950">异常明细</h4>
                      <div className="mt-4 space-y-4 text-sm">
                        <div>
                          <p className="font-semibold text-slate-950">本轮未纳入内容</p>
                          <div className="mt-2 space-y-2">
                            {selectedRound.auditDistribution.map((item) => (
                              <GateRow key={item.label} label={auditLabelMap[item.label] || item.label} value={item.value} />
                            ))}
                          </div>
                        </div>
                        <div className="border-t border-slate-100 pt-4">
                          <p className="font-semibold text-slate-950">待归类内容</p>
                          <p className="mt-1 text-slate-500">这些内容已识别到，但还没有归入任何问答对，需要确认归类方式。</p>
                          <div className="mt-2 space-y-2 leading-6 text-slate-700">
                            {selectedRound.orphanRecords.length > 0 ? (
                              selectedRound.orphanRecords.map((item, index) => <p key={buildListKey("round-orphan", item, index)}>{item}</p>)
                            ) : (
                              <p>当前没有需要补充归类的内容。</p>
                            )}
                          </div>
                        </div>
                        <div className="border-t border-slate-100 pt-4">
                          <p className="font-semibold text-slate-950">可能重复的内容</p>
                          <div className="mt-2 space-y-2 leading-6 text-slate-700">
                            {selectedRound.ambiguityRecords.length > 0 ? (
                              selectedRound.ambiguityRecords.map((item, index) => <p key={buildListKey("round-ambiguity", item, index)}>{item}</p>)
                            ) : (
                              <p>当前没有需要进一步确认的重复内容。</p>
                            )}
                          </div>
                        </div>
                        <div className="border-t border-slate-100 pt-4">
                          <p className="font-semibold text-slate-950">本轮未进入知识版本的内容</p>
                          <div className="mt-2 space-y-2 leading-6 text-slate-700">
                            {selectedRound.missingRecords.map((item, index) => (
                              <p key={buildListKey("round-blocked", item, index)}>{item}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    </section>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {scopes.map((scope) => (
                        <button
                          key={scope}
                          type="button"
                          className={cn(
                            "rounded-md border px-3 py-2 text-sm transition",
                            scope === selectedScope
                              ? "border-slate-950 bg-slate-950 text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                          )}
                          onClick={() => {
                            setSelectedScope(scope)
                            setFilterNotice(`已切换到${scope}`)
                          }}
                        >
                          {scope}
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <input
                        type="text"
                        className="min-h-9 flex-1 rounded-md border border-slate-200 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                        placeholder="搜索索引内容..."
                        aria-label="搜索索引内容"
                      />
                      <Button variant="outline" size="sm" onClick={() => setFilterNotice("已筛选索引内容")}>
                        搜索
                      </Button>
                    </div>
                    {filterNotice ? (
                      <div className="mt-3 rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-700">
                        {filterNotice}
                      </div>
                    ) : null}
                    <div className="mt-4 space-y-3">
                      {selectedRound.indexItems.map((item) => (
                        <article key={item.title} className="rounded-lg border border-slate-200 bg-white">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
                            <p className="font-medium text-slate-950">{item.title}</p>
                            <Badge variant={item.status === "已入索引" ? "default" : "secondary"} className="rounded-md">
                              {item.status}
                            </Badge>
                          </div>
                          <div className="px-4 py-3 text-sm leading-6 text-slate-600">
                            <p className="mb-2 text-slate-500">来源：{item.source}</p>
                            <p>{item.body}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  )
}

function GateBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-950">{value}</p>
    </div>
  )
}

function GateRow({ label, value, active }: { label: string; value: string; active?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <strong className={active === undefined ? "text-slate-950" : active ? "text-emerald-700" : "text-rose-700"}>
        {value}
      </strong>
    </div>
  )
}

function IndexVersionView({
  detailState,
  generatedIndexVersions,
}: {
  detailState: DetailState
  generatedIndexVersions: GeneratedIndexVersion[]
}) {
  const copy = stateCopy(detailState)
  const baseIndexVersions = [
    {
      knowledgeVersion: "Q4 第 2 轮内容草稿",
      indexVersionName: "Q4 政策批量更新索引 v2",
      knowledgeVersionId: "kv-2024-04-20",
      indexVersionId: "kb-index-2024-04-20",
      profile: "generic_customer_service v1",
      embedding: "text-v4",
      parentCount: 1204,
      chunkCount: 3612,
      status: "ready",
      buildTime: "今天 11:18",
      stageSummary: {
        sourceCount: 28,
        excludedCount: 18,
        highRiskCount: 18,
        promotedFaqCount: 42,
        pendingCount: 3,
        blockedCount: 1,
        approvedForStage10Count: 186,
      },
      stageCounts: [
        { stage: "Stage 1 source_manifest", value: "28 个来源文件 / 18 个 excluded" },
        { stage: "Stage 2 raw_records", value: "312 条 raw records" },
        { stage: "Stage 3 cleaned_records", value: "298 条 cleaned records" },
        { stage: "Stage 4 routing / reclassify", value: "262 条 include / 18 条 high risk / 18 条 exclude" },
        { stage: "Stage 5 structure", value: "146 条 explicit FAQ / 54 条 composite doc" },
        { stage: "Stage 6 promotion", value: "42 条 promoted FAQ / 12 条 residual doc" },
        { stage: "Stage 7 merge", value: "198 条 merge ready / 7 组 conflict candidates" },
        { stage: "Stage 8 conflict detection", value: "4 组 cleared / 1 组 blocked" },
        { stage: "Stage 9 release gating", value: "186 条 approved for stage10 / 3 条 pending / 1 条 blocked" },
        { stage: "Stage 10 parents / chunks", value: "1204 个 Parent / 3612 个 Chunks" },
        { stage: "Stage 11 coverage audit", value: "覆盖率 96.8% / 2 条 orphan / 1 条 ambiguity" },
      ],
      coverageAudit: {
        coverage: "96.8%",
      auditStatus: "需关注：存在待归类内容",
      reasons: ["有 2 条内容尚未归入问答对", "仍有 1 组口径冲突待处理"],
      orphanRecords: [
          "旧版报销说明尚未归入任何问答对。",
          "资格说明尚未归入任何问答对。",
        ],
        ambiguityRecords: ["“发票抬头修改”和“更正申请”内容边界接近，建议确认是否合并。"],
      },
      parents: [
        {
          id: "kp-warranty-001",
          question: "设备保修期多久？",
          answer: "标准保修期为 24 个月，延保服务以销售订单中的服务条款为准。购买后如需申请延保，请联系客户成功经理。",
          questionAliases: ["设备质保多久", "保修期是几年", "延保怎么算"],
          questionSignature: "device_warranty_period",
          subject: "保修政策",
          intent: "售后咨询",
          scopeTerms: ["保修", "延保", "销售订单"],
          device: "路由器",
          productModel: "通用",
          isExactFaq: true,
          reviewStatus: "approved",
          metadataSource: "manual_edited",
          recordKind: "cleared_conflict_faq",
          isHighRisk: true,
          inheritedRiskReason: "policy_or_billing_rules",
          tags: ["保修", "延保", "售后"],
          versionTags: ["2024Q4", "v3"],
          isTimeSensitive: true,
          sourceFiles: ["产品手册 v3.docx"],
          chunks: [
            {
              id: "kc-warranty-001-0",
              parentId: "kp-warranty-001",
              chunkKind: "question_alias",
              sectionTitle: "保修政策",
              chunkIndex: 0,
              content: "设备保修期多久？设备质保多久。保修期是几年。延保怎么算。",
              embeddingText: "设备保修期多久 设备质保多久 保修期是几年 延保怎么算",
              metadata: "subject=保修政策; intent=售后咨询; exactFaq=true",
              knowledgeVersionId: "kv-2024-04-20",
              indexVersionId: "kb-index-2024-04-20",
              sourceFiles: ["产品手册 v3.docx"],
              sourceDocumentIds: ["doc-product-manual-v3"],
              sourcePage: 12,
              sourceLocation: "保修政策 / FAQ 别名",
              embeddingModel: "text-v4",
              embeddingHash: "emb_93fd_warranty_alias",
              vectorId: "vec_kc_warranty_001_0",
              lexicalDocId: "lex_kc_warranty_001_0",
              tokenCount: 28,
              charCount: 32,
              chunkRuleVersion: "chunk-rule-v1.2",
              buildStatus: "ready",
              createdAt: "2026-04-20 11:12",
              updatedAt: "2026-04-20 11:18",
            },
            {
              id: "kc-warranty-001-1",
              parentId: "kp-warranty-001",
              chunkKind: "answer",
              sectionTitle: "保修政策",
              chunkIndex: 1,
              content: "标准保修期为 24 个月，延保服务以销售订单中的服务条款为准。",
              embeddingText: "标准保修期 24 个月 延保服务 销售订单 服务条款",
              metadata: "source=产品手册 v3.docx; scope=保修,延保",
              knowledgeVersionId: "kv-2024-04-20",
              indexVersionId: "kb-index-2024-04-20",
              sourceFiles: ["产品手册 v3.docx"],
              sourceDocumentIds: ["doc-product-manual-v3"],
              sourcePage: 13,
              sourceLocation: "保修政策 / 正文答案",
              embeddingModel: "text-v4",
              embeddingHash: "emb_93fd_warranty_answer",
              vectorId: "vec_kc_warranty_001_1",
              lexicalDocId: "lex_kc_warranty_001_1",
              tokenCount: 35,
              charCount: 38,
              chunkRuleVersion: "chunk-rule-v1.2",
              buildStatus: "ready",
              createdAt: "2026-04-20 11:12",
              updatedAt: "2026-04-20 11:18",
            },
          ],
        },
        {
          id: "kp-router-reset-002",
          question: "路由器密码如何重置？",
          answer: "找到设备背面的 Reset 按钮，按住 10 秒钟后等待设备重启，再使用默认管理员账号登录。",
          questionAliases: ["路由器忘记密码怎么办", "怎么恢复路由器默认密码"],
          questionSignature: "router_password_reset",
          subject: "设备设置",
          intent: "操作指引",
          scopeTerms: ["路由器", "密码", "Reset"],
          device: "路由器",
          productModel: "通用",
          isExactFaq: true,
          reviewStatus: "approved",
          metadataSource: "auto_generated",
          recordKind: "merge_ready_faq",
          isHighRisk: false,
          inheritedRiskReason: "",
          tags: ["设备设置", "密码重置"],
          versionTags: ["v3"],
          isTimeSensitive: false,
          sourceFiles: ["路由器设置文档.pdf"],
          chunks: [
            {
              id: "kc-router-reset-002-0",
              parentId: "kp-router-reset-002",
              chunkKind: "procedure",
              sectionTitle: "常见问题",
              chunkIndex: 0,
              content: "找到设备背面的 Reset 按钮，按住 10 秒钟后等待设备重启。",
              embeddingText: "路由器 密码 重置 Reset 按钮 10 秒 设备重启",
              metadata: "source=路由器设置文档.pdf; device=路由器",
              knowledgeVersionId: "kv-2024-04-20",
              indexVersionId: "kb-index-2024-04-20",
              sourceFiles: ["路由器设置文档.pdf"],
              sourceDocumentIds: ["doc-router-settings"],
              sourcePage: 8,
              sourceLocation: "常见问题 / 密码重置",
              embeddingModel: "text-v4",
              embeddingHash: "emb_7ae2_router_reset",
              vectorId: "vec_kc_router_reset_002_0",
              lexicalDocId: "lex_kc_router_reset_002_0",
              tokenCount: 31,
              charCount: 34,
              chunkRuleVersion: "chunk-rule-v1.2",
              buildStatus: "ready",
              createdAt: "2026-04-20 11:13",
              updatedAt: "2026-04-20 11:18",
            },
          ],
        },
      ],
    },
    {
      knowledgeVersion: "Q4 第 1 轮内容草稿",
      indexVersionName: "Q4 政策批量更新索引 v1",
      knowledgeVersionId: "kv-2024-04-18",
      indexVersionId: "kb-index-2024-04-18",
      profile: "generic_customer_service v1",
      embedding: "text-v4",
      parentCount: 1176,
      chunkCount: 3524,
      status: "archived",
      buildTime: "04-18 19:42",
      stageSummary: {
        sourceCount: 24,
        excludedCount: 16,
        highRiskCount: 12,
        promotedFaqCount: 31,
        pendingCount: 1,
        blockedCount: 0,
        approvedForStage10Count: 174,
      },
      stageCounts: [
        { stage: "Stage 1 source_manifest", value: "24 个来源文件 / 16 个 excluded" },
        { stage: "Stage 2 raw_records", value: "284 条 raw records" },
        { stage: "Stage 3 cleaned_records", value: "276 条 cleaned records" },
        { stage: "Stage 4 routing / reclassify", value: "248 条 include / 12 条 high risk / 16 条 exclude" },
        { stage: "Stage 5 structure", value: "138 条 explicit FAQ / 39 条 composite doc" },
        { stage: "Stage 6 promotion", value: "31 条 promoted FAQ / 8 条 residual doc" },
        { stage: "Stage 7 merge", value: "180 条 merge ready / 3 组 conflict candidates" },
        { stage: "Stage 8 conflict detection", value: "3 组 cleared / 0 组 blocked" },
        { stage: "Stage 9 release gating", value: "174 条 approved for stage10 / 1 条 pending / 0 条 blocked" },
        { stage: "Stage 10 parents / chunks", value: "1176 个 Parent / 3524 个 Chunks" },
        { stage: "Stage 11 coverage audit", value: "覆盖率 98.4% / 0 条 orphan / 0 条 ambiguity" },
      ],
      coverageAudit: {
        coverage: "98.4%",
        auditStatus: "正常",
        reasons: ["当前版本未发现待归类内容或可能重复内容。"],
        orphanRecords: [],
        ambiguityRecords: [],
      },
      parents: [
        {
          id: "kp-old-warranty-001",
          question: "设备保修期多久？",
          answer: "标准保修期为 12 个月，可在购买后 30 天内申请延保。",
          questionAliases: ["设备质保多久", "保修期是多久"],
          questionSignature: "device_warranty_period",
          subject: "保修政策",
          intent: "售后咨询",
          scopeTerms: ["保修", "延保"],
          device: "路由器",
          productModel: "通用",
          isExactFaq: true,
          reviewStatus: "approved",
          metadataSource: "auto_generated",
          recordKind: "merge_ready_faq",
          isHighRisk: true,
          inheritedRiskReason: "policy_or_billing_rules",
          tags: ["保修", "延保"],
          versionTags: ["2024Q3", "v2"],
          isTimeSensitive: true,
          sourceFiles: ["产品手册 v2.docx"],
          chunks: [
            {
              id: "kc-old-warranty-001-0",
              parentId: "kp-old-warranty-001",
              chunkKind: "answer",
              sectionTitle: "保修政策",
              chunkIndex: 0,
              content: "标准保修期为 12 个月，可在购买后 30 天内申请延保。",
              embeddingText: "标准保修期 12 个月 30 天 申请延保",
              metadata: "source=产品手册 v2.docx; scope=保修,延保",
              knowledgeVersionId: "kv-2024-04-18",
              indexVersionId: "kb-index-2024-04-18",
              sourceFiles: ["产品手册 v2.docx"],
              sourceDocumentIds: ["doc-product-manual-v2"],
              sourcePage: 10,
              sourceLocation: "保修政策 / 正文答案",
              embeddingModel: "text-v4",
              embeddingHash: "emb_51bc_old_warranty",
              vectorId: "vec_kc_old_warranty_001_0",
              lexicalDocId: "lex_kc_old_warranty_001_0",
              tokenCount: 26,
              charCount: 31,
              chunkRuleVersion: "chunk-rule-v1.1",
              buildStatus: "ready",
              createdAt: "2026-04-18 19:35",
              updatedAt: "2026-04-18 19:42",
            },
          ],
        },
      ],
    },
  ]
  const indexVersions = [
    ...generatedIndexVersions.map((generated) => {
      const template = baseIndexVersions[0]
      return {
        ...template,
        indexVersionName: generated.indexVersionName,
        indexVersionId: generated.indexVersionId,
        status: "ready" as const,
        buildTime: generated.buildTime,
        parents: template.parents.map((parent) => ({
          ...parent,
          chunks: parent.chunks.map((chunk) => ({
            ...chunk,
            indexVersionId: generated.indexVersionId,
            createdAt: generated.buildTime,
            updatedAt: generated.buildTime,
          })),
        })),
      }
    }),
    ...baseIndexVersions,
  ]
  const [selectedIndexVersion, setSelectedIndexVersion] = useState<(typeof indexVersions)[number] | null>(null)
  const [selectedIndexTab, setSelectedIndexTab] = useState<"overview" | "build" | "content">("overview")
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null)
  const [indexSearch, setIndexSearch] = useState("")
  const [indexNotice, setIndexNotice] = useState<string | null>(null)
  const [expandedChunkIds, setExpandedChunkIds] = useState<Record<string, boolean>>({})
  const searchText = indexSearch.trim().toLowerCase()
  const filteredParents =
    selectedIndexVersion?.parents.filter((parent) => {
      const chunkText = parent.chunks
        .map((chunk) => `${chunk.id} ${chunk.content} ${chunk.embeddingText} ${chunk.metadata}`)
        .join(" ")
      const haystack = `${parent.id} ${parent.question} ${parent.answer} ${parent.questionAliases.join(" ")} ${chunkText}`
      return !searchText || haystack.toLowerCase().includes(searchText)
    }) ?? []
  const selectedParent = filteredParents.find((parent) => parent.id === selectedParentId) ?? filteredParents[0] ?? null

  function openIndexVersion(record: (typeof indexVersions)[number]) {
    setSelectedIndexVersion(record)
    setSelectedIndexTab("overview")
    setSelectedParentId(record.parents[0]?.id ?? null)
    setIndexSearch("")
    setIndexNotice(null)
    setExpandedChunkIds({})
  }

  function toggleChunkDetails(chunkId: string) {
    setExpandedChunkIds((current) => ({ ...current, [chunkId]: !current[chunkId] }))
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="font-semibold">索引版本列表</h3>
            <p className="mt-1 text-sm text-slate-600">
              每个知识版本对应一个索引版本。这里是工程师查看索引内容的入口。
            </p>
          </div>
          <Badge variant={copy.indexReady ? "default" : "secondary"} className="rounded-md">
            {copy.indexReady ? "ready" : "building"}
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-5 py-3">知识版本 ID</th>
                <th className="px-5 py-3">索引版本名称</th>
                <th className="px-5 py-3">索引版本 ID</th>
                <th className="px-5 py-3">Profile</th>
                <th className="px-5 py-3">Embedding</th>
                <th className="px-5 py-3">Parent 数</th>
                <th className="px-5 py-3">Chunk 数</th>
                <th className="px-5 py-3">状态</th>
                <th className="px-5 py-3">构建时间</th>
                <th className="px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {indexVersions.map((record) => (
                <tr key={record.indexVersionId} className="bg-white">
                  <td className="px-5 py-4 font-medium text-slate-950">{record.knowledgeVersionId}</td>
                  <td className="px-5 py-4 font-medium text-slate-950">{record.indexVersionName}</td>
                  <td className="px-5 py-4 font-medium text-slate-950">{record.indexVersionId}</td>
                  <td className="px-5 py-4 text-slate-600">{record.profile}</td>
                  <td className="px-5 py-4 text-slate-600">{record.embedding}</td>
                  <td className="px-5 py-4 font-medium text-slate-950">{record.parentCount}</td>
                  <td className="px-5 py-4 font-medium text-slate-950">{record.chunkCount}</td>
                  <td className="px-5 py-4">
                    <Badge variant={record.status === "ready" ? "default" : "outline"} className="rounded-md">
                      {record.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{record.buildTime}</td>
                  <td className="px-5 py-4">
                    <Button size="sm" variant="outline" onClick={() => openIndexVersion(record)}>
                      查看
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedIndexVersion ? (
        <>
          <button
            type="button"
            aria-label="关闭索引版本抽屉"
            className="fixed inset-0 z-40 bg-slate-950/30"
            onClick={() => setSelectedIndexVersion(null)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedIndexVersion.indexVersionId}索引版本详情`}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-5xl flex-col border-l border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="font-semibold">索引版本详情</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-md">
                    知识版本：{selectedIndexVersion.knowledgeVersionId}
                  </Badge>
                  <Badge variant="outline" className="rounded-md">
                    索引版本：{selectedIndexVersion.indexVersionId}
                  </Badge>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedIndexVersion(null)}>
                关闭
              </Button>
            </div>
            <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[220px_minmax(0,1fr)]">
              <nav className="overflow-y-auto border-b border-slate-200 bg-slate-50/70 py-3 md:border-b-0 md:border-r">
                <div className="space-y-1 px-3">
                  {[
                    ["overview", "基础信息"],
                    ["build", "构建摘要"],
                    ["content", "Parent / Chunks"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={cn(
                        "w-full rounded-md px-3 py-2 text-left text-sm transition",
                        value === selectedIndexTab
                          ? "bg-white font-medium text-slate-950 shadow-sm"
                          : "text-slate-600 hover:bg-white"
                      )}
                      onClick={() => {
                        setSelectedIndexTab(value as "overview" | "build" | "content")
                        setIndexNotice(null)
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {selectedIndexTab === "content" ? (
                  <div className="mt-4 border-t border-slate-200 px-3 pt-4">
                    <p className="text-xs font-semibold text-slate-500">Parent 列表</p>
                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        className="min-h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                        placeholder="搜索 parent / chunk"
                        aria-label="搜索 parent / chunk"
                        value={indexSearch}
                        onChange={(event) => {
                          setIndexSearch(event.target.value)
                          setIndexNotice(null)
                        }}
                      />
                      <Button size="sm" variant="outline" onClick={() => setIndexNotice("已筛选 parent / chunk")}>
                        搜索
                      </Button>
                    </div>
                    <div className="mt-4 space-y-2">
                      {filteredParents.map((parent) => (
                        <button
                          key={parent.id}
                          type="button"
                          className={cn(
                            "w-full rounded-md border px-3 py-3 text-left text-sm transition",
                            selectedParent?.id === parent.id
                              ? "border-blue-200 bg-white text-slate-950 shadow-sm"
                              : "border-transparent text-slate-600 hover:bg-white"
                          )}
                          onClick={() => setSelectedParentId(parent.id)}
                        >
                          <span className="block font-medium">{parent.question}</span>
                          <span className="mt-1 block text-xs text-slate-500">{parent.id}</span>
                        </button>
                      ))}
                      {filteredParents.length === 0 ? (
                        <p className="rounded-md border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">
                          没有匹配的 Parent。
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </nav>
              <div className="min-h-0 overflow-y-auto p-5">
                {selectedIndexTab === "overview" ? (
                  <section className="space-y-4">
                    <section className="rounded-lg border border-slate-200 bg-white p-4">
                      <h4 className="font-semibold text-slate-950">索引版本信息</h4>
                      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                        <GateRow label="知识版本 ID" value={selectedIndexVersion.knowledgeVersionId} />
                        <GateRow label="索引版本 ID" value={selectedIndexVersion.indexVersionId} />
                        <GateRow label="Profile" value={selectedIndexVersion.profile} />
                        <GateRow label="Embedding" value={selectedIndexVersion.embedding} />
                        <GateRow label="构建时间" value={selectedIndexVersion.buildTime} />
                        <GateRow label="状态" value={selectedIndexVersion.status} />
                      </div>
                    </section>
                    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <h4 className="font-semibold text-slate-950">Stage 10 产物规模</h4>
                      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <GateBox label="Parent 数" value={`${selectedIndexVersion.parentCount}`} />
                        <GateBox label="Chunk 数" value={`${selectedIndexVersion.chunkCount}`} />
                        <GateBox
                          label="待归类内容"
                          value={`${selectedIndexVersion.coverageAudit.orphanRecords.length}`}
                        />
                        <GateBox
                          label="可能重复内容"
                          value={`${selectedIndexVersion.coverageAudit.ambiguityRecords.length}`}
                        />
                      </div>
                    </section>
                  </section>
                ) : null}

                {selectedIndexTab === "build" ? (
                  <section className="space-y-4">
                    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <h4 className="font-semibold text-slate-950">Stage 1-9 清洗摘要</h4>
                      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <GateBox label="source 数" value={`${selectedIndexVersion.stageSummary.sourceCount}`} />
                        <GateBox label="排除数" value={`${selectedIndexVersion.stageSummary.excludedCount}`} />
                        <GateBox label="高风险数" value={`${selectedIndexVersion.stageSummary.highRiskCount}`} />
                        <GateBox label="promoted FAQ 数" value={`${selectedIndexVersion.stageSummary.promotedFaqCount}`} />
                        <GateBox
                          label="pending / blocked 数"
                          value={`${selectedIndexVersion.stageSummary.pendingCount} / ${selectedIndexVersion.stageSummary.blockedCount}`}
                        />
                        <GateBox
                          label="approved for stage10"
                          value={`${selectedIndexVersion.stageSummary.approvedForStage10Count}`}
                        />
                      </div>
                    </section>

                    <section className="rounded-lg border border-slate-200 bg-white p-4">
                      <h4 className="font-semibold text-slate-950">Stage 1-11 数量快照</h4>
                      <div className="mt-3 space-y-2">
                        {selectedIndexVersion.stageCounts.map((item) => (
                          <div
                            key={item.stage}
                            className="flex flex-wrap justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                          >
                            <span className="font-medium text-slate-700">{item.stage}</span>
                            <span className="text-slate-600">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section
                      className={cn(
                        "rounded-lg border p-4",
                        selectedIndexVersion.coverageAudit.auditStatus === "正常"
                          ? "border-slate-200 bg-white"
                          : "border-rose-200 bg-rose-50"
                      )}
                    >
                      <h4 className="font-semibold text-slate-950">Stage 11 覆盖率审计</h4>
                      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <GateBox label="覆盖率结果" value={selectedIndexVersion.coverageAudit.coverage} />
                        <GateBox label="审计状态" value={selectedIndexVersion.coverageAudit.auditStatus} />
                        <GateBox
                          label="待归类内容（orphan）"
                          value={`${selectedIndexVersion.coverageAudit.orphanRecords.length}`}
                        />
                        <GateBox
                          label="可能重复内容（ambiguity）"
                          value={`${selectedIndexVersion.coverageAudit.ambiguityRecords.length}`}
                        />
                      </div>
                      <div className="mt-4 space-y-4 text-sm">
                        <div>
                          <p className="font-semibold text-slate-950">异常原因</p>
                          <div className="mt-2 space-y-2 leading-6 text-slate-700">
                            {selectedIndexVersion.coverageAudit.reasons.map((reason, index) => (
                              <p key={buildListKey("index-reason", reason, index)}>{reason}</p>
                            ))}
                          </div>
                        </div>
                        <div className="border-t border-slate-100 pt-4">
                          <p className="font-semibold text-slate-950">待归类内容（orphan）</p>
                          <div className="mt-2 space-y-2 leading-6 text-slate-700">
                            {selectedIndexVersion.coverageAudit.orphanRecords.length > 0 ? (
                              selectedIndexVersion.coverageAudit.orphanRecords.map((item, index) => <p key={buildListKey("index-orphan", item, index)}>{item}</p>)
                            ) : (
                              <p>当前没有待归类内容。</p>
                            )}
                          </div>
                        </div>
                        <div className="border-t border-slate-100 pt-4">
                          <p className="font-semibold text-slate-950">可能重复内容（ambiguity）</p>
                          <div className="mt-2 space-y-2 leading-6 text-slate-700">
                            {selectedIndexVersion.coverageAudit.ambiguityRecords.length > 0 ? (
                              selectedIndexVersion.coverageAudit.ambiguityRecords.map((item, index) => <p key={buildListKey("index-ambiguity", item, index)}>{item}</p>)
                            ) : (
                              <p>当前没有可能重复的内容。</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </section>
                  </section>
                ) : null}

                {selectedIndexTab === "content" ? (
                  <section>
                    <div className="space-y-5">
                      {indexNotice ? (
                        <div className="rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-700">
                          {indexNotice}
                        </div>
                      ) : null}

                      {selectedParent ? (
                        <>
                            <section className="space-y-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-950">Parent 信息</p>
                                <p className="mt-1 text-xs text-slate-500">一个 KnowledgeParent 对应一条完整问答和字段信息。</p>
                              </div>
                              <article className="rounded-lg border border-slate-200 bg-white">
                                <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
                                  <div>
                                    <p className="text-xs font-semibold text-slate-500">KnowledgeParent</p>
                                    <h4 className="mt-1 font-semibold text-slate-950">{selectedParent.question}</h4>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <Badge variant="outline" className="rounded-md">
                                        {selectedParent.recordKind}
                                      </Badge>
                                      <Badge variant="outline" className="rounded-md">
                                        {selectedParent.metadataSource}
                                      </Badge>
                                      <Badge
                                        variant={selectedParent.isHighRisk ? "destructive" : "secondary"}
                                        className="rounded-md"
                                      >
                                        {selectedParent.isHighRisk ? "高风险" : "普通"}
                                      </Badge>
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="rounded-md">
                                    {selectedParent.reviewStatus}
                                  </Badge>
                                </div>
                                <div className="mt-4 space-y-4 border-t border-slate-100 p-4 text-sm">
                                  <div className="rounded-md bg-slate-50 px-3 py-3">
                                    <p className="text-xs font-semibold text-slate-500">question</p>
                                    <p className="mt-1 font-medium text-slate-950">{selectedParent.question}</p>
                                  </div>
                                  <div className="rounded-md bg-slate-50 px-3 py-3">
                                    <p className="text-xs font-semibold text-slate-500">answer</p>
                                    <p className="mt-1 leading-6 text-slate-700">{selectedParent.answer}</p>
                                  </div>
                                  <div className="grid gap-2 text-sm md:grid-cols-2">
                                    <GateRow label="parentId" value={selectedParent.id} />
                                    <GateRow label="questionSignature" value={selectedParent.questionSignature} />
                                    <GateRow label="subject" value={selectedParent.subject} />
                                    <GateRow label="intent" value={selectedParent.intent} />
                                    <GateRow label="scopeTerms" value={selectedParent.scopeTerms.join("、")} />
                                    <GateRow label="device" value={selectedParent.device} />
                                    <GateRow label="productModel" value={selectedParent.productModel} />
                                    <GateRow label="recordKind" value={selectedParent.recordKind} />
                                    <GateRow label="isHighRisk" value={selectedParent.isHighRisk ? "true" : "false"} />
                                    <GateRow label="inheritedRiskReason" value={selectedParent.inheritedRiskReason || "无"} />
                                    <GateRow label="isTimeSensitive" value={selectedParent.isTimeSensitive ? "true" : "false"} />
                                    <GateRow label="metadataSource" value={selectedParent.metadataSource} />
                                  </div>
                                  <div className="grid gap-2 text-sm md:grid-cols-2">
                                    <div className="rounded-md bg-slate-50 px-3 py-3">
                                      <p className="text-xs font-semibold text-slate-500">questionAliases</p>
                                      <p className="mt-1 text-slate-700">{selectedParent.questionAliases.join("、")}</p>
                                    </div>
                                    <div className="rounded-md bg-slate-50 px-3 py-3">
                                      <p className="text-xs font-semibold text-slate-500">sourceFiles</p>
                                      <p className="mt-1 text-slate-700">{selectedParent.sourceFiles.join("、")}</p>
                                    </div>
                                    <div className="rounded-md bg-slate-50 px-3 py-3">
                                      <p className="text-xs font-semibold text-slate-500">tags</p>
                                      <p className="mt-1 text-slate-700">{selectedParent.tags.join("、")}</p>
                                    </div>
                                    <div className="rounded-md bg-slate-50 px-3 py-3">
                                      <p className="text-xs font-semibold text-slate-500">versionTags</p>
                                      <p className="mt-1 text-slate-700">{selectedParent.versionTags.join("、")}</p>
                                    </div>
                                  </div>
                                </div>
                              </article>
                            </section>

                            <section className="space-y-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-950">Chunks 信息</p>
                              </div>
                              {selectedParent.chunks.map((chunk) => (
                                <article key={chunk.id} className="rounded-lg border border-slate-200 bg-white p-4">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="space-y-2">
                                      <p className="text-xs font-semibold text-slate-500">KnowledgeChunk</p>
                                      <p className="mt-1 font-medium text-slate-950">{chunk.id}</p>
                                      <div className="flex flex-wrap gap-2">
                                        <Badge variant="secondary" className="rounded-md">
                                          {chunk.chunkKind}
                                        </Badge>
                                        <Badge variant="outline" className="rounded-md">
                                          {chunk.sectionTitle}
                                        </Badge>
                                        <Badge variant="outline" className="rounded-md">
                                          #{chunk.chunkIndex}
                                        </Badge>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Button size="sm" variant="outline" onClick={() => toggleChunkDetails(chunk.id)}>
                                        {expandedChunkIds[chunk.id] ? "收起详情" : "详情"}
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="mt-4 grid gap-4 text-sm xl:grid-cols-[minmax(0,1fr)_260px]">
                                    <div className="space-y-3">
                                      <div>
                                        <p className="font-semibold text-slate-950">内容与检索文本</p>
                                      </div>
                                      <div>
                                        <p className="text-xs font-semibold text-slate-500">Chunk 内容</p>
                                        <p className="mt-1 rounded-md bg-slate-50 px-3 py-3 leading-6 text-slate-600">
                                          {chunk.content}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs font-semibold text-slate-500">embeddingText</p>
                                        <p className="mt-1 rounded-md bg-slate-50 px-3 py-3 leading-6 text-slate-600">
                                          {chunk.embeddingText}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="space-y-3">
                                      <div>
                                        <p className="font-semibold text-slate-950">片段基础字段</p>
                                      </div>
                                      <div className="grid gap-2">
                                        <GateRow label="parentId" value={chunk.parentId} />
                                        <GateRow label="chunkKind" value={chunk.chunkKind} />
                                        <GateRow label="sectionTitle" value={chunk.sectionTitle} />
                                        <GateRow label="chunkIndex" value={`${chunk.chunkIndex}`} />
                                      </div>
                                      <div>
                                        <p className="text-xs font-semibold text-slate-500">Chunk metadata</p>
                                        <p className="mt-1 rounded-md bg-slate-50 px-3 py-3 leading-6 text-slate-600">
                                          {chunk.metadata}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  {expandedChunkIds[chunk.id] ? (
                                    <div className="mt-4 border-t border-slate-100 pt-4">
                                      <p className="text-sm font-semibold text-slate-950">Chunk 详情字段</p>
                                      <div className="mt-3 grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
                                        <p className="font-bold text-slate-950 md:col-span-2">来源信息</p>
                                        <GateRow label="knowledgeVersionId" value={chunk.knowledgeVersionId} />
                                        <GateRow label="indexVersionId" value={chunk.indexVersionId} />
                                        <GateRow label="sourceFiles" value={chunk.sourceFiles.join("、")} />
                                        <GateRow label="sourceDocumentIds" value={chunk.sourceDocumentIds.join("、")} />
                                        <GateRow label="sourcePage" value={`${chunk.sourcePage}`} />
                                        <GateRow label="sourceLocation" value={chunk.sourceLocation} />
                                        <p className="mt-3 font-bold text-slate-950 md:col-span-2">向量与索引信息</p>
                                        <GateRow label="embeddingModel" value={chunk.embeddingModel} />
                                        <GateRow label="embeddingHash" value={chunk.embeddingHash} />
                                        <GateRow label="vectorId" value={chunk.vectorId} />
                                        <GateRow label="lexicalDocId" value={chunk.lexicalDocId} />
                                        <GateRow label="tokenCount" value={`${chunk.tokenCount}`} />
                                        <GateRow label="charCount" value={`${chunk.charCount}`} />
                                        <p className="mt-3 font-bold text-slate-950 md:col-span-2">构建信息</p>
                                        <GateRow label="chunkRuleVersion" value={chunk.chunkRuleVersion} />
                                        <GateRow label="buildStatus" value={chunk.buildStatus} />
                                        <GateRow label="createdAt" value={chunk.createdAt} />
                                        <GateRow label="updatedAt" value={chunk.updatedAt} />
                                      </div>
                                    </div>
                                  ) : null}
                                </article>
                              ))}
                            </section>
                        </>
                      ) : (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
                          搜索结果为空，请调整关键词。
                        </div>
                      )}
                    </div>
                  </section>
                ) : null}
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  )
}
