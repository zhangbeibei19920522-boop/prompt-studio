"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, FileSpreadsheet, LoaderCircle, Pencil, Plus, Trash2, Upload } from "lucide-react"

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
import { Textarea } from "@/components/ui/textarea"
import { knowledgeApi } from "@/lib/utils/api-client"
import type { KnowledgeScopeMapping, KnowledgeScopeMappingDetail, KnowledgeScopeMappingRecord } from "@/types/database"

interface MappingManagementViewProps {
  projectId: string | null
  initialMappings?: KnowledgeScopeMapping[]
  initialSelectedMapping?: KnowledgeScopeMappingDetail | null
}

interface MappingRecordForm {
  id: string | null
  lookupKey: string
  scopeText: string
}

type MappingViewMode = "list" | "detail"

const EMPTY_RECORD_FORM: MappingRecordForm = {
  id: null,
  lookupKey: "",
  scopeText: "",
}

function formatScopeText(scope: Record<string, string[]>): string {
  return Object.entries(scope)
    .map(([key, values]) => `${key}=${values.join(", ")}`)
    .join("\n")
}

function parseScopeText(value: string): Record<string, string[]> {
  const scope: Record<string, string[]> = {}
  for (const line of value.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const separatorIndex = trimmed.search(/[=:：]/)
    if (separatorIndex < 0) continue
    const key = trimmed.slice(0, separatorIndex).trim()
    const rawValues = trimmed.slice(separatorIndex + 1).trim()
    if (!key || !rawValues) continue
    const values = rawValues
      .split(/[,，、]/)
      .map((item) => item.trim())
      .filter(Boolean)
    if (values.length > 0) {
      scope[key] = [...new Set([...(scope[key] ?? []), ...values])]
    }
  }
  return scope
}

function summarizeScope(scope: Record<string, string[]>): string {
  return Object.entries(scope)
    .map(([key, values]) => `${key}: ${values.join(", ")}`)
    .join("；")
}

export function MappingManagementView({
  projectId,
  initialMappings = [],
  initialSelectedMapping = null,
}: MappingManagementViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [mappings, setMappings] = useState<KnowledgeScopeMapping[]>(initialMappings)
  const [selectedMapping, setSelectedMapping] = useState<KnowledgeScopeMappingDetail | null>(initialSelectedMapping)
  const [viewMode, setViewMode] = useState<MappingViewMode>("list")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [keyword, setKeyword] = useState("")
  const [renameValue, setRenameValue] = useState(initialSelectedMapping?.name ?? "")
  const [recordForm, setRecordForm] = useState<MappingRecordForm>(EMPTY_RECORD_FORM)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(projectId) && initialMappings.length === 0)
  const [isMutating, setIsMutating] = useState(false)

  const filteredRecords = useMemo(() => {
    const records = selectedMapping?.records ?? []
    const query = keyword.trim().toLowerCase()
    if (!query) return records
    return records.filter((record) =>
      `${record.lookupKey} ${summarizeScope(record.scope)}`.toLowerCase().includes(query)
    )
  }, [keyword, selectedMapping])

  async function loadMappingList(): Promise<KnowledgeScopeMapping[]> {
    if (!projectId) {
      setMappings([])
      setSelectedMapping(null)
      setIsLoading(false)
      return []
    }
    setIsLoading(true)
    try {
      const nextMappings = await knowledgeApi.listKnowledgeScopeMappings(projectId)
      setMappings(nextMappings)
      return nextMappings
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载映射表失败")
      return []
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setViewMode("list")
    setSelectedMapping(null)
    setRenameValue("")
    setKeyword("")
    setRecordForm(EMPTY_RECORD_FORM)
    void loadMappingList()
    // Initial props only seed SSR/test rendering; runtime refresh is keyed by project.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  async function openMappingDetail(mappingId: string) {
    setError(null)
    setNotice(null)
    setIsLoading(true)
    try {
      const detail = await knowledgeApi.getKnowledgeScopeMapping(mappingId)
      setSelectedMapping(detail)
      setRenameValue(detail.name)
      setRecordForm(EMPTY_RECORD_FORM)
      setKeyword("")
      setViewMode("detail")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载映射表详情失败")
    } finally {
      setIsLoading(false)
    }
  }

  function returnToList() {
    setViewMode("list")
    setSelectedMapping(null)
    setRenameValue("")
    setKeyword("")
    setRecordForm(EMPTY_RECORD_FORM)
  }

  async function handleUpload(files: FileList | null) {
    if (!projectId || !files || files.length === 0) return
    setError(null)
    setNotice(null)
    setIsMutating(true)
    try {
      const uploaded = await knowledgeApi.uploadKnowledgeScopeMappings(projectId, Array.from(files))
      await loadMappingList()
      setCreateDialogOpen(false)
      setNotice(`已新增 ${uploaded.length} 个映射关系`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "新增映射关系失败")
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      setIsMutating(false)
    }
  }

  async function saveMappingName() {
    if (!selectedMapping) return
    const nextName = renameValue.trim()
    if (!nextName) {
      setError("映射名称不能为空")
      return
    }
    setIsMutating(true)
    setError(null)
    try {
      const updated = await knowledgeApi.updateKnowledgeScopeMapping(selectedMapping.id, { name: nextName })
      setSelectedMapping(updated)
      await loadMappingList()
      setNotice("映射关系名称已保存")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存映射表名称失败")
    } finally {
      setIsMutating(false)
    }
  }

  async function deleteSelectedMapping() {
    if (!selectedMapping) return
    if (!window.confirm(`确认删除映射关系「${selectedMapping.name}」？`)) return
    setIsMutating(true)
    setError(null)
    try {
      await knowledgeApi.deleteKnowledgeScopeMapping(selectedMapping.id)
      returnToList()
      await loadMappingList()
      setNotice("映射关系已删除")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除映射关系失败")
    } finally {
      setIsMutating(false)
    }
  }

  async function deleteMapping(mapping: KnowledgeScopeMapping) {
    if (!window.confirm(`确认删除映射关系「${mapping.name}」？`)) return
    setIsMutating(true)
    setError(null)
    try {
      await knowledgeApi.deleteKnowledgeScopeMapping(mapping.id)
      if (selectedMapping?.id === mapping.id) {
        returnToList()
      }
      await loadMappingList()
      setNotice("映射关系已删除")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除映射关系失败")
    } finally {
      setIsMutating(false)
    }
  }

  function openCreateRecordForm() {
    setRecordForm(EMPTY_RECORD_FORM)
    setError(null)
    setNotice(null)
  }

  function openEditRecordForm(record: KnowledgeScopeMappingRecord) {
    setRecordForm({
      id: record.id ?? null,
      lookupKey: record.lookupKey,
      scopeText: formatScopeText(record.scope),
    })
    setError(null)
    setNotice(null)
  }

  async function submitRecordForm() {
    if (!selectedMapping) return
    const lookupKey = recordForm.lookupKey.trim()
    const scope = parseScopeText(recordForm.scopeText)
    if (!lookupKey) {
      setError("lookupKey 不能为空")
      return
    }
    if (Object.keys(scope).length === 0) {
      setError("请按 key=value 格式填写 scope")
      return
    }

    setIsMutating(true)
    setError(null)
    try {
      if (recordForm.id) {
        await knowledgeApi.updateKnowledgeScopeMappingRecord(recordForm.id, { lookupKey, scope })
        setNotice("映射内容已更新")
      } else {
        await knowledgeApi.createKnowledgeScopeMappingRecord(selectedMapping.id, { lookupKey, scope })
        setNotice("映射内容已新增")
      }
      const detail = await knowledgeApi.getKnowledgeScopeMapping(selectedMapping.id)
      setSelectedMapping(detail)
      setRecordForm(EMPTY_RECORD_FORM)
      await loadMappingList()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存映射关系失败")
    } finally {
      setIsMutating(false)
    }
  }

  async function deleteRecord(record: KnowledgeScopeMappingRecord) {
    if (!record.id || !selectedMapping) return
    if (!window.confirm(`确认删除映射关系「${record.lookupKey}」？`)) return
    setIsMutating(true)
    setError(null)
    try {
      await knowledgeApi.deleteKnowledgeScopeMappingRecord(record.id)
      const detail = await knowledgeApi.getKnowledgeScopeMapping(selectedMapping.id)
      setSelectedMapping(detail)
      await loadMappingList()
      setNotice("映射内容已删除")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除映射关系失败")
    } finally {
      setIsMutating(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">映射管理</h2>
          <p className="mt-2 text-sm text-slate-600">
            管理可复用的 scope 映射关系，清洗任务只需要选择对应映射名称。
          </p>
        </div>
        {viewMode === "list" ? (
          <Button onClick={() => setCreateDialogOpen(true)} disabled={!projectId || isMutating}>
            <Plus className="size-4" />
            新增映射关系
          </Button>
        ) : null}
      </section>

      {notice ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      ) : null}

      {viewMode === "list" ? (
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h3 className="font-semibold">映射关系列表</h3>
              <p className="mt-1 text-xs text-slate-500">每条映射关系可在清洗任务中被选择，用来补充 scope。</p>
            </div>
            {isLoading ? <LoaderCircle className="size-4 animate-spin text-slate-400" /> : null}
          </div>
          {mappings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <tr>
                    <th className="px-4 py-3">映射关系</th>
                    <th className="px-4 py-3">来源文件</th>
                    <th className="px-4 py-3">主键字段</th>
                    <th className="px-4 py-3">scope 字段</th>
                    <th className="px-4 py-3">内容数</th>
                    <th className="px-4 py-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((mapping) => (
                    <tr key={mapping.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="grid size-9 place-items-center rounded-md bg-orange-50 text-orange-700">
                            <FileSpreadsheet className="size-4" />
                          </div>
                          <div>
                            <div className="font-medium text-slate-950">{mapping.name}</div>
                            <div className="mt-1 text-xs text-slate-400">更新于 {mapping.updatedAt || "-"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{mapping.sourceFileName || "在线维护"}</td>
                      <td className="px-4 py-3 text-slate-600">{mapping.keyField || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{mapping.scopeFields.join("、") || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{mapping.rowCount}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => void openMappingDetail(mapping.id)}>
                            查看详情
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void deleteMapping(mapping)}
                          >
                            删除
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid min-h-[320px] place-items-center px-5 py-12 text-center">
              <div>
                <FileSpreadsheet className="mx-auto mb-3 size-9 text-slate-400" />
                <h3 className="font-semibold text-slate-950">还没有可管理的映射关系</h3>
                <p className="mt-2 text-sm text-slate-500">新增映射关系后，系统会解析 Excel 并生成在线映射内容。</p>
              </div>
            </div>
          )}
        </section>
      ) : viewMode === "detail" && selectedMapping ? (
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="space-y-4 border-b border-slate-200 px-5 py-4">
            <Button variant="ghost" size="sm" onClick={returnToList}>
              <ArrowLeft className="size-4" />
              返回列表
            </Button>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">映射关系详情</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {selectedMapping.sourceFileName || "在线维护"} / {selectedMapping.rowCount} 条 / key: {selectedMapping.keyField || "-"}
                </p>
              </div>
              <Button variant="outline" onClick={deleteSelectedMapping} disabled={isMutating}>
                <Trash2 className="size-4" />
                删除映射关系
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                className="max-w-sm"
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                placeholder="映射关系名称"
              />
              <Button variant="outline" onClick={() => void saveMappingName()} disabled={isMutating}>
                保存名称
              </Button>
            </div>
          </div>

          <div className="border-b border-slate-200 px-5 py-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold">映射内容</h4>
                <p className="mt-1 text-xs text-slate-500">scope 按每行 key=value 填写，多值用逗号分隔。</p>
              </div>
              <Button variant="outline" onClick={openCreateRecordForm}>
                <Plus className="size-4" />
                新增映射内容
              </Button>
            </div>
            <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)_auto]">
              <Input
                value={recordForm.lookupKey}
                onChange={(event) => setRecordForm((current) => ({ ...current, lookupKey: event.target.value }))}
                placeholder="lookupKey，例如 85QD7N"
              />
              <Textarea
                value={recordForm.scopeText}
                onChange={(event) => setRecordForm((current) => ({ ...current, scopeText: event.target.value }))}
                placeholder={"productModel=85QD7N\nplatform=Google TV\nproductCategory=TV"}
                className="min-h-24"
              />
              <div className="flex items-start gap-2">
                <Button onClick={() => void submitRecordForm()} disabled={isMutating}>
                  {recordForm.id ? "保存" : "新增"}
                </Button>
                {recordForm.id ? (
                  <Button variant="outline" onClick={() => setRecordForm(EMPTY_RECORD_FORM)}>
                    取消
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <Input
                className="max-w-xs"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索 lookupKey 或 scope"
              />
              {isLoading ? <LoaderCircle className="size-4 animate-spin text-slate-400" /> : null}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <tr>
                    <th className="px-4 py-3">lookupKey</th>
                    <th className="px-4 py-3">scope</th>
                    <th className="px-4 py-3">更新时间</th>
                    <th className="px-4 py-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length > 0 ? (
                    filteredRecords.map((record) => (
                      <tr key={record.id ?? record.lookupKey} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3 font-medium text-slate-950">{record.lookupKey}</td>
                        <td className="px-4 py-3 text-slate-600">{summarizeScope(record.scope)}</td>
                        <td className="px-4 py-3 text-slate-500">{record.updatedAt ?? "-"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEditRecordForm(record)}>
                              <Pencil className="size-4" />
                              编辑
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => void deleteRecord(record)}>
                              <Trash2 className="size-4" />
                              删除
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                        暂无映射内容。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>新增映射关系</DialogTitle>
            <DialogDescription>
              上传 Excel 后会解析成在线映射关系。解析完成后可进入详情页继续新增、编辑或删除映射内容。
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center">
            <Upload className="mx-auto mb-3 size-8 text-slate-400" />
            <p className="text-sm font-medium text-slate-800">选择一个或多个映射文件</p>
            <p className="mt-1 text-xs text-slate-500">建议第一列为 lookupKey，其余列作为 scope 字段。</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => void handleUpload(event.target.files)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={isMutating}>
              取消
            </Button>
            <Button onClick={() => fileInputRef.current?.click()} disabled={!projectId || isMutating}>
              {isMutating ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
              选择文件
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
