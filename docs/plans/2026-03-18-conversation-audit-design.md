# 历史会话知识库质检模块 设计文档

日期：2026-03-18

## 需求

1. 上传知识库附件，支持 `Word`、`HTML`、`Excel`
2. 上传历史对话 Excel，列结构固定为：
   - `Conversation ID`
   - `Message Sender`
   - `Message`
3. `Message Sender` 只区分 `user` 和 `bot`
4. 按 `Conversation ID` 聚合对话，并按轮次检查：
   - 以一条 `user` 消息作为问题
   - 其后直到下一条 `user` 之前的连续 `bot` 消息合并为本轮回答
5. 重点验证 `bot` 是否依据知识库正确回答用户问题
6. 每轮输出只保留两个结果字段：
   - `是否有问题`
   - `原知识库回答`
7. 评估调用直接使用全局模型配置，不单独配置本模块模型

## 范围

### 一期包含

- 独立的“会话质检”模块
- 知识库附件上传与解析
- 历史对话 Excel 上传与解析
- 按轮质检
- 结果查看与筛选
- 结果导出为 Excel

### 一期不包含

- 使用站内 `Session / Message` 作为评估输入
- 人工改判或批注协作
- 自动修复 bot 回复
- 与现有测试集模块互相复用 UI 流程
- 复杂向量库或 embedding 基础设施

## 决策

- 模块形态：独立模块，不挂到现有测试集下
- 评估粒度：按轮，不按整段会话
- 知识依据：先召回相关知识片段，再送模型判断
- 模型配置：直接读取 `global_settings`
- 输出字段：仅保留 `hasIssue` 和 `knowledgeAnswer`
- 检索策略：一期先做轻量文本召回，不引入新向量系统
- 导出格式：Excel，便于人工复核和继续筛选

## 为什么不复用现有测试模块

现有测试模块的输入是“Prompt + 测试用例”，数据模型围绕 `TestSuite / TestCase / TestRun` 设计；本需求的输入是“知识库附件 + 外部历史对话 Excel”，评估对象也从 prompt 输出变成历史 bot 回复。两者虽然都需要 LLM 评估，但工作流、数据结构、页面入口和结果形态都不同，强行复用会让模型和页面都变得别扭。

## 架构

```
会话质检模块
├── 上传区
│   ├── 知识库附件: Word / HTML / Excel
│   └── 历史对话 Excel
├── 解析层
│   ├── 统一文档解析为纯文本块
│   ├── 历史对话表格解析为消息行
│   └── 按 Conversation ID 聚合
├── 切轮层
│   └── user 问题 + 后续 bot 回复 => 一轮
├── 检索评估层
│   ├── user 问题召回知识片段
│   └── LLM 输出是否有问题 + 原知识库回答
└── 结果层
    ├── 按轮展示
    ├── 过滤“仅看有问题”
    └── 导出 Excel
```

## 用户流程

1. 进入“会话质检”模块
2. 上传若干知识库文件
3. 上传历史对话 Excel
4. 系统先完成解析校验并展示摘要：
   - 知识库成功解析文件数
   - 历史对话会话数
   - 切分出的总轮数
   - 解析失败文件或异常行
5. 用户点击“开始检查”
6. 后台逐轮执行召回与评估
7. 页面显示结果列表，默认优先展示有问题的轮次
8. 用户可筛选、查看详情、导出 Excel

## 解析设计

### 知识库附件

- `doc/docx`：沿用现有 Word 解析能力
- `html`：
  - 去除 `script/style`
  - 提取可见文本
  - 压缩空白行
- `xls/xlsx`：
  - 逐 sheet 读取
  - 每行转成可读文本
  - 保留 sheet 名和列名，便于后续引用

### 历史对话 Excel

严格读取三列：

- `Conversation ID`
- `Message Sender`
- `Message`

校验规则：

- 缺列直接报错
- `Message Sender` 非 `user/bot` 的行记为异常行
- 空 `Conversation ID` 或空 `Message` 的行记为异常行
- 异常行不进入正式评估，但会在解析摘要中展示

## 切轮规则

对每个 `Conversation ID` 的消息顺序遍历：

1. 遇到 `user`：
   - 结束上一轮
   - 开启新一轮，记录 `userMessage`
2. 遇到 `bot`：
   - 若当前轮存在，追加到当前轮 `botReplyParts`
   - 若当前轮不存在，忽略并记为孤立 bot 行
3. 会话结束：
   - 若当前轮存在，则收尾生成最后一轮

边界处理：

- 连续多个 `user`，中间无 `bot`：保留该轮，`botReply` 为空
- 多条连续 `bot`：合并为一个回答
- 会话以 `bot` 开头：不生成轮次，但记入异常统计

## 检索与评估设计

### 知识切片

知识库解析后统一拆成可检索文本块：

- Word / HTML：按段落切块
- Excel：按 sheet 和行切块
- 每块附带来源信息：
  - 文件名
  - sheet 名（如有）
  - 行号或段落序号

### 一期召回策略

一期不引入 embedding。采用轻量召回：

- 对 `userMessage` 做基础归一化
- 基于关键词命中、词项重叠和文本长度做打分
- 取前若干条知识块作为模型输入

这样可以尽快落地，而且便于后续替换成向量召回而不改页面和数据结构。

### 模型评估输入

每轮传给模型的内容包括：

- 当前轮 `userMessage`
- 当前轮合并后的 `botReply`
- 召回到的知识片段

系统 prompt 要求模型：

- 只能依据提供的知识片段判断
- 如果知识不足以支持判断，不要强行判错
- 返回固定 JSON：

```json
{
  "hasIssue": true,
  "knowledgeAnswer": "根据知识库应回答的内容"
}
```

### 结果解释

- `hasIssue = false`：bot 回答与知识库一致，或至少没有发现明确冲突
- `hasIssue = true`：bot 回答错误、遗漏关键信息，或明显偏离知识库
- `knowledgeAnswer`：给出基于召回知识整理出的正确知识库回答

## 数据模型

建议新增独立表：

### `conversation_audit_jobs`

- 一次完整质检任务
- 字段：
  - `id`
  - `project_id`
  - `name`
  - `status` (`draft/running/completed/failed`)
  - `knowledge_file_names_json`
  - `history_file_name`
  - `total_conversations`
  - `total_turns`
  - `issue_turns`
  - `error_summary`
  - `created_at`
  - `updated_at`

### `conversation_audit_knowledge_chunks`

- 本次任务解析后的知识块
- 字段：
  - `id`
  - `job_id`
  - `source_name`
  - `source_type`
  - `sheet_name`
  - `chunk_index`
  - `content`

### `conversation_audit_conversations`

- 按 `Conversation ID` 聚合后的会话
- 字段：
  - `id`
  - `job_id`
  - `conversation_key`
  - `message_count`
  - `turn_count`

### `conversation_audit_turns`

- 每轮质检结果
- 字段：
  - `id`
  - `job_id`
  - `conversation_id`
  - `turn_index`
  - `user_message`
  - `bot_reply`
  - `has_issue`
  - `knowledge_answer`
  - `retrieved_sources_json`

## 页面设计

建议在左侧导航新增独立分组“会话质检”。

### 列表区

- 展示当前项目下所有质检任务
- 每行展示：
  - 任务名
  - 状态
  - 会话数
  - 轮次数
  - 问题轮次数

### 详情区

- 顶部：任务摘要与操作
- 中部：解析摘要
- 下部：轮次结果列表

每条轮次结果展示：

- `Conversation ID`
- 轮次序号
- `user` 问题
- `bot` 回答
- 是否有问题
- 原知识库回答

支持：

- 仅看有问题
- 按 `Conversation ID` 搜索
- 导出结果 Excel

## API 设计

### `POST /api/projects/[id]/conversation-audit-jobs`

创建任务并上传附件。

输入：

- `name`
- `knowledgeFiles[]`
- `historyFile`

输出：

- 任务基础信息
- 解析摘要

### `GET /api/projects/[id]/conversation-audit-jobs`

获取任务列表。

### `GET /api/conversation-audit-jobs/[id]`

获取任务详情和轮次结果。

### `POST /api/conversation-audit-jobs/[id]/run`

启动质检执行。

### `GET /api/conversation-audit-jobs/[id]/export`

导出结果 Excel。

## 风险与控制

- Excel 格式不稳定：
  - 通过固定列名校验和异常行统计控制
- 知识库过大：
  - 先切块再轻量召回，避免整库送模
- 模型幻觉：
  - 只允许依据召回知识输出
  - 找不到依据时允许“不足以判断”
- HTML 内容噪音大：
  - 先去除 `script/style`，压缩无意义空白

## 后续扩展位

- 将轻量召回替换为 embedding / 向量检索
- 支持站内会话直接发起质检
- 支持人工改判与二次标注
- 支持更细的错误类型分类
