"use client"

import { ArrowLeft, Search } from "lucide-react"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { KnowledgeVersion } from "@/types/database"

function GateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <strong className="text-slate-950">{value}</strong>
    </div>
  )
}

export function VersionDetailView({
  version,
  onBack,
}: {
  version?: KnowledgeVersion | null
  onBack: () => void
}) {
  const [selectedTab, setSelectedTab] = useState<"basic" | "items">("basic")
  const [keyword, setKeyword] = useState("")

  const filteredParents = useMemo(() => {
    if (!version?.parents) return []
    const normalizedKeyword = keyword.trim().toLowerCase()
    if (!normalizedKeyword) return version.parents

    return version.parents.filter((parent) => {
      const chunks = version.chunks?.filter((chunk) => chunk.parentId === parent.id) ?? []
      const haystack = [
        parent.question,
        parent.answer,
        parent.questionAliases.join(" "),
        chunks.map((chunk) => chunk.chunkText).join(" "),
      ]
        .join(" ")
        .toLowerCase()

      return haystack.includes(normalizedKeyword)
    })
  }, [keyword, version])

  if (!version) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4" />
          返回版本列表
        </Button>
        <section className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          当前没有可展示的知识版本详情。
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="size-4" />
        返回版本列表
      </Button>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="font-semibold">知识版本详情</h3>
            <Badge variant="outline" className="mt-2 rounded-md">
              {version.name || version.id}
            </Badge>
          </div>
          <div className="text-right text-sm text-slate-500">
            <div>版本 ID：{version.id}</div>
            <div>Profile：{version.buildProfile}</div>
          </div>
        </div>

        <div className="grid min-h-0 overflow-hidden md:grid-cols-[280px_minmax(0,1fr)]">
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
                    value === selectedTab ? "bg-white font-medium text-slate-950 shadow-sm" : "text-slate-600 hover:bg-white"
                  )}
                  onClick={() => setSelectedTab(value as "basic" | "items")}
                >
                  {label}
                </button>
              ))}
            </div>
          </nav>

          <div className="min-h-0 overflow-y-auto p-5">
            {selectedTab === "basic" ? (
              <>
                <section
                  className={cn(
                    "rounded-lg border p-4",
                    version.coverageAudit.auditStatus === "normal"
                      ? "border-slate-200 bg-slate-50"
                      : "border-rose-200 bg-rose-50"
                  )}
                >
                  <h4 className="font-semibold text-slate-950">覆盖率审计摘要</h4>
                  <div className="mt-3 space-y-2 rounded-md border border-white/80 bg-white px-4 py-3 text-sm">
                    <GateRow label="覆盖率" value={`${version.coverageAudit.coverage}%`} />
                    <GateRow
                      label="审计状态"
                      value={
                        version.coverageAudit.auditStatus === "normal"
                          ? "正常"
                          : `需关注：${version.coverageAudit.reasons.join("；") || "覆盖率或内容完整性待确认"}`
                      }
                    />
                  </div>
                </section>

                <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                  <h4 className="font-semibold text-slate-950">构建摘要</h4>
                  <div className="mt-4 space-y-2 text-sm">
                    <GateRow label="来源文件数" value={String(version.stageSummary.sourceCount)} />
                    <GateRow label="原始记录数" value={String(version.stageSummary.rawRecordCount)} />
                    <GateRow label="问答对数" value={String(version.parentCount)} />
                    <GateRow label="Chunk 数" value={String(version.chunkCount)} />
                    <GateRow label="待处理数量" value={String(version.pendingCount)} />
                    <GateRow label="阻断数量" value={String(version.blockedCount)} />
                    <GateRow label="高风险数量" value={String(version.stageSummary.highRiskCount)} />
                    <GateRow label="发布时间" value={version.publishedAt ?? "-"} />
                  </div>
                </section>

                <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                  <h4 className="font-semibold text-slate-950">异常明细</h4>
                  <div className="mt-4 space-y-4 text-sm">
                    <div>
                      <p className="font-semibold text-slate-950">异常原因</p>
                      <div className="mt-2 space-y-2 leading-6 text-slate-700">
                        {version.coverageAudit.reasons.length > 0 ? (
                          version.coverageAudit.reasons.map((reason) => <p key={reason}>{reason}</p>)
                        ) : (
                          <p>当前没有需要额外关注的异常原因。</p>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4">
                      <p className="font-semibold text-slate-950">待归类内容（orphan）</p>
                      <div className="mt-2 space-y-2 leading-6 text-slate-700">
                        {version.coverageAudit.orphanRecords.length > 0 ? (
                          version.coverageAudit.orphanRecords.map((item) => <p key={item}>{item}</p>)
                        ) : (
                          <p>当前没有待归类内容。</p>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4">
                      <p className="font-semibold text-slate-950">可能重复内容（ambiguity）</p>
                      <div className="mt-2 space-y-2 leading-6 text-slate-700">
                        {version.coverageAudit.ambiguityRecords.length > 0 ? (
                          version.coverageAudit.ambiguityRecords.map((item) => <p key={item}>{item}</p>)
                        ) : (
                          <p>当前没有需要确认的重复内容。</p>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
                  <input
                    type="text"
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    className="min-h-9 w-full rounded-md border border-slate-200 px-9 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                    placeholder="搜索问答对或索引内容"
                    aria-label="搜索索引内容"
                  />
                </div>

                <div className="mt-4 space-y-4">
                  {filteredParents.length > 0 ? (
                    filteredParents.map((parent) => {
                      const parentChunks = version.chunks?.filter((chunk) => chunk.parentId === parent.id) ?? []

                      return (
                        <article key={parent.id} className="rounded-lg border border-slate-200 bg-white p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h4 className="text-base font-semibold text-slate-950">{parent.question}</h4>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Badge variant="outline" className="rounded-md">
                                  {parent.recordKind}
                                </Badge>
                                <Badge variant="outline" className="rounded-md">
                                  {parent.reviewStatus}
                                </Badge>
                              </div>
                            </div>
                            <div className="text-right text-xs text-slate-500">
                              <div>来源文件：{parent.sourceFiles.join("、") || "-"}</div>
                              <div>问法别名：{parent.questionAliases.length}</div>
                            </div>
                          </div>

                          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                            {parent.answer}
                          </div>

                          <div className="mt-4 space-y-3">
                            <div className="text-sm font-semibold text-slate-950">Chunks 信息</div>
                            {parentChunks.length > 0 ? (
                              parentChunks.map((chunk) => (
                                <div key={chunk.id} className="rounded-md border border-slate-200 p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                                    <span>chunkOrder：{chunk.chunkOrder}</span>
                                    <span>chunkType：{chunk.chunkType}</span>
                                    <span>sectionTitle：{chunk.sectionTitle}</span>
                                  </div>
                                  <div className="mt-3 space-y-3 text-sm">
                                    <div>
                                      <div className="mb-1 font-semibold text-slate-950">chunkText</div>
                                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-slate-700">
                                        {chunk.chunkText}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="mb-1 font-semibold text-slate-950">embeddingText</div>
                                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 whitespace-pre-wrap text-slate-700">
                                        {chunk.embeddingText}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                                当前问答对还没有对应的索引片段。
                              </div>
                            )}
                          </div>
                        </article>
                      )
                    })
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                      没有匹配的问答对内容。
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
