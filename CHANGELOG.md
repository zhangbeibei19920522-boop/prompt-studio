# Changelog

## v0.1.24 (2026-03-18)

### 新功能
- **会话质检模块**: 新增项目级“会话质检”入口，支持上传知识库文件（Word / HTML / Excel）和历史对话 Excel，按 `Conversation ID` 聚合并切分为逐轮 `user -> bot` 问答，基于知识库召回结果和全局模型配置逐轮评估 bot 回答是否有问题，并输出“是否有问题 / 原知识库回答”
- **历史对话离线评估工作流**: 支持创建质检任务、查看解析摘要、SSE 流式运行进度、筛选“仅看有问题”轮次，以及导出 Excel 结果
- **知识库扩展解析**: 文档解析新增 `HTML` 正文抽取和 `Excel/CSV` 工作簿文本化能力，为会话质检和后续检索复用

### 改进
- **会话质检上传体验优化**: 新建任务页的“历史对话 Excel”和“知识库文件”入口改为更明显的拖拽上传区；知识库支持一次混合上传 `Word / HTML / Excel`，历史对话入口明确限制为 `xls/xlsx`

### 新增文件
- `src/lib/audit/history-parser.ts` — 历史对话 Excel 解析与逐轮切分
- `src/lib/audit/knowledge-chunker.ts` — 知识库文本切块
- `src/lib/audit/retriever.ts` — 轻量知识召回
- `src/lib/audit/evaluator.ts` — 逐轮质检评估器
- `src/lib/audit/runner.ts` — 质检任务执行器
- `src/lib/db/repositories/conversation-audit-*.ts` — 会话质检任务、知识块、会话、轮次仓储
- `src/app/api/projects/[id]/conversation-audit-jobs/route.ts` — 质检任务创建/列表 API
- `src/app/api/conversation-audit-jobs/[id]/route.ts` — 质检任务详情 API
- `src/app/api/conversation-audit-jobs/[id]/run/route.ts` — 质检运行 SSE API
- `src/app/api/conversation-audit-jobs/[id]/export/route.ts` — 质检结果导出 API
- `src/components/audit/conversation-audit-detail.tsx` — 会话质检主界面
- `src/components/audit/__tests__/conversation-audit-detail.test.tsx` — 会话质检创建页上传区测试
- `src/lib/utils/parse-html.ts` — HTML 正文抽取工具
- `src/lib/utils/parse-workbook.ts` — Excel/CSV 工作簿解析工具

### 修改文件
- `src/lib/db/schema.sql` — 新增 conversation audit 相关表和索引
- `src/types/database.ts` — 新增会话质检数据结构
- `src/types/api.ts` — 新增会话质检请求/响应类型
- `src/types/ai.ts` — 新增 `ConversationAuditRunEvent`
- `src/lib/utils/parse-document.ts` — 接入 HTML / Excel / CSV 解析分流
- `src/lib/utils/api-client.ts` — 新增 `conversationAuditJobsApi`
- `src/lib/utils/sse-client.ts` — 新增 `streamConversationAuditRun`
- `src/components/layout/sidebar.tsx` — 新增“会话质检”分组入口
- `src/app/(main)/page.tsx` — 新增会话质检模块状态与视图切换
- `src/components/audit/conversation-audit-detail.tsx` — 创建页上传入口改为拖拽卡片，知识库接收格式收敛为 `Word / HTML / Excel`
- `package.json` — 新增 `vitest`、`xlsx` 依赖和测试脚本
- `vitest.config.ts` / `src/test/setup.ts` — 新增测试基础设施

## v0.1.22 (2026-03-10)

### Bug 修复
- **右侧面板长文本溢出**: Prompt 预览/编辑面板中长文本撑破容器导致按钮消失。根因是 Radix ScrollArea Viewport 内部 `display: table` div 不受宽度约束，强制改为 `block` 布局 + `min-w-0`；同时预览/编辑组件去掉嵌套滚动容器

### 修改文件
- `src/components/ui/scroll-area.tsx` — Viewport 内部 div 强制 `block` + `min-w-0`
- `src/components/layout/right-panel.tsx` — 内容容器加 `max-w-full`
- `src/components/prompt/prompt-preview.tsx` — 去掉 `h-full overflow-auto`，加 `min-w-0 w-full`
- `src/components/prompt/prompt-editor.tsx` — 同上
- `package.json` — 版本号 0.1.21 → 0.1.22

## v0.1.21 (2026-03-10)

### 新功能
- **测试记录导出 PDF**: 测试运行结果支持一键导出为 PDF 报告（html2canvas + jsPDF 浏览器端生成），包含评分概览、逐条用例结果、整体评估报告，支持中文，自动分页，JPEG 压缩输出控制文件大小
- **历史测试记录查看**: 测试集详情页新增"历史记录" Tab，可查看该测试集所有历史运行记录列表，点击查看详情或直接导出 PDF

### 新增文件
- `src/lib/utils/pdf-export.ts` — PDF 导出核心工具函数
- `src/components/test/test-run-history.tsx` — 历史测试记录组件（列表+详情双视图）

### 修改文件
- `src/components/test/test-suite-detail.tsx` — 新增 Tabs 布局（测试结果 / 历史记录），当前结果 Tab 增加"导出 PDF"按钮
- `package.json` — 版本号 0.1.20 → 0.1.21，新增 html2canvas、jspdf 依赖

## v0.1.20 (2026-03-06)

### 新功能
- **会话删除**: 侧边栏会话列表项 hover 时显示 X 删除按钮，点击删除会话及其聊天记录（不影响已创建的 Prompt 和测试集）
- **会话标题自动总结**: 新会话首次对话完成后，自动调用 LLM 生成简短标题（≤15 字）替换默认的"新对话"，侧边栏实时更新

### 修改文件
- `src/types/ai.ts` — StreamEvent 新增 `session-title` 事件类型
- `src/lib/ai/agent.ts` — 新增 `generateSessionTitle` 函数，`handleAgentChat` 和 `handleTestAgentChat` 完成后自动生成标题并 yield 事件
- `src/components/chat/chat-area.tsx` — 新增 `onSessionTitleUpdate` prop，处理 `session-title` 事件
- `src/components/layout/sidebar.tsx` — 会话列表项新增 `onDeleteSession` prop 和 hover 删除按钮
- `src/app/(main)/page.tsx` — 新增 `handleDeleteSession` 处理函数，接收标题更新回调更新 sessions 状态
- `package.json` — 版本号 0.1.19 → 0.1.20

## v0.1.19 (2026-03-06)

### 改进
- **测试 Agent 思考链稳定显示**: 思考链（Agent 上下文摘要）每次都会出现，即使无引用内容也显示"已就绪"兜底信息
- **测试 Agent 提示词优化**: 禁止询问输出格式（JSON/CSV 等无关问题），限制提问最多一轮，用户回复后必须立即生成测试用例，禁止反复确认"是否开始"等过度思考行为

### 修改文件
- `src/components/chat/chat-area.tsx` — ContextLog 在 items 为空时显示兜底文案，不再隐藏
- `src/lib/ai/test-agent-prompt.ts` — 系统提示词新增硬性禁令（禁问格式、限一轮提问、禁反复确认），保留第一阶段澄清能力

## v0.1.18 (2026-03-06)

### Bug 修复
- **创建测试集后未稳定跳转到测试集页面**: `handleConfirmTestSuite` 中 `setTestSuites` 和 `handleTestSuiteClick` 内的状态更新被拆分到不同微任务，React 无法在同一批次处理，导致 `currentSuite` 为 null 时回退显示聊天界面。修复为先 `Promise.all` 一次性获取所有数据，再在同一同步代码块中设置全部状态

### 修改文件
- `src/app/(main)/page.tsx` — handleConfirmTestSuite 改为 Promise.all 获取数据后同步批量设置状态，不再调用 handleTestSuiteClick

## v0.1.17 (2026-03-05)

### 改进
- **测试 Agent 支持多轮对话用例生成**: 在测试 Agent 提示词中增加多轮对话格式说明和示例，引导大模型对对话类 Prompt（客服、咨询、教学等）自动生成 `User:/Assistant:` 格式的多轮测试用例，与测试 Runner 的多轮执行能力对齐

### Bug 修复
- **上传 .doc 文件报错**: 安装缺失的 word-extractor 依赖，修复上传老版 Word 文档时 `Module not found: Can't resolve 'word-extractor'` 错误

### 修改文件
- `src/lib/ai/test-agent-prompt.ts` — 系统提示词新增「多轮对话测试用例」章节，包含格式规则、判断标准和 JSON 示例
- `package.json` — 版本号 0.1.16 → 0.1.17
- `package-lock.json` — 安装 word-extractor 依赖

## v0.1.16 (2026-03-05)

### 改进
- **长 Prompt 截断自动续写**: max_tokens 默认值从 4096 提高到 16384，减少截断概率。当输出仍被截断时（检测到未闭合的 ```json 块），自动发起续写请求拼接完整内容（最多 3 次），前端显示"正在续写"进度提示

### 修改文件
- `src/lib/ai/openai-compatible.ts` — max_tokens 默认值 4096 → 16384
- `src/lib/ai/anthropic.ts` — max_tokens 默认值 4096 → 16384
- `src/lib/ai/stream-handler.ts` — 新增 detectTruncatedJson 截断检测函数
- `src/lib/ai/agent.ts` — handleAgentChat 流结束后自动续写循环
- `src/types/ai.ts` — StreamEvent 新增 continuation 类型
- `src/components/chat/chat-area.tsx` — 续写进度提示 UI

## v0.1.15 (2026-03-05)

### 改进
- **测试 Agent 不再询问输出格式**: 移除规划阶段，简化为两阶段（快速理解需求→分批生成）。Agent 交付物明确为平台内测试用例界面，禁止询问 JSON/CSV 等格式问题。用户引用 Prompt 并说明需求后直接生成测试用例

### Bug 修复
- **批量创建测试用例 SQLite 绑定错误**: `createTestCasesBatch` 中 `title`/`input`/`expectedOutput` 为 `undefined` 时 SQLite 报 `TypeError: can only bind numbers, strings, bigints, buffers, and null`。添加 `?? ''` 兜底

### 修改文件
- `src/lib/ai/test-agent-prompt.ts` — 系统提示词简化为两阶段，新增交付物声明和格式禁问规则
- `src/lib/db/repositories/test-cases.ts` — `createTestCasesBatch` 所有字段添加 `?? ''` 防御

## v0.1.14 (2026-03-05)

### 改进
- **多轮对话测试执行**: 测试用例输入包含 `User: / Assistant:` 多轮对话格式时，执行器逐轮独立调用 LLM，每个空 Assistant 槽位单独生成回复，actualOutput 存储完整交替对话
- **对话记录结构化展示**: 测试用例展开后，对话记录按轮次拆分，每轮用「用户」（蓝色）/「助手」（绿色）标签 + 分隔线清晰区分；单轮对话自动适配为用户→助手两段；期望输出独立展示

### 修改文件
- `src/lib/ai/test-runner.ts` — 新增 parseConversationTurns 多轮检测，多轮模式逐轮调用 LLM，单轮保持不变
- `src/components/test/test-suite-detail.tsx` — 新增 parseConversationOutput 解析函数，对话记录改为角色标签+分隔线结构化布局

## v0.1.13 (2026-03-05)

### 改进
- **测试报告对话式展示**: 测试用例展开后，输入和实际输出合并为「对话记录」卡片，用「用户」「助手」标签区分，呈现完整对话。未运行时仍显示原有输入/期望输出分栏

### 修改文件
- `src/components/test/test-suite-detail.tsx` — 有测试结果时用对话式布局替换独立输入/实际输出框

## v0.1.12 (2026-03-05)

### Bug 修复
- **少量测试用例创建后不跳转**: 确认创建测试集后未自动跳转到测试集详情页。原因是 refreshTestSuites 为异步 fire-and-forget，导致 testSuites 状态未更新时即触发导航，currentSuite 为 null。修复为 await 刷新完成后再导航
- **测试 Agent 跳过规划步骤**: 无论测试用例数量多少，Agent 均跳过第二阶段（规划）直接生成用例。原因是 handleTestAgentChat 中若 LLM 同时输出 plan 和 test-suite-batch，仅处理 batch 而忽略 plan。修复为 plan 块优先处理，存在 plan 时不处理 batch，强制分轮执行

### 修改文件
- `src/app/(main)/page.tsx` — handleConfirmTestSuite 改为 await 刷新 testSuites 后再导航
- `src/lib/ai/agent.ts` — handleTestAgentChat plan 块优先处理，plan 和 batch 不在同一轮处理
- `src/lib/ai/test-agent-prompt.ts` — 系统提示词强制三阶段分轮执行，规划和生成不得在同一轮输出

## v0.1.11 (2026-03-04)

### 改进
- **测试用例分批生成**: 测试集生成时 LLM 输出长度容易被截断，改为分批生成。每次最多生成 3 个用例，自动循环调用 LLM 续生成，每次携带引用的 Prompt、知识库文档和用户要求。全部生成完毕后合并为完整测试集供用户确认。前端显示生成进度条

### 修改文件
- `src/types/ai.ts` — 新增 TestSuiteBatchData、TestSuiteProgressData 类型，StreamEvent 增加 test-suite-progress 事件
- `src/lib/ai/stream-handler.ts` — parseAgentOutput 支持解析 test-suite-batch JSON 块
- `src/lib/ai/test-agent-prompt.ts` — 系统提示词改为分批生成（max 3），新增 buildBatchContinuationMessages 续生成函数
- `src/lib/ai/agent.ts` — handleTestAgentChat 新增批次循环逻辑，检测 test-suite-batch → 循环调用 LLM → 合并为 test-suite 事件
- `src/components/chat/chat-area.tsx` — 处理 test-suite-progress 事件，显示进度条和生成计数

## v0.1.10 (2026-03-04)

### Bug 修复
- **测试 Agent 不识别引用内容**: 测试对话中引用 Prompt 和知识库文档后 Agent 无法识别。原因是测试 Agent 从 UI 到提示词全链路均未传递引用。修复后测试 Agent 可基于引用的 Prompt 内容设计针对性测试用例，基于知识库文档设计符合业务场景的测试用例

### 修改文件
- `src/lib/utils/sse-client.ts` — streamTestChat 接受并发送 references 参数
- `src/app/api/ai/test-chat/route.ts` — 提取 references 并传递给 handler
- `src/lib/ai/agent.ts` — handleTestAgentChat 接受 references，调用 collectAgentContext 收集上下文，yield context 思考链事件
- `src/lib/ai/test-agent-prompt.ts` — buildTestAgentMessages 改用 AgentContext，注入引用的 Prompt/文档/项目业务信息到系统提示词
- `src/components/chat/chat-area.tsx` — 测试对话传递 references 给 streamTestChat

## v0.1.9 (2026-03-04)

### 新功能
- **自动化测试**: 为项目中的 Prompt 创建自动化测试集，逐条运行测试用例，由 LLM 评估结果并生成测试报告
  - 对话式创建：通过对话与测试 Agent 交互，描述测试需求后自动生成测试用例及预期结果
  - 逐条执行：每个测试用例独立调用 LLM，使用测试集配置的 model/key
  - 混合评估：逐条判断通过/不通过（全局 model），再整体评估改进建议
  - 测试集级别 model 配置：运行用测试集配置，评估用全局配置
  - 实时进度：SSE 流式推送执行和评估进度
  - 测试报告：展示总分、通过率、每条用例详情、Prompt 改进建议
  - 侧边栏入口：与会话、Prompt、知识库平级的独立模块
  - 测试用例管理：创建后可编辑/新增/删除用例，确认后方可运行

### 新增文件
- `src/lib/db/repositories/test-suites.ts` — 测试集 CRUD
- `src/lib/db/repositories/test-cases.ts` — 测试用例 CRUD（含批量创建）
- `src/lib/db/repositories/test-runs.ts` — 测试运行记录 CRUD
- `src/lib/ai/test-runner.ts` — 测试执行引擎（逐条调用 LLM + SSE 事件）
- `src/lib/ai/test-evaluator.ts` — 测试评估引擎（逐条评分 + 整体报告）
- `src/lib/ai/test-agent-prompt.ts` — 测试集创建专用 Agent 提示词
- `src/app/api/projects/[id]/test-suites/route.ts` — 项目测试集 API
- `src/app/api/test-suites/[id]/route.ts` — 测试集详情 API
- `src/app/api/test-suites/[id]/cases/route.ts` — 测试用例 API（含批量）
- `src/app/api/test-suites/[id]/run/route.ts` — 运行测试 SSE API
- `src/app/api/test-suites/[id]/runs/route.ts` — 运行历史 API
- `src/app/api/test-cases/[id]/route.ts` — 测试用例详情 API
- `src/app/api/test-runs/[id]/route.ts` — 运行详情 API
- `src/app/api/ai/test-chat/route.ts` — 测试对话 SSE API
- `src/components/test/test-suite-detail.tsx` — 测试集详情页（用例列表 + 运行 + 报告）
- `src/components/test/test-case-editor.tsx` — 测试用例编辑器
- `src/components/test/test-run-config.tsx` — 运行配置弹窗（选择 Prompt + model/key）
- `src/components/test/test-report.tsx` — 测试报告展示
- `src/components/test/test-suite-card.tsx` — 对话中的测试集预览卡片
- `src/components/test/test-suite-list.tsx` — 测试集列表组件
- `src/types/word-extractor.d.ts` — word-extractor 类型声明（修复已知 build 警告）

### 修改文件
- `src/lib/db/schema.sql` — 新增 test_suites + test_cases + test_runs 表 + 3 索引
- `src/types/database.ts` — 新增 TestSuite/TestCase/TestRun/TestCaseResult/TestReport/TestSuiteConfig 接口
- `src/types/api.ts` — 新增测试相关请求类型
- `src/types/ai.ts` — 新增 TestRunEvent/TestSuiteGenerationData 类型，StreamEvent 增加 test-suite 事件
- `src/lib/ai/agent.ts` — 新增 handleTestAgentChat 测试 Agent 入口
- `src/lib/ai/stream-handler.ts` — parseAgentOutput 支持 test-suite 类型
- `src/lib/utils/api-client.ts` — 新增 testSuitesApi/testCasesApi/testRunsApi
- `src/lib/utils/sse-client.ts` — 新增 streamTestChat/streamTestRun
- `src/components/layout/sidebar.tsx` — 新增测试集分组（CollapsibleGroup）
- `src/components/chat/chat-area.tsx` — 支持 test-suite 事件 + TestSuiteCard 渲染 + testMode 路由
- `src/app/(main)/page.tsx` — 测试状态管理 + 视图切换 + 测试集操作 handler

## v0.1.8 (2026-03-04)

### 新功能
- **记忆系统**: Agent 可跨会话记住用户偏好和业务知识，生成更贴合需求的 prompt
  - 两层结构：全局记忆 + 项目记忆，项目记忆优先级高于全局
  - 混合模式：Agent 自动提取 + 用户手动管理
  - 自动提取：切换/新建会话时后台增量提取，单次 LLM 调用完成提取+去重
  - 对话指令：支持"记住 XXX"、"忘掉 XXX"、"我的记忆有哪些"等自然语言指令
  - 管理 UI：全局设置和项目设置各新增"记忆" tab，支持增删改查、筛选、提升为全局
  - 上下文注入：Agent 系统提示词自动注入记忆，思考链日志显示记忆计数
  - 侧边栏通知：提取完成后项目设置按钮旁显示"+N 记忆"徽标
  - 各层上限 50 条，超限先合并再淘汰

### 新增文件
- `src/lib/db/repositories/memories.ts` — 记忆 CRUD + promoteToGlobal
- `src/lib/db/repositories/extraction-progress.ts` — 提取进度追踪
- `src/lib/ai/memory-extraction.ts` — LLM 记忆提取服务
- `src/app/api/memories/route.ts` — 全局记忆 API（GET + POST）
- `src/app/api/memories/[id]/route.ts` — 单条记忆 API（GET + PUT + DELETE）
- `src/app/api/projects/[id]/memories/route.ts` — 项目记忆 API（GET + POST）
- `src/app/api/ai/extract-memories/route.ts` — 提取触发 API
- `src/components/memory/memory-list.tsx` — 记忆列表组件（分类分组、筛选、增删改）

### 修改文件
- `src/lib/db/schema.sql` — 新增 memories 表 + session_extraction_progress 表 + 3 索引
- `src/types/database.ts` — 新增 Memory、SessionExtractionProgress 接口
- `src/types/ai.ts` — AgentContext 增加记忆字段、StreamEvent 增加 memory 事件、新增提取/指令类型
- `src/types/api.ts` — 新增 CreateMemoryRequest、UpdateMemoryRequest
- `src/lib/utils/api-client.ts` — 新增 memoriesApi 命名空间
- `src/lib/ai/context-collector.ts` — 从数据库加载全局/项目记忆
- `src/lib/ai/agent-prompt.ts` — 系统提示词注入记忆系统章节 + 上下文注入记忆块
- `src/lib/ai/agent.ts` — 处理 memory 类型 JSON 块（create/delete/list）
- `src/lib/ai/stream-handler.ts` — 解析 memory JSON 块
- `src/app/(main)/settings/page.tsx` — Tabs 包裹 + 新增记忆 tab
- `src/app/(main)/page.tsx` — 会话切换触发提取 + 记忆状态 + 指令回调 + 徽标
- `src/components/layout/sidebar.tsx` — 新增记忆徽标通知
- `src/components/chat/chat-area.tsx` — memory 事件处理 + 思考链记忆计数
- `src/components/project/project-settings.tsx` — Tabs 包裹 + 新增记忆 tab

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
