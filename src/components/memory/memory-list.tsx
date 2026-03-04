"use client"

import * as React from "react"
import { Plus, Pencil, Trash2, ArrowUpFromLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import type { Memory } from "@/types/database"

type Props = {
  memories: Memory[]
  scope: "global" | "project"
  onAdd: (data: { content: string; category: "preference" | "fact" }) => void
  onEdit: (id: string, data: { content: string; category: "preference" | "fact" }) => void
  onDelete: (id: string) => void
  onPromote?: (id: string) => void
}

type Filter = "all" | "preference" | "fact"

export function MemoryList({ memories, scope, onAdd, onEdit, onDelete, onPromote }: Props) {
  const [filter, setFilter] = React.useState<Filter>("all")
  const [addDialogOpen, setAddDialogOpen] = React.useState(false)
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  const [editingMemory, setEditingMemory] = React.useState<Memory | null>(null)
  const [formContent, setFormContent] = React.useState("")
  const [formCategory, setFormCategory] = React.useState<"preference" | "fact">("fact")

  const filtered = filter === "all" ? memories : memories.filter((m) => m.category === filter)

  const preferences = filtered.filter((m) => m.category === "preference")
  const facts = filtered.filter((m) => m.category === "fact")

  const handleOpenAdd = () => {
    setFormContent("")
    setFormCategory("fact")
    setAddDialogOpen(true)
  }

  const handleAdd = () => {
    if (!formContent.trim()) return
    onAdd({ content: formContent.trim(), category: formCategory })
    setAddDialogOpen(false)
  }

  const handleOpenEdit = (memory: Memory) => {
    setEditingMemory(memory)
    setFormContent(memory.content)
    setFormCategory(memory.category)
    setEditDialogOpen(true)
  }

  const handleEdit = () => {
    if (!editingMemory || !formContent.trim()) return
    onEdit(editingMemory.id, { content: formContent.trim(), category: formCategory })
    setEditDialogOpen(false)
    setEditingMemory(null)
  }

  const renderMemoryItem = (memory: Memory) => (
    <div
      key={memory.id}
      className="group flex items-start justify-between gap-2 rounded-md border p-3"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm">{memory.content}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            {memory.source === "auto" ? "自动提取" : "手动"}
          </span>
          <span className="text-muted-foreground text-xs">
            {new Date(memory.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEdit(memory)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        {scope === "project" && onPromote && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onPromote(memory.id)} title="提升为全局记忆">
            <ArrowUpFromLine className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(memory.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )

  const renderGroup = (title: string, items: Memory[]) => {
    if (items.length === 0) return null
    return (
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
        {items.map(renderMemoryItem)}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(["all", "preference", "fact"] as Filter[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "全部" : f === "preference" ? "偏好" : "事实"}
            </Button>
          ))}
        </div>
        <Button size="sm" onClick={handleOpenAdd}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          新增
        </Button>
      </div>

      {/* 记忆列表 */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            暂无记忆
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {filter === "all" ? (
            <>
              {renderGroup("偏好", preferences)}
              {renderGroup("事实", facts)}
            </>
          ) : (
            filtered.map(renderMemoryItem)
          )}
        </div>
      )}

      {/* 新增对话框 */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新增记忆</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">分类</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as "preference" | "fact")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                <option value="preference">偏好</option>
                <option value="fact">事实</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">内容</label>
              <Textarea
                placeholder="请输入记忆内容"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                className="min-h-24 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>取消</Button>
            <Button onClick={handleAdd} disabled={!formContent.trim()}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑记忆</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">分类</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as "preference" | "fact")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                <option value="preference">偏好</option>
                <option value="fact">事实</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">内容</label>
              <Textarea
                placeholder="请输入记忆内容"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                className="min-h-24 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>取消</Button>
            <Button onClick={handleEdit} disabled={!formContent.trim()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
