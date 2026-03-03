# 记忆功能设计文档

## 概述

为 Prompt Manager 新增记忆功能，使 Agent 能够跨会话记住用户偏好和业务知识，生成更贴合需求的 prompt。

## 核心设计决策

| 决策项 | 方案 |
|--------|------|
| 记忆层级 | 全局记忆 + 项目记忆，两层结构 |
| 记忆来源 | 混合模式（Agent 自动提取 + 用户手动管理） |
| 自动提取时机 | 切换/新建会话时，增量提取未处理的新消息 |
| 自动提取 scope | **一律存项目记忆**，多项目出现时建议晋升全局 |
| 记忆粒度 | 结构化独立条目，带分类标签 |
| 分类体系 | 两类：`preference`（偏好）+ `fact`（事实） |
| 同层级冲突 | 最新为准，自动覆盖 |
| 跨层级冲突（全局 vs 项目） | **项目记忆静默覆盖全局记忆**，不询问用户 |
| LLM 调用策略 | 提取 + 去重合并为 **1 次** LLM 调用 |
| 记忆量控制 | 各 50 条上限，超限时先合并相似条目再淘汰 |
| 管理方式 | 对话快捷操作 + 专门管理页面 |
| LLM 调用 | 复用全局设置中用户配置的 LLM |
| 存储方案 | 纯 SQLite，无向量检索 |

## 设计原则

1. **宁可漏存全局，不可误存全局** — 项目记忆存错影响范围小，全局记忆存错会污染所有项目
2. **项目优先级高于全局** — 越具体的记忆越优先，类似 CSS 优先级规则
3. **减少用户决策负担** — 尽量自动处理，不打断用户流程
4. **最少 LLM 调用** — 合并调用，降低成本和延迟

## 数据模型

### memories 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| scope | TEXT | `global` 或 `project` |
| projectId | TEXT | scope=project 时关联项目，global 时为 null |
| category | TEXT | `preference` 或 `fact` |
| content | TEXT | 记忆内容 |
| source | TEXT | `auto`（自动提取）或 `manual`（用户手动） |
| sourceSessionId | TEXT | 自动提取时关联的会话 ID |
| createdAt | TEXT | 创建时间 |
| updatedAt | TEXT | 更新时间 |

**分类说明：**
- `preference`：用户**想要**什么（写作风格、格式习惯、语气偏好、语言选择等）
- `fact`：用户**告诉** Agent 的事实（业务术语、领域规则、技术约束、历史决策及原因等）

### session_extraction_progress 表

| 字段 | 类型 | 说明 |
|------|------|------|
| sessionId | TEXT PK | 会话 ID |
| lastExtractedMessageIndex | INTEGER | 上次提取到第几条消息 |
| updatedAt | TEXT | 上次提取时间 |

## Scope 判定规则

### 自动提取：一律存项目

自动提取的记忆**全部存为项目记忆**，不让 LLM 判断 scope。理由：
- LLM 判断 scope 不准确，容易将项目特有信息污染全局
- 存错项目影响范围小，存错全局影响所有项目

### 手动创建：用户指定

- 用户说"记住 XXX" → 存**项目记忆**（默认）
- 用户说"所有项目都记住 XXX" / "全局记住 XXX" → 存**全局记忆**

### 自然晋升机制

当同一条记忆在 **2 个以上项目** 中出现时，Agent 主动建议：

> "这个偏好在多个项目中出现，要提升为全局记忆吗？"

用户确认后：
1. 在全局记忆中创建该条目
2. 删除各项目中的重复条目

## 记忆提取流程

### 触发条件

用户切换或新建会话时，检查当前会话是否有未提取的新消息：
- 无新消息 → 跳过
- 有新消息 → 后台异步触发提取（不阻塞新会话）

### 提取步骤（单次 LLM 调用）

1. **读取增量消息**：根据 `session_extraction_progress` 获取上次提取位置，只取新增消息
2. **读取已有记忆**：获取当前项目记忆 + 全局记忆列表
3. **合并调用 LLM**：一次调用完成提取 + 去重 + 冲突判断

提取 prompt 大意：
```
以下是用户新增的对话消息，以及已有的记忆列表。
请提取值得记住的新信息，每条标注分类（preference / fact），并判断：
- insert：全新条目，给出 content 和 category
- update：应覆盖已有记忆，给出目标记忆 id 和新 content
- skip：与已有记忆重复，无需操作

输出 JSON 数组，scope 一律为 project。
```

4. **写入数据库**：根据 LLM 返回的 JSON 执行 insert / update 操作
5. **更新进度**：写入 `session_extraction_progress`

### 长会话压缩

- 当会话消息超过 20 条时，将早期消息压缩为摘要
- 存储压缩摘要供后续上下文构建使用
- Agent 构建上下文时：压缩摘要 + 最近 20 条完整消息

## 跨层级优先级

**项目记忆 > 全局记忆**，静默处理，不询问用户。

示例：
- 全局记忆："用户偏好中文写 prompt"
- 项目记忆："这个项目用英文写 prompt"
- Agent 行为：在该项目中用英文，不需要问用户

实现方式：在 Agent 系统提示中注入优先级指令：
```
当项目记忆与全局记忆存在矛盾时，以项目记忆为准，无需询问用户确认。
```

## Agent 上下文注入

在现有 `context-collector.ts` 中增加记忆层，最终上下文结构：

```
1. 全局业务信息
2. 全局记忆（scope=global）          ← 新增
3. 项目业务信息
4. 项目记忆（scope=project）         ← 新增
5. 会话压缩摘要（如有）              ← 新增
6. @引用的 prompt / 文档
7. 最近 20 条消息
```

注入时标注优先级：
```
## 全局记忆（通用偏好和知识）
- [preference] 用户偏好中文写 prompt
- [fact] 公司名称为 xxx

## 项目记忆（本项目专属，优先级高于全局）
- [preference] 本项目用英文写 prompt
- [fact] 目标用户为北美市场
```

## 记忆量控制

### 上限
- 全局记忆最多 **50 条**
- 每个项目记忆最多 **50 条**

### 超限处理（先合并再淘汰）

当记忆条数达到上限时，不直接丢弃旧条目，而是先尝试合并：

1. **LLM 合并调用**：将所有记忆发给模型，要求合并语义相似的条目
   - "用户喜欢简洁" + "用户不喜欢冗长的 prompt" → 合并为"用户偏好简洁的 prompt，不喜欢冗长表达"
2. **合并后仍超限**：按 `updatedAt` 排序，淘汰最早未更新的条目
3. **manual 来源保护**：用户手动创建的记忆优先保留，只在最后才淘汰

## 用户交互

### 对话快捷操作

Agent 系统提示中声明可响应的记忆指令：
- "记住 XXX" → 创建 `manual` 来源的**项目记忆**
- "所有项目都记住 XXX" → 创建 `manual` 来源的**全局记忆**
- "忘掉 XXX" → 查找匹配记忆并删除
- "我的记忆有哪些" → 列出当前生效的记忆（全局 + 项目）

### 记忆管理页面

- **全局记忆**：全局设置页面新增"记忆"tab
- **项目记忆**：项目设置/详情中新增"记忆"tab

页面功能：
- 按分类分组展示（偏好 / 事实）
- 每条显示：内容、来源（自动/手动）、更新时间
- 操作：编辑、删除、手动新增、**提升为全局**（仅项目记忆）
- 筛选：按分类、按来源

### 提取通知

后台提取完成后，给出轻量提示（侧边栏徽章等），用户可点击查看本次提取的新记忆，不打断当前操作。

---

## 开发计划

### 依赖关系

```
Phase 1 (数据库+类型)
  ├→ Phase 2 (API+Client)
  │    ├→ Phase 5 (管理UI)
  │    └→ Phase 6 (触发+通知) ← 也依赖 Phase 3, 4
  ├→ Phase 3 (提取服务)
  └→ Phase 4 (上下文集成)
```

Phase 3 和 Phase 4 互不依赖，可并行开发。

### Phase 1: 数据库 + 类型定义

#### 1.1 新增表结构
**修改** `src/lib/db/schema.sql` — 末尾追加两张表：
- `memories` 表：id, scope(global/project), project_id, category(preference/fact), content, source(auto/manual), source_session_id, created_at, updated_at
- `session_extraction_progress` 表：session_id, last_extracted_message_index, updated_at
- 索引：idx_memories_scope, idx_memories_project, idx_memories_scope_project

#### 1.2 TypeScript 类型
**修改** `src/types/database.ts` — 新增 `Memory` 和 `SessionExtractionProgress` 接口
**修改** `src/types/ai.ts` — AgentContext 增加 globalMemories/projectMemories 字段；新增 MemoryExtractionAction、MemoryExtractionResult、MemoryCommandData 类型；StreamEvent 增加 memory 事件；AgentContextSummary 增加记忆计数
**修改** `src/types/api.ts` — 新增 CreateMemoryRequest、UpdateMemoryRequest

#### 1.3 Repository
**新建** `src/lib/db/repositories/memories.ts` — 按现有 prompts.ts 模式（Row接口→mapper→导出函数）：
- findGlobalMemories(), findProjectMemories(projectId), findMemoryById(id)
- countMemoriesByScope(scope, projectId?)
- createMemory(data), updateMemory(id, data), deleteMemory(id)
- promoteToGlobal(memoryId)

**新建** `src/lib/db/repositories/extraction-progress.ts`：
- getExtractionProgress(sessionId), upsertExtractionProgress(sessionId, lastIndex)

**验证**: 启动应用，确认新表自动创建

### Phase 2: API 路由 + 客户端

#### 2.1 API 路由（按现有 response envelope 模式）
**新建** `src/app/api/memories/route.ts` — GET(全局列表) + POST(创建)
**新建** `src/app/api/memories/[id]/route.ts` — GET + PUT(更新/提升) + DELETE
**新建** `src/app/api/projects/[id]/memories/route.ts` — GET(项目列表) + POST(项目创建)

#### 2.2 API Client
**修改** `src/lib/utils/api-client.ts` — 新增 memoriesApi 命名空间：
- listGlobal(), listByProject(projectId)
- create(data), createForProject(projectId, data)
- update(id, data), promote(id), delete(id)

**验证**: curl 测试 CRUD 端点

### Phase 3: 记忆提取服务

#### 3.1 提取核心逻辑
**新建** `src/lib/ai/memory-extraction.ts`（~200行）：
- EXTRACTION_PROMPT 常量 — 指导 LLM 提取 preference/fact，输出 JSON 数组（insert/update/skip）
- buildExtractionMessages(newMessages, existingMemories) — 组装提取请求
- parseExtractionResult(text) — 解析 LLM 返回的 JSON（含 ```json 块兼容）
- extractMemoriesFromSession(sessionId) — 主流程：读增量消息→读已有记忆→单次 LLM 调用→执行 insert/update→更新进度

#### 3.2 提取 API
**新建** `src/app/api/ai/extract-memories/route.ts` — POST，接收 sessionId，调用 extractMemoriesFromSession

**验证**: 手动创建会话消息后调用提取 API，确认记忆被正确提取

### Phase 4: Agent 上下文集成

#### 4.1 上下文收集
**修改** `src/lib/ai/context-collector.ts` — collectAgentContext() 增加 findGlobalMemories() 和 findProjectMemories() 调用，填充 AgentContext 的新字段

#### 4.2 系统提示词
**修改** `src/lib/ai/agent-prompt.ts`：
- SYSTEM_PROMPT 增加"记忆系统"章节（优先级规则、记忆指令格式、memory JSON 输出格式）
- buildPlanMessages() 注入全局记忆和项目记忆块（标注优先级）

#### 4.3 流事件处理
**修改** `src/lib/ai/stream-handler.ts` — parseAgentOutput 的 type 检查增加 'memory'
**修改** `src/lib/ai/agent.ts` — handleAgentChat() 处理 memory 类型 JSON 块；context summary 增加记忆计数

**验证**: 手动创建记忆后对话，确认 Agent 上下文包含记忆、思考链显示记忆计数

### Phase 5: 记忆管理 UI

#### 5.1 记忆列表组件
**新建** `src/components/memory/memory-list.tsx`（~250行）：
- Props: memories[], scope, onAdd, onEdit, onDelete, onPromote?
- 按分类分组展示（偏好/事实），支持筛选
- 每条显示：内容、来源徽标(自动/手动)、更新时间
- 操作：新增弹窗、编辑弹窗、删除确认、提升为全局（仅项目）

#### 5.2 全局设置页
**修改** `src/app/(main)/settings/page.tsx` — 用 Tabs 包裹，原内容为"设置" tab，新增"记忆" tab 展示 MemoryList(scope=global)

#### 5.3 项目设置
**修改** `src/components/project/project-settings.tsx` — 同样增加"记忆" tab，Props 扩展记忆回调

#### 5.4 主页面集成
**修改** `src/app/(main)/page.tsx` — 增加 projectMemories 状态，加载/刷新逻辑，传递记忆回调给 ProjectSettings

**验证**: 全局设置和项目设置中能增删改查记忆，项目记忆可提升为全局

### Phase 6: 会话切换触发 + 通知

#### 6.1 会话切换触发提取
**修改** `src/app/(main)/page.tsx`：
- 用 useRef 追踪前一个 sessionId
- 切换/新建会话时对前一个会话异步触发 extractMemoriesFromSession（fire-and-forget）
- 提取完成后刷新 projectMemories 并更新 badge 计数

#### 6.2 侧边栏通知
**修改** `src/components/layout/sidebar.tsx` — 新增 memoryBadge prop，项目设置按钮旁显示"+N 记忆"徽标

#### 6.3 对话中记忆指令
**修改** `src/components/chat/chat-area.tsx`：
- 处理 memory 流事件，调用 onMemoryCommand 回调
- ContextLog 组件增加记忆计数显示

**修改** `src/app/(main)/page.tsx` — handleMemoryCommand 回调：处理 create/delete/list 指令，调用 memoriesApi

**验证**: 对话后切换会话→观察提取徽标；测试"记住 XXX"/"忘掉 XXX"/"我的记忆有哪些"指令

### 文件清单

#### 新建文件（8个）
| 文件 | 说明 |
|------|------|
| `src/lib/db/repositories/memories.ts` | 记忆 CRUD |
| `src/lib/db/repositories/extraction-progress.ts` | 提取进度追踪 |
| `src/lib/ai/memory-extraction.ts` | LLM 提取服务 |
| `src/app/api/memories/route.ts` | 全局记忆 API |
| `src/app/api/memories/[id]/route.ts` | 单条记忆 API |
| `src/app/api/projects/[id]/memories/route.ts` | 项目记忆 API |
| `src/app/api/ai/extract-memories/route.ts` | 提取触发 API |
| `src/components/memory/memory-list.tsx` | 记忆列表组件 |

#### 修改文件（13个）
| 文件 | 改动 |
|------|------|
| `src/lib/db/schema.sql` | +2 表 +3 索引 |
| `src/types/database.ts` | +2 接口 |
| `src/types/ai.ts` | 扩展 AgentContext/StreamEvent/Summary，+3 类型 |
| `src/types/api.ts` | +2 请求类型 |
| `src/lib/utils/api-client.ts` | +memoriesApi 命名空间 |
| `src/lib/ai/context-collector.ts` | 收集记忆到上下文 |
| `src/lib/ai/agent-prompt.ts` | 注入记忆到系统提示词 |
| `src/lib/ai/agent.ts` | 处理 memory 事件 |
| `src/lib/ai/stream-handler.ts` | 解析 memory JSON 块 |
| `src/app/(main)/settings/page.tsx` | +记忆 tab |
| `src/app/(main)/page.tsx` | 会话切换触发+记忆状态+指令处理 |
| `src/components/layout/sidebar.tsx` | +记忆徽标 |
| `src/components/chat/chat-area.tsx` | +memory 事件处理+上下文日志 |

### 最终验证

1. 启动应用，确认新表自动创建
2. 全局设置页 → 记忆 tab → 手动增删改
3. 项目设置 → 记忆 tab → 手动增删改、提升为全局
4. 与 Agent 对话 → 确认上下文思考链显示记忆计数
5. 对话中说"记住我喜欢简洁的 prompt" → 确认记忆被创建
6. 切换到新会话 → 确认侧边栏出现提取徽标
7. 回到 Agent 对话 → 确认 Agent 行为受记忆影响
8. `npm run build` 通过，无 TypeScript 错误
