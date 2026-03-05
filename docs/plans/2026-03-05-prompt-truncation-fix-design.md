# Prompt 生成截断修复设计

## 问题

当前 prompt 生成（preview/diff）是单次 LLM 调用，`max_tokens` 默认 4096。长 prompt 输出到上限后被截断，JSON 解析失败，内容直接丢失。

## 方案：提高 max_tokens + 截断续写

两层防御：
1. 提高 `max_tokens` 默认值到 16384，覆盖大多数场景
2. 检测到截断时自动续写拼接，兜底极端情况

## 修改范围

### 1. 提高 max_tokens 默认值

**文件：** `src/lib/ai/openai-compatible.ts`、`src/lib/ai/anthropic.ts`

将所有 `options?.maxTokens ?? 4096` 改为 `?? 16384`。

### 2. 截断检测函数

**文件：** `src/lib/ai/stream-handler.ts`

新增 `detectTruncatedJson(text: string): boolean`：
- 检查文本中是否有未闭合的 `` ```json `` 块（有开头无闭合 `` ``` ``）
- 返回 true 表示输出被截断

### 3. 续写循环

**文件：** `src/lib/ai/agent.ts`

在 `handleAgentChat` 中，流结束后、`parseAgentOutput` 之前加入续写：

```
流结束 → detectTruncatedJson → 如果截断:
  构建续写消息 [原始 messages + assistant(已输出) + user("请继续")]
  → chatStream → 拼接到 accumulated（不 yield text 事件）
  → yield continuation 进度事件
  → 再次检测截断 → 最多循环 3 次
→ parseAgentOutput
```

续写消息：
- 保留原始 system + user messages
- 追加 assistant 消息（已累积文本）
- 追加 user 消息："你的输出被截断了，请从断点处继续，只输出剩余内容，不要重复已输出的部分。"

### 4. 新增 StreamEvent 类型

**文件：** `src/types/ai.ts`

新增 `continuation` 事件：
```typescript
{ type: 'continuation', data: { iteration: number, maxIterations: number } }
```

### 5. 前端续写提示

**文件：** `src/components/chat/chat-area.tsx`

收到 `continuation` 事件时显示 "内容较长，正在续写 (1/3)..." 提示。

## 不影响的部分

- `parseAgentOutput` 逻辑不变
- Agent prompt 指令不变
- plan、memory、test-suite 等其他 JSON block 类型不受影响
- 测试 Agent（已有自己的 batch 机制）不受影响
- preview/diff 卡片渲染不变

## 安全措施

- 续写最多 3 次，防止无限循环
- 续写期间不 yield text 事件，避免 UI 重复显示
- 续写只在检测到未闭合 JSON 块时触发，plan/memory 等短输出不会误触发
