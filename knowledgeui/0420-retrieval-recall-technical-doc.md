# 多客户知识库检索召回技术文档

本文档整理一套可支持多客户知识库的检索召回链路。范围包括 `parents/chunks` ingest、embedding、向量召回、exact/alias 召回、metadata 过滤、rerank、matched chunks 选择，以及召回结果如何交给答案组装。

当前 `qa_verify` 是这套链路的本地参考实现。文档中的 OPPO 路径、OPPO 业务词和 v5 产物只作为客户实现示例，不应作为所有客户的默认规则。

## 1. 总体链路

当前本地 RAG 召回链路：

```text
parents/chunks
  -> ingest 校验快照
  -> chunk embedding
  -> 本地向量索引
  -> query embedding
  -> chunk 级向量召回
  -> 按 parent 聚合
  -> exact/alias 加权
  -> metadata 软过滤
  -> rerank
  -> 返回 top_k 文档及 matched chunks
  -> answer assembler 选择候选并组装答案
  -> generator 使用 extractive 或 LLM fallback
```

当前参考实现代码：

| 文件 | 作用 |
| --- | --- |
| `monorepo/qa_verify/src/ingest.py` | 读取并校验 `parents/chunks`，构建本地索引 |
| `monorepo/qa_verify/src/index.py` | 向量检索、exact/alias 加权、metadata prefilter、parent 聚合 |
| `monorepo/qa_verify/src/reranker.py` | 对召回结果做规则 rerank |
| `monorepo/qa_verify/src/semantic_router.py` | 抽取 query/candidate 的 intent、subject、scope、device 等结构信号 |
| `monorepo/qa_verify/src/answer_assembler.py` | 从 recall top5 中选择最合适 parent，并拼接 matched chunks |
| `monorepo/qa_verify/src/generator.py` | 决定走 extractive 还是 LLM fallback |
| `monorepo/qa_verify/run.py` | 串联 ingest -> recall -> answer -> judge |

## 2. 输入产物与通用 Schema

召回层的直接输入是清洗链路生成的：

```text
parents_auto_v*.jsonl
chunks_auto_v*.jsonl
```

OPPO 当前 v5 试验配置示例：

```text
/Users/cs001/oppo_support/parents_auto_v5_source_to_index_trial.jsonl
/Users/cs001/oppo_support/chunks_auto_v5_source_to_index_trial.jsonl
```

OPPO 当前配置入口示例：

```text
monorepo/qa_verify/config.snapshot_v5_source_to_index_trial.yaml
```

召回层强依赖以下 parent/chunk 字段：

| 字段 | 用途 |
| --- | --- |
| `doc_id` / `parent_id` | parent 聚合和 chunk 归属 |
| `chunk_id` | matched chunks 输出和溯源 |
| `question_clean` / `question_raw` | 主要召回问题 |
| `question_aliases` | 问法变体召回 |
| `question_signature` | exact 召回签名 |
| `question_alias_signatures` | alias 签名召回 |
| `intent` | rerank 意图匹配 |
| `subject` | rerank 主题匹配 |
| `entity_type` / `entities` | 通用实体字段，表示产品、设备、服务、地区、渠道、用户类型等 |
| `device` | 当前参考实现中的设备字段，可视为 `entities.device` 的兼容投影 |
| `product_model` | 当前参考实现中的型号字段，可视为 `entities.product_model` 的兼容投影 |
| `scope_terms` | 范围匹配，避免泛问题误命中特定范围答案；应由客户范围词典维护 |
| `is_exact_faq` | exact FAQ 加权 |
| `chunk_text` | 返回给答案组装和生成 |
| `embedding_text` | 向量化文本 |
| `chunk_type` / `section_title` | answer assembler 判断步骤、定义、条件、注意事项 |
| `source_files` / `source_record_ids` | 溯源和评测 expected doc 推断 |

需要特别说明：这些字段是在上游清洗链路里生成的，召回层本身不负责生成它们。召回层的职责是“消费这些字段”，用它们做 exact recall、metadata 过滤、rerank 和答案候选选择。

### 2.1 这些字段在召回里怎么被消费

当前参考实现里，metadata 字段主要在 4 个位置被消费：

| 层 | 代码位置 | 作用 |
| --- | --- | --- |
| exact/alias recall | `src/index.py` | 给命中的标准问题、alias、signature 加权 |
| metadata prefilter | `src/index.py` | 对设备/型号不匹配的候选做软惩罚 |
| rerank | `src/reranker.py` | 对 intent/subject/device/model/exact FAQ/scope 做加分或扣分 |
| answer candidate selection | `src/answer_assembler.py` + `src/generator.py` | 决定 top5 里哪个 parent 真正拿来回答，以及是否允许直接 extractive |

字段消费关系：

| 字段 | 在哪被消费 | 怎么消费 |
| --- | --- | --- |
| `question_aliases` | exact/alias recall | query 规范化后与 alias 原文做完全匹配，命中则加分 |
| `question_signature` | exact/alias recall | query 规范化后与主问题签名做完全匹配，命中则加分 |
| `question_alias_signatures` | exact/alias recall | query 规范化后与 alias 签名做完全匹配，命中则加分 |
| `question_normalized` | exact/alias recall | 作为主问题归一化候选之一参与完全匹配 |
| `source_parent_questions` | exact/alias recall | 作为补充 exact 候选，避免父问题信息丢失 |
| `is_exact_faq` | exact recall / rerank / candidate selection | exact 命中时给更高加分；rerank 中继续加分；answer candidate 选择时给 exact bonus |
| `intent` | rerank | query intent 与候选 intent 一致时加分，不一致时扣分 |
| `subject` | rerank | query 主题和候选主题对上时加分 |
| `device` | metadata prefilter / rerank | query 和候选设备不一致时先做软惩罚，rerank 再做设备加减分 |
| `product_model` | metadata prefilter / rerank | query 和候选型号不一致时先做软惩罚，rerank 再做型号加减分 |
| `scope_terms` | semantic router / rerank / candidate selection | 用来判断是否 scope mismatch，泛问题命中特定范围答案时扣分 |
| `chunk_type` | rerank / answer assembler | how_to 偏好 `steps`，policy 偏好 `condition/support_models`，feature 偏好 `definition` |
| `section_title` | rerank / answer assembler | 用来判断路径、版本分支、注意事项、步骤结构是否完整 |

### 2.2 `question_aliases`、`question_signature`、`intent` 在召回里的区别

这几个字段经常被混用，当前参考实现里它们职责不同：

| 字段 | 召回职责 | 不是做什么 |
| --- | --- | --- |
| `question_aliases` | 扩充可读问法，提升 exact/near-exact 命中率 | 不是 query rewrite，不负责复杂改写 |
| `question_signature` | 给主问题提供稳定、强归一化的 exact key | 不是面向人看的文本 |
| `question_alias_signatures` | 给 alias 再做一层强归一化 | 不是单独的 alias 来源 |
| `intent` | 给 rerank 和 candidate selection 提供问题类型信号 | 不直接决定 exact recall |

可以简单理解为：

```text
question_aliases / question_signature 解决“能不能找到”
intent / subject / scope / device / model 解决“找到以后排第几”
chunk_type / section_title 解决“排上来以后能不能完整回答”
```

### 2.3 当前实现的一个边界

当前召回层默认认为这些 metadata 已经在上游清洗链路里准备好了。也就是说：

- 召回层不负责生成 alias、intent、scope。
- 如果上游没有补全这些字段，召回层只能退回更依赖向量分和词面分的排序。
- 所以上游 metadata 生成机制的完整度，直接决定召回排序的稳定性。

这也是为什么清洗文档里建议后续增加统一的 `metadata_enrichment` 步骤。

## 3. Ingest：快照校验与索引构建

入口：

```python
ingest_local_knowledge_with_progress(config, embedder)
```

如果配置里有 `parents_file` 和 `chunks_file`，会走 `faq_snapshot` 模式，读取已经清洗好的 parent/chunk 快照。

Ingest 校验：

| 校验项 | 处理 |
| --- | --- |
| parent `doc_id` 为空 | 报错 |
| parent `doc_id` 重复 | 报错 |
| chunk `chunk_id` 为空 | 报错 |
| chunk `chunk_id` 重复 | 报错 |
| chunk `parent_id` 不存在 | 报错 |
| parent question 为空 | 报错 |
| chunk_text 为空 | 尝试使用 parent answer fallback，仍为空则报错 |
| embedding_text 缺失或内容为空 | 用 question + section_title + chunk_text 重建 fallback |

Ingest 产出：

| 对象 | 说明 |
| --- | --- |
| `documents` | parent 级 `KnowledgeDocument` 列表 |
| `chunks` | chunk 级 `Chunk` 列表 |
| `snapshot_hash` | parents/chunks 快照 hash |
| `index` | 本地 `LocalVectorIndex` |
| `cache_hit` | 是否命中缓存 |
| `cache_path` | 本次索引缓存路径 |

## 4. Embedding 与缓存

当前 embedding 模型：

```text
text-embedding-v4
```

缓存分两层：

| 缓存 | 作用 |
| --- | --- |
| snapshot index cache | 保存整个快照对应的 embedding 矩阵 |
| chunk embedding cache | 保存单个 chunk 的 embedding，便于增量复用 |

snapshot cache key 包括：

| 字段 | 说明 |
| --- | --- |
| `mode` | `faq_snapshot` 或 `knowledge_file` |
| `snapshot_hash` | parent/chunk 内容 hash |
| `embedding_model` | embedding 模型 |
| `api_base_url` | embedding API 地址 |
| `chunk_target_chars` / `chunk_overlap_chars` | 兼容旧知识文件模式 |

chunk cache fingerprint 包括：

```text
chunk_id
doc_id
text_type
embedding_text
```

因此，parent/chunk 内容变化会触发新 snapshot hash；chunk 的 `embedding_text` 变化会触发单 chunk 重新 embedding；rerank 代码变化不会触发 embedding 重建。

## 5. 向量召回

入口：

```python
LocalVectorIndex.search(query_text, embedder, top_k=5)
```

实际调用：

```python
recall_results = ingest_artifacts.index.search(sample.query, embedder, top_k=config.top_k)
```

当前默认 `top_k=5`。

召回步骤：

1. 对用户问题做 query embedding。
2. 和所有 chunk embedding 计算 cosine similarity。
3. 对每个 chunk 计算 exact/alias 加分。
4. 对每个 chunk 计算 device/model mismatch 扣分。
5. 生成 `effective_score`。
6. 按 `doc_id` 聚合，保留每个 parent 的最佳分数。
7. 为每个 parent 选择 matched chunks。
8. 对 parent 级结果做 rerank。
9. 返回 top_k。

分数公式：

```python
effective_score = dense_score + exact_match_score - metadata_mismatch_penalty
```

其中 metadata mismatch penalty 当前为 `0.45`。

## 6. Exact / Alias 召回通道

当前 exact/alias 不是单独的硬召回索引，而是加权通道。查询会先规范化：

```python
LOOKUP_NORMALIZE_RE = re.compile(r"[^\w\u4e00-\u9fff]+")
```

然后和以下候选完全匹配：

| 候选字段 | 来源 |
| --- | --- |
| `chunk.question` | chunk 主问题 |
| `question_normalized` | metadata |
| `question_signature` | Stage 10 生成 |
| `question_aliases` | metadata alias |
| `question_alias_signatures` | Stage 10 生成 |
| `source_parent_questions` | 来源父问题 |

命中加分：

| 条件 | 加分 |
| --- | --- |
| exact/alias 命中且 `is_exact_faq=true` | `+2.0` |
| exact/alias 命中但不是 exact FAQ | `+1.4` |

这个设计的优点是简单、可叠加向量召回；缺点是 exact FAQ 不是硬置顶，仍可能被强语义候选竞争。

## 7. Metadata 软过滤

当前 metadata prefilter 只做两类判断：

| 字段 | 逻辑 |
| --- | --- |
| `product_model` | query 有型号，候选也有型号，但二者不一致，则 mismatch |
| `device` | query 有设备，候选也有设备，但二者不一致，则 mismatch |

如果 mismatch，不会直接丢弃候选，只扣 `0.45` 分。

这是一种软过滤：

| 优点 | 风险 |
| --- | --- |
| metadata 抽错时不至于直接漏召回 | 相近但不该命中的文档仍可能进入 top_k |
| 召回更稳，不容易过度过滤 | 对 exact/alias 和 rerank 质量依赖更高 |

## 8. Parent 聚合与 matched chunks

检索先发生在 chunk 级，但最终返回 parent 级结果。

每个结果包含：

| 字段 | 说明 |
| --- | --- |
| `doc_id` | parent ID |
| `score` | 加权后得分 |
| `semantic_score` | 原始向量分 |
| `question` | 候选问题 |
| `answer_preview` | parent answer 预览 |
| `metadata` | chunk metadata |
| `match_lane` | `exact_alias` 或 `semantic` |
| `exact_match_score` | exact/alias 加分 |
| `metadata_prefilter_passed` | metadata 是否通过 |
| `metadata_prefilter_reason` | mismatch 原因 |
| `matched_chunks` | 当前 parent 下选出的 chunk |
| `matched_chunk_ids` | matched chunk ID 列表 |
| `matched_chunk_count` | matched chunk 数量 |
| `chunk_text` | matched chunks 拼接文本 |

matched chunks 选择逻辑：

| 场景 | 处理 |
| --- | --- |
| parent 下命中 chunk 不超过 8 个 | 按 chunk 顺序全部返回 |
| parent 下命中 chunk 超过 8 个 | 取最高分 chunk 附近相邻 chunk，再按分数补齐，最多 8 个 |
| 没有 document match 但有 fallback | 使用 fallback match |

这个逻辑的目标是避免“只召回 parent，但只给生成阶段一个碎片 chunk”，减少长答案丢信息。

## 9. Rerank 排序

代码入口：`monorepo/qa_verify/src/reranker.py`

Rerank 是规则打分，不是 LLM rerank。

最终分数由以下信号组成：

| 信号 | 作用 |
| --- | --- |
| dense score | 向量相似度基础分 |
| lexical overlap | query 与候选问题的词面重合 |
| phrase bonus | 完整短语包含关系 |
| anchor bonus | 去掉泛词后的核心锚点匹配 |
| conflict penalty | 明显错主题惩罚 |
| action bonus | 动作词与主体词组合匹配 |
| metadata bonus | exact FAQ、intent、subject、device、model 匹配 |
| intent bonus | query intent 与候选 intent 匹配 |
| route bonus | semantic route 兼容性 |
| problem surface bonus | “无法支付/无法打开/他人可解锁”等问题信号 |
| scope penalty | 泛问题命中特定范围答案时惩罚 |
| chunk prior | 按 query intent 偏好 steps/definition/condition 等 chunk |

排序方式：

```python
reranked.sort(key=lambda item: (item["rerank_score"], item.get("score", 0.0)), reverse=True)
```

## 10. Semantic Router

代码入口：`monorepo/qa_verify/src/semantic_router.py`

Semantic Router 会把 query 和 candidate 都抽成结构化 route。

抽取字段：

| 字段 | 说明 |
| --- | --- |
| `intent` | 通用意图，例如 troubleshooting / policy / feature / how_to / lookup / unknown；客户可扩展 |
| `subject_terms` | 客户主题词典中的主题，例如支付失败、登录异常、套餐规则、设备配网等 |
| `action_terms` | 通用动作词，例如支付、打开、关闭、设置、介绍、解锁、查询；客户可扩展 |
| `problem_terms` | 客户问题词典中的故障或诉求，例如无法支付、无法打开、无法登录、扣费异常等 |
| `scope_terms` | 客户范围词典中的范围，例如地区、渠道、系统版本、服务包、会员类型、设备类型等 |
| `specificity` | generic 或 scoped |
| `entity_type` / `device` | 通用实体类型；当前参考实现保留 `device` 兼容字段 |
| `evidence_anchors` | 去掉泛词后的证据锚点 |

Route 兼容性用于：

| 用途 | 说明 |
| --- | --- |
| rerank 加分 | subject、intent、action、problem、scope、anchor 匹配加分 |
| scope mismatch 惩罚 | 泛问题不优先命中特定范围答案 |
| answer candidate 选择 | answer assembler 不固定取 Top1，而是选 route 更匹配的 parent |

当前参考实现中的 `NFC支付`、`GPS开关`、`云同步`、`手表表盘`、`面部识别解锁` 等属于 OPPO tenant dictionary 示例。多客户版本不应把这些写死在通用代码里，而应放到客户词典或规则配置中。

## 11. Answer Assembler 如何使用召回结果

代码入口：`monorepo/qa_verify/src/answer_assembler.py`

Answer assembler 不是召回，但它决定召回结果最终怎么被使用。

核心逻辑：

1. 从 recall top5 中选择最适合回答的 parent。
2. 对每个候选计算 route compatibility。
3. 优先排除 scope mismatch 的候选。
4. exact source 优先保留该 parent 下最多 8 个 chunk。
5. 非 exact source 会按 query intent 过滤无关 chunk。
6. 如果拼出的答案结构不完整，返回 None。

如果返回 None，generator 会走 LLM fallback。

这说明召回结果不能只看 `recalled_doc_id`，还要看：

| 字段 | 为什么重要 |
| --- | --- |
| `matched_chunk_ids` | 决定答案是否完整 |
| `matched_chunk_count` | 多 chunk parent 是否带全 |
| `section_title` | 生成阶段是否知道每段是什么 |
| `chunk_type` | 是否能保留步骤、条件、注意事项 |
| `match_lane` | exact 还是 semantic |
| `metadata_prefilter_reason` | 是否被设备/型号惩罚 |

## 12. Generator 与召回的关系

代码入口：`monorepo/qa_verify/src/generator.py`

Generator 有两条路径：

| 路径 | 说明 |
| --- | --- |
| `extractive` | answer assembler 能拼出可信答案时，直接返回原文片段 |
| `llm_fallback` | 把 recall top_k 和 matched chunks 放进 prompt，让 LLM 生成 |

使用 extractive 的前提：

| 条件 | 说明 |
| --- | --- |
| assembled answer 可用 | answer assembler 成功拼出答案 |
| Top1 无明显问题冲突 | `question_conflict_penalty` 不能为负 |
| selected candidate 足够可信 | 选中的 parent 不能明显弱于 Top1 |
| Top1/Top2 分差足够 | 避免强行使用错误 Top1 |
| 需要完整答案时 | 如果 Top2 chunk 更多且分差小，可能改走 LLM |

LLM fallback prompt 的关键约束：

| 约束 | 目的 |
| --- | --- |
| 先判断最匹配文档 | 避免多个无关文档拼接 |
| 同一文档多个片段必须综合 | 避免只保留单 chunk |
| 保留条件、范围、版本、路径、注意事项 | 避免生成阶段丢信息 |
| 无关文档不要拼接 | 避免错召回污染答案 |

## 13. 评测报告中的召回字段

`run.py` 会把召回结果写入报告。

关键字段：

| 字段 | 说明 |
| --- | --- |
| `expected_doc_id` | 期望命中的 parent |
| `recalled_doc_id` | Top1 召回 parent |
| `recalled_question` | Top1 问题 |
| `recalled_chunk_ids` | Top1 matched chunks |
| `recalled_chunk_count` | Top1 matched chunk 数 |
| `answer_mode` | extractive 或 llm_fallback |
| `answer_doc_id` | 实际用于答案的 parent |
| `answer_chunk_ids` | 实际用于答案的 chunks |
| `top_recall_score` | Top1 分数 |
| `recall_hit` | expected_doc_id 是否出现在 top_k 中 |

注意：`recall_hit=true` 只说明正确 parent 进入 top_k，不代表 Top1 正确，也不代表最终答案正确。

## 14. 当前问题

| 问题 | 影响 |
| --- | --- |
| exact/alias 是加权，不是硬通道 | exact FAQ 通常能上来，但仍可能被强语义候选竞争 |
| metadata prefilter 是软惩罚 | 型号/设备错误不会直接排除，仍可能进入 top_k |
| 没有独立 BM25/关键词索引 | 短问题、专有名词、数字型问题依赖向量和规则补偿 |
| semantic_router 规则需要租户化 | 当前参考实现里仍有客户业务词，不能直接迁移到任意知识库 |
| scope_terms 依赖数据清洗质量 | scope 抽不出来时，泛问题和特定范围问题容易互相压过 |
| matched chunks 最多 8 个 | 超长 parent 仍可能截断 |
| rerank 变化不触发 embedding 重建 | 测试时要区分“索引没变”和“排序逻辑变了” |

## 15. 对清洗产物的接口要求

清洗完成后，如果希望召回稳定，parent/chunk 至少要满足：

| 要求 | 原因 |
| --- | --- |
| 一个 parent 只对应一个主问题 | parent 聚合按 `doc_id`，一问多答会污染召回和生成 |
| exact FAQ 必须有稳定 `question_signature` | exact/alias 通道依赖它 |
| alias 只能补充，不能替代原问题 | 原始问题仍是最强匹配信号 |
| `subject/intent/entities/scope` 要可维护 | rerank 和 prefilter 会使用 |
| `scope_terms` 要覆盖关键业务范围 | 避免泛问题误命中特定范围答案 |
| `chunk_type` 要准确 | answer assembler 会按 steps/definition/condition/note 选择内容 |
| `section_title` 要有意义 | 多 chunk parent 需要靠 section_title 保留结构 |
| source trace 必须保留 | 评测、诊断、人工审核都依赖溯源 |

## 16. 产品化建议

如果要把这套逻辑做成内部运营工具，并且复用到线上，建议拆成四层。

| 层 | 产品化能力 |
| --- | --- |
| Ingest 层 | 校验 parent/chunk、生成 snapshot hash、embedding、缓存、发布索引版本 |
| Exact 层 | `question_signature`、`alias_signature`、`source_parent_question` 的硬召回通道 |
| Semantic 层 | 向量召回、BM25/关键词召回、metadata 软过滤 |
| Rerank 层 | 统一 rerank 打分、冲突惩罚、scope/device/model 约束、诊断解释 |

优先改造：

| 优先级 | 改造 |
| --- | --- |
| P0 | exact FAQ 硬通道，命中后进入候选前排，而不是只加分 |
| P0 | parent/chunk schema 固化，metadata 可维护 |
| P0 | 召回诊断输出，记录每个候选为什么上来、为什么被压下去 |
| P1 | 增加 sparse/BM25 召回，补短问题、专有名词、数字问题 |
| P1 | metadata filter 从纯软惩罚升级为可配置 hard/soft 策略 |
| P1 | semantic_router 规则资产化，允许按业务维护 subject/scope/problem terms |
| P2 | LLM rerank 只用于低置信或冲突 case，不作为全量强依赖 |

## 17. 多客户配置层

多客户版本不应把业务词、实体词、混淆词和 rerank 特例写死在代码里。建议每个客户维护一组 tenant retrieval config。

建议配置结构：

```text
tenants/{tenant_id}/retrieval.yaml
tenants/{tenant_id}/entities.yaml
tenants/{tenant_id}/intent_rules.yaml
tenants/{tenant_id}/subject_dictionary.yaml
tenants/{tenant_id}/scope_dictionary.yaml
tenants/{tenant_id}/conflict_rules.yaml
tenants/{tenant_id}/rerank_rules.yaml
```

配置项：

| 配置 | 说明 |
| --- | --- |
| `entity_dictionary` | 产品、型号、设备、服务、地区、渠道、用户类型等实体 |
| `subject_dictionary` | 客户业务主题，例如支付、登录、售后、会员、订单、设备连接 |
| `scope_dictionary` | 范围词，例如版本、地区、渠道、服务包、用户等级、适用对象 |
| `intent_rules` | 客户自定义意图和触发词 |
| `conflict_rules` | 容易混淆或互斥的问题对 |
| `metadata_filter_policy` | 哪些字段 hard filter，哪些字段 soft penalty |
| `chunk_type_prior` | 不同 intent 偏好的 chunk 类型 |
| `exact_policy` | exact FAQ 命中后的置顶、加权或强候选策略 |

## 18. 结论

当前清洗完成后的检索召回不是纯向量 TopK，而是：

```text
向量召回 + exact/alias 加权 + metadata 软过滤 + 规则 rerank + matched chunks 组装
```

清洗产物决定召回上限：parent 粒度、chunk 粒度、question signature、alias、subject、scope、device、model 这些字段都会进入召回排序。要把召回稳定性继续提升，重点不是继续补散点 case，而是把 exact 通道、metadata 维护、scope 规则、召回诊断做成可运营的产品能力。
