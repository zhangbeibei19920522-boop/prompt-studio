# Prompt 截断修复 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 解决长 prompt 生成/修改时因 max_tokens 不足导致输出截断、JSON 解析失败的问题。

**Architecture:** 两层防御 — 提高 max_tokens 默认值（16384）减少截断概率 + 截断自动续写机制兜底。续写检测基于未闭合的 ```json 块，续写循环最多 3 次，仅影响 handleAgentChat，不影响 test agent。

**Tech Stack:** TypeScript, Next.js SSE streaming

---

### Task 1: 提高 max_tokens 默认值

**Files:**
- Modify: `src/lib/ai/openai-compatible.ts:43,69,84`
- Modify: `src/lib/ai/anthropic.ts:51,79,95`

**Step 1: 修改 openai-compatible.ts**

将 3 处 `options?.maxTokens ?? 4096` 改为 `options?.maxTokens ?? 16384`：

```typescript
// line 43 (chat 方法)
...buildTokenLimit(model, options?.maxTokens ?? 16384),

// line 69 (chatStream 日志)
...buildTokenLimit(model, options?.maxTokens ?? 16384),

// line 84 (chatStream 请求)
...buildTokenLimit(model, options?.maxTokens ?? 16384),
```

**Step 2: 修改 anthropic.ts**

将 3 处 `options?.maxTokens ?? 4096` 改为 `options?.maxTokens ?? 16384`：

```typescript
// line 51 (chat 方法)
max_tokens: options?.maxTokens ?? 16384,

// line 79 (chatStream 日志)
max_tokens: options?.maxTokens ?? 16384,

// line 95 (chatStream 请求)
max_tokens: options?.maxTokens ?? 16384,
```

**Step 3: Commit**

```bash
git add src/lib/ai/openai-compatible.ts src/lib/ai/anthropic.ts
git commit -m "feat: 提高 max_tokens 默认值到 16384"
```

---

### Task 2: 添加截断检测函数

**Files:**
- Modify: `src/lib/ai/stream-handler.ts`

**Step 1: 在 stream-handler.ts 末尾添加 detectTruncatedJson 函数**

在 `parseAgentOutput` 函数之后添加：

```typescript
/**
 * Detect whether streamed AI output contains a truncated JSON code block.
 * A truncated block has an opening ```json fence but no corresponding closing ```.
 */
export function detectTruncatedJson(text: string): boolean {
  // Find all ```json openings
  const openRegex = /```json\b/g
  const closeRegex = /```(?!json)/g

  const opens: number[] = []
  const closes: number[] = []

  let m: RegExpExecArray | null
  while ((m = openRegex.exec(text)) !== null) opens.push(m.index)
  while ((m = closeRegex.exec(text)) !== null) closes.push(m.index)

  // For each opening, check if there's a corresponding close after it
  for (const openIdx of opens) {
    const hasClose = closes.some(closeIdx => closeIdx > openIdx)
    if (!hasClose) return true
  }

  return false
}
```

**Step 2: Commit**

```bash
git add src/lib/ai/stream-handler.ts
git commit -m "feat: 添加截断检测函数 detectTruncatedJson"
```

---

### Task 3: 添加 continuation StreamEvent 类型

**Files:**
- Modify: `src/types/ai.ts:98-108`

**Step 1: 在 StreamEvent 联合类型中添加 continuation 事件**

在 `| { type: 'test-suite-progress'; data: TestSuiteProgressData }` 之后、`| { type: 'done' }` 之前插入：

```typescript
  | { type: 'continuation'; data: { iteration: number; maxIterations: number } }
```

完整的 StreamEvent 变为：

```typescript
export type StreamEvent =
  | { type: 'text'; content: string }
  | { type: 'context'; data: AgentContextSummary }
  | { type: 'plan'; data: PlanData }
  | { type: 'preview'; data: PreviewData }
  | { type: 'diff'; data: DiffData }
  | { type: 'memory'; data: MemoryCommandData }
  | { type: 'test-suite'; data: TestSuiteGenerationData }
  | { type: 'test-suite-progress'; data: TestSuiteProgressData }
  | { type: 'continuation'; data: { iteration: number; maxIterations: number } }
  | { type: 'done' }
  | { type: 'error'; message: string }
```

**Step 2: Commit**

```bash
git add src/types/ai.ts
git commit -m "feat: 添加 continuation StreamEvent 类型"
```

---

### Task 4: 在 agent.ts 中实现续写循环

**Files:**
- Modify: `src/lib/ai/agent.ts`

**Step 1: 添加 import**

在文件顶部 import 列表中，从 `./stream-handler` 增加 `detectTruncatedJson`：

```typescript
import { parseAgentOutput, detectTruncatedJson } from './stream-handler'
```

**Step 2: 在 handleAgentChat 中添加续写逻辑**

在第 89 行（`console.log('[Agent] Stream complete...')`）之后、第 92 行（`const { jsonBlocks, plainText } = parseAgentOutput(accumulated)`）之前，插入续写循环：

```typescript
    // 5.5 Continuation: detect truncated JSON and auto-continue
    const MAX_CONTINUATIONS = 3
    let continuationCount = 0

    while (detectTruncatedJson(accumulated) && continuationCount < MAX_CONTINUATIONS) {
      continuationCount++
      console.log('[Agent] Truncated JSON detected, continuation', continuationCount, '/', MAX_CONTINUATIONS)

      yield {
        type: 'continuation',
        data: { iteration: continuationCount, maxIterations: MAX_CONTINUATIONS },
      }

      // Build continuation messages: original messages + assistant output so far + continue instruction
      const continuationMessages: import('@/types/ai').ChatMessage[] = [
        ...messages,
        { role: 'assistant' as const, content: accumulated },
        { role: 'user' as const, content: '你的输出被截断了，请从断点处继续，只输出剩余内容，不要重复已输出的部分。' },
      ]

      for await (const chunk of provider.chatStream(continuationMessages)) {
        accumulated += chunk
        yield { type: 'text', content: chunk }
      }

      console.log('[Agent] Continuation', continuationCount, 'complete. Total length:', accumulated.length)
    }
```

**Step 3: Commit**

```bash
git add src/lib/ai/agent.ts
git commit -m "feat: 实现 Agent 截断自动续写机制"
```

---

### Task 5: 前端显示续写提示

**Files:**
- Modify: `src/components/chat/chat-area.tsx`

**Step 1: 添加 continuation state**

在 `const [batchProgress, setBatchProgress] = useState<TestSuiteProgressData | null>(null)` 之后添加：

```typescript
  const [continuationInfo, setContinuationInfo] = useState<{ iteration: number; maxIterations: number } | null>(null)
```

**Step 2: 在 useEffect 依赖中添加 continuationInfo**

```typescript
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, streamingText, pendingTestSuite, batchProgress, continuationInfo])
```

**Step 3: 在 handleSend 的 switch 中处理 continuation 事件**

在 `case "test-suite-progress":` 之前添加：

```typescript
            case "continuation":
              setContinuationInfo(event.data)
              break
```

**Step 4: 在 finally 块中清除 continuationInfo**

```typescript
      } finally {
        setIsStreaming(false)
        setStreamingText("")
        setContextSummary(null)
        setBatchProgress(null)
        setContinuationInfo(null)
        onMessagesChange()
      }
```

**Step 5: 在模板中显示续写提示**

在 `{batchProgress && !streamingText && (` 块之前添加：

```tsx
                {continuationInfo && (
                  <div className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground bg-muted/50 mb-1">
                    内容较长，正在续写 ({continuationInfo.iteration}/{continuationInfo.maxIterations})...
                  </div>
                )}
```

**Step 6: 更新条件渲染的判断**

将 `{(contextSummary || streamingText || batchProgress) && (` 改为：

```tsx
          {(contextSummary || streamingText || batchProgress || continuationInfo) && (
```

**Step 7: Commit**

```bash
git add src/components/chat/chat-area.tsx
git commit -m "feat: 前端显示续写进度提示"
```

---

### Task 6: 验证构建

**Step 1: 运行 build 确认无编译错误**

Run: `npm run build`
Expected: 编译成功，无 TypeScript 错误

**Step 2: 如有错误，修复后重新 build**

**Step 3: 最终 commit（如有修复）**

```bash
git add -A
git commit -m "fix: 修复构建问题"
```
