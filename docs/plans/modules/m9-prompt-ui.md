# M9: Prompt 管理 UI

> 依赖：M4, M6 | 产出：Prompt 列表、详情预览、版本历史

## 目标

在左侧栏展示当前项目的 Prompt 列表，支持查看详情、版本历史和基本管理。

注意：Prompt 的创建和修改主要通过对话（Agent）完成，此模块侧重于浏览和管理。

## 组件清单

### `src/components/prompt/prompt-list.tsx` — Prompt 列表

左侧栏中的 Prompt 区域：
- 显示当前项目的所有 prompt
- 每项显示：标题 + 状态标签（draft/active/archived）
- 点击 → 右侧面板预览
- 右键菜单：查看版本历史、删除、更改状态

### `src/components/prompt/prompt-preview.tsx` — Prompt 预览

右侧面板中显示：
- 标题、状态、标签
- Prompt 内容（Markdown 渲染）
- 变量列表
- 补充说明
- 版本号 + 最后修改时间
- 操作按钮：编辑、复制内容、查看历史

### `src/components/prompt/prompt-editor.tsx` — Prompt 编辑器

右侧面板中的编辑模式：
- 标题编辑
- 内容编辑（大文本框，支持变量高亮 `{{变量名}}`）
- 补充说明编辑
- 标签编辑
- 状态切换
- 保存按钮（自动创建新版本）

### `src/components/prompt/version-history.tsx` — 版本历史

右侧面板中显示：
- 版本列表（版本号 + 修改说明 + 时间）
- 点击某版本 → 查看该版本内容
- 可恢复到某个历史版本

## 提交

```bash
git add src/components/prompt/
git commit -m "feat: add prompt management UI with list, preview and version history"
```
