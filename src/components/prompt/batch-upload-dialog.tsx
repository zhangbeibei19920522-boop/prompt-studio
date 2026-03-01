"use client"

import { useState, useRef } from "react"
import { Upload, X, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ParsedFile {
  name: string
  title: string
  content: string
}

interface BatchUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpload: (items: Array<{ title: string; content: string }>) => void
}

export function BatchUploadDialog({
  open,
  onOpenChange,
  onUpload,
}: BatchUploadDialogProps) {
  const [files, setFiles] = useState<ParsedFile[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files
    if (!selected || selected.length === 0) return

    const promises = Array.from(selected).map(
      (file) =>
        new Promise<ParsedFile>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => {
            const title = file.name.replace(/\.(txt|md)$/i, "")
            resolve({ name: file.name, title, content: reader.result as string })
          }
          reader.readAsText(file)
        })
    )

    Promise.all(promises).then((parsed) => {
      setFiles((prev) => [...prev, ...parsed])
    })

    e.target.value = ""
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    if (files.length === 0) return
    setLoading(true)
    try {
      onUpload(files.map(({ title, content }) => ({ title, content })))
      setFiles([])
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  function handleClose(value: boolean) {
    if (!value) setFiles([])
    onOpenChange(value)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>批量导入 Prompt</DialogTitle>
          <DialogDescription>
            选择 .txt 或 .md 文件，每个文件将创建一个 Prompt（文件名作为标题）
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" />
            选择文件
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".txt,.md"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          {files.length > 0 && (
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {files.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{file.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {file.content.length} 字符
                  </span>
                  <button
                    onClick={() => removeFile(i)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={files.length === 0 || loading}
          >
            {loading ? "导入中..." : `导入 ${files.length} 个 Prompt`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
