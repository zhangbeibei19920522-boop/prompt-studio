"use client"

import * as React from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

interface RightPanelProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

function RightPanel({ open, onClose, title, children }: RightPanelProps) {
  return (
    <div
      className={cn(
        "flex flex-col border-l bg-white transition-all duration-300 ease-in-out overflow-hidden shrink-0",
        open ? "w-[400px] opacity-100" : "w-0 opacity-0"
      )}
    >
      {/* Top bar */}
      <div className="flex h-14 items-center justify-between border-b px-4 shrink-0">
        <span className="text-sm font-semibold truncate">{title}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close panel"
        >
          <X />
        </Button>
      </div>

      {/* Scrollable content area */}
      <ScrollArea className="flex-1">
        <div className="p-4">{children}</div>
      </ScrollArea>
    </div>
  )
}

export { RightPanel }
export type { RightPanelProps }
