# Changelog

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
