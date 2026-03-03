# Changelog

## v0.1.7 (2026-03-03)

### Bug 修复
- **PDF/DOCX 上传乱码**: 二进制文件（PDF/DOCX）之前被 `file.text()` 当作文本读取导致乱码。新建服务端 FormData 上传路由，使用 `pdf-parse` v2 和 `mammoth` 在服务端解析二进制文件后存入数据库
- **旧版 .doc 文件上传报错**: mammoth 不支持旧版二进制 .doc 格式，上传 .doc 文件报 "Can't find end of central directory" 错误。新增 `word-extractor` 库专门解析 .doc 格式，上传接口返回具体错误信息
- **DOC/DOCX 扩展名与实际格式不匹配**: 文件扩展名为 `.docx` 但实际内容为旧版 `.doc` 格式时解析失败。改用 magic bytes 检测实际文件格式（OLE2→word-extractor，ZIP→mammoth），不再仅依赖扩展名
- **上传对话框不接受 .doc 文件**: 文件选择器的 ACCEPTED_EXTENSIONS 和 MIME 类型缺少 `.doc`/`application/msword`，导致旧版 Word 文件无法选择上传
- **HTML 伪装 .doc 文件上传报错**: 部分 .doc 文件实际为 HTML 格式（Word "另存为网页"或网络下载），magic bytes 既非 OLE2 也非 ZIP，mammoth 和 word-extractor 均无法解析。新增 fallback：剥离 HTML 标签和解码常见实体后作为纯文本读取
- **侧边栏文件名过长**: 长文件名将"添加"按钮撑出可视区域。添加 `truncateText` 截断函数（10 字符 + ...），hover 时 title tooltip 显示完整名称
- **侧边栏文件名居中**: Prompt 和文档列表项文本未左对齐，添加 `text-left` class 修复

### 新功能
- **Agent 思考链日志**: Agent 响应前发送 `context` 事件，聊天界面展示可折叠的"Agent 思考链"面板，显示引用的 Prompt/文档、全局/项目业务信息、历史消息数

### 新增文件
- `src/lib/utils/parse-document.ts` — 服务端文件解析工具（PDF/DOCX/DOC/TXT/MD）
- `src/app/api/projects/[id]/documents/upload/route.ts` — FormData 文件上传 API 路由

### 修改文件
- `next.config.ts` — serverExternalPackages 添加 pdf-parse、mammoth、word-extractor
- `src/lib/utils/api-client.ts` — 新增 `documentsApi.upload` 方法
- `src/app/(main)/page.tsx` — handleUpload 改用 FormData 上传
- `src/components/layout/sidebar.tsx` — truncateText + text-left + title tooltip
- `src/types/ai.ts` — 新增 AgentContextSummary 接口和 context 事件类型
- `src/lib/ai/agent.ts` — 流式响应前 yield context 上下文摘要事件
- `src/components/chat/chat-area.tsx` — ContextLog 可折叠组件 + context 事件处理
- `src/components/knowledge/upload-dialog.tsx` — ACCEPTED_EXTENSIONS 和 MIME 类型添加 .doc 支持

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
