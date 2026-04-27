# 知识库 R 节点产品化需求文档

## 1. 目标

把项目内的知识库能力补成自动化测试可使用的 RAG 节点。

当前自动化测试已经支持多 Prompt 路由：入口 Prompt 输出 intent，系统根据 intent 命中对应 Prompt。接下来需要新增一个默认存在的 `R` 节点，用于在测试运行时从指定知识库索引版本中检索内容，并基于检索结果生成回复。

本需求以 `qa_verify` 的完整 RAG 链路为参考，但不能把 `qa_verify` 里 OPPO 业务硬编码直接产品化。产品实现需要拆成通用 RAG Core 和可配置 Domain Profile。

第一版重点是：

- 保证 R 节点运行逻辑和 `qa_verify` 的 parent 级 RAG 流程一致。
- 建立可复现的知识内容版本和索引版本。
- 支持 metadata 的生成、维护和索引使用。
- 让自动化测试可以绑定某个知识库索引版本运行。

## 2. 背景与现状

### 2.1 现有知识库

当前项目知识库主要是文档库能力：

- 文档属于项目。
- 上传后服务端解析为纯文本。
- 文档内容存入 `documents` 表。
- 聊天 Agent 可以通过引用文档，把全文放进上下文。

当前缺少：

- 知识库资产概念。
- 清洗后的 parent/chunk 知识结构。
- 知识内容版本。
- 索引版本。
- metadata 维护能力。
- 自动化测试运行时的知识检索链路。

### 2.2 现有自动化测试

自动化测试已经有两种运行模式：

- `single`：测试单个 Prompt。
- `routing`：先执行入口 Prompt，再根据 intent 路由到目标 Prompt。

当前 routing 配置结构：

```json
{
  "entryPromptId": "prompt-a",
  "routes": [
    { "intent": "A", "promptId": "prompt-b" },
    { "intent": "B", "promptId": "prompt-c" }
  ]
}
```

`G` 是现有特殊 intent：

- 入口 Prompt 返回 `G` 时，不把 `G` 当作一条独立路由。
- 系统复用上一轮已经成功命中的 intent。
- 例如上一轮命中 `A`，下一轮返回 `G`，则继续走 `A` 对应的 Prompt。

### 2.3 `qa_verify` 可复用能力

`qa_verify` 里已经有一条完整的本地 RAG 验证链路：

```text
ingest -> recall -> rerank -> answer -> judge
```

产品第一版需要复用或等价实现其中这些核心逻辑：

- 读取 `parents/chunks`。
- 校验 parent 和 chunk 快照。
- 基于 snapshot hash 和 embedding 配置构建或复用索引。
- query embedding。
- vector recall。
- exact alias / signature / normalized question 匹配。
- metadata prefilter。
- parent 聚合。
- rerank。
- extractive-first answer。
- 必要时 LLM fallback。

`judge` 属于评测能力，第一版仍优先使用现有自动化测试报告，不单独产品化 `qa_verify` 的 judge。

## 3. 范围

### 3.1 第一版要做

- 项目内默认知识库。
- 文档库到知识版本的生成入口。
- `KnowledgeParent` 和 `KnowledgeChunk` 数据模型。
- `KnowledgeVersion` 和 `KnowledgeIndexVersion` 分离。
- metadata 的生成、编辑、批量编辑、重跑、锁定和来源记录。
- Domain Profile 和 Profile Version，用于通用化业务规则。
- 异步构建任务。
- 索引构建失败后的重试和恢复。
- R 节点绑定 `KnowledgeIndexVersion`。
- 自动化测试 routing 模式下默认支持 `R`。
- R 节点运行时按 `qa_verify` 逻辑完成召回、重排和答案生成。
- 测试结果至少记录 R 节点实际输出和绑定的版本信息。
- 项目隔离和索引文件清理。

### 3.2 第一版不做

- 不做发布机制。
- 不做发布审批。
- 不做发布回滚。
- 不做召回诊断页面。
- 不做生成记录页面。
- 不做复杂的 retrieved sources 展开 UI。
- 不接外部 retrieve 服务。
- 不把 `qa_verify` 里的 OPPO 业务规则直接写死到产品核心。
- 不把旧的 `knowledge_new.html` 全量产品流程一次性搬进正式工程。

## 4. 核心原则

### 4.1 R 节点绑定索引版本

R 节点不绑定实时文档库，也不绑定原始知识内容版本，而是绑定 `KnowledgeIndexVersion`。

原因：

- 自动化测试需要可复现。
- 同一份知识内容可以用不同 embedding 模型构建多个索引。
- 同一份知识内容可以用不同 chunk 规则或 rerank 规则构建多个索引。
- Domain Profile 的变化也会影响索引和召回结果。

### 4.2 内容版本和索引版本分离

`KnowledgeVersion` 表示清洗后的 parent/chunk 内容快照。

`KnowledgeIndexVersion` 表示基于某个 `KnowledgeVersion` 构建出来的可检索索引。

两者不能混在一起。

### 4.3 Parent 是主知识单元

RAG 核心应按 parent 聚合，而不是只按 chunk 检索。

`KnowledgeParent` 对应一条主问题和完整答案。`KnowledgeChunk` 是 parent 下的索引片段。

召回结果需要先找到 chunk，再聚合到 parent，再基于 parent 级结果 rerank 和生成答案。

### 4.4 `qa_verify` 是逻辑参考，不是直接业务模型

`qa_verify` 当前有 OPPO 场景硬编码，例如 OPPO 客服角色、手机/手表/电视等设备识别、ColorOS 相关规则。

产品化时需要拆成：

```text
通用 RAG Core
业务 Domain Profile
```

通用 RAG Core 负责 parent/chunk、索引、召回、重排、答案生成框架。

Domain Profile 负责业务词表、metadata schema、Prompt 模板、行业实体规则和答案规则。

## 5. 核心概念

### 5.1 KnowledgeBase

项目下的知识库资产。第一版可以约定每个项目只有一个默认知识库。

```ts
interface KnowledgeBase {
  id: string
  projectId: string
  name: string
  status: "active" | "archived"
  createdAt: string
  updatedAt: string
}
```

### 5.2 KnowledgeVersion

一次清洗后的知识内容快照。

```ts
interface KnowledgeVersion {
  id: string
  knowledgeBaseId: string
  version: number
  name: string
  sourceDocumentIds: string[]
  parentCount: number
  chunkCount: number
  snapshotHash: string
  status: "draft" | "ready" | "failed"
  createdAt: string
  updatedAt: string
}
```

说明：

- `draft` 表示内容生成中或待修订。
- `ready` 表示可用于构建索引。
- `failed` 表示内容生成失败。
- 不引入 `published` 状态。

### 5.3 KnowledgeParent

清洗后的主知识单元。

```ts
interface KnowledgeParent {
  id: string
  knowledgeVersionId: string
  question: string
  answer: string
  questionAliases: string[]
  questionSignature: string
  intent: string
  subject: string
  scopeTerms: string[]
  entities: Array<{
    type: string
    value: string
    aliases?: string[]
  }>
  isExactFaq: boolean
  sourceFiles: string[]
  reviewStatus: "draft" | "reviewed" | "approved" | "rejected"
  metadataSource: "auto_generated" | "manual_edited" | "rule_patched" | "llm_suggested"
  metadataLockedFields: string[]
  createdAt: string
  updatedAt: string
}
```

说明：

- `entities` 用于替代只适用于 OPPO 场景的 `device` 和 `productModel`。
- OPPO 场景可以把 `device`、`product_model` 映射为 entity。
- 其他业务可以用 `plan`、`region`、`policy_type`、`product_line` 等实体。

### 5.4 KnowledgeChunk

挂在 parent 下的检索片段。

```ts
interface KnowledgeChunk {
  id: string
  knowledgeVersionId: string
  parentId: string
  chunkKind: string
  sectionTitle: string
  chunkIndex: number
  content: string
  embeddingText: string
  metadata: Record<string, unknown>
  createdAt: string
}
```

说明：

- `content` 对应用户可读知识片段。
- `embeddingText` 对应向量化文本。
- `metadata` 保留 chunk 级字段，例如 `source_file`、`chunk_total`、`text_type`、`section_title` 等。

### 5.5 KnowledgeIndexVersion

基于某个 `KnowledgeVersion` 构建出来的可检索索引。

```ts
interface KnowledgeIndexVersion {
  id: string
  knowledgeVersionId: string
  ragProfileId: string
  ragProfileVersion: string
  embeddingModel: string
  embeddingProvider: string
  engineVersion: string
  taxonomyVersion: string
  snapshotHash: string
  indexPath: string
  manifestPath: string
  status: "building" | "ready" | "failed"
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}
```

说明：

- 自动化测试的 R 节点绑定此对象。
- `snapshotHash` 用于保证内容快照和索引快照可追溯。
- 不需要 `published` 状态。

### 5.6 KnowledgeRagProfile

业务领域配置。用于把 OPPO 业务硬编码抽离成可配置规则。

```ts
interface KnowledgeRagProfile {
  id: string
  name: string
  version: string
  answerRole: string
  assistantName?: string
  organizationName?: string
  answerPromptTemplate: string
  metadataSchema: {
    intents: string[]
    subjects: string[]
    entityTypes: string[]
    scopeTypes: string[]
  }
  taxonomy: {
    intentPatterns: Array<{ intent: string; patterns: string[] }>
    entityPatterns: Array<{ type: string; value: string; aliases: string[] }>
    scopePatterns: Array<{ value: string; aliases: string[] }>
    subjectPatterns: Array<{ value: string; aliases: string[] }>
  }
  answerRules: {
    preserveConditions: boolean
    preserveVersionBranches: boolean
    preserveThirdPartyMentions: boolean
    noAnswerText: string
  }
  createdAt: string
  updatedAt: string
}
```

第一版需要内置一个通用 profile：

```text
generic_customer_service
```

OPPO 规则可以作为兼容样例 profile，但不能作为产品核心默认逻辑。

### 5.7 KnowledgeBuildTask

异步构建任务，覆盖知识版本生成、metadata 生成和索引构建。

```ts
interface KnowledgeBuildTask {
  id: string
  knowledgeBaseId: string
  knowledgeVersionId?: string
  knowledgeIndexVersionId?: string
  taskType: "create_knowledge_version" | "generate_metadata" | "build_index"
  status: "pending" | "running" | "succeeded" | "failed" | "cancelled"
  currentStep: string
  progress: number
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}
```

第一版不把运行参数暴露给用户配置，工程代码固定使用以下策略：

- 有风险内容继续生成，生成后重新确认。
- 自动清洗轮次固定为一轮。
- 不发送完成后提醒。

### 5.8 TestSuiteRagConfig

测试集级别 R 节点配置。

```ts
interface TestSuiteRagConfig {
  enabled: boolean
  intent: "R"
  knowledgeIndexVersionId: string | null
  topK: number
  answerMode: "extractive_first" | "llm_only"
}
```

默认值：

```json
{
  "enabled": true,
  "intent": "R",
  "knowledgeIndexVersionId": null,
  "topK": 5,
  "answerMode": "extractive_first"
}
```

## 6. metadata 需求

### 6.1 metadata 字段

第一版至少支持：

- `questionAliases`
- `questionSignature`
- `intent`
- `subject`
- `scopeTerms`
- `entities`
- `isExactFaq`
- `sourceFiles`
- `reviewStatus`
- `metadataSource`
- `metadataLockedFields`

### 6.2 metadata 维护能力

第一版需要支持：

- 单条 parent 编辑 metadata。
- 批量编辑 parent metadata。
- 重跑 metadata 自动生成。
- 人工锁定字段，避免重新生成时覆盖。
- 查看字段来源。
- 查看修改历史。
- 维护 taxonomy/词表，包括 intent、subject、scope、entity type 和 entity value。

### 6.3 metadata 生成规则

metadata 可以来自：

- 自动规则。
- LLM 建议。
- 人工编辑。
- 规则补丁。

重新生成 metadata 时：

- 不覆盖 `metadataLockedFields`。
- 保留人工编辑记录。
- 新生成内容需要标记来源。

### 6.4 metadata 和召回的关系

metadata 必须参与 R 节点召回和重排：

- exact FAQ 判断。
- alias 匹配。
- question signature 匹配。
- intent 匹配。
- subject 匹配。
- scope 匹配。
- entity 匹配。
- mismatch penalty。

第一版不做召回诊断页面，但底层召回逻辑必须使用这些字段。

## 7. R 与 G 的关系

`G` 和 `R` 都是 routing 测试里的特殊 intent，但语义不同。

| intent | 类型 | 行为 |
| --- | --- | --- |
| `G` | 状态复用节点 | 沿用上一轮命中的 intent，再进入对应 Prompt 或 R 节点 |
| `R` | 知识检索节点 | 从配置的知识库索引版本召回知识，并生成知识库回答 |
| 其他 intent | 普通路由 | 根据 `routes` 命中目标 Prompt |

`R` 不应该放进普通 `routes` 里维护。

原因：

- 普通 route 的目标是 Prompt。
- `R` 的目标是 `KnowledgeIndexVersion`。
- `R` 的运行链路是 RAG engine，不是 Prompt executor。
- `R` 的配置项和 UI 交互与 Prompt route 不同。

多轮场景下，如果上一轮 resolved intent 是 `R`，下一轮入口 Prompt 返回 `G`，则继续走 R 节点。

## 8. 数据结构建议

### 8.1 test_suites 扩展

新增 `rag_config` 字段：

```sql
ALTER TABLE test_suites ADD COLUMN rag_config TEXT;
```

对应类型：

```ts
interface TestSuite {
  workflowMode: "single" | "routing"
  routingConfig: TestSuiteRoutingConfig | null
  ragConfig: TestSuiteRagConfig | null
}
```

### 8.2 新增知识库表

建议新增：

- `knowledge_bases`
- `knowledge_versions`
- `knowledge_parents`
- `knowledge_chunks`
- `knowledge_index_versions`
- `knowledge_rag_profiles`
- `knowledge_build_tasks`
- `knowledge_metadata_audit_logs`
- `knowledge_taxonomy_terms`

### 8.3 文件资产

索引相关文件不建议全部放进 SQLite。

建议文件结构：

```text
data/
  knowledge/
    {projectId}/
      {knowledgeBaseId}/
        versions/
          {knowledgeVersionId}/
            parents.jsonl
            chunks.jsonl
            manifest.json
        indexes/
          {knowledgeIndexVersionId}/
            index.npz
            manifest.json
            embedding-cache.json
        tmp/
          {taskId}/
```

删除知识版本或索引版本时，需要清理对应文件。

构建失败时，只清理 `tmp/{taskId}`，不能影响已有 ready 版本。

## 9. 标准中间产物

为了和 `qa_verify` 对齐，第一版需要支持导入和导出：

- `parents.jsonl`
- `chunks.jsonl`

`parents.jsonl` 里的记录应能映射到 `KnowledgeParent`。

`chunks.jsonl` 里的记录应能映射到 `KnowledgeChunk`，并包含 `parent_id`。

构建索引时必须执行和 `qa_verify` 一致的校验：

- parent id 不重复。
- chunk id 不重复。
- chunk 的 parent id 必须存在。
- parent 必须有可用 question。
- chunk text 为空时 fallback 到 parent answer。
- embedding text 缺失或内容为空时，用 question、section title、chunk text 构造 fallback。
- 生成 snapshot hash。

## 10. RAG Core 运行逻辑

### 10.1 ingest

```text
读取 KnowledgeIndexVersion
-> 读取关联 KnowledgeVersion
-> 读取 parents/chunks
-> 校验快照
-> 计算 snapshot hash
-> 判断是否可复用索引缓存
-> 构建或加载 LocalVectorIndex
```

### 10.2 recall

召回逻辑必须按 parent 级别聚合：

```text
query embedding
-> chunk vector search
-> exact alias score
-> question signature score
-> normalized question score
-> metadata prefilter
-> parent aggregation
-> matched chunks selection
-> rerank
-> topK parent results
```

第一版不允许退回到仅关键词召回。

### 10.3 answer

答案生成逻辑需要和 `qa_verify` 保持一致：

```text
recall results
-> assemble_answer
-> 如果答案完整且置信足够，extractive 原文直出
-> 否则 LLM fallback
-> 如果知识不足，返回 no_answer 文案
```

answer mode：

```ts
type RagAnswerMode = "extractive" | "llm_generated" | "no_answer"
```

第一版不做生成记录页面，但内部结果需要保留：

```ts
interface RagNodeResult {
  answer: string
  answerMode: RagAnswerMode
  usedParentIds: string[]
  usedChunkIds: string[]
  knowledgeIndexVersionId: string
  knowledgeVersionId: string
  ragProfileVersion: string
  embeddingModel: string
  engineVersion: string
  snapshotHash: string
}
```

这些字段用于测试结果追溯和后续排查，不要求第一版做复杂前端展示。

## 11. 自动化测试接入

### 11.1 单轮 routing

```text
测试用例输入
-> 入口 Prompt
-> 解析 intent
-> intent = G：沿用上一轮 intent
-> resolved intent = R：进入 R 节点
-> resolved intent = 其他：进入普通 Prompt route
-> 得到 actualOutput
-> 进入现有自动化测试评估
```

### 11.2 R 节点执行

```text
R 节点收到用户问题
-> 读取 testSuite.ragConfig
-> 校验 knowledgeIndexVersionId
-> 加载索引版本
-> 执行 RAG Core recall
-> 执行 extractive-first answer
-> 返回 actualReply
-> 写入 history
```

### 11.3 多轮 routing

多轮场景沿用现有 `parseConversationTurns`。

关键规则：

- 每一轮用户输入都先进入入口 Prompt。
- 如果返回 `G`，沿用上一轮 resolved intent。
- 如果 resolved intent 是 `R`，本轮走知识库检索。
- R 节点生成的回复需要写入 history，供后续入口 Prompt 判断上下文。

### 11.4 测试结果

第一版继续复用现有自动化测试报告。

测试结果中至少要保证：

- `actualIntent` 可以是 `R`。
- `actualOutput` 是 R 节点最终答案。
- `expectedOutput` 仍按现有回复评估逻辑处理。
- routing step 能标明命中的是知识库 R 节点。

第一版不要求展示完整召回来源、match lane、penalty 或生成 prompt。

## 12. UI 需求

### 12.1 知识库页面

知识库页面保留两个主区域：

- `文档库`：上传、查看、删除原始文档。
- `清洗与索引`：管理知识版本、metadata 和索引版本。

### 12.2 清洗与索引

第一版页面能力：

- 从当前项目文档库选择来源文档。
- 创建维护任务。
- 创建知识版本。
- 查看知识版本状态。
- 查看 parent 列表。
- 查看 parent 详情。
- 编辑单条 parent metadata。
- 批量编辑 parent metadata。
- 重跑 metadata 生成。
- 锁定 metadata 字段。
- 查看 metadata 修改历史。
- 构建索引版本。
- 查看索引版本状态。
- 失败后重试构建。

新建维护任务只保留必要流程：

```text
基础信息
-> 选择来源
-> 确认启动
```

新建维护任务不展示“运行参数”步骤，也不让用户配置以下内容：

- 风险确认方式。
- 自动清洗轮次。
- 完成后提醒。

上述参数由工程代码固定：

- 有风险内容继续生成，生成后重新确认。
- 自动清洗轮次固定为一轮。
- 不发送完成后提醒。

不做：

- 发布按钮。
- 发布状态。
- 发布审批。
- 发布回滚。

### 12.3 taxonomy 维护

需要提供基础词表维护：

- intent。
- subject。
- scope。
- entity type。
- entity value。
- aliases。

这些词表属于 Domain Profile 或 Profile Version。

### 12.4 自动化测试配置

测试集详情页的配置区域增加 R 节点配置：

```text
R 节点
启用：是/否
intent：R
索引版本：选择 KnowledgeIndexVersion
召回数量：默认 5
答案模式：extractive first / llm only
```

routing 测试的路由配置弹窗继续只维护 Prompt route，不把 R 放进去。

如果测试集是 routing 模式：

- `R` 默认启用。
- 页面提示：入口 Prompt 输出 `R` 时，将进入已配置知识库索引版本。

如果测试集是 single 模式：

- 第一版可以先不展示 R 节点。

### 12.5 测试结果展示

第一版只做轻量展示：

- 实际 intent：`R`。
- 命中节点：知识库 R。
- 知识库索引版本名称。
- 最终回复。
- 如果 R 节点失败，展示错误原因。

不做召回诊断和生成记录详情。

## 13. 模型与配置

### 13.1 模型类型

RAG 至少涉及：

- embedding model。
- answer generation model。
- metadata generation model。

`judge model` 后续再考虑，不进入第一版产品需求。

### 13.2 密钥管理

API key 不允许写入知识版本、索引版本、parents/chunks 或 manifest。

版本里只记录：

- provider。
- model name。
- base URL 摘要。
- 参数摘要。

密钥读取应来自现有设置或环境变量。

### 13.3 Profile 版本化

`KnowledgeIndexVersion` 必须记录：

- `ragProfileId`
- `ragProfileVersion`
- `taxonomyVersion`
- `engineVersion`

原因：

- Profile 影响 metadata。
- Profile 影响 rerank。
- Profile 影响 answer prompt。
- 同一份知识内容使用不同 profile 可能得到不同结果。

## 14. 错误处理

| 场景 | 行为 |
| --- | --- |
| R 节点未配置索引版本 | 当前用例失败，提示需要配置 R 节点索引版本 |
| 索引版本不存在 | 当前用例失败，提示版本不存在或已删除 |
| 索引版本状态不是 ready | 当前用例失败，提示索引未就绪 |
| 知识版本没有 parent | 构建失败，提示知识内容为空 |
| chunk 缺失 parent | 构建失败，提示 parent_id 无效 |
| embedding 调用失败 | 构建任务失败，可重试 |
| 索引构建失败 | 不影响已有 ready 索引版本 |
| 没有召回结果 | 返回 no_answer 文案，评估可能失败 |
| LLM fallback 失败 | 当前用例失败，记录错误 |
| 文档更新后旧版本不变 | 历史测试继续使用绑定索引版本，保证可复现 |
| 清洗过程中发现风险内容 | 不阻断本轮生成；生成完成后进入风险与确认 |

## 15. 权限、隔离和清理

### 15.1 项目隔离

- 知识库属于 project。
- 测试集只能选择同 project 下的 `KnowledgeIndexVersion`。
- 删除 project 时级联清理知识库记录和索引文件。

### 15.2 文件清理

- 删除 `KnowledgeVersion` 时，清理其 parents/chunks 快照。
- 删除 `KnowledgeIndexVersion` 时，清理其 index 文件和 manifest。
- 构建失败时，清理 task 临时目录。
- 清理不能影响其他 ready 版本。

### 15.3 数据安全

第一版需要遵守：

- API key 不进入版本快照。
- 测试报告不默认暴露完整知识正文。
- 导出 parents/chunks 时不包含密钥。

## 16. 实施阶段

### 阶段 1：数据模型和文档格式

- 新增知识库相关表。
- 定义 `parents.jsonl` 和 `chunks.jsonl` 格式。
- 支持从文档库生成 `KnowledgeVersion`。
- 支持 parent/chunk 存储。
- 支持 metadata 字段存储。
- 创建维护任务固定使用工程默认策略：风险继续生成、生成后确认、自动清洗一轮、不发送完成提醒。

### 阶段 2：metadata 和 Profile

- 内置 `generic_customer_service` profile。
- 支持 metadata 自动生成。
- 支持单条和批量 metadata 编辑。
- 支持字段锁定。
- 支持 metadata 修改历史。
- 支持 taxonomy 维护。

### 阶段 3：索引构建

- 新增异步构建任务。
- 基于 `KnowledgeVersion` 构建 `KnowledgeIndexVersion`。
- 构建逻辑对齐 `qa_verify` ingest。
- 支持 embedding cache。
- 支持失败重试。

### 阶段 4：R 节点运行

- `test_suites` 新增 `rag_config`。
- routing executor 支持 `R` 分支。
- R 节点绑定 `KnowledgeIndexVersion`。
- 运行逻辑对齐 `qa_verify` recall、rerank、answer。
- R 节点回复写入多轮 history。

### 阶段 5：UI 串联

- 知识库页展示知识版本、parent 列表、metadata 编辑和索引版本。
- 测试配置页选择 R 节点索引版本。
- 测试结果轻量展示 R 节点命中和最终回复。

## 17. 测试点

### 17.1 数据层

- 创建知识版本会写入 parents 和 chunks。
- chunk 必须挂到 parent。
- 删除知识版本会清理关联 parent/chunk。
- 创建索引版本会记录 profile、embedding model、engine version 和 snapshot hash。
- 老测试集没有 `rag_config` 时仍可打开和运行。

### 17.2 metadata

- 单条 parent metadata 可以编辑。
- 批量 metadata 可以编辑。
- 锁定字段不会被重跑覆盖。
- metadata 修改历史可查询。
- taxonomy 修改后可以生成新的 profile version 或 taxonomy version。

### 17.3 构建任务

- 构建任务状态可更新。
- 新建维护任务不展示运行参数配置。
- 风险内容不会在清洗生成阶段阻断任务。
- 有风险内容生成完成后需要重新确认。
- 自动清洗轮次固定为一轮。
- 任务完成后不发送提醒。
- 构建失败不影响已有 ready 索引。
- embedding 失败可重试。
- 构建临时文件可清理。

### 17.4 R 节点

- 入口 Prompt 输出普通 intent 时，行为不变。
- 入口 Prompt 输出 `G` 时，继续沿用上一轮 intent。
- 入口 Prompt 输出 `R` 时，进入 R 节点。
- R 节点未配置索引版本时，用例失败但运行不中断。
- R 节点能按 parent 聚合召回。
- exact FAQ 高置信时优先 extractive。
- 低置信时走 LLM fallback。
- 无召回时返回 no_answer。
- 多轮中 R 节点回复会写入 history。

### 17.5 UI

- routing 测试集默认展示 R 节点配置。
- 用户可以选择 ready 状态的索引版本。
- 未选择索引版本时运行前有明确提示。
- 知识库页可以查看知识版本和索引版本状态。
- 新建维护任务只有基础信息、选择来源、确认启动三步。
- 新建维护任务不展示运行参数步骤。
- 新建维护任务不展示风险确认方式、自动清洗轮次和完成后提醒配置。
- metadata 编辑不会展示成召回诊断页面。

## 18. 待确认问题

1. 第一版是否约定每个项目只有一个默认知识库？
2. R 节点是否只在 routing 模式生效？
3. 入口 Prompt 输出 `R` 时，是否固定由知识库回答，不再进入任何 Prompt？
4. RAG 回复使用测试集运行模型，还是单独配置 answer generation model？
5. `qa_verify` 的 Python engine 是先通过 adapter 复用，还是直接迁移核心逻辑到 TypeScript？
6. OPPO profile 是否需要作为样例保留，还是只保留 generic profile？

## 19. 推荐结论

第一版应采用：

```text
文档库
-> KnowledgeVersion
-> KnowledgeParent / KnowledgeChunk
-> metadata 生成和维护
-> KnowledgeIndexVersion
-> 自动化测试 R 节点绑定索引版本
-> R 节点按 qa_verify 逻辑运行
```

不做发布机制，不做召回诊断页面，不做生成记录页面。

最重要的是先把数据模型、索引版本、Profile 版本和 R 节点运行链路定准。这样后续无论是继续复用 `qa_verify` Python engine，还是把核心逻辑迁移到 TypeScript，都不会推翻产品结构。
