"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Check, ChevronsUpDown, LoaderCircle, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type {
  KnowledgeManualDraftInput,
  KnowledgeRepairQuestionInput,
  KnowledgeTaskType,
} from "@/types/database"
import { type CustomerState } from "./prototype-data"

interface SourceDocument {
  id: string
  name: string
  type: string
}

interface ManualDraft {
  title: string
  content: string
  source: string
  status: string
}

interface RepairQuestion {
  query: string
  problem: string
  direction: string
  status: string
}

export interface KnowledgeVersionOption {
  value: string
  label: string
}

export interface CreateKnowledgeTaskPayload {
  name: string
  taskType: KnowledgeTaskType
  baseVersionId: string | null
  documentIds: string[]
  manualDrafts: KnowledgeManualDraftInput[]
  repairQuestions: KnowledgeRepairQuestionInput[]
}

const maintenanceTaskOptions: Array<{ value: KnowledgeTaskType; label: string; hint: string }> = [
  {
    value: "batch",
    label: "批量文件更新",
    hint: "从已有版本继续维护，适合日常按批次更新文档内容。",
  },
  {
    value: "manual",
    label: "人工补充",
    hint: "基于已有版本补充少量内容，不重新做全量替换。",
  },
  {
    value: "repair",
    label: "内容修复",
    hint: "基于已有版本做定向修复，适合按反馈迭代内容。",
  },
  {
    value: "full",
    label: "全量重建",
    hint: "整体替换当前知识内容，启动后重新生成完整版本。",
  },
]

const createKnowledgeBaseOption = {
  value: "full" as const,
  label: "全量构建",
  hint: "创建知识库时默认执行全量构建，直接生成首个版本。",
}

const EMPTY_MANUAL_DRAFT = {
  title: "",
  content: "",
  source: "manual",
}

export function CreateView(props: {
  customer: CustomerState
  sourceDocuments?: SourceDocument[]
  versionOptions?: KnowledgeVersionOption[]
  isSubmitting?: boolean
  onBack: () => void
  onSubmit: (payload: CreateKnowledgeTaskPayload) => Promise<void> | void
}) {
  const {
    customer,
    sourceDocuments = [],
    versionOptions = [],
    isSubmitting = false,
    onBack,
    onSubmit,
  } = props
  const isCreateKnowledgeBase = !customer.hasKnowledgeBase
  const taskOptions = isCreateKnowledgeBase ? [createKnowledgeBaseOption] : maintenanceTaskOptions
  const [taskType, setTaskType] = useState<KnowledgeTaskType>(isCreateKnowledgeBase ? "full" : "batch")
  const [taskName, setTaskName] = useState(isCreateKnowledgeBase ? "第一版全量构建" : "Q4 第 3 轮内容维护")
  const [selectedVersionId, setSelectedVersionId] = useState(versionOptions[0]?.value ?? "")
  const [selectedDocumentIds, setSelectedDocumentIds] = useState(() => sourceDocuments.map((document) => document.id))
  const [manualDrafts, setManualDrafts] = useState<ManualDraft[]>([])
  const [manualFormOpen, setManualFormOpen] = useState(false)
  const [manualDraftForm, setManualDraftForm] = useState(EMPTY_MANUAL_DRAFT)
  const [repairQuestions, setRepairQuestions] = useState<RepairQuestion[]>([])
  const [repairFormOpen, setRepairFormOpen] = useState(false)
  const [repairDraft, setRepairDraft] = useState({ query: "", problem: "", direction: "" })
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const activeTaskOption = taskOptions.find((option) => option.value === taskType) ?? taskOptions[0]
  const requiresVersion = !isCreateKnowledgeBase && taskType !== "full"
  const requiresDocuments = taskType === "batch" || taskType === "full"
  const requiresManualDrafts = taskType === "manual"
  const requiresRepairQuestions = taskType === "repair"
  const canStart =
    taskName.trim().length > 0 &&
    (!requiresVersion || selectedVersionId.length > 0) &&
    (!requiresDocuments || selectedDocumentIds.length > 0) &&
    (!requiresManualDrafts || manualDrafts.length > 0) &&
    (!requiresRepairQuestions || repairQuestions.length > 0)

  useEffect(() => {
    if (requiresVersion && !selectedVersionId && versionOptions[0]?.value) {
      setSelectedVersionId(versionOptions[0].value)
    }
  }, [requiresVersion, selectedVersionId, versionOptions])

  const versionSelectOptions = useMemo(() => {
    if (versionOptions.length > 0) return versionOptions
    return [{ value: "", label: "暂无可选知识版本" }]
  }, [versionOptions])

  function updateTaskType(value: KnowledgeTaskType) {
    setTaskType(value)
    setActionNotice(null)
    setActionError(null)
    if (value === "full") {
      setSelectedVersionId("")
      setSelectedDocumentIds(sourceDocuments.map((document) => document.id))
      return
    }
    if (!selectedVersionId) {
      setSelectedVersionId(versionOptions[0]?.value ?? "")
    }
  }

  function toggleDocumentSelection(documentId: string) {
    setSelectedDocumentIds((current) =>
      current.includes(documentId) ? current.filter((id) => id !== documentId) : [...current, documentId]
    )
  }

  function openManualDraftForm() {
    setManualFormOpen(true)
    setActionNotice(null)
    setActionError(null)
  }

  function closeManualDraftForm() {
    setManualFormOpen(false)
    setManualDraftForm(EMPTY_MANUAL_DRAFT)
  }

  function confirmManualDraft() {
    if (!manualDraftForm.title.trim() || !manualDraftForm.content.trim()) {
      setActionError("请至少填写标题和正文摘要")
      return
    }

    setManualDrafts((current) => [
      ...current,
      {
        title: manualDraftForm.title.trim(),
        content: manualDraftForm.content.trim(),
        source: manualDraftForm.source.trim() || "manual",
        status: "待确认",
      },
    ])
    setManualDraftForm(EMPTY_MANUAL_DRAFT)
    setManualFormOpen(false)
    setActionNotice("已新增一条内容，可继续编辑")
    setActionError(null)
  }

  function showEditNotice() {
    setActionNotice("已打开编辑框，可继续补充正文摘要和 metadata 备注")
    setActionError(null)
  }

  function openRepairQuestionForm() {
    setRepairFormOpen(true)
    setActionNotice(null)
    setActionError(null)
  }

  function closeRepairQuestionForm() {
    setRepairFormOpen(false)
    setRepairDraft({ query: "", problem: "", direction: "" })
  }

  function confirmRepairQuestion() {
    if (!repairDraft.query.trim() || !repairDraft.problem.trim() || !repairDraft.direction.trim()) {
      setActionError("请完整填写问题、当前问题描述和期望修复方向")
      return
    }

    setRepairQuestions((current) => [
      ...current,
      {
        query: repairDraft.query.trim(),
        problem: repairDraft.problem.trim(),
        direction: repairDraft.direction.trim(),
        status: "待验证",
      },
    ])
    setRepairDraft({ query: "", problem: "", direction: "" })
    setRepairFormOpen(false)
    setActionNotice("已将待修复问题加入列表")
    setActionError(null)
  }

  async function handleSubmit() {
    if (!canStart || isSubmitting) return

    setActionError(null)
    try {
      await onSubmit({
        name: taskName.trim(),
        taskType,
        baseVersionId: requiresVersion ? selectedVersionId : null,
        documentIds: selectedDocumentIds,
        manualDrafts: manualDrafts.map((draft) => ({
          title: draft.title,
          content: draft.content,
          source: draft.source,
        })),
        repairQuestions: repairQuestions.map((question) => ({
          query: question.query,
          problem: question.problem,
          direction: question.direction,
        })),
      })
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "启动任务失败")
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-zinc-950">
            {isCreateKnowledgeBase ? "创建知识库" : "新建维护任务"}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            先配置任务信息，再直接启动本轮清洗任务。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onBack} disabled={isSubmitting}>
          取消
        </Button>
      </div>

      <section className="mx-auto max-w-[720px] rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="space-y-4">
          {actionNotice ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {actionNotice}
            </div>
          ) : null}
          {actionError ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {actionError}
            </div>
          ) : null}

          <FormField label="任务名称">
            <Input
              value={taskName}
              onChange={(event) => setTaskName(event.target.value)}
              placeholder="例如：Q4 第 3 轮内容维护"
              disabled={isSubmitting}
            />
          </FormField>

          <FormField label="任务类型" hint={activeTaskOption.hint}>
            <select
              value={taskType}
              onChange={(event) => updateTaskType(event.target.value as KnowledgeTaskType)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              disabled={isCreateKnowledgeBase || isSubmitting}
            >
              {taskOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>

          {requiresVersion ? (
            <FormField label="选择版本" hint="从已有知识版本继续维护当前内容。">
              <select
                value={selectedVersionId}
                onChange={(event) => setSelectedVersionId(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={isSubmitting || versionOptions.length === 0}
              >
                {versionSelectOptions.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
          ) : !isCreateKnowledgeBase && taskType === "full" ? (
            <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-3 text-sm leading-6 text-zinc-600">
              当前任务类型为全量重建，不需要选择版本。
            </div>
          ) : null}

          {taskType === "manual" ? (
            <ManualEntryPanel
              drafts={manualDrafts}
              formOpen={manualFormOpen}
              draft={manualDraftForm}
              isSubmitting={isSubmitting}
              onOpenForm={openManualDraftForm}
              onCloseForm={closeManualDraftForm}
              onDraftChange={setManualDraftForm}
              onConfirm={confirmManualDraft}
              onEditRow={showEditNotice}
            />
          ) : null}

          {taskType === "batch" || taskType === "full" ? (
            <SourceDocumentPanel
              documents={sourceDocuments}
              selectedDocumentIds={selectedDocumentIds}
              hint={
                taskType === "full"
                  ? "全量重建会默认全选文档库文件，可按需要取消个别文件。"
                  : "从文档库选择本轮要更新的文件。这里不重复上传，只选择已入库文件。"
              }
              onToggleDocument={toggleDocumentSelection}
            />
          ) : null}

          {taskType === "repair" ? (
            <div className="space-y-4">
              <RepairQuestionPanel
                questions={repairQuestions}
                formOpen={repairFormOpen}
                draft={repairDraft}
                isSubmitting={isSubmitting}
                onOpenForm={openRepairQuestionForm}
                onCloseForm={closeRepairQuestionForm}
                onDraftChange={setRepairDraft}
                onConfirm={confirmRepairQuestion}
                onEditRow={showEditNotice}
              />
              <SourceDocumentPanel
                documents={sourceDocuments}
                selectedDocumentIds={selectedDocumentIds}
                hint="内容修复可关联文档库文件，作为本轮修复的参考来源。"
                onToggleDocument={toggleDocumentSelection}
              />
            </div>
          ) : null}

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
              <ArrowLeft className="size-4" />
              返回
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={!canStart || isSubmitting}>
              {isSubmitting ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  启动中
                </>
              ) : (
                "启动任务"
              )}
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

function SourceDocumentPanel({
  documents,
  selectedDocumentIds,
  hint,
  onToggleDocument,
}: {
  documents: SourceDocument[]
  selectedDocumentIds: string[]
  hint: string
  onToggleDocument: (documentId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const allSelected = documents.length > 0 && selectedDocumentIds.length === documents.length

  function toggleAllDocuments() {
    if (allSelected) {
      documents.forEach((document) => {
        if (selectedDocumentIds.includes(document.id)) {
          onToggleDocument(document.id)
        }
      })
      return
    }

    documents.forEach((document) => {
      if (!selectedDocumentIds.includes(document.id)) {
        onToggleDocument(document.id)
      }
    })
  }

  return (
    <FormField label="文档库选择文件" hint={hint}>
      {documents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
          文档库暂无可选文件，请先在文档库补充资料。
        </div>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between font-normal">
              <span className="truncate">已选择：{selectedDocumentIds.length} 个文件</span>
              <ChevronsUpDown className="size-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput placeholder="搜索文件..." />
              <div className="flex items-center justify-end border-b px-3 py-2">
                <button
                  type="button"
                  onClick={toggleAllDocuments}
                  className="text-xs font-medium text-blue-600 transition-colors hover:text-blue-500"
                >
                  {allSelected ? "取消全选" : "全选"}
                </button>
              </div>
              <CommandList>
                <CommandEmpty>无匹配文件</CommandEmpty>
                <CommandGroup>
                  {documents.map((document) => {
                    const selected = selectedDocumentIds.includes(document.id)
                    return (
                      <CommandItem
                        key={document.id}
                        value={`${document.name} ${document.type}`}
                        onSelect={() => onToggleDocument(document.id)}
                      >
                        <Check className={cn("size-3.5 shrink-0", selected ? "opacity-100" : "opacity-0")} />
                        <span className="min-w-0 flex-1 truncate">{document.name}</span>
                        <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] uppercase text-zinc-500">
                          {document.type}
                        </span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </FormField>
  )
}

function ManualEntryPanel({
  drafts,
  formOpen,
  draft,
  isSubmitting,
  onOpenForm,
  onCloseForm,
  onDraftChange,
  onConfirm,
  onEditRow,
}: {
  drafts: ManualDraft[]
  formOpen: boolean
  draft: { title: string; content: string; source: string }
  isSubmitting: boolean
  onOpenForm: () => void
  onCloseForm: () => void
  onDraftChange: (draft: { title: string; content: string; source: string }) => void
  onConfirm: () => void
  onEditRow: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-zinc-950">手动新增内容</div>
        <Button variant="outline" size="sm" onClick={onOpenForm} disabled={isSubmitting}>
          <Plus className="size-4" />
          新增一条内容
        </Button>
      </div>
      <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-zinc-600">
        人工补充不需要选择原文件，可一次新增多条内容。创建后会进入“清洗结果确认”，由运营继续编辑、确认文本。
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="text-sm text-zinc-500">本次已添加内容</div>
        <div className="mt-2 text-lg font-semibold text-blue-600">{drafts.length} 条</div>
      </div>

      {formOpen ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <FormField label="标题">
            <Input
              value={draft.title}
              onChange={(event) => onDraftChange({ ...draft, title: event.target.value })}
              placeholder="例如：如何联系客户支持"
            />
          </FormField>
          <div className="mt-4">
            <FormField label="正文摘要">
              <textarea
                value={draft.content}
                onChange={(event) => onDraftChange({ ...draft, content: event.target.value })}
                placeholder="例如：可通过 support@example.com 联系客服。"
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </FormField>
          </div>
          <div className="mt-4">
            <FormField label="来源备注">
              <Input
                value={draft.source}
                onChange={(event) => onDraftChange({ ...draft, source: event.target.value })}
                placeholder="例如：manual"
              />
            </FormField>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onCloseForm}>
              取消
            </Button>
            <Button size="sm" onClick={onConfirm}>
              加入列表
            </Button>
          </div>
        </div>
      ) : null}

      <SimpleTable
        headers={["标题", "正文摘要", "来源备注", "状态", "操作"]}
        rows={drafts.map((draft) => [draft.title, draft.content, draft.source, draft.status, "编辑"])}
        onAction={onEditRow}
      />
    </div>
  )
}

function RepairQuestionPanel({
  questions,
  formOpen,
  draft,
  isSubmitting,
  onOpenForm,
  onCloseForm,
  onDraftChange,
  onConfirm,
  onEditRow,
}: {
  questions: RepairQuestion[]
  formOpen: boolean
  draft: { query: string; problem: string; direction: string }
  isSubmitting: boolean
  onOpenForm: () => void
  onCloseForm: () => void
  onDraftChange: (draft: { query: string; problem: string; direction: string }) => void
  onConfirm: () => void
  onEditRow: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-zinc-950">手动新增待修复问题</div>
        <Button variant="outline" size="sm" onClick={onOpenForm} disabled={isSubmitting}>
          <Plus className="size-4" />
          新增一个问题
        </Button>
      </div>
      <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-zinc-600">
        先录入待修复问题，再按需要关联文档库文件，作为本轮修复的上下文。
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="text-sm text-zinc-500">本次待修复问题</div>
        <div className="mt-2 text-lg font-semibold text-blue-600">{questions.length} 个</div>
      </div>

      {formOpen ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <FormField label="用户问题">
            <Input
              value={draft.query}
              onChange={(event) => onDraftChange({ ...draft, query: event.target.value })}
              placeholder="例如：忘记管理员账号还能恢复吗？"
            />
          </FormField>
          <div className="mt-4">
            <FormField label="当前问题描述">
              <textarea
                value={draft.problem}
                onChange={(event) => onDraftChange({ ...draft, problem: event.target.value })}
                placeholder="例如：当前答案只建议联系客服，没有说明本地恢复方式。"
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </FormField>
          </div>
          <div className="mt-4">
            <FormField label="期望修复方向">
              <textarea
                value={draft.direction}
                onChange={(event) => onDraftChange({ ...draft, direction: event.target.value })}
                placeholder="例如：优先说明本地恢复，再给人工支持入口。"
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </FormField>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onCloseForm}>
              取消
            </Button>
            <Button size="sm" onClick={onConfirm}>
              加入列表
            </Button>
          </div>
        </div>
      ) : null}

      <SimpleTable
        headers={["用户问题", "当前问题", "期望修复方向", "状态", "操作"]}
        rows={questions.map((question) => [
          question.query,
          question.problem,
          question.direction,
          question.status,
          "编辑",
        ])}
        onAction={onEditRow}
      />
    </div>
  )
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="block space-y-2 text-sm">
      <span className="font-semibold text-zinc-900">{label}</span>
      {children}
      {hint ? <span className="block text-xs leading-5 text-zinc-500">{hint}</span> : null}
    </div>
  )
}

function SimpleTable({
  headers,
  rows,
  onAction,
}: {
  headers: string[]
  rows: string[][]
  onAction?: () => void
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead className="bg-zinc-50 text-xs font-semibold text-zinc-500">
          <tr>
            {headers.map((header) => (
              <th key={header} className="border-b border-zinc-200 px-3 py-2 text-left">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join("|")} className="border-b border-zinc-100 last:border-0">
              {row.map((cell, index) => (
                <td key={`${cell}-${index}`} className="px-3 py-2 align-top text-zinc-700">
                  {onAction && index === row.length - 1 ? (
                    <button type="button" className="text-blue-600 hover:underline" onClick={onAction}>
                      {cell}
                    </button>
                  ) : index === 0 ? (
                    <b>{cell}</b>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
