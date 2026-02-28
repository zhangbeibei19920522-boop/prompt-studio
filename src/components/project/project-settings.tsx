"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

type Project = {
  id: string
  name: string
  description: string
  businessDescription: string
  businessGoal: string
  businessBackground: string
}

type Props = {
  project: Project
  onSave: (data: Partial<Project>) => void
  onDelete: () => void
}

export function ProjectSettings({ project, onSave, onDelete }: Props) {
  const [basicInfo, setBasicInfo] = React.useState({
    name: project.name,
    description: project.description,
  })
  const [businessDescription, setBusinessDescription] = React.useState(
    project.businessDescription
  )
  const [businessGoal, setBusinessGoal] = React.useState(project.businessGoal)
  const [businessBackground, setBusinessBackground] = React.useState(
    project.businessBackground
  )
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)

  const updateBasicInfo = <K extends keyof typeof basicInfo>(
    key: K,
    value: (typeof basicInfo)[K]
  ) => {
    setBasicInfo((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveBasicInfo = () => {
    onSave({ name: basicInfo.name, description: basicInfo.description })
  }

  const handleSaveBusinessDescription = () => {
    onSave({ businessDescription })
  }

  const handleSaveBusinessGoal = () => {
    onSave({ businessGoal })
  }

  const handleSaveBusinessBackground = () => {
    onSave({ businessBackground })
  }

  const handleConfirmDelete = () => {
    setDeleteDialogOpen(false)
    onDelete()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              项目名称
              <span className="text-destructive ml-0.5">*</span>
            </label>
            <Input
              placeholder="请输入项目名称"
              value={basicInfo.name}
              onChange={(e) => updateBasicInfo("name", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">项目简介</label>
            <Input
              placeholder="请输入项目简介"
              value={basicInfo.description}
              onChange={(e) => updateBasicInfo("description", e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveBasicInfo}>保存</Button>
          </div>
        </CardContent>
      </Card>

      {/* 业务说明 */}
      <Card>
        <CardHeader>
          <CardTitle>业务说明</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <p className="text-muted-foreground text-sm">
              包含需要强制写入 prompt 的规则
            </p>
            <Textarea
              placeholder="请输入业务说明"
              value={businessDescription}
              onChange={(e) => setBusinessDescription(e.target.value)}
              className="min-h-28 resize-none"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveBusinessDescription}>保存</Button>
          </div>
        </CardContent>
      </Card>

      {/* 业务目标 */}
      <Card>
        <CardHeader>
          <CardTitle>业务目标</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Textarea
              placeholder="请输入业务目标"
              value={businessGoal}
              onChange={(e) => setBusinessGoal(e.target.value)}
              className="min-h-28 resize-none"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveBusinessGoal}>保存</Button>
          </div>
        </CardContent>
      </Card>

      {/* 业务背景 */}
      <Card>
        <CardHeader>
          <CardTitle>业务背景</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Textarea
              placeholder="请输入业务背景"
              value={businessBackground}
              onChange={(e) => setBusinessBackground(e.target.value)}
              className="min-h-28 resize-none"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveBusinessBackground}>保存</Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* 危险操作区 */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-destructive">危险操作</h3>
        <p className="text-muted-foreground text-sm">
          删除项目后，所有相关数据将被永久删除，且无法恢复。
        </p>
        <div>
          <Button
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            删除项目
          </Button>
        </div>
      </div>

      {/* 确认删除对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除？</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            确定要删除项目 <span className="text-foreground font-medium">"{project.name}"</span> 吗？
            此操作不可撤销，所有相关数据将被永久删除。
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              取消
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
