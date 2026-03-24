# Routing Expected Output Enrichment Design

## Goal

在创建多 Prompt 路由测试集时，不再直接信任测试 Agent 生成的 `expectedOutput` 摘要，而是在服务端按真实业务链路补全成完整预期对话。

## Current Problem

- 当前 routing 测试集的 case 由测试 Agent 直接输出 `expectedOutput`
- 对多轮 case，Agent 只会生成一段“应满足的要点”或单次回复摘要
- 这与真实运行链路不一致：真实运行会对每个 `User:` 轮次都执行一次
  - 入口 Prompt -> intent
  - intent 路由到子 Prompt
  - 子 Prompt 输出回复

结果是：
- 多轮 `expectedOutput` 不是真实多轮会话
- 左侧预期输出与右侧实际对话记录结构不一致

## Design

### 1. Enrichment 触发时机

只在 `workflowMode === "routing"` 的测试集创建链路触发。

- 前端仍然提交测试 Agent 生成的 case 草案
- 服务端在写入 `test_cases` 前，对每条 routing case 先补全 `expectedOutput`

### 2. Enrichment 执行规则

执行规则与运行测试保持一致：

- 单轮 input：
  - 入口 Prompt -> intent -> 子 Prompt -> reply
- 多轮 input：
  - 每个 `User:` 轮次都重复执行一次
  - 中间上下文要累积，和正式运行一致

### 3. 写回格式

补全后的 `expectedOutput` 直接写成完整会话文本：

```text
User: 想了解一下 Enco X3，降噪怎么样？
Assistant: P-SQ
Enco X3 降噪深度 50dB，公交地铁一键安静。
```

如果是多轮，就继续按 `User:/Assistant:` 顺序写完整段文本。

约定：
- `Assistant:` 后第一行先写 intent
- 后续正文保持原回复内容

### 4. 失败回退

如果某条 case 在补全过程中发生以下任一情况：
- 入口 Prompt 无法返回有效 intent
- route 未命中
- 目标 Prompt 不存在
- LLM 调用失败

则只对该 case 回退到原始 `expectedOutput`，不阻塞整个测试集创建。

## Architecture

从现有 [`src/lib/ai/test-runner.ts`](/Users/cs001/prompt-studio/src/lib/ai/test-runner.ts) 中抽出共享的 routing 执行能力，供两个地方复用：

- 运行测试
- 创建 routing test cases 时补全 expectedOutput

避免两套逐轮路由逻辑分叉。

## Testing

- API 测试：
  - routing suite 创建 cases 时，会把多轮 `expectedOutput` 补全成完整多轮对话
  - 单轮 routing case 也会写回 `Assistant: intent + reply`
  - 补全失败时回退到原始 `expectedOutput`
- 保留现有 routing runner 测试，确认抽出共享逻辑后行为不变
