# M7: 项目管理 UI

> 依赖：M4, M6 | 产出：项目 CRUD 界面 + 业务信息维护

## 目标

实现项目的创建、编辑、删除，以及三级业务信息（项目级）的维护界面。

## 组件清单

### `src/components/project/create-project-dialog.tsx` — 创建项目弹窗

表单字段：
- 项目名称（必填）
- 项目简介
- 业务说明（textarea，提示：包含强制规则）
- 业务目标（textarea）
- 业务背景（textarea）

### `src/components/project/project-settings.tsx` — 项目设置页内容

`src/app/(main)/project/[id]/settings/page.tsx` 的主要内容组件：

- 项目基本信息编辑（名称、简介）
- 业务说明编辑（大文本框，提示"哪些规则必须强制写在 prompt 中"）
- 业务目标编辑
- 业务背景编辑
- 删除项目（确认弹窗）

### `src/components/project/project-selector.tsx` — 项目选择器

顶栏中的下拉菜单：
- 显示所有项目列表
- 搜索过滤
- 选中后切换当前项目
- 底部"新建项目"入口

## 交互流程

1. 用户首次打开 → 无项目 → 引导创建项目
2. 有项目 → 自动选中最近访问的项目
3. 切换项目 → 更新左侧栏（会话列表、prompt 列表、知识库）

## 提交

```bash
git add src/components/project/ src/app/(main)/project/
git commit -m "feat: add project management UI with business info editing"
```
