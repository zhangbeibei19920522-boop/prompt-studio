# Routing G Intent Design

## Goal

让 routing 测试链路支持保留 intent `G`，其语义固定为“沿用上一轮已成功命中的 intent”。

## Scope

本次只覆盖测试功能相关链路：

- 测试集生成提示词
- routing 测试执行
- routing 测试用例创建时的 `expectedOutput` enrichment
- routing 测试预期输出重生成

不改真实聊天主链路。

## Design

### 1. `G` 的语义

- 入口 Prompt 返回普通 intent 时，继续按现有 `intent -> Prompt` 路由
- 入口 Prompt 返回 `G` 时，不把 `G` 当成一条独立 route
- 系统改为读取上一轮已经成功解析并命中的 intent，并用该 intent 继续命中相同子 Prompt

示例：

- turn 1: raw intent = `A` -> 命中 Prompt A
- turn 2: raw intent = `G` -> resolved intent = `A` -> 继续命中 Prompt A

### 2. 状态记录

执行器区分两种 intent：

- `rawIntent`: 入口 Prompt 本轮原始输出
- `resolvedIntent`: 真正用于路由的 intent

兼容性约定：

- 现有 `actualIntent` 继续记录 `resolvedIntent`
- `routingSteps` 增加可选 `rawIntent`

这样测试结果和评估仍按真实命中的 intent 工作，同时保留排查信息。

### 3. 错误处理

如果出现以下情况，直接视为 routing error：

- 入口 Prompt 未返回有效 intent
- 返回 `G` 但没有上一轮成功命中的 intent
- resolved intent 未命中 route
- route 对应 Prompt 不存在

其中“`G` 但没有上一轮 intent”按当前业务约定应被视为 bug，不做静默兜底。

### 4. 生成侧同步

routing 测试集生成 prompt 需要显式告知模型：

- `G` 表示沿用上一轮相同 intent
- 设计多轮用例时，`expectedIntent` 应写 resolved intent，而不是字面量 `G`

这样生成、enrichment、执行三条链路的语义保持一致。

## Files

- `src/lib/ai/routing-executor.ts`
- `src/lib/ai/test-agent-prompt.ts`
- `src/types/database.ts`
- `src/lib/ai/__tests__/test-runner-routing.test.ts`

## Testing

- 新增 runner 测试：第二轮返回 `G` 时，继续命中上一轮 Prompt
- 断言 `actualIntent` 记录 resolved intent
- 断言 `routingSteps.rawIntent` 保留 `G`
- 断言生成 prompt 明确写入 `G` 规则
