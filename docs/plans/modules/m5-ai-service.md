# M5: AI 服务层

> 依赖：M1, M2 | 产出：多模型接入 + 流式调用 + Agent Prompt 构造

## 目标

实现统一的 AI 调用接口，支持多家大模型厂商，支持 SSE 流式输出。

## 核心设计

### 统一接口，多 Provider 实现

大部分国内模型（Kimi、GLM、DeepSeek、通义千问）都兼容 OpenAI API 格式，因此只需实现两种 Provider：

1. **OpenAI 兼容** — 适用于 OpenAI、Kimi、GLM、DeepSeek、通义千问及任何兼容 API
2. **Anthropic** — 适用于 Claude 系列

### Provider 配置模板

| 厂商 | baseUrl | 备注 |
|------|---------|------|
| OpenAI | `https://api.openai.com/v1` | 默认 |
| Kimi | `https://api.moonshot.cn/v1` | OpenAI 兼容 |
| GLM | `https://open.bigmodel.cn/api/paas/v4` | OpenAI 兼容 |
| DeepSeek | `https://api.deepseek.com/v1` | OpenAI 兼容 |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | OpenAI 兼容 |
| Claude | `https://api.anthropic.com` | Anthropic 格式 |

## 文件清单

### `src/lib/ai/provider.ts` — AI Provider 统一接口

```typescript
// 核心函数：根据配置创建对应的调用函数
export function createAiProvider(config: AiProviderConfig): AiProvider

interface AiProvider {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>
  chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<string>
}
```

### `src/lib/ai/openai-compatible.ts` — OpenAI 兼容实现

- 使用 `fetch` 直接调用（不依赖 SDK，减少包体积）
- 支持流式（`stream: true`）和非流式
- 解析 SSE 数据格式 `data: {...}`

### `src/lib/ai/anthropic.ts` — Anthropic 实现

- 使用 `fetch` 调用 Anthropic Messages API
- 处理 Anthropic 特有的 SSE 事件格式

### `src/lib/ai/agent-prompt.ts` — Agent System Prompt 构造

按设计文档顺序拼装上下文：

```
1. System Prompt（角色定义 + 行为规则）
2. 全局业务信息
3. 项目业务信息
4. 被引用的 Prompt 内容
5. 被引用的知识库文档
6. 会话历史
7. 用户消息
```

导出两个核心函数：
- `buildPlanPrompt(context)` — 生成规划阶段的 prompt
- `buildExecutePrompt(context, plan)` — 生成执行阶段的 prompt

### `src/lib/ai/stream-handler.ts` — SSE 流式响应处理

将 AI 的流式输出转换为前端可消费的 SSE 事件流。

## 提交

```bash
git add src/lib/ai/
git commit -m "feat: add AI service layer with multi-provider support and streaming"
```
