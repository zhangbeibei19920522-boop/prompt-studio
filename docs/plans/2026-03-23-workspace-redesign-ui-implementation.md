# 工作区改版 UI 实现文档

> 基于原型 `prototype/workspace-redesign.html` 和设计规格 `docs/superpowers/specs/2026-03-23-conversational-workspace-redesign-design.md`

---

## 一、改版总览

### 1.1 核心变化

| 维度 | 旧版 | 新版 |
|------|------|------|
| **整体布局** | TopBar + 左 Sidebar(多功能) + 主区 + 右 RightPanel | TopBar + 左 Sidebar(仅对话) + 对话主区 + Canvas 侧滑面板 |
| **Prompt 编辑** | 右侧窄面板 (RightPanel 360px) | Canvas 面板 (480px)，可独立编辑 |
| **测试 / 质检** | 左侧栏切换 tab 进入 | 对话中 Agent 结果卡片 + 快捷按钮，Canvas 内列表→详情 |
| **知识库** | 左侧栏固定区域 | 顶栏按钮触发 Canvas 知识库 tab |
| **资产导航** | 左侧栏分组列表 | ⌘K 命令面板 + Canvas tab 切换 |
| **配色** | 暖棕色调 (workspace-frame.tsx) | 中性灰 shadcn/ui 标准色 |
| **@ 引用** | ReferenceSelector 弹出，单选 | 增强 @ 面板，Tab 过滤，多选 checkbox，行内 chip |

### 1.2 布局架构

```
┌─ TopBar ──────────────────────────────────────────────────┐
│ [☰] [项目切换▾]      [🔍 搜索... ⌘K]      [📚] [⚙️]    │
├────────────┬──────────────────────────────────┬────────────┤
│ Sidebar    │ Conversation Area                │ Canvas     │
│ 260px      │ (flex: 1, 最大宽 720px 居中)      │ 480px      │
│            │                                  │ (侧滑)     │
│ ── 对话 ── │  [消息列表]                       │ ┌──────┐  │
│ 今天       │   · 用户消息                      │ │ Tabs │  │
│  · 当前    │   · Agent 回复 + 操作卡片          │ ├──────┤  │
│  · ...     │   · 结果卡片 (测试/质检)          │ │      │  │
│ 昨天       │                                  │ │ 内容 │  │
│  · ...     │  [输入区]                         │ │      │  │
│            │   · @ 面板 / 质检配置卡片          │ └──────┘  │
│            │   · chip 引用 + 输入框 + 快捷按钮  │           │
└────────────┴──────────────────────────────────┴────────────┘
```

### 1.3 Canvas 面板状态

| 状态 | 宽度 | 对话区 | 触发场景 |
|------|------|--------|----------|
| 关闭 | 0 | 全宽 | 默认 / Esc / 关闭按钮 |
| 正常打开 | 480px | 收窄（marginRight） | 点击 Agent 卡片、快捷按钮、⌘K |
| 展开全屏 | `calc(100vw - 260px)` | 隐藏 (display:none) | 进入测试/质检详情 |

---

## 二、组件映射

### 2.1 原型区域 → React 组件

| 原型区域 | 对应新组件 | 复用/新建 | 关键 props |
|----------|-----------|----------|-----------|
| `.topbar` | `WorkspaceTopBar` | **新建** | `projectName, onCmdPalette, onKnowledge, onSettings` |
| `.sidebar` | `WorkspaceSidebar` | **新建**（替代 Sidebar 的会话部分） | `sessions, currentId, onSelect, onCreate` |
| `.conversation` + `.messages` | `ChatArea`（现有） | 复用+**增强** | 增加 `onOpenCanvas` prop |
| `.input-area` + `.input-wrapper` | `WorkspaceChatInput` | **新建**（替代 ChatInput） | 增加 @ 多选、chip 展示、快捷按钮 |
| `.mention-panel` | `MentionPanel` | **新建** | `prompts, documents, onConfirm` |
| `.audit-config` | `AuditConfigCard` | **新建** | `documents, onStartAudit, onCancel` |
| `.canvas` 整体 | `CanvasPanel` | **新建** | `open, expanded, activeTab, onClose, onTabSwitch` |
| `.canvas` > Prompt | `PromptEditor`（现有） | 复用，微调样式 | |
| `.canvas` > Prompt 库 | `PromptLibrary` | **新建** | `prompts, onSelect` |
| `.canvas` > 测试 List | `TestSuiteList`（现有） | 复用 | 去掉新建按钮 |
| `.canvas` > 测试 Detail | `TestSuiteDetail`（现有） | 复用 | 增加路由配置/重新生成预期结果按钮 |
| `.canvas` > 质检 List | 从 `ConversationAuditDetail` 拆出 | **新建** `AuditJobList` | `jobs, onSelect` |
| `.canvas` > 质检 Report | `ConversationAuditDetail`（现有） | 复用 | |
| `.canvas` > 知识库 | `KnowledgePanel` | **新建** | `documents, onUpload` |
| `.canvas` > 设置 | `SettingsPanel` | **新建** | `settings, onSave` |
| `.cmd-overlay` | `WorkspaceCommandPalette`（现有） | 复用+修改 | |
| `.result-card`（对话中测试） | `TestResultCard` | **新建** | `data, onClick` |
| `.result-card`（对话中质检） | `AuditResultCard` | **新建** | `data, onClick` |
| `.flow-config-card` | `TestFlowConfigCard`（现有） | 复用 | |
| `.agent-action` | `AgentActionCard` | **新建** | `title, changes[], onView` |

### 2.2 被替代/废弃的组件

| 旧组件 | 文件 | 处置 |
|--------|------|------|
| `TopBar` | `src/components/layout/top-bar.tsx` | 被 `WorkspaceTopBar` 替代 |
| `Sidebar` | `src/components/layout/sidebar.tsx` | 被 `WorkspaceSidebar` 替代，会话部分逻辑迁移 |
| `RightPanel` | `src/components/layout/right-panel.tsx` | 被 `CanvasPanel` 替代 |
| `ChatInput` | `src/components/chat/chat-input.tsx` | 被 `WorkspaceChatInput` 替代 |
| `ReferenceSelector` | `src/components/chat/reference-selector.tsx` | 被 `MentionPanel` 替代 |
| `ReferenceTag` | `src/components/chat/reference-tag.tsx` | 保留内联展示，输入区改用 chip |
| `WorkspaceFrame` | `src/components/workspace/workspace-frame.tsx` | 重写（当前暖棕色版本废弃） |
| `WorkspaceKnowledgeDrawer` | `src/components/workspace/workspace-knowledge-drawer.tsx` | 融入 `CanvasPanel` 知识库 tab |

---

## 三、新组件详细设计

### 3.1 CanvasPanel — Canvas 侧滑面板

**文件**: `src/components/workspace/canvas-panel.tsx`

```typescript
interface CanvasTab {
  id: "prompt" | "library" | "test" | "audit" | "knowledge" | "settings"
  label: string
  icon: React.ReactNode
}

interface CanvasPanelProps {
  open: boolean
  expanded: boolean
  activeTab: CanvasTab["id"]
  onClose: () => void
  onTabSwitch: (tab: CanvasTab["id"]) => void
  onExpandedChange: (expanded: boolean) => void
  children: React.ReactNode // 各 tab 内容由外部注入
}
```

**行为逻辑**:
- `open=true` 时 `transform: translateX(0)`，宽度 480px
- `expanded=true` 时 宽度 `calc(100vw - var(--sidebar-w))`，`onExpandedChange` 通知父级隐藏对话区
- Tab 切换时，如果当前 tab 是 test/audit 且在详情视图，切换到其他 tab 自动回退到列表视图并取消展开
- Esc 键关闭

**CSS 变量** (添加到 `globals.css`):
```css
:root {
  --sidebar-w: 260px;
  --topbar-h: 52px;
  --canvas-w: 480px;
  --canvas-w-expanded: calc(100vw - var(--sidebar-w));
}
```

### 3.2 WorkspaceTopBar — 顶栏

**文件**: `src/components/workspace/workspace-top-bar.tsx`

```typescript
interface WorkspaceTopBarProps {
  projectName: string
  projects: Project[]
  onProjectSwitch: (id: string) => void
  onSidebarToggle: () => void
  onOpenCmdPalette: () => void
  onOpenKnowledge: () => void
  onOpenSettings: () => void
}
```

**布局**: 三段式 `flex` — 左 (汉堡 + 项目切换) / 中 (命令面板触发器) / 右 (知识库 + 设置图标按钮)

### 3.3 WorkspaceSidebar — 仅对话线程

**文件**: `src/components/workspace/workspace-sidebar.tsx`

```typescript
interface WorkspaceSidebarProps {
  sessions: Session[]
  currentSessionId: string | null
  collapsed: boolean
  onSelectSession: (id: string) => void
  onCreateSession: () => void
  onDeleteSession: (id: string) => void
}
```

**布局**:
- 固定宽度 260px，`collapsed` 时 `width: 0; overflow: hidden`
- 头部: "对话" 标题 + 新建按钮
- 分组: 按时间分组（今天/昨天/更早）
- 每项: 标题 + 时间，hover 显示删除按钮

### 3.4 WorkspaceChatInput — 增强输入区

**文件**: `src/components/chat/workspace-chat-input.tsx`

```typescript
interface WorkspaceChatInputProps {
  prompts: Array<{ id: string; title: string; description?: string }>
  documents: Array<{ id: string; name: string; type: string }>
  onSend: (content: string, references: Reference[]) => void
  onOpenCanvas: (tab: CanvasTab["id"]) => void
  onStartAudit: (config: AuditConfig) => void
}
```

**子区域**:
1. **质检配置卡片** (`AuditConfigCard`): 弹出在输入框上方，包含文件上传区 + 知识库 chip 多选
2. **@ 面板** (`MentionPanel`): 输入 `@` 触发，Tab 过滤（全部/Prompt/文档），checkbox 多选，底部确认栏
3. **Chip 区**: 已选引用以行内 chip 展示，可单独移除
4. **输入行**: textarea + 发送按钮
5. **快捷操作栏**: 🧪 测试 / 🔍 质检 / 📋 Prompt / 📚 知识库

### 3.5 MentionPanel — 增强 @ 引用面板

**文件**: `src/components/chat/mention-panel.tsx`

```typescript
interface MentionPanelProps {
  visible: boolean
  prompts: Array<{ id: string; title: string; description: string }>
  documents: Array<{ id: string; name: string; type: string; description: string }>
  selected: Set<string> // "prompt:id" | "doc:id"
  onToggle: (key: string) => void
  onConfirm: () => void
  onClose: () => void
}
```

**交互**:
- 顶部搜索框，实时过滤
- Tab: 全部 / Prompt / 文档
- 每项左侧 checkbox，选中时蓝色背景
- 底部: 已选 N 项 + "插入引用" 按钮
- 选中后预览区（可选）

### 3.6 AuditConfigCard — 质检创建配置卡片

**文件**: `src/components/audit/audit-config-card.tsx`

```typescript
interface AuditConfigCardProps {
  visible: boolean
  documents: Array<{ id: string; name: string }>
  onStartAudit: (files: File[], knowledgeDocIds: string[]) => void
  onCancel: () => void
}
```

**区域**:
1. 标题栏 + 关闭按钮
2. 对话文件: 拖拽/点击上传区，上传后显示文件预览（名称 + 移除）
3. 质检基准: 知识库文档 chip 多选（预选全部）
4. 底部: 取消 + 开始质检

### 3.7 TestResultCard / AuditResultCard — 对话内结果卡片

**文件**: `src/components/chat/test-result-card.tsx`, `src/components/chat/audit-result-card.tsx`

```typescript
// TestResultCard
interface TestResultCardProps {
  suiteName: string
  subtitle: string       // "4 个用例 · 路由模式 · GPT-4o"
  score: number
  passCount: number
  totalCount: number
  intentMatchRate?: number
  status: string
  onClick: () => void    // 打开 Canvas 测试详情
}

// AuditResultCard
interface AuditResultCardProps {
  jobName: string
  subtitle: string       // "28 段对话 · 刚刚完成"
  passRate: number
  knowledgeAccuracy: number
  highRiskCount: number
  status: string
  onClick: () => void    // 打开 Canvas 质检报告
}
```

**样式**: 卡片式，顶部 icon + 标题 + 状态 badge，中间 3 列统计数据，底部"查看完整报告 →"链接

### 3.8 AgentActionCard — Agent 操作卡片

**文件**: `src/components/chat/agent-action-card.tsx`

```typescript
interface AgentActionCardProps {
  title: string           // "修改 Prompt: 订单查询"
  changes: string[]       // ["+ 增加 3 种语气模板", ...]
  onView: () => void      // 打开 Canvas Prompt 编辑器
  onShowPlan: () => void
}
```

---

## 四、配色迁移

### 4.1 新 Design Tokens

从原型提取的 shadcn/ui 中性色板，写入 `globals.css`:

```css
:root {
  /* 背景 */
  --bg: #fafafa;
  --bg-card: #ffffff;
  --bg-sidebar: #f5f5f4;
  --bg-hover: #f0efee;
  --bg-active: #e7e5e4;
  --bg-muted: #f5f5f4;

  /* 边框 */
  --border: #e5e5e5;
  --border-strong: #d4d4d4;
  --border-focus: #3b82f6;

  /* 文字 */
  --text: #0a0a0a;
  --text-secondary: #525252;
  --text-muted: #a3a3a3;

  /* 强调色 */
  --accent: #3b82f6;
  --green: #22c55e;
  --orange: #f97316;
  --red: #ef4444;
  --purple: #8b5cf6;
}
```

### 4.2 需要移除的暖色调

`workspace-frame.tsx` 中使用的暖棕色渐变、`rgba(94, 60, 28, ...)` 边框、橙色 accent `rgb(188, 92, 41)` 全部废弃，改用上述中性色。

---

## 五、State Management 变更

### 5.1 新增状态

在 `src/app/(main)/page.tsx` 或提升到 Context:

```typescript
// Canvas 状态
const [canvasOpen, setCanvasOpen] = useState(false)
const [canvasTab, setCanvasTab] = useState<CanvasTabId>("prompt")
const [canvasExpanded, setCanvasExpanded] = useState(false)

// Sidebar 折叠
const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

// 命令面板
const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false)
```

### 5.2 废弃状态

```typescript
// 以下状态可以移除或合并
// rightPanelView → 由 canvasTab + canvasOpen 替代
// testMode → 由 canvasTab === "test" 替代
// conversationAuditCreateMode → 由 AuditConfigCard visible 替代
```

### 5.3 Canvas 打开逻辑

```typescript
function openCanvas(tab: CanvasTabId) {
  setCanvasTab(tab)
  setCanvasOpen(true)
  setCanvasExpanded(false) // 默认不展开
}

function openCanvasDetail(tab: "test" | "audit", detailId: string) {
  setCanvasTab(tab)
  setCanvasOpen(true)
  setCanvasExpanded(true) // 详情需要全屏
  // 同时设置对应的 detail ID
  if (tab === "test") setCurrentTestSuiteId(detailId)
  if (tab === "audit") setCurrentConversationAuditJobId(detailId)
}
```

---

## 六、SSE 事件扩展

Agent 流式返回需要新增事件类型，用于在对话中嵌入测试/质检结果卡片:

| 事件类型 | 数据 | 触发场景 |
|---------|------|---------|
| `test-result` | `TestResultCardData` | Agent 完成测试后发送 |
| `audit-result` | `AuditResultCardData` | Agent 完成质检后发送 |
| `agent-action` | `AgentActionCardData` | Agent 规划 Prompt 修改时发送 |

`MessageBubble` 需要根据 `message.metadata.type` 渲染对应的卡片组件。

---

## 七、实现步骤

### Phase 1: 基础壳层（不改变业务逻辑）

| 步骤 | 涉及文件 | 说明 |
|------|---------|------|
| 1.1 | `globals.css` | 添加 CSS 变量 (design tokens) 和 canvas 相关样式 |
| 1.2 | `workspace-top-bar.tsx` | 新建顶栏组件 |
| 1.3 | `workspace-sidebar.tsx` | 新建仅会话侧边栏 |
| 1.4 | `canvas-panel.tsx` | 新建 Canvas 侧滑面板壳层（tabs + 内容插槽） |
| 1.5 | `page.tsx` | 替换旧布局：TopBar → WorkspaceTopBar, Sidebar → WorkspaceSidebar, RightPanel → CanvasPanel |
| 1.6 | 运行测试 | 确认不破坏现有功能 |

### Phase 2: Canvas 内容面板

| 步骤 | 涉及文件 | 说明 |
|------|---------|------|
| 2.1 | Canvas > Prompt tab | 挂载现有 PromptEditor + PromptPreview 到 Canvas |
| 2.2 | `prompt-library.tsx` | 新建 Prompt 库列表组件（搜索 + 过滤 + 列表项） |
| 2.3 | Canvas > 测试 tab | 挂载 TestSuiteList（列表）+ TestSuiteDetail（详情），列表→详情切换触发展开 |
| 2.4 | `audit-job-list.tsx` | 从 ConversationAuditDetail 拆分出质检列表组件 |
| 2.5 | Canvas > 质检 tab | 挂载 AuditJobList（列表）+ ConversationAuditDetail（详情） |
| 2.6 | `knowledge-panel.tsx` | 新建知识库面板（上传区 + 文档列表） |
| 2.7 | `settings-panel.tsx` | 新建设置面板（AI 配置 + 业务信息） |

### Phase 3: 对话增强

| 步骤 | 涉及文件 | 说明 |
|------|---------|------|
| 3.1 | `mention-panel.tsx` | 新建增强 @ 面板（搜索 + Tab + 多选 + chip） |
| 3.2 | `workspace-chat-input.tsx` | 新建增强输入组件（集成 @ 面板 + chip + 快捷按钮） |
| 3.3 | `audit-config-card.tsx` | 新建质检创建配置卡片 |
| 3.4 | `test-result-card.tsx` | 新建对话内测试结果卡片 |
| 3.5 | `audit-result-card.tsx` | 新建对话内质检结果卡片 |
| 3.6 | `agent-action-card.tsx` | 新建 Agent 操作卡片 |
| 3.7 | `message-bubble.tsx` | 修改：根据 metadata 类型渲染新卡片 |
| 3.8 | `chat-area.tsx` | 修改：接入新输入组件，处理新的 SSE 事件类型 |

### Phase 4: 命令面板与键盘快捷键

| 步骤 | 涉及文件 | 说明 |
|------|---------|------|
| 4.1 | `workspace-command-palette.tsx` | 修改：配色迁移到中性色，保持现有 6 分组结构 |
| 4.2 | `page.tsx` | 添加 ⌘K 全局快捷键，Esc 关闭 Canvas |

### Phase 5: 清理与测试

| 步骤 | 涉及文件 | 说明 |
|------|---------|------|
| 5.1 | 废弃组件 | 标记 TopBar、旧 Sidebar、RightPanel、旧 WorkspaceFrame 为 deprecated |
| 5.2 | 状态清理 | 移除 `rightPanelView`、`testMode` 等废弃状态 |
| 5.3 | 测试 | 补充 Canvas 组件渲染测试，验证 tab 切换、展开/收回 |
| 5.4 | 回归测试 | 确保测试运行、质检流程、Prompt 编辑等核心业务不受影响 |

---

## 八、文件变更清单

### 新建文件 (~14 个)

```
src/components/workspace/
  workspace-top-bar.tsx          # 顶栏
  workspace-sidebar.tsx          # 仅对话侧边栏
  canvas-panel.tsx               # Canvas 侧滑面板壳层

src/components/chat/
  workspace-chat-input.tsx       # 增强输入组件
  mention-panel.tsx              # @ 多选面板
  test-result-card.tsx           # 对话内测试结果卡片
  audit-result-card.tsx          # 对话内质检结果卡片
  agent-action-card.tsx          # Agent 操作卡片

src/components/audit/
  audit-config-card.tsx          # 质检创建配置卡片
  audit-job-list.tsx             # 质检任务列表

src/components/test/
  (无新增，复用现有)

src/components/workspace/
  prompt-library.tsx             # Prompt 库列表
  knowledge-panel.tsx            # 知识库面板
  settings-panel.tsx             # 设置面板
```

### 修改文件 (~6 个)

```
src/app/globals.css              # CSS 变量 + Canvas 样式
src/app/(main)/page.tsx          # 替换布局壳层，接入 Canvas 状态
src/components/chat/chat-area.tsx         # 新 SSE 事件处理
src/components/chat/message-bubble.tsx    # 渲染新卡片类型
src/components/workspace/workspace-command-palette.tsx  # 配色迁移
src/components/test/test-suite-detail.tsx  # 按钮调整（去编辑，加路由配置/重新生成）
```

### 废弃文件 (~4 个)

```
src/components/layout/top-bar.tsx         # → WorkspaceTopBar
src/components/layout/sidebar.tsx         # → WorkspaceSidebar
src/components/layout/right-panel.tsx     # → CanvasPanel
src/components/workspace/workspace-frame.tsx  # → 重写
src/components/workspace/workspace-knowledge-drawer.tsx  # → 知识库 tab
```

---

## 九、关键交互流程

### 9.1 Agent 修改 Prompt

```
用户发消息 → Agent 分析 → 返回 agent-action 事件
→ 对话中显示 AgentActionCard
→ 用户点击"查看修改" → openCanvas("prompt") → Canvas 打开 Prompt 编辑器
→ 用户确认/继续对话
```

### 9.2 测试从对话发起

```
用户说"跑个测试" → Agent 执行测试 → 返回 test-result 事件
→ 对话中显示 TestResultCard (评分/通过率/意图匹配)
→ 用户点击卡片 → openCanvasDetail("test", suiteId) → Canvas 展开全屏 → 测试详情
```

### 9.3 质检从快捷按钮发起

```
用户点击输入栏 🔍 质检按钮 → 弹出 AuditConfigCard
→ 上传对话文件 + 选择知识库文档
→ 点击"开始质检" → Agent 开始质检 → 返回 audit-result 事件
→ 对话中显示 AuditResultCard
→ 用户点击 → Canvas 展开质检报告 → 点击对话 → 三级导航
```

### 9.4 @ 引用流程

```
用户输入 @ → MentionPanel 弹出 → 搜索/Tab 过滤 → 多选 checkbox
→ 点击"插入引用" → 输入框上方显示 chip 标签
→ 发送消息时 chip 作为 references 传给 Agent
```

### 9.5 命令面板

```
用户按 ⌘K → CommandPalette 弹出 → 输入搜索
→ 快捷操作: 新建对话/Prompt/测试集/质检任务
→ 资产搜索: 已有 Prompt/测试/质检/文档
→ 选中 → 打开对应 Canvas tab 或执行操作
```

---

## 十、注意事项

1. **复用优先**: 测试/质检/Prompt 的深层业务逻辑（运行、评估、SSE 流等）全部复用现有组件，改版只涉及壳层和导航
2. **渐进式迁移**: Phase 1 完成后即可切换到新布局，后续 Phase 独立推进
3. **旧组件不立即删除**: 标记 deprecated，待新壳层稳定后统一清理
4. **Canvas 内 TestSuiteDetail**: 该组件已有 645 行，直接嵌入 Canvas 即可，无需改内部结构
5. **ConversationAuditDetail**: 887 行，需要拆分出列表部分为独立 AuditJobList，报告和对话详情保持不变
6. **测试详情按钮**: 原型中为 `路由配置 | 配置 | 重新生成预期结果 | 运行测试`，需要移除旧的"编辑"按钮
