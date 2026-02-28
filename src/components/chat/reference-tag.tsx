"use client"

import { X } from "lucide-react"
import type { MessageReference } from "@/types/database"

interface ReferenceTagProps {
  reference: MessageReference
  removable?: boolean
  onRemove?: () => void
}

export function ReferenceTag({ reference, removable, onRemove }: ReferenceTagProps) {
  const isPrompt = reference.type === "prompt"
  const icon = isPrompt ? "📋" : "📁"
  const colorClass = isPrompt
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-green-50 text-green-700 border-green-200"

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs ${colorClass}`}
    >
      <span>{icon}</span>
      <span className="max-w-[120px] truncate">{reference.title}</span>
      {removable && onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 rounded-sm hover:bg-black/10 transition-colors"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  )
}
