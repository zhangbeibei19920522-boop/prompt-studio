# Test Result Conversation Layout Design

## Goal

把测试结果页和历史记录详情里的结果展示改成更适合对话测试阅读的结构：

- `上下文` 保持在上方
- `预期输出` 和 `对话记录` 改成左右双栏
- `预期输出` 不再是纯文本，而是用和 `对话记录` 一致的会话样式呈现
- `回复评估` 保持在下方

## Current Context

- 当前结果页在 [`src/components/test/test-suite-detail.tsx`](/Users/cs001/prompt-studio/src/components/test/test-suite-detail.tsx) 内联渲染 `对话记录` 和 `预期输出`
- 当前历史记录详情在 [`src/components/test/test-run-history.tsx`](/Users/cs001/prompt-studio/src/components/test/test-run-history.tsx) 内联渲染 `对话记录`
- [`src/components/test/conversation-output.ts`](/Users/cs001/prompt-studio/src/components/test/conversation-output.ts) 已经能把 `actualOutput` 解析成多轮会话，并给助手消息挂上 intent badge

## Design

### 1. 抽通用会话面板

新增一个只负责渲染会话卡片列表的通用组件，供 `预期输出` 和 `对话记录` 复用。

- 支持传入标题
- 支持渲染用户/助手消息
- 支持可选 intent badge
- 不带业务评估逻辑

### 2. 预期输出会话化

`expectedOutput` 的渲染规则：

- 如果内容本身是 `User:/Assistant:` 多轮格式，就直接按会话解析并展示
- 如果只是单轮纯文本，就把当前 case 的 `input` 作为用户消息，把 `expectedOutput` 作为助手消息，拼成标准两条会话

`预期输出` 不显示 intent badge，只显示标准用户/助手标签和消息内容。

### 3. 双栏布局

当前结果页和历史记录详情统一为：

- 左侧：`预期输出`
- 右侧：`对话记录`
- 在窄屏下自动回落为上下堆叠

`上下文` 和 `回复评估` 的相对位置不变。

## Error Handling

- 如果 `expectedOutput` 为空，则左栏不渲染
- 如果 `actualOutput` 为空，则右栏不渲染
- 两侧任何一边缺失时，另一边保持单栏宽度

## Testing

- 为当前结果页补渲染测试，确认：
  - 存在双栏容器
  - `预期输出` 以会话形式渲染，而不是纯文本块
- 为历史记录详情补同类测试
- 为会话解析补测试，确认单轮 `expectedOutput` 会被包装成 `用户 -> 助手` 两条会话
