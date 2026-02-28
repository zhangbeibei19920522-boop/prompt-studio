"use client"

import * as React from "react"
import { Trash2, FileText } from "lucide-react"
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
import { Separator } from "@/components/ui/separator"

const FILE_TYPE_LABELS: Record<string, string> = {
  pdf: "PDF",
  docx: "Word",
  txt: "纯文本",
  md: "Markdown",
}

const FILE_TYPE_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pdf: "destructive",
  docx: "default",
  txt: "secondary",
  md: "outline",
}

function getTypeLabel(type: string): string {
  return FILE_TYPE_LABELS[type.toLowerCase()] ?? type.toUpperCase()
}

function getTypeVariant(
  type: string
): "default" | "secondary" | "outline" | "destructive" {
  return FILE_TYPE_VARIANTS[type.toLowerCase()] ?? "secondary"
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface DocumentPreviewProps {
  document: {
    id: string
    name: string
    type: string
    content: string
    createdAt: string
  }
  onDelete: () => void
}

export function DocumentPreview({ document, onDelete }: DocumentPreviewProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  function handleDeleteConfirmed() {
    setConfirmOpen(false)
    onDelete()
  }

  return (
    <>
      <div className="flex h-full flex-col gap-0">
        {/* Header */}
        <div className="flex items-start gap-3 px-4 py-4">
          <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <h2
              className="truncate text-base font-semibold leading-snug"
              title={document.name}
            >
              {document.name}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={getTypeVariant(document.type)}>
                {getTypeLabel(document.type)}
              </Badge>
              <span>上传于 {formatDate(document.createdAt)}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="删除文档"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        <Separator />

        {/* Content preview */}
        <div className="flex-1 overflow-auto px-4 py-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            文档内容
          </p>
          <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/40 px-4 py-3 font-mono text-sm leading-relaxed text-foreground">
            {document.content || "（无内容）"}
          </pre>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除文档「{document.name}」吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirmed}>
              <Trash2 className="size-4" />
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
