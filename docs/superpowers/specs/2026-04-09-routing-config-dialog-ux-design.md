# Routing Config Dialog UX Design

## Goal

优化多 Prompt 路由配置弹窗的可用性，解决大量 intent 时弹窗无法滚动的问题，并为“intent 与 Prompt 同名”的场景提供更快的配置路径。

## Requirements

- 路由配置弹窗在存在大量路由规则时仍可正常查看和编辑
- 头部说明和底部操作按钮保持稳定可见，不随长列表一起滚走
- 保留现有手动新增、编辑、删除路由的能力
- 为同名场景提供一键快速配置能力，减少逐条手选 Prompt 的成本
- 不修改后端接口、数据库结构和 `routingConfig` 数据形态
- 同一套弹窗继续同时服务于测试 Agent 会话入口和测试集详情页编辑入口

## Non-Goals

- 不新增独立的路由配置页面
- 不引入通用工作流编辑器
- 不让 Agent 自动猜测并持久化路由规则
- 不改动测试运行、评估或路由执行语义

## Design

### 1. 本地修复弹窗滚动，不改全局 Dialog 基座

问题集中在路由配置弹窗本身，不需要先改全局 [`src/components/ui/dialog.tsx`](/Users/cs001/prompt-studio/src/components/ui/dialog.tsx)。

路由配置弹窗改为三段式布局：

- 头部：标题和说明
- 中间主体：入口 Prompt 和路由规则列表
- 底部：`取消` / `保存并继续`

弹窗主体设置本地高度上限和 `overflow-hidden`，把中间内容区单独做成滚动容器。这样在 intent 很多时：

- 头部不会滚走
- 底部保存按钮始终可见
- 用户只滚动中间的配置区

### 2. 增加“一键从 Prompts 生成路由”

在路由规则标题区域增加批量动作：

- `从 Prompts 生成路由`

触发条件：

- 必须已经选择入口 Prompt
- 当前项目至少还有一个非入口 Prompt

生成规则：

- 遍历当前 `prompts`
- 排除当前 `entryPromptId`
- 为每个剩余 Prompt 生成一条 route
  - `intent = prompt.title`
  - `promptId = prompt.id`
- 顺序与当前 Prompt 列表顺序保持一致

交互规则：

- 如果当前只有默认空白行，直接替换为生成结果
- 如果当前已经存在已填写的 route，先提示“将覆盖当前路由配置”，确认后再替换

这样在“intent 和 Prompt 同名”的业务里，用户只需：

1. 选择入口 Prompt
2. 点击一次 `从 Prompts 生成路由`
3. 删除少量不需要的 route 或微调个别规则

### 3. 增加单行自动匹配，减少例外场景的手工选择

在保留手动输入 `intent` 的前提下，补一层轻量自动匹配：

- 当某一行 `intent` 变化时，如果该行还没有选择 `promptId`
- 且这个 `intent` 能唯一匹配某个 Prompt 标题
- 就自动把该 Prompt 填入目标 Prompt 字段

匹配规则：

- 去掉首尾空格
- 大小写不敏感
- `-`、`_`、空格视为等价

例如：

- `after_sale`
- `After Sale`
- `after-sale`

都会视为同一个匹配键。

安全约束：

- 如果有多个 Prompt 命中同一个规范化名称，不自动填充
- 如果该行已经手工选择了 Prompt，不自动覆盖
- 入口 Prompt 不参与匹配

### 4. 将目标 Prompt 下拉改为可搜索选择器

当 Prompt 很多时，即使只修改少数例外规则，普通下拉也会很慢。

因此路由配置弹窗内部的“目标 Prompt”选择器改为带搜索的选择器，复用现有 `Popover + Command` 组件模式：

- 点击后展开搜索面板
- 支持按 Prompt 标题过滤
- 选中后立即回填当前行

这部分只在路由配置弹窗内部落地，不影响其他现有 `Select` 使用点。

### 5. 提取纯函数，避免把交互逻辑塞进组件

将下面逻辑提取为独立纯函数，供弹窗复用并单测覆盖：

- `normalizeRoutingKey(value)`
- `findUniquePromptMatch(intent, prompts, entryPromptId)`
- `buildRoutesFromPrompts(prompts, entryPromptId)`

这样可以把“批量生成”和“单行自动匹配”的规则锁死，避免后续 UI 调整时行为漂移。

## Affected Files

- [`src/components/test/test-routing-config-dialog.tsx`](/Users/cs001/prompt-studio/src/components/test/test-routing-config-dialog.tsx)
- [`src/components/test/__tests__/test-flow-config-card.test.tsx`](/Users/cs001/prompt-studio/src/components/test/__tests__/test-flow-config-card.test.tsx)
- 新增 `src/components/test/routing-config-utils.ts`
- 新增 `src/components/test/__tests__/routing-config-utils.test.ts`

## Testing

- 纯函数测试
  - 规范化规则正确
  - 入口 Prompt 被排除
  - 同名唯一匹配时自动命中
  - 重名 Prompt 时不自动命中
  - 批量生成时按 Prompt 列表生成 route
- 组件测试
  - 路由弹窗包含本地滚动布局约束
  - 批量生成按钮存在且依赖入口 Prompt
  - 表单在同名场景下支持快速生成 route
  - 现有手动新增/删除路由能力不回退

## Rollout Notes

- 本次只改前端交互，不涉及数据迁移
- 旧测试集和已有 routing 配置可以直接继续编辑
- 如果后续发现其他弹窗也有同类问题，再考虑抽象成全局 Dialog 滚动规范
