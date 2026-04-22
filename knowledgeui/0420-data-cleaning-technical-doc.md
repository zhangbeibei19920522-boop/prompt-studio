# 多客户知识库数据清洗技术文档

本文档整理一套可支持多客户知识库的通用数据清洗链路，从源文件进入系统，到生成标准化 `parents/chunks`。范围只覆盖数据清洗、结构化、合并、审计和索引产物生成，不覆盖线上检索服务、答案生成服务和评测工具的完整实现。

文档性质：这是技术方案文档，不是产品 PRD。它回答的是“当前链路怎么工作、字段怎么生成、规则落在哪一层”，不是“页面怎么交互、角色怎么操作、审核流怎么走”。

当前 OPPO 支持知识库是这套链路的一个落地实现。文档中的 OPPO 内容只作为客户实现示例，不应作为所有客户的默认规则。

## 1. 总体链路

当前清洗链路按 Stage 拆分，核心原则是“先抽取，再清洗，再结构化，再合并，再审计，最后生成索引”。

```text
源文件
  -> Stage 1 source_manifest
  -> Stage 2 raw_records
  -> Stage 3 cleaned_records
  -> Stage 4 routing / reclassify
  -> Stage 5 structure
  -> Stage 6 promotion
  -> Stage 7 merge
  -> Stage 8 conflict detection
  -> Stage 9 release gating
  -> Stage 10 parents / chunks
  -> Stage 11 coverage audit
  -> tenant repair layer
```

通用链路分三层：

| 层 | 说明 |
| --- | --- |
| 通用执行层 | Stage 1-11 的固定流水线，负责抽取、清洗、结构化、合并、审计和生成索引产物 |
| 客户配置层 | 每个客户维护自己的 source group、字段映射、风险规则、排除规则、实体词典、主题词典、metadata schema |
| 客户专项修复层 | 处理某个客户历史数据中的特殊格式、专项文档、规则例外和人工修复 |

OPPO 当前实现参考统计：

| 阶段 | 关键产物 | 当前统计 |
| --- | --- | --- |
| Stage 1 | `source_manifest.csv` | 10506 个源文件，10184 个候选入库文件，322 个排除文件，2517 个高风险文件 |
| Stage 2 | `raw_records.jsonl` | 10588 条原始记录，8747 条 explicit QA，1432 条 composite parent，405 条 xlsx QA，4 条 docx parent |
| Stage 10 | `parents_auto_v*.jsonl` / `chunks_auto_v*.jsonl` | 按 Stage 9 approved 记录生成 parent 和 chunk |

## 2. Stage 1：源文件盘点

代码入口：`tools/source_manifest.py`

Stage 1 的目标不是清洗正文，而是先把所有可处理源文件盘点出来，判断每个源文件是否值得进入后续抽取流程。

### 输入

根目录下所有后缀为以下类型的文件：

| 类型 | 说明 |
| --- | --- |
| `.html` | 帮助中心、FAQ、文章、公告等网页导出内容 |
| `.txt` | 文本导出内容，可能是正文，也可能是跳转 stub |
| `.docx` | 复合长文档、活动说明、权益说明、操作手册等 |
| `.xlsx` | FAQ、IVR、知识表格、运营表格等结构化数据 |

发现文件的逻辑：

```python
TARGET_EXTENSIONS = {".html", ".xlsx", ".docx", ".txt"}
root.rglob("*")
```

### 输出

主产物：

```text
source_manifest.csv
source_manifest_summary.json
```

`source_manifest.csv` 的字段：

| 字段 | 含义 |
| --- | --- |
| `source_path` | 源文件绝对路径 |
| `source_file` | 源文件名 |
| `source_type` | 文件类型，html/txt/docx/xlsx |
| `source_group` | 客户定义的一级来源分组，例如 FAQ、文章、手册、公告、root |
| `title_guess` | 根据文件名或正文标题推断的主标题 |
| `parse_strategy` | 后续抽取策略提示 |
| `is_explicit_qa` | 是否明显是一问一答文件 |
| `is_composite_doc` | 是否是复合长文档 |
| `classification` | `candidate` / `high_risk` / `excluded` |
| `is_candidate_for_index` | 是否进入 Stage 2 抽取 |
| `risk_level` | 风险等级 |
| `exclusion_reason` | 被排除原因 |
| `risk_reason` | 高风险原因 |
| `priority_hint` | 后续处理优先级提示 |

### 分类逻辑

Stage 1 会先根据文件类型生成 `ContentProfile`：

| 文件类型 | 识别逻辑 |
| --- | --- |
| HTML | 通过客户配置判断哪些来源默认是短 FAQ，哪些来源默认是复合文章；多标题 HTML、方括号标题 HTML 可作为复合文档信号 |
| TXT | 如果正文只有“点击链接查看”等跳转内容，标记为 `txt_link_stub`；否则按普通文本处理 |
| DOCX | 默认视为复合文档；如果出现多个 Q/A 标记，视为复合 QA notes；如果有活动时间/活动规则，视为规则文档 |
| XLSX | 第一张 sheet 表头包含“标准问题”和“回答”时，视为显式 QA 表格 |

Stage 1 的决策顺序：

1. 先判断是否排除。
2. 再判断是否高风险。
3. 都不满足时进入普通候选。

排除规则主要包括：

| 排除原因 | 典型条件 |
| --- | --- |
| `empty_or_unparsed` | 文本为空或过短 |
| `link_stub_only` | txt 只有“点击链接查看”等跳转内容 |
| `internal_only` | 标题或前 240 字包含内部备注/内部资料 |
| `navigation_or_list` | 目录页、列表页、导航页且正文很短 |
| `marketing_recommendation` | 产品推荐、热卖推荐等导流内容 |

高风险规则主要包括：

| 高风险原因 | 典型内容 |
| --- | --- |
| `time_bound_notice` | 公告、通知、维护、停服、灰度、随机投放，并带日期 |
| `activity_rules` | 活动、优惠、领取规则，并含资格、政策或日期 |
| `policy_or_billing_rules` | 退款、退货、售后、保修、套餐、价格等 |
| `membership_or_entitlement_rules` | 会员、权益、礼包、福利、积分等 |
| `qualification_or_certification_rules` | 学生认证、实名、资格等 |
| `version_or_rollout_dependency` | 产品版本、系统版本、软件版本、机型范围、发布时间、灰度发布等 |
| `support_contact_rules` | 客服联系方式、热线、邮箱等 |
| `mixed_composite_doc` | root 下的 docx 复合文档 |

### 关键限制

Stage 1 只做文件级判断，不拆问题，不清洗答案。它的作用是降低明显废文件进入后续链路的概率，但不能保证一个候选文件里的每个问题都是有效知识。

## 3. Stage 2：原始记录抽取

代码入口：`tools/raw_records.py`

Stage 2 的目标是把 Stage 1 允许入库的源文件转换成统一的 `raw_records.jsonl`。这一阶段保留原始问题和答案，不做深度改写。

### 输入

```text
source_manifest.csv
源文件原文
```

只处理满足以下条件的 manifest 行：

```python
classification != "excluded"
is_candidate_for_index == "true"
```

### 输出

主产物：

```text
raw_records.jsonl
raw_records_summary.json
```

`raw_records.jsonl` 的字段：

| 字段 | 含义 |
| --- | --- |
| `record_id` | 原始记录稳定 ID |
| `source_path` | 源文件绝对路径 |
| `source_file` | 源文件名 |
| `source_type` | 文件类型 |
| `source_group` | 源文件所在一级目录 |
| `source_row_or_locator` | 文件内位置，例如 `file`、`document`、`Sheet1!12` |
| `question_raw` | 原始问题 |
| `answer_raw` | 原始答案 |
| `extraction_mode` | 抽取模式 |
| `is_explicit_qa` | 继承 Stage 1 的显式 QA 判断 |
| `is_composite_doc` | 继承 Stage 1 的复合文档判断 |
| `parent_source_title` | Stage 1 推断的源标题 |
| `candidate_status` | Stage 1 的 classification |
| `risk_level` | Stage 1 的风险等级 |
| `risk_reason` | Stage 1 的风险原因 |
| `source_priority` | Stage 1 的 priority hint |

`record_id` 生成方式：

```python
sha1(source_path + locator + question_raw + answer_raw)[:16]
```

这保证同一个源文件、同一个位置、同一个问答内容会生成稳定 ID。

### 不同文件类型的抽取方式

| 文件类型 | 抽取方式 | 输出粒度 |
| --- | --- | --- |
| HTML | 去 HTML 标签，保留块级换行，去掉开头标题 | 通常 1 文件 1 记录 |
| TXT | 读取文本，去掉开头标题，折叠空白 | 1 文件 1 记录 |
| DOCX | 读取 `word/document.xml` 中所有 `w:t` 文本并拼接 | 1 文档 1 parent 记录 |
| XLSX | 遍历 workbook 和 sheet，识别问题列/答案列 | 1 行 1 QA 记录 |

### 抽取模式

| `extraction_mode` | 说明 |
| --- | --- |
| `explicit_qa_file` | HTML 中明确的一问一答 FAQ |
| `composite_parent` | HTML 复合文章父记录 |
| `txt_file` | 普通文本文件 |
| `docx_parent` | DOCX 复合长文父记录 |
| `xlsx_row_explicit_qa` | XLSX 中每行一个显式 QA |

### 关键限制

Stage 2 的 DOCX 抽取目前是纯文本拼接，表格结构、段落层级、编号层级不会被完整保留。因此像参数表、活动表、多个 FAQ 混在一个 Word 文档里的场景，后续必须依赖 Stage 5/6/10 或 repair layer 继续拆分和修正。

## 4. Stage 3：基础清洗

代码入口：`tools/stage3_cleaning.py`

Stage 3 输入 `raw_records.jsonl`，输出 `cleaned_records.jsonl`。目标是低风险文本清洗，不做业务判断。

主要处理：

| 类别 | 规则 |
| --- | --- |
| 问题清洗 | 规范换行、控制字符、不可见字符、外层引号、空白和标点间距 |
| 答案清洗 | 去 URL-only 行、图片/视频占位、参考类话术、跳转类话术 |
| 结构保护 | 对“功能介绍/操作方法/温馨提示/注意事项/适用机型”等标题插入换行 |
| 低质标记 | 标记 empty、near-empty、low-information、redirect residue、directory、recommendation |

Stage 3 会输出清洗报告：

```text
stage3_cleaning_report.csv
```

这一阶段只“删噪音、保结构”，不决定是否入库。

## 5. Stage 4：路由与重分类

代码入口：

```text
tools/stage4_routing.py
tools/stage4_reclassify.py
```

Stage 4 分两层：

| 子阶段 | 作用 |
| --- | --- |
| `stage4_routing.py` | 根据 Stage 3 清洗结果初判 include/exclude/high_risk |
| `stage4_reclassify.py` | 用更细规则二次修正，产出 `routed_status_v2` |

主要输出：

```text
stage4_routed_records_v2.jsonl
excluded_records_v2.csv
high_risk_records_v2.csv
stage4_reclassification_log.csv
stage4_routing_report_v2.csv
```

Stage 4 会处理：

| 类型 | 处理逻辑 |
| --- | --- |
| 无答案/空答案 | 排除 |
| 纯跳转/纯推荐/目录页 | 排除 |
| 有实质操作或说明 | include |
| 退款、资格、权益、版本、活动、频次等 | high_risk |
| 常规设置、排障、功能介绍 | 尽量避免误判为 high_risk |

Stage 4 的关键是把“是否有知识价值”和“是否需要高风险审查”分开。

## 6. Stage 5：结构类型判断

代码入口：`tools/stage5_structure.py`

Stage 5 只处理 Stage 4 的 active 记录，也就是 `include` 和 `high_risk`。它判断每条记录是独立 FAQ，还是复合长文档。

主要输出：

```text
stage5_structured_records.jsonl
explicit_faq_records.jsonl
composite_doc_records.jsonl
stage5_structure_report.csv
```

结构类型：

| 类型 | 说明 |
| --- | --- |
| `explicit_faq` | 可以直接作为一个主问题的 FAQ |
| `composite_doc` | 一篇文档里有多个主题或多个 FAQ，需要继续拆 |

判断依据包括：

| 信号 | 说明 |
| --- | --- |
| 来源模式 | `explicit_qa_file`、`xlsx_row_explicit_qa` 更倾向 explicit FAQ |
| 文档类型 | `docx_parent` 通常倾向 composite doc |
| 标题形态 | 活动、权益、规则、说明合集等倾向 composite |
| 正文结构 | 多标题、多段规则、多问题、多操作分支倾向 composite |
| 答案长度 | 长答案不一定 composite，只有明显多主题才拆 |

## 7. Stage 6：从复合文档提升独立 FAQ

代码入口：`tools/stage6_promotion.py`

Stage 6 从 `composite_doc_records.jsonl` 中识别可以独立回答的子问题，把它们提升成独立 FAQ，同时保留无法拆完的 residual 文档。

主要输出：

```text
stage6_promoted_candidates.jsonl
stage6_residual_composite_docs.jsonl
stage6_promotion_map.csv
stage6_rejected_promotion_candidates.csv
stage6_promotion_report.csv
```

提升方式：

| 提升来源 | 说明 |
| --- | --- |
| 显式 Q/A 块 | 文档中出现 Q/A、问/答结构 |
| 稳定标题块 | “功能介绍/操作方法/设置方法/温馨提示”等章节 |
| 术语说明块 | 例如多个功能分别介绍 |
| 编号子项 | 长文档中每个编号项本身能独立回答时提升 |

拒绝提升的情况：

| 拒绝原因 | 说明 |
| --- | --- |
| 标题太泛 | 如“说明”“介绍”“注意事项”且无法独立成问 |
| 与父标题重复 | 提升后和父问题没有区别 |
| 答案太薄 | 没有实质步骤、结论或解释 |
| 依赖上下文 | 脱离原文后用户无法理解 |
| 与已有 FAQ 重复 | 避免同题重复入库 |
| 低质跳转 | 只有“查看详情/请参考”等 |

Stage 6 会给 promoted FAQ 生成基础 metadata：

```text
question_normalized
question_aliases
intent
domain
subject
device
product_model
scope_terms
is_exact_faq
```

## 8. FAQ Metadata 生成

代码入口：`tools/faq_metadata.py`

这些字段当前是规则生成，不是 LLM 生成。

需要特别说明：当前实现里没有单独命名为 “Metadata Enrichment Stage” 的独立 Stage。逻辑上它属于清洗后的 metadata 补充层，但代码上分散在多个位置：

| 位置 | 作用 |
| --- | --- |
| `tools/stage6_promotion.py` | 对从复合文档中提升出来的 FAQ 调 `build_faq_metadata(...)` |
| `tools/v4_issue_repairs.py` | 对客户专项修复出来的 parent/chunk 重建 metadata |
| `tools/stage7_merge.py` | 合并并透传已有 metadata，不主动重新生成完整 metadata |
| `tools/stage10_generate_index.py` | 生成 `question_signature` 和 `question_alias_signatures`，并把 metadata 写入最终 parent/chunk |

这意味着当前 metadata 生成并不是“所有 FAQ 在同一个阶段统一生成”。当前最完整的 metadata 主要出现在：

| 来源 | 完整度 |
| --- | --- |
| Stage 6 promoted FAQ | 高 |
| repair layer 重建 FAQ | 高 |
| 早期 explicit FAQ 直接透传 | 可能只有部分字段，取决于前面有没有补 metadata |

如果后续要做成真正多客户、可维护的生产链路，建议把这部分显式收敛成独立的 `metadata_enrichment` 步骤，对所有 active FAQ 统一跑一次。

| 字段 | 生成方式 |
| --- | --- |
| `question_normalized` | 问题归一化，去空白、标点、大小写差异 |
| `question_aliases` | 轻度问法变体，例如“怎么/如何”“设置方法/如何设置” |
| `intent` | 正则识别 troubleshooting/how_to/policy/definition |
| `domain` | 根据客户领域词典识别业务域，例如账户、支付、售后、设备、会员、云服务等 |
| `subject` | 从问题中去掉设备、尾缀、泛化词后抽取主题 |
| `device` | 根据问题和答案中的设备词抽取 |
| `product_model` | 根据客户产品词典识别具体产品、型号、服务包或 SKU |
| `scope_terms` | 根据客户范围词典识别版本、地区、渠道、设备、服务范围、适用对象等 |
| `is_exact_faq` | 判断是否是标准 FAQ，而不是活动汇总/权益说明/功能合集 |

### 8.1 `question_aliases` 当前是怎么生成的

`question_aliases` 当前是轻量规则改写，不是语义改写。核心逻辑在 `build_question_aliases(question)`。

当前参考实现会做以下几类变换：

| 规则 | 例子 |
| --- | --- |
| `怎么` -> `如何` | “怎么开启” -> “如何开启” |
| `如何` -> `怎么` | “如何设置” -> “怎么设置” |
| `怎么设置` -> `如何设置` / `设置方法` | “壁纸怎么设置” -> “壁纸如何设置” / “壁纸设置方法” |
| `如何设置` -> `怎么设置` / `设置方法` | “壁纸如何设置” -> “壁纸怎么设置” / “壁纸设置方法” |
| `是什么` -> `介绍` / `说明` | “云同步是什么” -> “云同步介绍” / “云同步说明” |

约束：

| 约束 | 说明 |
| --- | --- |
| 不保留原问题本身 | alias 只补充，不替代原问题 |
| 自动去重 | 相同 alias 不重复写入 |
| 不做长句改写 | 不会生成口语化重写、同义扩写、缩写扩写 |

所以当前 alias 更适合做 exact/near-exact recall 补充，不适合承担完整 query rewrite 的职责。

### 8.2 `intent` 当前是怎么生成的

`intent` 当前由 `detect_intent(question)` 通过正则匹配问题文本生成。当前参考实现内置 4 类：

| intent | 触发词 |
| --- | --- |
| `troubleshooting` | 怎么办、无法、不能、失败、异常、无声、声音小、听不到、故障、问题 |
| `how_to` | 如何、怎么、设置、开启、关闭、连接、使用、路径、操作、方法、安装、下载、打开 |
| `policy` | 有效期、规则、条件、限制、支持、适用、要求、资格、退款、退货、换货、次数、时间 |
| `definition` | 是什么、介绍、说明、作用、含义、区别 |

规则行为：

| 行为 | 说明 |
| --- | --- |
| 按顺序匹配 | 命中第一个 intent 就返回 |
| 只看 question | 当前 `intent` 判断主要基于问题文本，不依赖答案全文 |
| 未命中则返回空 | 不是 `unknown`，而是空字符串 |

这套规则稳定、成本低，但语义能力有限。对于多客户系统，更合理的做法是把 intent 规则 tenant 化，允许客户扩展自己的 intent 类别和触发词。

### 8.3 `question_signature` 和 `question_aliases` 不是同一个东西

很多召回问题都出在这里，需要单独说明。

| 字段 | 作用 |
| --- | --- |
| `question_aliases` | 对原问题做轻度变体扩展，保留可读文本 |
| `question_signature` | 对主问题做强归一化，用于 exact recall |
| `question_alias_signatures` | 对 alias 再做强归一化，用于 alias exact recall |

`question_signature` 不是在 `faq_metadata.py` 里生成的，而是在 Stage 10 生成：

```python
normalize_question_signature(text)
```

处理逻辑：

| 处理 | 说明 |
| --- | --- |
| 去首尾问号/句号 | 统一问题形式 |
| 转小写 | 英文和型号匹配更稳定 |
| 去掉非字母数字中文字符 | 保留核心问题骨架 |

所以：

- `question_aliases` 是“可读的变体文本”
- `question_signature` 是“检索用的规范化键”

两者都要有，不能互相替代。

### 8.4 当前实现的缺口

当前 metadata 机制还有几个真实缺口，文档里需要明确：

| 缺口 | 影响 |
| --- | --- |
| 没有统一 metadata_enrichment stage | 所有 FAQ 不能保证在同一层统一生成 alias/intent/subject/scope |
| explicit FAQ 可能 metadata 不完整 | 早期 explicit FAQ 如果没有补 metadata，后续只能透传已有字段 |
| alias 规则过轻 | 召回能补充近义问法，但覆盖不了复杂口语改写 |
| intent 只看 question | 对依赖答案上下文的问题分类不够稳 |
| `question_signature` 在 Stage 10 才生成 | 前面阶段做 exact merge 或诊断时可用性有限 |

推荐通用化改法：

1. 在 Stage 5 之后增加统一的 `metadata_enrichment`。
2. 对所有 active FAQ 统一生成：
   `question_normalized / question_aliases / intent / subject / entities / scope_terms / is_exact_faq`
3. 在 Stage 10 之前就补齐 `question_signature`，不要只在最终索引阶段生成。
4. 把 alias、intent、subject、scope 的规则都 tenant 化。

当前限制：

| 限制 | 影响 |
| --- | --- |
| `scope_terms` 规则偏弱 | 很多业务范围词不会自动抽出 |
| alias 只做轻度变体 | 不能覆盖复杂口语改写 |
| subject 是启发式抽取 | 相近主题可能抽成同一个，也可能抽散 |
| 不依赖 LLM | 稳定可控，但语义理解能力有限 |

## 9. Stage 7：同题合并

代码入口：`tools/stage7_merge.py`

Stage 7 合并 explicit FAQ 和 Stage 6 promoted FAQ 中的同题或近同题记录。

主要输出：

```text
stage7_merge_ready_records.jsonl
stage7_unmerged_conflict_candidates.jsonl
stage7_merge_groups.csv
stage7_merge_decisions.csv
stage7_passthrough_residual_composite_docs.jsonl
stage7_merge_report.csv
```

合并策略：

| 场景 | 处理 |
| --- | --- |
| 单条候选 | 直接 passthrough |
| 完全重复答案 | 保留优先级最高的一条 |
| 长答案覆盖短答案 | 保留长答案或主候选 |
| 非高风险互补答案 | 去重后合并 |
| 高风险或规则差异 | 不自动合并，送 Stage 8 |

合并优先级大致为：

| 优先信号 | 说明 |
| --- | --- |
| `is_exact_faq` | 标准 FAQ 优先 |
| 问题形态 | “如何/怎么/是否/为什么”等明确问法优先 |
| 问题长度 | 更具体的问题优先 |
| 答案长度 | 更完整的答案优先 |

冲突判断包括：

| 冲突类型 | 例子 |
| --- | --- |
| 正反冲突 | 支持 vs 不支持，可以 vs 不可以 |
| 数字差异 | 次数、天数、金额、GB、百分比不同 |
| 日期差异 | 活动日期、有效期不同 |
| 版本差异 | 系统版本、软件版本、产品版本、地区版本或服务版本不同 |
| 高风险规则差异 | 资格、退款、活动、权益规则不一致 |

## 10. Stage 8：冲突检测与自动澄清

代码入口：`tools/stage8_conflict_detection.py`

Stage 8 接收 Stage 7 无法安全合并的冲突候选，判断是否能自动澄清，不能澄清的进入人工复核。

主要输出：

```text
stage8_conflict_review.csv
stage8_conflict_blocked_groups.jsonl
stage8_conflict_cleared_records.jsonl
stage8_passthrough_merge_ready_records.jsonl
stage8_passthrough_residual_composite_docs.jsonl
stage8_conflict_report.csv
```

自动澄清场景：

| 场景 | 处理 |
| --- | --- |
| 长短答案变体 | 长答案完整覆盖短答案，保留长答案 |
| 参数答案 vs 营销摘要 | 优先结构化参数答案 |
| 路径/版本互补 | 合并成多分支操作说明 |
| 时间范围一致 | 合并补充细节 |
| 介绍 + 使用方法 | 无冲突时合并为完整答案 |
| 普通非高风险补充 | 无明确冲突时去重合并 |

阻断场景：

| 场景 | 处理 |
| --- | --- |
| 明确正反冲突 | `blocked_true_conflict` |
| 路径冲突且不能证明互补 | `blocked_needs_review` |
| 高风险内容上下文不足 | 进入人工复核 |
| 证据不足 | 进入人工复核 |

## 11. Stage 9：发布门禁

代码入口：`tools/stage9_release_gating.py`

Stage 9 决定哪些记录可以进入 Stage 10 生成索引，哪些必须留在 pending 或 blocked。

主要输出：

```text
stage9_release_ready_records.jsonl
stage9_pending_review_records.jsonl
stage9_blocked_conflict_groups.jsonl
stage9_release_decisions.csv
stage9_release_report.csv
```

发布判断：

| 类型 | 处理 |
| --- | --- |
| 非高风险且内容完整 | 通常 `approved_for_stage10` |
| 简短事实答案但有明确结论 | 可放行 |
| 高风险但范围明确 | 可放行 |
| 高风险且时间/资格/频次/退款范围不明确 | pending |
| Stage 8 blocked conflict | blocked |

高风险可放行的典型条件：

| 条件 | 说明 |
| --- | --- |
| 明确时间范围 | 活动时间、有效期、截止日期清楚 |
| 明确资格范围 | 适用对象、认证条件、机型范围清楚 |
| 明确退款/售后边界 | 可退/不可退/申请路径清楚 |
| 明确版本或机型 | 支持版本/支持机型清楚 |
| 明确频次规则 | 每天/每月/每用户次数清楚 |
| 只是稳定事实 | 价格、规格、服务入口等稳定事实 |

## 12. Stage 10：生成 Parent 和 Chunk

代码入口：`tools/stage10_generate_index.py`

Stage 10 输入 Stage 9 的 release-ready 记录，生成最终索引用的 parent 和 chunk。

主要输出：

```text
parents_auto_v*.jsonl
chunks_auto_v*.jsonl
stage10_generation_report*.csv
stage10_generation_warnings*.csv
```

Parent 字段包括：

| 字段 | 说明 |
| --- | --- |
| `doc_id` | parent ID |
| `question_raw` / `question_clean` | 主问题 |
| `question_aliases` | 问法变体 |
| `question_signature` / `question_alias_signatures` | 精确召回用签名 |
| `intent/domain/subject/device/product_model/scope_terms` | 检索元数据 |
| `is_exact_faq` | 是否标准 FAQ |
| `answer_raw` / `answer_clean` | parent 级答案 |
| `source_record_ids` / `source_files` | 来源追踪 |
| `record_kind` | merge_ready_faq、cleared_conflict_faq、residual_composite_doc 等 |
| `is_high_risk` / `inherited_risk_reason` | 风险信息 |
| `tags/version_tags/is_time_sensitive` | 标签和时效性 |

Chunk 字段包括：

| 字段 | 说明 |
| --- | --- |
| `chunk_id` | chunk ID |
| `parent_id` | 所属 parent |
| `chunk_order` | 顺序 |
| `section_title` | 分段标题 |
| `chunk_text` | 分段内容 |
| `embedding_text` | 向量化文本，格式为主问题 + 分段 + 内容 |
| `chunk_type` | definition/steps/condition/faq/note 等 |
| 其他 metadata | 继承 parent 的问题、别名、签名、来源、风险字段 |

Stage 10 的关键规则：

| 规则 | 说明 |
| --- | --- |
| 只处理 release ready | `release_decision=approved_for_stage10` 且 `ready_for_stage10=true` |
| 丢弃无来源记录 | 缺 `source_record_ids` 或 `source_files` 会 warning 并跳过 |
| 丢弃空答案 | 清洗后空答案跳过 |
| 丢弃占位答案 | 如“小布加速理解中...” |
| 保护结构标题 | 对功能介绍、操作方法、活动规则、温馨提示等插入换行 |
| 自动分段 | 根据章节标题、编号、Q/A、步骤、规则拆 chunk |
| 显式 FAQ 默认单 chunk | 只有答案很长且多主题时才拆 |
| 超长 embedding 输入拆分 | 保证 embedding provider 的输入长度不超过模型限制；当前实现按 8192 做保护 |

`embedding_text` 当前格式：

```text
主问题：{question}
分段：{section_title}
内容：{chunk_text}
```

## 13. Stage 11：覆盖率审计

代码入口：`tools/stage11_coverage_audit.py`

Stage 11 不再改变数据，主要检查从 raw record 到 final parent/chunk 的链路是否断掉。

主要输入：

```text
raw_records.jsonl
cleaned_records.jsonl
excluded_records_v2.csv
stage9_pending_review_records.jsonl
stage9_blocked_conflict_groups.jsonl
stage9_release_ready_records.jsonl
parents_auto_v*.jsonl
chunks_auto_v*.jsonl
stage4_routed_records_v2.jsonl
stage5_structured_records.jsonl
stage6_promoted_candidates.jsonl
stage7_merge_decisions.csv
stage9_release_decisions.csv
```

主要输出：

```text
coverage_audit_auto_v*.csv
coverage_audit_summary_v*.csv
coverage_orphan_records_v*.csv
coverage_ambiguity_records_v*.csv
stage11_audit_report_v*.csv
```

它用于回答：

| 问题 | 审计意义 |
| --- | --- |
| 原始记录是否进入最终 parent/chunk | 找数据丢失 |
| 被排除的原因是否合理 | 找误删 |
| pending/blocked 是否过多 | 找门禁过严 |
| 是否存在同题多版本 | 找冲突和召回竞争 |
| 目标测试 case 对应 source 是否缺失 | 找 pipeline loss |

## 14. 客户专项 Repair Layer

代码入口：`tools/v4_issue_repairs.py`

Repair layer 是客户专项修复层，用来解决通用规则暂时无法覆盖的历史数据问题，例如特殊文档拆分、人工标准答案、别名补充、parent/chunk 重建和 metadata 修正。

当前 `tools/v4_issue_repairs.py` 是 OPPO 客户的 repair 实现，不应直接作为其他客户的通用规则。长期应把稳定、可复用的部分沉淀为通用清洗能力，把客户特有部分留在 tenant repair 配置或插件里。

主要能力：

| 能力 | 说明 |
| --- | --- |
| 手工构造 parent | 对特定文档按主问题重建 parent |
| 手工构造 chunk | 对特定答案按合理段落生成 chunk |
| metadata 补齐 | 调用 `build_faq_metadata`，并补充 alias、签名、型号等 |
| exact FAQ 调整 | 强制设置或降级 `is_exact_faq` |
| source trace 继承 | 绑定 source files 和 raw record |
| 文档专项拆分 | 对客户特定长文档、表格文档、活动文档、权益文档等进行专项切分 |

这层不是理想的长期方案。它更像“质量补丁层”，用来把现有知识库快速修到可用状态。长期应该把其中稳定规则沉淀回 Stage 1-10 的通用逻辑，或产品化成可维护的人工标注/审核能力。

## 15. 自动化重建入口

代码入口：`tools/run_accuracy_gate.py`

当前自动化重建主要从 Stage 3 开始跑：

```text
stage3
stage4_route
stage4_reclassify
stage5
stage6
stage7
stage8
stage9
stage10
stage11
```

它默认使用已有的：

```text
source_manifest.csv
raw_records.jsonl
```

因此，如果源文件发生变化，严格完整重建应该先跑：

```bash
python3 tools/source_manifest.py --root /Users/cs001/oppo_support --output /Users/cs001/oppo_support/source_manifest.csv --summary-json /Users/cs001/oppo_support/source_manifest_summary.json
python3 tools/raw_records.py --root /Users/cs001/oppo_support --manifest /Users/cs001/oppo_support/source_manifest.csv --output /Users/cs001/oppo_support/raw_records.jsonl --summary-json /Users/cs001/oppo_support/raw_records_summary.json
```

再跑 Stage 3-11。

## 16. 当前主要问题

| 问题 | 根因 | 影响 |
| --- | --- | --- |
| DOCX 表格结构丢失 | Stage 2 只拼接 `w:t` 文本 | 参数表、活动表、复杂说明需要后续手工修 |
| 复合长文拆分依赖规则 | Stage 6/10 主要靠正则标题和编号 | 部分文档可能拆少、拆错或一问多答 |
| metadata 偏启发式 | `faq_metadata.py` 不使用 LLM | subject/scope/alias 不一定准确 |
| repair layer 过重 | `v4_issue_repairs.py` 承担大量专项修复 | 后续维护成本高，难产品化 |
| 高风险策略保守但复杂 | Stage 8/9 规则多 | 需要报告和人工审核机制配套 |
| run_accuracy_gate 不重建 Stage 1/2 | 默认复用已有 manifest/raw | 源文件变动后容易漏掉前置重建 |

## 17. 产品化建议

如果要把这套清洗链路做成内部运营工具，并且逻辑也能用于线上，建议拆成以下后端能力。

| 模块 | 能力 |
| --- | --- |
| 源文件管理 | 上传、解析、版本化、记录 source file 和 source group |
| Stage 1 文件盘点 | 展示文件级分类、风险、排除原因，允许人工改 classification |
| Stage 2 原始抽取 | 展示 raw record，支持查看源文件定位和原始答案 |
| 清洗任务 | 一键执行 Stage 3-10，保留每次任务版本和产物 |
| 主问题管理 | 管理 parent、answer、alias、intent、subject、scope、exact FAQ |
| 复合文档拆分 | 对 DOCX/文章做可视化拆 FAQ，人工确认后入库 |
| 冲突审核 | 展示同题多版本、差异原因、建议动作 |
| 发布门禁 | 管理 pending/high-risk/blocked/approved 状态 |
| 索引产物 | 生成 parents/chunks，并支持本地 ingest 或线上发布 |
| 审计报告 | 显示 raw -> clean -> release -> parent/chunk 的覆盖链路 |

优先产品化的不是所有规则，而是以下几个可维护对象：

| 对象 | 原因 |
| --- | --- |
| 主问题 | parent 的核心，不应只靠自动生成 |
| 答案 | 需要人工能编辑、确认、锁定 |
| alias | 召回强相关，运营应该能维护 |
| subject/intent/entities/scope | 检索和 rerank 依赖，必须可维护 |
| source trace | 每条知识必须能回溯到源文件和 raw record |
| high-risk 状态 | 需要审核流，不应隐藏在脚本里 |

多客户版本建议把规则资产从 Python 正则中抽出来，按 tenant 维护：

```text
tenants/{tenant_id}/source_adapters.yaml
tenants/{tenant_id}/cleaning_rules.yaml
tenants/{tenant_id}/risk_rules.yaml
tenants/{tenant_id}/promotion_rules.yaml
tenants/{tenant_id}/merge_rules.yaml
tenants/{tenant_id}/conflict_rules.yaml
tenants/{tenant_id}/metadata_schema.yaml
tenants/{tenant_id}/entity_dictionary.yaml
tenants/{tenant_id}/repair_rules.yaml
```

配置项职责：

| 配置 | 说明 |
| --- | --- |
| `source_adapters` | 定义文件类型、标题提取、表格列映射、结构保留策略 |
| `cleaning_rules` | 定义噪音话术、跳转话术、低质内容、格式归一规则 |
| `risk_rules` | 定义活动、政策、资格、时效、价格、合规等高风险规则 |
| `promotion_rules` | 定义复合文档如何拆出独立 FAQ |
| `merge_rules` | 定义同题合并、长短答案覆盖、互补答案合并规则 |
| `conflict_rules` | 定义冲突检测、互斥词、版本/时间/数字差异规则 |
| `metadata_schema` | 定义该客户需要维护哪些 metadata 字段 |
| `entity_dictionary` | 定义产品、设备、服务、地区、渠道、用户类型等实体 |
| `repair_rules` | 定义客户专项修复和人工确认后的覆盖规则 |

## 18. 本项目中的“知识库-清洗任务”模块逻辑

当前 `prompt-studio` 里已经有一套“知识库-清洗任务”模块原型，但它和本文前面描述的 Stage 1-11 离线清洗脚本不是同一层。

两者关系可以理解为：

| 层 | 作用 |
| --- | --- |
| Stage 1-11 清洗流水线 | 真正负责 source_manifest、raw_records、cleaned_records、merge、gating、parents/chunks 的数据处理 |
| 知识库-清洗任务模块 | 把“选来源 -> 发起任务 -> 处理风险 -> 确认问答对 -> 生成索引 -> 管理版本”的运营动作产品化 |

当前项目里的代码入口主要在：

```text
src/app/(main)/page.tsx
src/components/knowledge-automation/knowledge-automation-panel.tsx
src/components/knowledge-automation/list-view.tsx
src/components/knowledge-automation/create-view.tsx
src/components/knowledge-automation/detail-view.tsx
src/components/knowledge-automation/version-detail-view.tsx
src/components/knowledge-automation/prototype-data.ts
```

### 18.1 模块入口与页面分层

当前项目把知识库拆成 3 个并列子视图：

```text
知识库
  -> 文档库
  -> 清洗任务
  -> 版本管理
```

对应关系：

| 子视图 | 当前职责 |
| --- | --- |
| 文档库 | 上传、预览、删除项目原始文档 |
| 清洗任务 | 新建任务、处理风险、确认问答对草稿、推进到 STG/PROD |
| 版本管理 | 查看知识版本、索引版本、Push STG、Push PROD、回滚 |

当前代码里有一个很重要的项目内约束：`hasKnowledgeBase` 不是独立数据库字段，而是直接由当前项目 `documents.length > 0` 推断。也就是说，当前原型把“项目下已有文档”视为“已有知识库”的成立条件，而不是单独维护 `knowledge_base` 实体。

`KnowledgeAutomationPanel` 内部又把清洗模块细分为 4 个页面态：

| `view` | 说明 |
| --- | --- |
| `list` | 任务列表或版本列表首页 |
| `create` | 新建任务 / 创建知识库 |
| `detail` | 单个清洗任务的工作台 |
| `version-detail` | 单个知识版本详情 |

因此，这个模块本质上是“知识库运营工作台”，不是单独的一段后台 worker 代码。

### 18.2 新建任务逻辑

当前项目里，新建流程不是 4 步 Wizard，而是一个单页表单，填完就直接 `启动任务`。这和文档中的通用产品化建议不同，更接近“紧凑型运营表单”。

任务类型在代码中的内部枚举是：

```text
batch
manual
repair
full
```

对应 UI 文案：

| 内部值 | UI 名称 | 逻辑含义 |
| --- | --- | --- |
| `batch` | 批量文件更新 | 基于已有版本，选择一批文档库文件做增量维护 |
| `manual` | 人工补充 | 基于已有版本，直接录入多条新增内容 |
| `repair` | 内容修复 | 基于已有版本，录入待修复问题，并可关联文档库文件 |
| `full` | 全量重建 / 全量构建 | 不沿用旧版本内容，重新以整批文档构建 |

创建入口分两种场景：

| 场景 | 页面标题 | 任务类型限制 | 默认行为 |
| --- | --- | --- | --- |
| 当前项目无知识库 | `创建知识库` | 只能选 `full` | 默认任务名为“第一版全量构建”，默认全选全部文档 |
| 当前项目已有知识库 | `新建维护任务` | 可选 `batch/manual/repair/full` | 默认任务名为“Q4 第 3 轮内容维护” |

表单校验规则是：

| 条件 | 规则 |
| --- | --- |
| 任务名 | 必填 |
| 基线版本 | 除 `full` 外都要求选择已有知识版本 |
| 来源文档 | `batch` 和 `full` 必须至少选择 1 个文档 |
| 修复问题 | `repair` 必须至少有 1 条待修复问题 |

不同任务类型的输入结构：

| 类型 | 输入内容 | 说明 |
| --- | --- | --- |
| 批量文件更新 | 版本 + 文档库文件 | 从现有版本继续维护，文件来自当前项目文档库 |
| 人工补充 | 版本 + 手工内容草稿列表 | 不要求原文件，先录入标题、摘要、来源备注 |
| 内容修复 | 版本 + 待修复问题 + 可选文档 | 同时承载“修复目标”和“修复参考来源” |
| 全量重建 | 文档库文件 | 不要求选择版本，默认全选文档库 |

这意味着当前项目里的“清洗任务”不是单纯执行 Stage 3-10，而是把 4 种不同来源形态统一包装成一类任务对象。

### 18.3 任务详情状态机

任务启动后进入 `DetailView`。这部分是整个模块的核心状态机。

内部状态：

| `detailState` | UI 状态文案 | 业务含义 |
| --- | --- | --- |
| `risk` | 待人工确认 | 仍有风险项/冲突项，不能进入正式确认 |
| `review` | 待发布 STG | 风险已处理，问答对草稿可编辑，可生成索引 |
| `indexed` | STG 测试通过 | 已生成索引并到 STG，等待发布到 PROD |
| `ready` | 已发布 PROD | 当前任务对应版本已经成为线上版本 |

页面顶部进度条把任务阶段固定成 7 段：

```text
任务创建
-> 内容来源
-> 解析与清洗
-> 风险与冲突确认
-> 清洗结果确认
-> 发布到 STG
-> 发布到 PROD
```

状态推进逻辑：

```text
risk
  -> resolveRisks()
  -> review
  -> publishToStg()
  -> indexed
  -> publishToProd()
  -> ready
```

几个关键约束：

| 约束 | 当前实现 |
| --- | --- |
| 风险没处理完 | `清洗结果确认` Tab 禁用 |
| 还没到 STG | `索引版本` Tab 禁用 |
| 发布到 STG | 与“生成索引版本”合并成一个动作 |
| PROD / STG 详情态 | 提供 `回滚版本` 动作 |

也就是说，当前项目把“索引生成”定义成从候选问答对进入 STG 的边界，而不是一个完全独立的后台菜单。

### 18.4 风险与确认逻辑

风险处理页被拆成 3 个子页签：

| Tab | 作用 |
| --- | --- |
| 待处理事项 | 汇总 pending 数量、冲突数、高风险删除数 |
| 合并冲突确认 | 处理同题不同口径 |
| 高风险内容删除 | 处理“系统删掉了但可能删错”的内容 |

冲突确认卡片会并排展示两份内容：

| 区块 | 含义 |
| --- | --- |
| 当前知识版本内容 | 旧版本当前正在生效或已存在的口径 |
| 本次文档库内容 | 本轮任务从新来源抽出的口径 |

运营可执行动作：

| 场景 | 动作 |
| --- | --- |
| 合并冲突 | 编辑本次内容、保留当前知识版本内容、使用本次文档库内容、本轮忽略 |
| 高风险删除 | 编辑本次内容、保持删除、恢复到本轮内容 |

这一层非常重要，因为它把 Stage 8/9 里“blocked/pending/high-risk”的规则结果，映射成了可操作的人工确认动作。并且当前原型明确规定：这些审核结论只影响当前任务，不回写成全局规则。

### 18.5 清洗结果确认逻辑

风险处理通过后，任务进入“清洗结果确认”。

这里展示的不是 chunk，也不是底层 parent JSON，而是运营可读的“问答对草稿”：

| 展示内容 | 说明 |
| --- | --- |
| 标题 | 当前主问题或问答主题 |
| 正文 | 清洗后的主答案 |
| 来源 | 原始文档或人工补充来源 |
| metadata | `question_aliases`、`intent`、`domain`、`subject`、`device`、`product_model`、`scope_terms`、`is_exact_faq` |

运营动作包括：

| 动作 | 当前实现 |
| --- | --- |
| 编辑问答对 | 改标题和正文 |
| 锁定字段 | 锁住问题、答案和 metadata 字段，避免被后续重生成覆盖 |
| 重新生成 | 基于当前草稿生成增强版内容预览，再决定是否应用 |
| 删除 | 把当前问答对从本轮草稿中移除 |

这里的核心设计是：

1. 运营编辑的是“问答对草稿”，不是 `chunk`。
2. metadata 跟问答对一起维护，但仍属于草稿态。
3. 生成索引动作挂在“发布到 STG”按钮上，不单独暴露底层向量构建步骤。

### 18.6 清洗轮次、知识版本与索引版本

当前项目实际上把“清洗任务”和“版本管理”拆成了两层对象：

| 对象 | 含义 |
| --- | --- |
| 清洗任务 | 一次维护动作，例如“Q4 第 2 轮内容维护” |
| 清洗轮次 | 任务内部某一轮产物，带 Stage 1-11 汇总 |
| 知识版本 | 某一轮清洗后形成的内容版本 |
| 索引版本 | 某个知识版本对应的可检索索引版本 |

任务详情里的 `知识版本` Tab 会展示每一轮的：

| 字段 | 含义 |
| --- | --- |
| 本轮内容 | 当前轮次的候选知识内容 |
| 本轮清洗策略 | 如系统默认基线、激进清洗 + repair 规则 |
| Stage 汇总 | Stage 1-11 每一层的记录数、风险数、approved 数 |
| 覆盖率审计 | orphan、ambiguity、missing records |

任务详情里的 `索引版本` Tab 会进一步展示：

| 内容 | 说明 |
| --- | --- |
| `knowledgeVersionId` / `indexVersionId` | 版本关联关系 |
| `parentCount` / `chunkCount` | 生成结果规模 |
| `stageSummary` / `stageCounts` | 从 source 到 chunk 的压缩统计 |
| parent / chunk 明细 | 只在索引版本视角里暴露，用于排查，不作为运营主编辑面板 |

单独的“版本管理”页则承接发布动作：

| 版本状态 | 可执行动作 |
| --- | --- |
| `草稿` | `Push STG` |
| `STG` | `Push Prod` |
| `已归档` | `回滚` |
| `PROD` | 只读查看 |

因此，当前项目已经把“候选内容版本”和“环境发布版本”明确拆开，而不是把清洗完成直接等同于线上发布。

### 18.7 当前实现边界

虽然页面和状态机已经比较完整，但当前项目里的“知识库-清洗任务”仍主要是前端原型层，不是完整后端实现。

当前边界如下：

| 项 | 当前状态 |
| --- | --- |
| 任务/版本数据源 | 主要来自 `prototype-data.ts` 和组件本地 `useState` |
| 知识库存在性 | 由 `documents.length > 0` 推断 |
| `knowledge_bases` / `knowledge_versions` / `knowledge_build_tasks` | 只在 `knowledgeui/2026-04-20-local-knowledge-rag-prototype.md` 中定义，运行时代码里尚未落表 |
| 实际 worker 执行 | 当前页面没有真正触发 Stage 1-11 Python 脚本 |
| 持久化发布记录 | 当前版本推送、回滚也还是前端态更新 |

所以，站在工程实现角度，当前项目已经具备：

1. 清洗任务的产品层对象模型。
2. 从任务创建到风险确认、问答对确认、STG/PROD 推进的页面状态机。
3. 把 Stage 1-11 结果投影成运营可理解工作流的 UI 结构。

但它还缺：

1. 与真实 `knowledge_build_tasks` / `knowledge_versions` / `knowledge_index_versions` 的持久化映射。
2. 与 Python 清洗脚本或独立 worker 的异步执行绑定。
3. 真正的索引构建、发布、回滚后端能力。

换句话说，本文前半段描述的是“数据怎么被清洗出来”，而当前项目中的“知识库-清洗任务”模块描述的是“运营怎么驱动和确认这条清洗链路”。产品化时，应该把这两层一一对齐，而不是只实现其中一层。

## 19. 结论

当前清洗链路已经具备完整的 source-to-index 闭环：

```text
源文件盘点 -> 原始抽取 -> 文本清洗 -> 分流 -> 拆 FAQ -> 合并 -> 冲突审计 -> 发布门禁 -> parent/chunk 生成 -> 覆盖审计
```

Stage 1 和 Stage 2 是前置基础：Stage 1 决定哪些源文件进入流程，Stage 2 决定源文件如何变成统一 raw record。后续 Stage 3-10 的所有清洗、拆分、合并、召回 metadata 都建立在这两个阶段的输出上。多客户版本尤其要加强结构化抽取能力，避免 DOCX、表格、PDF、网页复杂布局被降级成纯文本后，只能依赖 repair layer 补偿。
