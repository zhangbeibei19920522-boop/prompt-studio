"use client"

import * as React from "react"
import { FileText, FolderOpen, Upload, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface WorkspaceKnowledgeDrawerProps {
  open: boolean
  onClose: () => void
  documents: Array<{ id: string; name: string; type: string }>
  selectedDocumentId: string | null
  onSelectDocument: (id: string) => void
  onUploadDocument?: () => void
  preview?: React.ReactNode
}

export function WorkspaceKnowledgeDrawer({
  open,
  onClose,
  documents,
  selectedDocumentId,
  onSelectDocument,
  onUploadDocument,
  preview,
}: WorkspaceKnowledgeDrawerProps) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-y-0 right-0 z-40 w-[420px] translate-x-full border-l border-[rgba(94,60,28,0.14)] bg-[rgba(255,250,244,0.95)] shadow-[0_30px_80px_rgba(72,46,18,0.22)] backdrop-blur transition-transform duration-300",
        open && "pointer-events-auto translate-x-0"
      )}
      aria-hidden={!open}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(94,60,28,0.12)] px-5 py-5">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <FolderOpen className="size-4 text-[rgb(188,92,41)]" />
              <p className="text-base font-semibold">知识库抽屉</p>
            </div>
            <p className="text-sm leading-6 text-[rgba(54,39,25,0.72)]">
              只在引用资料时打开，不占用主导航。
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} className="rounded-xl">
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between border-b border-[rgba(94,60,28,0.08)] px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[rgba(54,39,25,0.6)]">
            文档列表
          </p>
          {onUploadDocument && (
            <Button
              variant="outline"
              size="sm"
              onClick={onUploadDocument}
              className="rounded-xl border-[rgba(94,60,28,0.12)] bg-white/70 shadow-none"
            >
              <Upload className="size-4" />
              上传文档
            </Button>
          )}
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-[220px_minmax(0,1fr)]">
          <div className="overflow-auto px-4 py-4">
            <div className="flex flex-col gap-2">
              {documents.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-[rgba(94,60,28,0.18)] bg-white/40 p-4 text-sm text-[rgba(54,39,25,0.72)]">
                  还没有知识文档，先上传一份资料。
                </div>
              ) : (
                documents.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => onSelectDocument(doc.id)}
                    className={cn(
                      "rounded-3xl border px-4 py-3 text-left transition-colors",
                      selectedDocumentId === doc.id
                        ? "border-[rgba(188,92,41,0.22)] bg-[rgba(188,92,41,0.08)]"
                        : "border-[rgba(94,60,28,0.1)] bg-white/65 hover:bg-white"
                    )}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <FileText className="size-4 text-[rgba(54,39,25,0.72)]" />
                      <span className="text-sm font-medium">{doc.name}</span>
                    </div>
                    <span className="text-xs text-[rgba(54,39,25,0.6)]">
                      {doc.type.toUpperCase()} 文档
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="min-h-0 overflow-auto border-t border-[rgba(94,60,28,0.08)] bg-white/45">
            {preview ?? (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[rgba(54,39,25,0.72)]">
                选择一份文档后，在这里预览内容。
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
