import type {
  KnowledgeBuildTask,
  KnowledgeCoverageAudit,
  KnowledgeIndexVersion,
  KnowledgeVersion,
} from "@/types/database"

export interface KnowledgeVersionRow {
  knowledgeVersionId: string
  indexVersionId: string
  status: string
  publishedAt: string
  coverage: string
  auditStatus: string
  qaPairCount: string
}

export interface KnowledgeTaskRow {
  id: string
  knowledgeVersionId: string | null
  name: string
  type: string
  owner: string
  stage: string
  status: string
  progress: number
  isRunning: boolean
  updatedAt: string
}

export function resolveEffectiveTaskState(task: KnowledgeBuildTask, versions: KnowledgeVersion[]) {
  if (task.status === "running" || ((task.currentStep === "queued" || task.currentStep === "building_artifacts") && !task.completedAt)) {
    return {
      status: "running" as const,
      currentStep: task.currentStep,
    }
  }

  const linkedVersion = task.knowledgeVersionId
    ? versions.find((version) => version.id === task.knowledgeVersionId)
    : null
  const stageSummary = task.stageSummary ?? linkedVersion?.stageSummary ?? null

  if (linkedVersion?.status === "draft" && stageSummary) {
    if (stageSummary.highRiskCount > 0 || stageSummary.blockedCount > 0) {
      return {
        status: "pending" as const,
        currentStep: "risk_review",
      }
    }

    return {
      status: "pending" as const,
      currentStep: "result_review",
    }
  }

  return {
    status: task.status,
    currentStep: task.currentStep,
  }
}

export interface KnowledgePushRecord {
  action: "Push STG" | "Push Prod" | "回滚"
  knowledgeVersionId: string
  targetEnvironment: "STG" | "PROD"
  operator: string
  operatedAt: string
}

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

export function formatKnowledgeTimestamp(value: string | null): string {
  if (!value) return "-"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`
}

export function getKnowledgeVersionStatusLabel(status: KnowledgeVersion["status"]): string {
  switch (status) {
    case "prod":
      return "PROD"
    case "stg":
      return "STG"
    case "archived":
      return "已归档"
    case "draft":
    default:
      return "草稿"
  }
}

export function getKnowledgeAuditStatusLabel(audit: Pick<KnowledgeCoverageAudit, "auditStatus" | "reasons">): string {
  if (audit.auditStatus === "normal") {
    return "正常"
  }

  if (audit.reasons.length === 0) {
    return "需关注：覆盖率或内容完整性待确认"
  }

  return `需关注：${audit.reasons.join("；")}`
}

function getKnowledgeTaskTypeLabel(taskType: KnowledgeBuildTask["taskType"]): string {
  switch (taskType) {
    case "batch":
      return "批量文件更新"
    case "manual":
      return "人工补充"
    case "repair":
      return "内容修复"
    case "full":
    default:
      return "全量重建"
  }
}

function getKnowledgeTaskStatusLabel(status: KnowledgeBuildTask["status"]): string {
  switch (status) {
    case "running":
      return "进行中"
    case "succeeded":
      return "已完成"
    case "failed":
      return "失败"
    case "cancelled":
      return "已取消"
    case "pending":
    default:
      return "待处理"
  }
}

function getKnowledgeTaskStageLabel(step: string): string {
  switch (step) {
    case "queued":
      return "排队中"
    case "building_artifacts":
      return "清洗处理中"
    case "risk_review":
      return "风险与确认"
    case "result_review":
      return "清洗结果确认"
    case "completed":
      return "已完成"
    case "failed":
      return "执行失败"
    default:
      return step
  }
}

function findIndexVersionForKnowledgeVersion(
  indexVersions: KnowledgeIndexVersion[],
  knowledgeVersionId: string,
): KnowledgeIndexVersion | undefined {
  return indexVersions.find((version) => version.knowledgeVersionId === knowledgeVersionId)
}

export function buildKnowledgeVersionRows(
  versions: KnowledgeVersion[],
  indexVersions: KnowledgeIndexVersion[],
): KnowledgeVersionRow[] {
  return versions.map((version) => {
    const indexVersion = findIndexVersionForKnowledgeVersion(indexVersions, version.id)

    return {
      knowledgeVersionId: version.id,
      indexVersionId: indexVersion?.id ?? "待生成",
      status: getKnowledgeVersionStatusLabel(version.status),
      publishedAt: formatKnowledgeTimestamp(version.publishedAt),
      coverage: `${version.coverageAudit.coverage}%`,
      auditStatus: getKnowledgeAuditStatusLabel(version.coverageAudit),
      qaPairCount: String(version.qaPairCount),
    }
  })
}

export function buildKnowledgeTaskRows(tasks: KnowledgeBuildTask[], versions: KnowledgeVersion[] = []): KnowledgeTaskRow[] {
  return tasks.map((task) => {
    const effective = resolveEffectiveTaskState(task, versions)

    return ({
    id: task.id,
    knowledgeVersionId: task.knowledgeVersionId,
    name: task.name,
    type: getKnowledgeTaskTypeLabel(task.taskType),
    owner: "系统",
    stage: getKnowledgeTaskStageLabel(effective.currentStep),
    status: getKnowledgeTaskStatusLabel(effective.status),
    progress: task.progress,
    isRunning: effective.status === "running",
    updatedAt: formatKnowledgeTimestamp(task.updatedAt),
  })})
}

export function buildKnowledgePushRecords(versions: KnowledgeVersion[]): KnowledgePushRecord[] {
  return versions
    .filter((version) => version.publishedAt && (version.status === "stg" || version.status === "prod"))
    .map((version) => ({
      action: version.status === "prod" ? "Push Prod" : "Push STG",
      knowledgeVersionId: version.id,
      targetEnvironment: version.status === "prod" ? "PROD" : "STG",
      operator: "系统",
      operatedAt: formatKnowledgeTimestamp(version.publishedAt),
    }))
}
