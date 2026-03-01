"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"

interface ReferenceSelectorProps {
  type: "prompt" | "document"
  items: Array<{ id: string; label: string }>
  selectedIds: string[]
  onToggle: (id: string, label: string) => void
  icon: React.ReactNode
  label: string
}

export function ReferenceSelector({
  items,
  selectedIds,
  onToggle,
  icon,
  label,
}: ReferenceSelectorProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 size-8"
          title={label}
        >
          {icon}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start" side="top">
        <Command>
          <CommandInput placeholder={`搜索${label}...`} />
          <CommandList>
            <CommandEmpty>无匹配结果</CommandEmpty>
            <CommandGroup>
              {items.map((item) => {
                const selected = selectedIds.includes(item.id)
                return (
                  <CommandItem
                    key={item.id}
                    value={item.label}
                    onSelect={() => onToggle(item.id, item.label)}
                  >
                    <Check
                      className={cn(
                        "size-3.5 shrink-0",
                        selected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
