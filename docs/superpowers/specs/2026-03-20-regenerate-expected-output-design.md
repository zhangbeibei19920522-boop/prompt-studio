# Regenerate Expected Output Design

## Goal

为测试集详情页增加“重生成预期结果”能力，支持用户在 Prompt 或路由配置更新后，重新生成整套测试集的 `expectedOutput`。

## Requirements

- 入口在测试集详情页头部，靠近 `运行测试`
- 作用范围是整套测试集，不是单条 case
- 执行后直接覆盖当前测试集所有 case 的 `expectedOutput`
- 单 Prompt 和 routing 测试集都支持
- 失败时不阻塞全部，返回成功更新数量

## Design

### 1. 前端入口

在 [`src/components/test/test-suite-detail.tsx`](/Users/cs001/prompt-studio/src/components/test/test-suite-detail.tsx) 头部按钮区新增：

- `重生成预期结果`

点击后调用新的服务端 API，完成后刷新测试集详情。

### 2. 服务端 API

新增测试集级批量重生成入口：

- `POST /api/test-suites/[id]/regenerate-expected-outputs`

返回：

- `updatedCount`
- `totalCount`

### 3. 执行规则

#### 单 Prompt

对每条 case 重新执行当前 Prompt：

- 单轮：生成一次回复
- 多轮：对每个空的 `Assistant:` 占位重新生成回复

然后把完整对话写回 `expectedOutput`。

#### Routing

对每条 case 重新执行当前 routing 链路：

- 每个 `User:` 轮次都跑一次
  - 入口 Prompt -> intent
  - intent 路由到子 Prompt
  - 子 Prompt 输出回复

然后把完整对话写回 `expectedOutput`。

### 4. 失败策略

单条 case 失败：

- 保留原 `expectedOutput`
- 继续处理其他 case

最终返回成功更新数量，前端提示：

- `已更新 X/Y 条预期结果`

## Architecture

抽共享执行器，避免重复：

- 单 Prompt 预期生成使用与 `runTestSuite` 相同的对话执行逻辑
- routing 预期生成使用现有共享 routing 执行器

## Testing

- API 测试：
  - 单 Prompt 测试集可批量重生成
  - routing 测试集可批量重生成
  - 单条失败时继续并返回正确统计
- 组件测试：
  - 详情页包含 `重生成预期结果` 按钮
  - 按钮位于 `运行测试` 附近的头部动作区
