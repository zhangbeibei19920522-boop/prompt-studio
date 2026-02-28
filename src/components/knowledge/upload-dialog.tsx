"use client"

import * as React from "react"
import { Upload, X, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"]
const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isFileAccepted(file: File): boolean {
  const ext = "." + file.name.split(".").pop()?.toLowerCase()
  return (
    ACCEPTED_EXTENSIONS.includes(ext) ||
    ACCEPTED_MIME_TYPES.includes(file.type)
  )
}

interface UploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpload: (files: File[]) => void
}

export function UploadDialog({ open, onOpenChange, onUpload }: UploadDialogProps) {
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([])
  const [isDragging, setIsDragging] = React.useState(false)
  const [errors, setErrors] = React.useState<string[]>([])
  const inputRef = React.useRef<HTMLInputElement>(null)

  function handleClose() {
    setSelectedFiles([])
    setErrors([])
    setIsDragging(false)
    onOpenChange(false)
  }

  function processFiles(incoming: FileList | File[]) {
    const fileArray = Array.from(incoming)
    const valid: File[] = []
    const invalid: string[] = []

    for (const file of fileArray) {
      if (isFileAccepted(file)) {
        // Deduplicate by name
        const alreadyAdded = selectedFiles.some((f) => f.name === file.name)
        if (!alreadyAdded) {
          valid.push(file)
        }
      } else {
        invalid.push(file.name)
      }
    }

    if (invalid.length > 0) {
      setErrors([
        `不支持的文件类型：${invalid.join("、")}。`,
        `仅支持 ${ACCEPTED_EXTENSIONS.join("、")} 格式。`,
      ])
    } else {
      setErrors([])
    }

    if (valid.length > 0) {
      setSelectedFiles((prev) => [...prev, ...valid])
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      processFiles(e.target.files)
    }
    // Reset so the same file can be re-selected after removal
    e.target.value = ""
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files)
    }
  }

  function handleRemoveFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  function handleUpload() {
    if (selectedFiles.length === 0) return
    onUpload(selectedFiles)
    handleClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>上传文档</DialogTitle>
        </DialogHeader>

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="上传区域，点击或拖拽文件"
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 transition-colors cursor-pointer select-none",
            isDragging
              ? "border-primary bg-primary/5 text-primary"
              : "border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:bg-muted/40"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
        >
          <Upload className="size-10 shrink-0" />
          <div className="text-center">
            <p className="text-sm font-medium">拖拽文件到此处或点击上传</p>
            <p className="mt-1 text-xs text-muted-foreground">
              支持 {ACCEPTED_EXTENSIONS.join("、")} 格式，可多选
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS.join(",")}
            className="hidden"
            onChange={handleFileInput}
          />
        </div>

        {/* Validation errors */}
        {errors.length > 0 && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errors.map((err, i) => (
              <p key={i}>{err}</p>
            ))}
          </div>
        )}

        {/* Selected file list */}
        {selectedFiles.length > 0 && (
          <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {selectedFiles.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate font-medium">{file.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </span>
                <button
                  type="button"
                  aria-label={`移除 ${file.name}`}
                  className="shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveFile(index)
                  }}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0}
          >
            <Upload className="size-4" />
            上传{selectedFiles.length > 0 ? `（${selectedFiles.length} 个文件）` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
