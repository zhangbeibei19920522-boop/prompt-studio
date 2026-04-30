# 通用知识清洗与 Scope 映射改造设计

## 背景

当前项目已经有知识库版本和发布主流程：

- 上传项目文档。
- 创建知识清洗任务。
- 生成 `parents.jsonl`、`chunks.jsonl`、`manifest.json`。
- 将 parent/chunk 落到 SQLite。
- 为知识版本构建 index ingest。
- 发布知识版本到 STG / PROD。

现在缺的是一个更通用的数据清洗层，能处理常见客户知识库格式，尤其是 Excel 工作簿：

- FAQ 文档生成 parent/chunk。
- scope 可以来自知识文档本身、映射表补充、人工编辑确认。映射表只负责补齐或增强 scope，不是唯一来源。
- 高风险、冲突、未映射、无法解析的数据需要人工确认。
- 运营后续维护时主要编辑 parent，chunk 和 index 都从 parent 派生。

第一版不建议依赖 LLM 理解文件结构。更稳的方式是把“知识文档入口”和“映射表入口”拆开，用确定性规则完成清洗。

## 目标

1. 做一个通用知识清洗流程，覆盖常见 FAQ、规格表、矩阵表。
2. 最终产物保持为 `parent` 和 `chunk`。
3. 支持用户单独上传映射表。
4. 映射表可选，不上传也能生成普通 FAQ。
5. 系统无法判断时明确提示：
   - `xxx 文档暂时无法解析`
6. 每个索引版本自包含、可复现。
7. 复用现有知识版本、索引版本、STG、PROD 发布流程。

## 非目标

- 不把 GraphRAG 放进清洗主流程。
- 不让 LLM 直接生成最终 parent/chunk。
- 不强制所有清洗任务必须上传映射表。
- 不让运行时 RAG 临时读取外部映射表。
- 不重做现有路由、RAG、索引版本模型。

## 产品流程

### 1. 映射表入口

新增独立的“映射表”上传入口。

映射表不直接生成 FAQ parent，只在清洗阶段补齐或增强 scope。

支持这类格式：

```text
model - 65U8G | platform - Android TV
model - 55R6G | platform - Roku TV
```

```text
model - CFU14N6AWE | product - Freezer
model - FC50D6AWD | product - Freezer
```

也支持结构化表格：

```text
model | platform | deviceCategory
85QD7N | Google TV | TV
43H6570G | Android TV | TV
```

系统将每次上传保存成一个 mapping version：

```ts
type KnowledgeMappingVersion = {
  id: string
  projectId: string
  name: string
  fileName: string
  fileHash: string
  rowCount: number
  keyField: string
  scopeFields: string[]
  recordsFilePath: string
  createdAt: string
  updatedAt: string
}
```

第一版可以先支持一个清洗任务选择一个 mapping version。后续再支持多个 mapping version 组合。

### 2. 知识文档入口

FAQ、规格表、说明文档继续通过知识文档入口上传。

创建清洗任务时，可以选择一个 mapping version。也可以不选择。不选择时，系统仍然生成 parent/chunk，并保留从知识文档中直接识别到的 scope，只是不补充映射表里的额外 scope。

### 3. 清洗任务

任务输入扩展：

```ts
type KnowledgeTaskInput = {
  documentIds: string[]
  mappingVersionId?: string | null
  manualDrafts?: KnowledgeManualDraftInput[]
  repairQuestions?: KnowledgeRepairQuestionInput[]
}
```

清洗阶段：

```text
1. 解析文档，得到 workbook/sheet 结构信息。
2. 分析 FAQ sheet 的结构布局。
3. 从 FAQ sheet 中抽取原始 FAQ / spec record。
4. 从 sheetName、列头、显式 scope 列中提取直接 scope。
5. 如果选择了 mapping version，则执行映射表 join。
6. 生成标准化 parent candidate。
7. 检测高风险内容。
8. 按 question + scope 检测冲突。
9. 汇总未映射、无法解析数据。
10. 保存候选知识版本。
11. 等待运营人工确认。
```

## Scope 来源

Scope 不是只从映射表来。第一版需要支持三类来源：

1. 知识文档直接提取
   - sheetName：例如 `model - 85QD7N` 提取 `productModel=85QD7N`
   - 矩阵列头：例如 `Roku / Google / Android` 提取 `platform`
   - 表格显式列：例如 `model / platform / region / channel`
   - 文件名或 sheet 名中的稳定前缀：例如 `Refrigerator_Product` 提取 `productCategory`
2. 映射表补充
   - 通过已识别的 key 做 join，例如 `productModel=85QD7N` 查到 `platform=Google TV`
   - 映射表只补齐缺失维度或规范化值，不直接生成 FAQ
3. 人工编辑确认
   - 运营可以在 parent 编辑器里修正 scope
   - 保存后重新生成 chunk 和 index

优先级建议：

```text
人工编辑确认 > 知识文档直接提取 > 映射表补充 > 空 scope
```

如果不同来源给同一 scope key 产生冲突，例如文档列头是 `Roku`，映射表补出 `Google TV`，不要静默覆盖，应进入人工确认。

## FAQ Sheet 结构识别

因为映射表和知识文档已经分入口上传，知识文档清洗时不需要再判断某个 sheet 是否是映射表。清洗器只需要分析 FAQ sheet 的结构布局，并判断它是否属于可支持的 FAQ / 规格表形态。

```ts
type FaqSheetLayout =
  | "faq_table"
  | "faq_matrix"
  | "sheet_scoped_faq"
  | "spec_table"
  | "ignore"
  | "unsupported"
```

### `faq_table`

普通问答表：一列问题，一列答案。

示例：

```text
Question | exp_voice_answer
What is the difference between open and closed captioning? | ...
```

需要增量支持的 answer 列别名：

```text
answer
a
答案
response
exp_voice_answer
voice_answer
answer_text
```

### `faq_matrix`

矩阵型 FAQ：第一列是问题，其余列是不同答案版本。

示例：

```text
Question | Roku | Google | Android | Fire | Vidaa
No picture | Roku 答案 | Google 答案 | ...
```

清洗结果：

- 每个非空答案单元格生成一条 parent。
- 列头不仅写入 `variantLabel`，还要转成标准 scope。

示例：

```json
{
  "scope": {
    "platform": ["Roku TV"]
  },
  "scopeRaw": {
    "variantLabel": "Roku"
  }
}
```

### `sheet_scoped_faq`

每个 sheet 自带 scope，sheet 内部是 `Question | answer`。

`Cdmtv Model Spec.xlsx` 就是这种：

```text
Sheet: model - 85QD7N
Question | answer
How long is the Warranty? | The warranty is 1 year.
```

清洗结果：

```json
{
  "scope": {
    "productModel": ["85QD7N"]
  },
  "scopeRaw": {
    "sheetName": "model - 85QD7N"
  }
}
```

如果选择了映射表，可以继续补：

```json
{
  "scope": {
    "productModel": ["85QD7N"],
    "platform": ["Google TV"],
    "productCategory": ["TV"]
  }
}
```

### `spec_table`

型号规格表。

示例：

```text
model | spec_term | spec_value
FU140N3SWEL | Garage Ready | This model is designed...
```

```text
Model Number | Product | Specification | Value
AX3120Q | Hisense AX3120Q... | Auto Power Off | All sources
```

清洗成 parent：

```json
{
  "question": "Auto Power Off",
  "answer": "All sources",
  "metadata": {
    "domain": "model_spec",
    "subject": "Auto Power Off",
    "scope": {
      "productModel": ["AX3120Q"],
      "productCategory": ["Soundbar"]
    }
  }
}
```

规格表需要做噪声过滤。比如这些网页抓取噪声应被过滤或进入人工确认：

```text
Cookies settings
Accept
Deny
Skip to Main Content
```

### `unsupported`

系统无法安全解析的 FAQ sheet 归类为 `unsupported`。

`unsupported` sheet 不生成 parent/chunk。

UI 提示：

```text
<文件名> 文档暂时无法解析
```

如果文件部分可解析，只提示具体 sheet：

```text
Agent Assist.xlsx 中的 Toshiba 工作表暂时无法解析
```

## Parent 数据结构

Parent 是运营可编辑的主数据，也是 chunk 和 index 的上游来源。新的 parent 仍然写入 `parents.jsonl`，一行一个 JSON。

### Parent 顶层字段

```ts
type KnowledgeParentArtifact = {
  // 稳定 ID。建议由 source file、sheet、row、scope 生成可复现 ID，避免每次重建都完全变化。
  id: string

  // 原始展示问题。运营编辑时主要改这个字段。
  question: string

  // 清洗后的标准问题。用于检索、去重、展示。
  question_clean: string

  // 完整标准答案。运营编辑时主要改这个字段。
  answer: string

  // 问题别名。用于 exact lookup 和召回增强。
  question_aliases: string[]

  // 结构化元数据。所有新增能力都放在 metadata 内，避免大规模 DB schema churn。
  metadata: KnowledgeParentMetadata

  // 兼容现有存储字段，仍然保留。
  source_files: string[]
  source_record_ids: string[]
  review_status: KnowledgeReviewStatus
  record_kind: string
  is_high_risk: boolean
  inherited_risk_reason: string
}
```

### Parent Metadata 完整结构

```ts
type KnowledgeParentMetadata = {
  // 兼容当前项目和 qa_verify 风格字段。
  profileKey: string
  questionNormalized: string
  questionSignature: string
  questionAliasSignatures: string[]
  sourceParentQuestions: string[]
  isExactFaq: boolean

  // 辅助召回字段，不用于强过滤。
  intent?: string
  domain?: string
  subject?: string
  tags: string[]

  // 通用适用范围。scope 是强相关字段，参与 scope-aware retrieval。
  scope: Record<string, string[]>
  scopeSignature: string
  scopeRaw: {
    // 从 FAQ 文档直接识别到的原始值。
    sheetName?: string
    columnHeader?: string
    fileName?: string
    rowScope?: Record<string, unknown>

    // 兼容旧逻辑。
    variantLabel?: string

    // 映射表原始信息。
    mappingRaw?: Record<string, unknown>
  }
  scopeSource: {
    direct: Array<{
      key: string
      value: string
      source: "sheetName" | "columnHeader" | "fileName" | "rowColumn" | "manual"
    }>
    mappingVersionId?: string | null
    lookupKey?: string
    matched: boolean
    mapped: Array<{
      key: string
      value: string
      sourceField: string
    }>
    unmatchedReason?: string
    conflicts: Array<{
      key: string
      directValue: string
      mappedValue: string
      reason: string
    }>
  }

  // 文档来源。用于排查、回溯和 UI 展示。
  source: {
    sourceType: "document" | "manual" | "repair"
    documentId?: string
    documentType?: string
    sourceFiles: string[]
    sourceRecordIds: string[]
    sourceSheet?: string
    sourceRow?: number
    sourceColumn?: string
    sourceCell?: string
    mergedSourceCount: number
    mergedSourceFiles: string[]
  }

  // 清洗诊断。用于候选版本 review。
  cleaning: {
    cleaningVersion: number
    sheetLayout: FaqSheetLayout
    extractionKind:
      | "faq_table"
      | "faq_matrix_cell"
      | "sheet_scoped_faq"
      | "spec_table_row"
      | "manual"
      | "repair"
    confidence: "high" | "medium" | "low"
    warnings: string[]
    unsupportedReason?: string
  }

  // 治理和发布状态。用于高风险、冲突、未映射、发布判断。
  governance: {
    recordKind: string
    candidateStatus: "included" | "excluded" | "pending_review"
    releaseDecision: "approved" | "blocked" | "pending"
    reviewStatus: KnowledgeReviewStatus
    isHighRisk: boolean
    inheritedRiskLevel: "none" | "low" | "medium" | "high"
    inheritedRiskReason: string
    conflictGroupId?: string
    conflictReason?: string
    isTimeSensitive: boolean
    notes?: string
  }

  // 兼容旧版 OPPO/qa_verify 字段命名，迁移期可以保留。
  legacy?: {
    doc_id?: string
    question_raw?: string
    answer_raw?: string
    product_model?: string
    scope_terms?: string[]
    version_tags?: string[]
  }
}
```

### Parent JSONL 示例

```json
{
  "id": "cdmtv_85QD7N_warranty",
  "question": "How long is the Warranty?",
  "question_clean": "How long is the Warranty?",
  "answer": "The warranty is 1 year.",
  "question_aliases": [],
  "metadata": {
    "profileKey": "generic_customer_service",
    "questionNormalized": "howlongisthewarranty",
    "questionSignature": "how long is the warranty",
    "questionAliasSignatures": [],
    "sourceParentQuestions": ["How long is the Warranty?"],
    "isExactFaq": true,
    "intent": "spec_lookup",
    "domain": "model_spec",
    "subject": "Warranty",
    "tags": ["Warranty", "model_spec", "85QD7N"],
    "scope": {
      "productModel": ["85QD7N"],
      "platform": ["Google TV"],
      "productCategory": ["TV"]
    },
    "scopeSignature": "platform=Google TV|productCategory=TV|productModel=85QD7N",
    "scopeRaw": {
      "sheetName": "model - 85QD7N",
      "mappingRaw": {
        "Head Entity": "model - 85QD7N",
        "Tail Entity": "platform - Google TV"
      }
    },
    "scopeSource": {
      "direct": [
        {
          "key": "productModel",
          "value": "85QD7N",
          "source": "sheetName"
        }
      ],
      "mappingVersionId": "mapping_v1",
      "lookupKey": "85QD7N",
      "matched": true,
      "mapped": [
        {
          "key": "platform",
          "value": "Google TV",
          "sourceField": "Tail Entity"
        },
        {
          "key": "productCategory",
          "value": "TV",
          "sourceField": "default"
        }
      ],
      "conflicts": []
    },
    "source": {
      "sourceType": "document",
      "documentId": "doc_cdmtv_model_spec",
      "documentType": "xlsx",
      "sourceFiles": ["Cdmtv Model Spec.xlsx"],
      "sourceRecordIds": ["Cdmtv Model Spec.xlsx:model - 85QD7N:row:3"],
      "sourceSheet": "model - 85QD7N",
      "sourceRow": 3,
      "sourceColumn": "answer",
      "sourceCell": "B3",
      "mergedSourceCount": 1,
      "mergedSourceFiles": ["Cdmtv Model Spec.xlsx"]
    },
    "cleaning": {
      "cleaningVersion": 1,
      "sheetLayout": "sheet_scoped_faq",
      "extractionKind": "sheet_scoped_faq",
      "confidence": "high",
      "warnings": []
    },
    "governance": {
      "recordKind": "model_spec_faq",
      "candidateStatus": "included",
      "releaseDecision": "approved",
      "reviewStatus": "approved",
      "isHighRisk": false,
      "inheritedRiskLevel": "none",
      "inheritedRiskReason": "",
      "isTimeSensitive": false,
      "notes": ""
    }
  },
  "source_files": ["Cdmtv Model Spec.xlsx"],
  "source_record_ids": ["Cdmtv Model Spec.xlsx:model - 85QD7N:row:3"],
  "review_status": "approved",
  "record_kind": "model_spec_faq",
  "is_high_risk": false,
  "inherited_risk_reason": ""
}
```

## Chunk 数据结构

Chunk 从 parent 派生，用于 embedding、BM25、召回和 evidence assembly。运营不直接编辑 chunk。新的 chunk 仍然写入 `chunks.jsonl`，一行一个 JSON。

### Chunk 顶层字段

```ts
type KnowledgeChunkArtifact = {
  id: string
  parent_id: string
  chunk_order: number
  section_title: string
  chunk_text: string
  embedding_text: string
  chunk_type: string
  metadata: KnowledgeChunkMetadata
}
```

### Chunk Metadata 完整结构

```ts
type KnowledgeChunkMetadata = {
  // 从 parent 继承的检索字段。
  question: string
  questionAliases: string[]
  questionNormalized: string
  questionSignature: string
  questionAliasSignatures: string[]
  sourceParentQuestions: string[]
  isExactFaq: boolean

  // 从 parent 继承的辅助字段。
  intent?: string
  domain?: string
  subject?: string
  tags: string[]

  // 从 parent 继承的 scope。chunk 不单独维护 scope。
  scope: Record<string, string[]>
  scopeSignature: string
  scopeSource: {
    mappingVersionId?: string | null
    lookupKey?: string
    matched: boolean
  }

  // chunk 自身字段。
  chunkKind: "overview" | "steps" | "condition" | "note" | "policy" | "definition" | "spec" | "faq"
  chunkRole: "answer" | "question" | "context" | "spec"
  chunkIndex: number
  chunkTotal: number

  // 来源和清洗诊断，主要用于 debug 和 UI 展示。
  source: {
    sourceFiles: string[]
    sourceRecordIds: string[]
    sourceSheet?: string
    sourceRow?: number
    sourceColumn?: string
    sourceCell?: string
  }
  cleaning: {
    cleaningVersion: number
    sheetLayout: FaqSheetLayout
    warnings: string[]
  }
}
```

### Chunk JSONL 示例

```json
{
  "id": "cdmtv_85QD7N_warranty_01",
  "parent_id": "cdmtv_85QD7N_warranty",
  "chunk_order": 1,
  "section_title": "概述",
  "chunk_text": "The warranty is 1 year.",
  "embedding_text": "主问题：How long is the Warranty?\n适用范围：TV / 85QD7N / Google TV\n分段：概述\n内容：The warranty is 1 year.",
  "chunk_type": "spec_lookup",
  "metadata": {
    "question": "How long is the Warranty?",
    "questionAliases": [],
    "questionNormalized": "howlongisthewarranty",
    "questionSignature": "how long is the warranty",
    "questionAliasSignatures": [],
    "sourceParentQuestions": ["How long is the Warranty?"],
    "isExactFaq": true,
    "intent": "spec_lookup",
    "domain": "model_spec",
    "subject": "Warranty",
    "tags": ["Warranty", "model_spec", "85QD7N"],
    "scope": {
      "productModel": ["85QD7N"],
      "platform": ["Google TV"],
      "productCategory": ["TV"]
    },
    "scopeSignature": "platform=Google TV|productCategory=TV|productModel=85QD7N",
    "scopeSource": {
      "mappingVersionId": "mapping_v1",
      "lookupKey": "85QD7N",
      "matched": true
    },
    "chunkKind": "spec",
    "chunkRole": "spec",
    "chunkIndex": 1,
    "chunkTotal": 1,
    "source": {
      "sourceFiles": ["Cdmtv Model Spec.xlsx"],
      "sourceRecordIds": ["Cdmtv Model Spec.xlsx:model - 85QD7N:row:3"],
      "sourceSheet": "model - 85QD7N",
      "sourceRow": 3,
      "sourceColumn": "answer",
      "sourceCell": "B3"
    },
    "cleaning": {
      "cleaningVersion": 1,
      "sheetLayout": "sheet_scoped_faq",
      "warnings": []
    }
  }
}
```

### Parent 与 Chunk 的关系

规则：

1. parent 是主数据，chunk 是派生数据。
2. parent 更新后，必须重新生成该 parent 下的 chunks。
3. parent 是 scope 的唯一编辑源，chunk 不单独维护 scope。
4. 生成 chunk 时必须从 parent 复制 `metadata.scope`、`metadata.scopeSignature`、`metadata.scopeSource`。
5. parent 的 `question/question_clean/question_aliases/metadata.scope/metadata.intent/metadata.domain/metadata.subject` 必须同步到 chunk metadata。
6. parent scope 修改后，必须重新生成该 parent 下所有 chunks，并重新构建受影响索引。
7. 第一版不支持 chunk-level scope override。即使一个 parent 下有多个 chunk，也默认这些 chunk 与 parent 适用范围一致。
8. 如果未来出现“同一个 parent 内不同段落适用范围不同”的需求，再单独设计 chunk-level override。
9. chunk 的 `embedding_text` 应包含问题、适用范围、分段标题和片段正文。
10. old index 兼容：如果旧数据没有 `metadata.scope`，运行时按 `scope = {}` 处理。

### Parent 编辑与索引失效规则

第一版建议采用简单且安全的规则：

```text
运营编辑 parent 任一字段后，该知识版本都标记为 needs_reindex。
```

原因：

- `question`、`question_clean`、`question_aliases` 会影响 exact lookup、BM25、embedding text。
- `answer` 会影响 chunk_text、embedding_text、最终 evidence。
- `metadata.scope` 会影响 scope-aware retrieval。
- `metadata.intent/domain/subject/tags` 会影响辅助召回和 rerank。
- `review_status`、`governance.releaseDecision`、`is_high_risk` 会影响该 parent 是否进入可发布索引。

处理流程：

```text
编辑 parent
-> 保存 parent draft
-> 标记 knowledgeVersion.needsReindex = true
-> 重新生成该 parent 下的 chunks
-> 重新构建 index ingest / vectors
-> 生成新的 index version
-> 再允许发布 STG / PROD
```

不要在已发布 index 上原地修改。parent 编辑应该产生新的可追踪版本或让当前 draft 版本变为 dirty，重新构建后再发布。

理论上 `notes` 这类纯治理备注可以不影响索引，但第一版不建议做字段级例外。统一重建更容易理解，也能避免遗漏导致线上索引和 parent 不一致。

## Scope 映射规则

Scope 是通用机制，不写死到某个客户。

映射表只是 scope 的一个来源，主要用于补齐或规范化。清洗器必须先保留文档中直接提取到的 scope，再按映射表补充缺失维度。

Hisense 这批数据建议先支持这些维度：

```ts
type Scope = {
  productModel?: string[]
  platform?: string[]
  productCategory?: string[]
  deviceCategory?: string[]
  region?: string[]
  channel?: string[]
  appVersion?: string[]
  systemVersion?: string[]
}
```

规则：

1. 文档中直接识别到的 scope 一定保留。
2. 映射表是可选增强。
3. 映射结果在清洗阶段固化到 parent/chunk。
4. 运行时 RAG 不再读取映射表。
5. 映射缺失是 warning，不是 fatal error。

未命中映射示例：

```json
{
  "scope": {
    "productModel": ["65U7N"]
  },
  "scopeSource": {
    "mappingVersionId": "mapping_v1",
    "lookupKey": "65U7N",
    "matched": false,
    "unmatchedReason": "No mapping row found"
  }
}
```

## 冲突规则

当前 merge/conflict 需要升级为 scope-aware。

旧 key：

```text
questionSignature + variantLabel + sheetName
```

新 key：

```text
questionSignature + scopeSignature
```

这样不同平台、不同产品、不同型号下的答案不会互相误判为冲突。

例子：

- 同问题 + `platform=Roku TV` + 同答案：合并来源。
- 同问题 + `platform=Roku TV` + 不同答案：冲突。
- 同问题 + `platform=Roku TV` vs `platform=Google TV`：不是冲突。
- 同问题 + 空 scope vs 有 scope：都保留；运行时命中 scope 时 scoped answer 优先。

## 无法解析处理

系统需要明确、可解释的失败状态。

### 文档级无法解析

当整个文件都不能安全解析时使用。

场景：

- 文件类型不支持。
- workbook 损坏。
- 空文档。
- 没有可读 sheet。
- 所有 sheet 都是 `unknown`。

UI 提示：

```text
<文件名> 文档暂时无法解析
```

示例：

```text
Toshiba.xlsx 文档暂时无法解析
```

### Sheet 级无法解析

当文件部分可用，但某些 sheet 无法判断时使用。

UI 提示：

```text
<文件名> 中的 <工作表名> 工作表暂时无法解析
```

示例：

```text
Agent Assist.xlsx 中的 Toshiba 工作表暂时无法解析
```

### 映射缺失不是无法解析

FAQ 本身已经解析成功，只是映射表缺少某个 key 时，不阻塞。

UI 提示：

```text
65U7N 未在映射表中找到，已保留 productModel，platform 暂未补齐
```

### 必要列缺失

如果 sheet 已经被识别为某种 FAQ 结构，但缺少必要列，则标记为无法解析。

例子：

- `faq_table` 缺少 question 或 answer 列。
- `spec_table` 缺少 model/spec/value 列。

UI 提示：

```text
<文件名> 中的 <工作表名> 工作表暂时无法解析：缺少问题列或答案列
```

## Manifest 增量

knowledge manifest 需要记录清洗和映射诊断信息：

```json
{
  "cleaningContract": {
    "version": 1,
    "supportsScope": true,
    "supportsMappingVersion": true,
    "supportsSheetLayoutDiagnostics": true
  },
  "mappingVersions": [
    {
      "id": "mapping_v1",
      "fileName": "Agent Assist.xlsx",
      "fileHash": "sha256:...",
      "rowCount": 976,
      "scopeFields": ["platform", "productCategory"]
    }
  ],
  "documentDiagnostics": [
    {
      "fileName": "Agent Assist.xlsx",
      "status": "partial",
      "parsedSheets": 16,
      "unparsedSheets": ["Toshiba"],
      "warnings": ["Agent Assist.xlsx 中的 Toshiba 工作表暂时无法解析"]
    }
  ],
  "scopeDiagnostics": {
    "mappedCount": 223,
    "unmappedKeys": ["65U7N"]
  }
}
```

## UI 改造

### 知识库抽屉

增加两个上传区域：

1. `知识文档`
   - FAQ、规格表、政策说明、产品说明。
   - 生成 parent/chunk。
2. `映射表`
   - model/platform/product 映射。
   - 只生成 mapping version。

### 创建清洗任务

增加可选映射表选择：

```text
映射表：不使用 / model-platform-v1 / model-product-v1
```

不选择映射表时，系统继续清洗，只保留直接识别到的 scope。

### 清洗结果确认

增加这些确认分组：

- 高风险
- 冲突
- 未映射
- 暂时无法解析
- 已清洗 FAQ

`暂时无法解析` tab 展示文件级和 sheet 级提示，并给出处理建议：

- 修正文件格式。
- 手动选择或修正 FAQ sheet 结构。
- 补充必要列。
- 如需补充 scope，则上传映射表。

### Parent 编辑器

运营编辑 parent：

- question
- answer
- aliases
- scope
- review status
- notes

保存 parent 后，系统重新生成 chunks 和 index。

## 后端改造

### 新增模块

```text
src/lib/knowledge/workbook-profiler.ts
src/lib/knowledge/faq-sheet-layout-detector.ts
src/lib/knowledge/mapping-parser.ts
src/lib/knowledge/scope-mapper.ts
src/lib/knowledge/record-adapters/
  faq-table.ts
  faq-matrix.ts
  sheet-scoped-faq.ts
  spec-table.ts
```

### 更新现有模块

```text
src/lib/utils/parse-workbook.ts
```

除了现在的文本扁平化输出，还要支持结构化 workbook rows。现有文本输出可以保留用于兼容，但清洗应使用结构化 rows。

```text
src/lib/knowledge/builder.ts
```

把当前 spreadsheet extraction 拆成基于 FAQ sheet layout 的 adapters。现有 stage 可以保留，但 workbook sheet 需要走新 adapters。

```text
src/lib/knowledge/service.ts
```

把 `mappingVersionId` 传入 build task，并把 mapping 诊断写进 manifest。

```text
src/lib/db/repositories/knowledge-versions.ts
```

支持 parent 更新，以及从更新后的 parent 重新生成 chunk。

```text
src/lib/ai/rag/retriever.ts
```

后续阶段增加 scope-aware selection。

## Hisense 数据覆盖

确定性 MVP 应覆盖这几份数据。

### `Agent Assist.xlsx`

作为知识文档上传时，支持：

- `引导类问题`：`faq_table`，第三列备注忽略。
- `CDMTV Top Question`：`faq_matrix`，列头转 `platform`。
- `CDMTV Default`：`faq_table`，支持 `exp_voice_answer`。
- `CDMTV Platform`：`faq_matrix`，列头转 `platform`。
- `Refrigerator_default`：`faq_table`。
- `Refrigerator_Product`：`faq_matrix`，列头转 `productCategory`。
- `Appliance_default`：`faq_table`。
- `Appliance_Product`：`faq_matrix`，列头转 `productCategory`。
- `Appliance_Model`：`spec_table`。
- `Soundbar_default`：`faq_table`。
- `Soundbar_Model`：`spec_table`。
- `Laser TV`：`spec_table`。
- `Model_Product relation`：如果在知识文档入口上传，忽略并提示应作为映射表上传。
- `TV Model_platform relation`：如果在知识文档入口上传，忽略并提示应作为映射表上传。
- `L5 直接转人工`：MVP 不生成 parent，作为不支持的 FAQ sheet 提示。
- `Toshiba`：空表或未知表，提示暂时无法解析。

### `Cdmtv Model Spec.xlsx`

按 `sheet_scoped_faq` 支持。

- sheetName 提供 `scope.productModel`。
- `TV Model_platform relation` 可补充 `scope.platform`。

### `Refrigerator_Agent Assist.xlsx`

支持：

- `Refrigerator_default`：`faq_table`。
- `Refrigerator_Product`：`faq_matrix`，列头转 `productCategory`。
- `Refrigerator_model`：`spec_table`。

## 分阶段计划

### Phase 1：确定性清洗 MVP

- 增加结构化 workbook parser。
- 增加 FAQ sheet layout detection。
- 增加 layout-based adapters。
- 增加 mapping table parser。
- parent/chunk 写入 scope metadata。
- manifest 写入诊断信息。
- 支持文档级和 sheet 级无法解析提示。

### Phase 2：运营确认和 Parent 编辑

- 增加高风险、冲突、未映射、无法解析 review tab。
- 增加 parent editor。
- parent 编辑后重新生成 chunks。
- parent 编辑后重新构建 index。

### Phase 3：Scope-Aware Retrieval

- RAG 请求支持 runtime scope。
- hybrid retrieval 后增加 scope match scoring。
- routing steps 记录 scope 匹配诊断。

### Phase 4：可选 LLM 辅助

只有确定性规则无法安全判断时才引入 LLM。

LLM 只生成建议的 FAQ sheet layout 或 cleaning plan，不直接生成最终 parent/chunk。

## 测试计划

单元测试：

- workbook 结构化解析。
- 每种 FAQ sheet layout 的识别。
- mapping table 解析。
- mapping version 应用到 FAQ record。
- scope signature 生成。
- 不同 scope 下同问题不误判为冲突。
- unsupported sheet 标记为无法解析。
- mapping table 不生成 FAQ parent。

集成测试：

- 使用 Hisense 风格 `Agent Assist.xlsx` 构建。
- 使用 `Cdmtv Model Spec.xlsx` 构建，并通过映射表补 platform。
- 不选择映射表也能构建。
- 映射缺失时生成 warning。
- manifest 包含诊断信息。
- parent 编辑后重新生成 chunk。

回归测试：

- 现有 `Question | Answer` 简单表仍能生成 parent/chunk。
- 老索引版本仍可运行。
- RAG 检索兼容没有 `metadata.scope` 的旧记录。
