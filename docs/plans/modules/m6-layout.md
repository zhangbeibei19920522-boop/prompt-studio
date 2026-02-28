# M6: 布局与导航

> 依赖：M1, M4 | 产出：三栏布局 + 项目切换 + 全局设置页

## 目标

实现对话中心化的三栏布局框架，作为所有 UI 模块的容器。

## 页面结构

```
src/app/
├── layout.tsx                    # 根布局（全局字体、样式）
├── page.tsx                      # 首页（重定向到最近项目或项目列表）
├── (main)/
│   ├── layout.tsx                # 三栏布局（顶栏 + 左侧栏 + 中央 + 右侧面板）
│   ├── project/[id]/
│   │   ├── page.tsx              # 项目主页（对话界面）
│   │   └── settings/
│   │       └── page.tsx          # 项目设置（业务信息）
│   └── settings/
│       └── page.tsx              # 全局设置页
└── globals.css
```

## 组件清单

### `src/components/layout/app-layout.tsx` — 三栏布局容器

```
┌──────────────────────────────────────────────────┐
│  TopBar                                          │
├──────────┬────────────────────┬──────────────────┤
│ Sidebar  │  MainContent       │  RightPanel      │
│ (240px)  │  (flex-1)          │  (400px, 可折叠)  │
└──────────┴────────────────────┴──────────────────┘
```

### `src/components/layout/top-bar.tsx` — 顶部栏

- 左侧：项目选择下拉菜单 + 新建项目按钮
- 右侧：全局设置按钮

### `src/components/layout/sidebar.tsx` — 左侧栏

两个区域：
1. **会话列表** — 当前项目的对话会话 + 新建会话按钮
2. **项目资源** — Prompt 列表、知识库文档、项目设置入口、其他项目（只读）

### `src/components/layout/right-panel.tsx` — 右侧面板

可折叠面板，根据当前上下文显示不同内容：
- Prompt 全文预览 / 编辑
- Diff 对比视图
- 知识库文档预览
- 默认折叠，点击对话中的卡片时展开

### 全局设置页 `src/app/(main)/settings/page.tsx`

- AI 模型配置表单（Provider 选择 + API Key + Model + Base URL）
- 全局业务说明 / 目标 / 背景 的文本编辑区域
- 导入 / 导出功能（后续实现）

## 状态管理

使用 React Context 管理全局状态：

### `src/lib/store/app-context.tsx`

```typescript
interface AppState {
  currentProjectId: string | null
  currentSessionId: string | null
  rightPanelContent: RightPanelContent | null
  rightPanelOpen: boolean
}
```

## 响应式设计

- 桌面端：三栏完整显示
- 平板端：左侧栏可折叠，右侧面板覆盖式
- 移动端：单栏，底部导航切换

## 提交

```bash
git add src/app/(main)/ src/components/layout/ src/lib/store/
git commit -m "feat: add three-column layout with navigation and global settings"
```
