"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

export type CreateProjectData = {
  name: string
  description: string
  businessDescription: string
  businessGoal: string
  businessBackground: string
}

type FormState = CreateProjectData

const initialFormState: FormState = {
  name: "",
  description: "",
  businessDescription: "",
  businessGoal: "",
  businessBackground: "",
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CreateProjectData) => void
}

export function CreateProjectDialog({ open, onOpenChange, onSubmit }: Props) {
  const [form, setForm] = React.useState<FormState>(initialFormState)
  const [nameError, setNameError] = React.useState("")

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (key === "name" && value) {
      setNameError("")
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setNameError("项目名称不能为空")
      return
    }
    onSubmit({ ...form, name: form.name.trim() })
    setForm(initialFormState)
    setNameError("")
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setForm(initialFormState)
      setNameError("")
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>新建项目</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* 项目名称 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              项目名称
              <span className="text-destructive ml-0.5">*</span>
            </label>
            <Input
              placeholder="请输入项目名称"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              aria-invalid={!!nameError}
            />
            {nameError && (
              <p className="text-destructive text-xs">{nameError}</p>
            )}
          </div>

          {/* 项目简介 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">项目简介</label>
            <Input
              placeholder="请输入项目简介"
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
            />
          </div>

          {/* 业务说明 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">业务说明</label>
            <p className="text-muted-foreground text-xs">
              包含需要强制写入 prompt 的规则
            </p>
            <Textarea
              placeholder="请输入业务说明"
              value={form.businessDescription}
              onChange={(e) => updateField("businessDescription", e.target.value)}
              className="min-h-20 resize-none"
            />
          </div>

          {/* 业务目标 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">业务目标</label>
            <Textarea
              placeholder="请输入业务目标"
              value={form.businessGoal}
              onChange={(e) => updateField("businessGoal", e.target.value)}
              className="min-h-20 resize-none"
            />
          </div>

          {/* 业务背景 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">业务背景</label>
            <Textarea
              placeholder="请输入业务背景"
              value={form.businessBackground}
              onChange={(e) => updateField("businessBackground", e.target.value)}
              className="min-h-20 resize-none"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit">创建项目</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
