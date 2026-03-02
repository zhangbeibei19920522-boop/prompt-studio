# Changelog

## v0.1.6 (2026-03-02)

### Bug 修复
- **右侧面板文本不换行**: Diff 卡片、预览卡片、Prompt 预览面板均添加 `break-words whitespace-pre-wrap`，长文本自动换行不再溢出；按钮区域添加 `flex-wrap` 防止按钮被截断
- **右侧面板内容溢出**: 面板内容容器添加 `min-w-0 overflow-hidden`，阻止子元素撑开父容器
- **GPT-5/o 系列模型 400 错误**: 新模型不支持 `max_tokens` 参数，自动检测模型名称切换为 `max_completion_tokens`

### 新功能
- **Prompt 删除**: Prompt 预览面板新增"删除"按钮，带确认弹窗，删除后自动关闭面板并刷新列表
- **侧边栏快捷删除**: Prompt 和知识库列表项 hover 时显示 X 删除按钮，可快速删除

### 改进
- **Agent 思考链精细化**: 系统提示词重构为四阶段流程——需求挖掘→知识库深度利用→方案对齐→精细化产出。Agent 不再一步到位产出 prompt，而是先理解场景、提取知识库要素、与用户确认方案后再精细化写作

### 修改文件
- `src/components/chat/diff-card.tsx` — 添加文本换行样式
- `src/components/chat/preview-card.tsx` — 按钮区域 flex-wrap
- `src/components/prompt/prompt-preview.tsx` — 文本换行 + 删除按钮 + 确认弹窗
- `src/components/layout/right-panel.tsx` — 内容容器 min-w-0 overflow-hidden
- `src/components/layout/sidebar.tsx` — Prompt/知识库列表项添加 hover 删除按钮
- `src/lib/ai/agent-prompt.ts` — 系统提示词四阶段重构
- `src/lib/ai/openai-compatible.ts` — 兼容 max_completion_tokens 参数
- `src/app/(main)/page.tsx` — 新增 handleDeletePrompt/handleDeleteDocument + 串联

## v0.1.5 (2026-03-02)

### Bug 修复
- **右侧面板宽度不足**: 面板宽度从 400px 调整为 560px，Prompt 内容不再被截断，滚动功能保持正常
- **应用修改 404 错误**: Agent 输出的 promptId 为标题而非 UUID，客户端和服务端均增加按标题回退查找逻辑
- **对话上下文丢失**: 后续消息丢失之前引用的 Prompt 和知识库内容，改为从会话历史中收集并去重所有引用
- **修改已有 Prompt 错误新建**: Agent 引用已有 Prompt 时错误使用 preview（新建）格式，强化系统提示词要求使用 diff（修改）格式

### 新功能
- **空状态开始对话按钮**: 无会话时在对话区域中心显示可点击的"开始对话"按钮
- **对话卡片复制按钮**: PreviewCard 和 DiffCard 均新增"复制内容"按钮
- **对话卡片版本记录**: DiffCard 新增"版本记录"按钮，可直接查看被修改 Prompt 的历史版本

### 改进
- Agent 系统提示词大幅增强：明确知识库文档必须深度阅读、diff 必须使用实际 ID、引用 Prompt 修改必须用 diff 格式
- 新增 `findPromptByTitle` 数据库查询方法，作为 promptId 解析的回退机制

### 修改文件
- `src/components/layout/right-panel.tsx` — 面板宽度调整
- `src/app/api/ai/apply/route.ts` — promptId 回退查找
- `src/lib/db/repositories/prompts.ts` — 新增 findPromptByTitle
- `src/lib/ai/context-collector.ts` — 历史引用收集
- `src/lib/ai/agent-prompt.ts` — 系统提示词增强
- `src/components/chat/chat-area.tsx` — 空状态按钮 + onViewHistory/onNewSession
- `src/components/chat/preview-card.tsx` — 复制按钮
- `src/components/chat/diff-card.tsx` — 复制 + 版本记录按钮
- `src/components/chat/message-bubble.tsx` — 传递 onViewHistory
- `src/app/(main)/page.tsx` — promptId 回退 + onViewHistory/onNewSession 串联

## v0.1.4 (2026-03-01)

### Bug 修复
- **右侧面板无法滚动 (回归)**: ScrollArea 在 flex 布局中添加 `overflow-hidden` 约束高度
- **对话区域无法向上滚动**: 同上修复，聊天历史过长时可正常滚动
- **Agent 返回原始 JSON**: 改进系统提示词，要求先用自然语言解释再附 JSON；增加裸 JSON 兜底解析
- **Agent 无法识别引用内容**: 系统提示词明确区分 Prompt 引用和知识库文档引用的用途
- **操作按钮无响应**: MessageBubble 未传递回调给 PreviewCard/DiffCard，补齐完整回调链路
- **AI API 连接超时**: 新增 proxy-fetch 模块，支持 HTTP_PROXY 代理连接 OpenAI 等国外 API

### 改进
- Agent 助手消息保存时去除 JSON 块，只保留自然语言部分
- 保存的消息内容更干净，不再显示原始 JSON

## v0.1.3 (2026-03-01)

### 新功能
- **引用选择器**: 用 Popover+Command 下拉选择器替换 @ 引用机制，输入框左侧新增 Prompt 和知识库按钮，支持搜索和多选
- **Prompt 文件导入**: PromptEditor 新增"从文件导入"按钮，支持 .txt/.md 文件导入内容和标题
- **Prompt 批量导入**: 侧边栏 Prompt 分组新增上传按钮，支持批量导入 .txt/.md 文件为 Prompt

### 改进
- 侧边栏 CollapsibleGroup 支持多个操作按钮
- 空对话状态提示文案更新

### 移除
- 移除 MentionPopover 组件和 @ 触发逻辑

### 修改文件
- 新增 `src/components/chat/reference-selector.tsx`
- 新增 `src/components/prompt/batch-upload-dialog.tsx`
- 修改 `src/components/chat/chat-input.tsx`
- 修改 `src/components/chat/chat-area.tsx`
- 修改 `src/components/prompt/prompt-editor.tsx`
- 修改 `src/components/layout/sidebar.tsx`
- 修改 `src/app/(main)/page.tsx`

## v0.1.2 (2026-03-01)

### Bug 修复
- 创建 Prompt 500 错误 — 补充 status: 'draft'
- 右侧面板无法滚动 — ScrollArea 添加 overflow-hidden
- @ 引用残留字符 — preventDefault 阻止 @ 写入输入框

## v0.1.1 (2026-03-01)

### Bug 修复
- 侧边栏缺少创建入口 — 增加 "+" 按钮
- Stream error: fetch failed — 新增代理 fetch 支持
- 空对话状态体验差 — 增加空状态 UI
- CLI 生产模式启动失败 — standalone 模式修复

## v0.1.0 (2026-02-28)

- 初始版本发布
