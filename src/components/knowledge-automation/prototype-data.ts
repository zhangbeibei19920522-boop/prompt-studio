export type PrototypeView = "list" | "create" | "detail"
export type CustomerId = "acme" | "techflow"
export type DetailState = "risk" | "review" | "indexed" | "ready"
export type DetailMode = "candidate" | "stg" | "prod" | "history"
export type DetailTab = "risk" | "cleaned" | "rounds" | "recall"

export interface CustomerState {
  id: CustomerId
  name: string
  hasKnowledgeBase: boolean
  knowledgeBaseName: string
  currentVersion: string
}

export const customers: CustomerState[] = [
  {
    id: "acme",
    name: "Acme Corp",
    hasKnowledgeBase: true,
    knowledgeBaseName: "客户支持知识库",
    currentVersion: "kb-index-2024-04-20",
  },
  {
    id: "techflow",
    name: "TechFlow Inc",
    hasKnowledgeBase: false,
    knowledgeBaseName: "",
    currentVersion: "",
  },
]

export const navItems = ["仪表盘", "Agent 构建器", "知识库自动化", "数据分析", "系统设置"]

export const taskRows = [
  {
    name: "Q4 政策批量更新",
    type: "批量文件更新",
    source: "HR 2024 批次",
    status: "待确认",
    stage: "风险与冲突确认",
    pending: 24,
    output: "186 个问答对草稿",
    version: "未构建索引",
  },
  {
    name: "补充转人工规则",
    type: "人工补充",
    source: "运营录入 8 条",
    status: "索引就绪",
    stage: "索引版本已生成",
    pending: 0,
    output: "8 个问答对 / 19 个索引片段",
    version: "kb-index-2024-04-19",
  },
  {
    name: "HR 政策 2024",
    type: "批量文件更新",
    source: "HR 2024 批次",
    status: "索引可用",
    stage: "索引版本已确认",
    pending: 0,
    output: "212 个问答对 / 640 个索引片段",
    version: "kb-index-2024-04-20",
  },
]

export const prodVersionCard = {
  knowledgeVersionId: "kv-2024-04-18",
  indexVersionId: "kb-index-2024-04-18",
  publishedAt: "2026-04-18 19:42",
  publishedBy: "张敏",
  coverage: "98.4%",
  auditStatus: "正常",
  qaPairCount: "1176",
  rollbackBase: "kv-2024-04-12",
}

export const stgVersionCard = {
  knowledgeVersionId: "kv-2024-04-20-rc1",
  indexVersionId: "kb-index-2024-04-20-rc1",
  deployedAt: "今天 14:10",
  deployedBy: "张敏",
  testStatus: "自动化测试通过",
  coverage: "96.8%",
  auditStatus: "需关注：存在待归类内容",
  qaPairCount: "1204",
}

export const candidateVersionCard = {
  knowledgeVersionId: "kv-2024-04-21-draft",
  title: "Q4 第 3 轮候选版本",
  stage: "清洗结果确认",
  pending: 6,
  updatedAt: "今天 15:32",
  owner: "张敏",
  sourceBatch: "Q4 政策补充批次",
  summary: "214 个问答对待运营确认",
}

export const historyVersionRows = [
  {
    knowledgeVersionId: "kv-2024-04-21-draft",
    status: "草稿",
    publishedAt: "-",
    coverage: "97.1%",
    auditStatus: "正常",
    qaPairCount: "1216",
    indexVersionId: "待生成",
  },
  {
    knowledgeVersionId: "kv-2024-04-18",
    status: "PROD",
    publishedAt: "2026-04-18 19:42",
    coverage: "98.4%",
    auditStatus: "正常",
    qaPairCount: "1176",
    indexVersionId: "kb-index-2024-04-18",
  },
  {
    knowledgeVersionId: "kv-2024-04-20-rc1",
    status: "STG",
    publishedAt: "今天 14:10",
    coverage: "96.8%",
    auditStatus: "需关注：存在待归类内容",
    qaPairCount: "1204",
    indexVersionId: "kb-index-2024-04-20-rc1",
  },
  {
    knowledgeVersionId: "kv-2024-04-12",
    status: "已归档",
    publishedAt: "2026-04-12 16:30",
    coverage: "97.2%",
    auditStatus: "正常",
    qaPairCount: "1098",
    indexVersionId: "kb-index-2024-04-12",
  },
  {
    knowledgeVersionId: "kv-2024-04-08",
    status: "已归档",
    publishedAt: "2026-04-08 10:12",
    coverage: "95.6%",
    auditStatus: "需关注：覆盖率偏低",
    qaPairCount: "1044",
    indexVersionId: "kb-index-2024-04-08",
  },
]

export const versionPushRecords = [
  {
    action: "Push Prod",
    knowledgeVersionId: "kv-2024-04-18",
    targetEnvironment: "PROD",
    operator: "张敏",
    operatedAt: "2026-04-18 19:42",
  },
  {
    action: "Push STG",
    knowledgeVersionId: "kv-2024-04-20-rc1",
    targetEnvironment: "STG",
    operator: "张敏",
    operatedAt: "今天 14:10",
  },
  {
    action: "回滚",
    knowledgeVersionId: "kv-2024-04-12",
    targetEnvironment: "PROD",
    operator: "李思",
    operatedAt: "2026-04-12 16:30",
  },
]

export const taskRecordRows = [
  {
    name: "Q4 第 2 轮内容维护",
    type: "批量文件更新",
    owner: "张敏",
    stage: "风险与确认",
    status: "进行中",
    updatedAt: "今天 11:18",
  },
  {
    name: "补充转人工规则",
    type: "人工补充",
    owner: "李思",
    stage: "索引已生成",
    status: "已完成",
    updatedAt: "昨天 18:40",
  },
  {
    name: "HR 政策 2024",
    type: "批量文件更新",
    owner: "张敏",
    stage: "已发布",
    status: "已完成",
    updatedAt: "2026-04-18 19:42",
  },
]

export const pipelineStages = [
  "任务创建",
  "内容来源",
  "解析与清洗",
  "风险与冲突确认",
  "清洗结果确认",
  "发布到 STG",
  "发布到 PROD",
]

export const cleanedDrafts = [
  {
    title: "年假申请规则",
    body: "员工可在工作台提交年假申请。系统会校验剩余年假、审批链路和请假日期。",
    source: "HR-policy-2024.docx",
    status: "待确认",
    question_aliases: ["年假怎么申请", "申请年假规则", "年假审批流程"],
    intent: "policy",
    domain: "人力资源",
    subject: "年假申请",
    device: "工作台",
    product_model: "通用",
    scope_terms: ["员工", "审批", "剩余年假"],
    is_exact_faq: "true",
  },
  {
    title: "病假材料要求",
    body: "连续病假超过 2 天时，需要上传医院证明。特殊情况由直属主管补充说明。",
    source: "attendance.xlsx / Sheet: 病假",
    status: "已确认",
    question_aliases: ["病假需要什么材料", "病假证明要求"],
    intent: "policy",
    domain: "人力资源",
    subject: "病假材料",
    device: "工作台",
    product_model: "通用",
    scope_terms: ["病假", "医院证明", "直属主管"],
    is_exact_faq: "true",
  },
  {
    title: "人工新增：远程办公说明",
    body: "临时远程办公需要提前一天提交申请，并同步当天工作计划。",
    source: "人工补充",
    status: "新增",
    question_aliases: ["远程办公怎么申请", "临时居家办公说明"],
    intent: "how_to",
    domain: "行政管理",
    subject: "远程办公",
    device: "工作台",
    product_model: "通用",
    scope_terms: ["申请", "工作计划", "提前一天"],
    is_exact_faq: "false",
  },
]

export const recallResults = [
  {
    title: "年假申请规则",
    score: "0.91",
    summary: "命中年假申请入口、剩余额度校验、审批链路说明。",
  },
  {
    title: "考勤异常处理",
    score: "0.78",
    summary: "补充异常考勤与请假申请的关联说明。",
  },
  {
    title: "HR 服务台联系方式",
    score: "0.64",
    summary: "低相关结果，可作为兜底咨询入口。",
  },
]

export function getCustomer(customerId: CustomerId): CustomerState {
  return customers.find((customer) => customer.id === customerId) ?? customers[0]
}

export function stateCopy(detailState: DetailState): {
  status: string
  nextAction: string
  pendingCount: number
  indexReady: boolean
  description: string
} {
  switch (detailState) {
    case "risk":
      return {
        status: "待人工确认",
        nextAction: "处理风险与冲突",
        pendingCount: 24,
        indexReady: false,
        description: "当前轮次存在冲突和高风险删除项，先处理后再确认清洗结果。",
      }
    case "review":
      return {
        status: "待发布 STG",
        nextAction: "发布到 STG",
        pendingCount: 0,
        indexReady: false,
        description: "风险已处理，当前候选知识版本可直接发布到 STG 进行验证。",
      }
    case "indexed":
      return {
        status: "STG 测试通过",
        nextAction: "发布到 PROD",
        pendingCount: 0,
        indexReady: true,
        description: "已发布到 STG，可继续验证后发布到 PROD。",
      }
    case "ready":
      return {
        status: "已发布 PROD",
        nextAction: "当前为 PROD 版本",
        pendingCount: 0,
        indexReady: true,
        description: "已发布到 PROD，当前线上版本已更新。",
      }
  }
}

export function pipelineState(index: number, detailState: DetailState): "done" | "active" | "pending" {
  const activeIndexByState: Record<DetailState, number> = {
    risk: 3,
    review: 4,
    indexed: 5,
    ready: 6,
  }
  const activeIndex = activeIndexByState[detailState]
  if (index < activeIndex) return "done"
  if (index === activeIndex) return "active"
  return "pending"
}

export function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "索引可用" || status === "索引就绪") return "default"
  if (status === "待确认") return "destructive"
  return "outline"
}

export function knowledgeVersionBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "PROD") return "default"
  if (status === "STG") return "secondary"
  if (status === "进行中") return "secondary"
  if (status.includes("需关注")) return "destructive"
  return "outline"
}
