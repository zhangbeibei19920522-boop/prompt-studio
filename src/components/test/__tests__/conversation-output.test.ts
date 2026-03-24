import {
  parseConversationOutput,
  parseExpectedConversationOutput,
} from "@/components/test/conversation-output"

describe("conversation output parsing", () => {
  it("hides suspicious explanatory intents and routing error assistant text", () => {
    const turns = parseConversationOutput(
      '[ROUTING_ERROR] 未找到 intent "50dB，数据来自实验室 1kHz 单频噪声环境实测。" 对应的 Prompt',
      "这个手机运行时噪音多大？",
      {
        actualIntent: "50dB，数据来自实验室 1kHz 单频噪声环境实测。",
        routingSteps: [
          {
            turnIndex: 0,
            userInput: "这个手机运行时噪音多大？",
            actualIntent: "50dB，数据来自实验室 1kHz 单频噪声环境实测。",
            matchedPromptId: null,
            matchedPromptTitle: null,
            actualReply:
              '[ROUTING_ERROR] 未找到 intent "50dB，数据来自实验室 1kHz 单频噪声环境实测。" 对应的 Prompt',
          },
        ],
      }
    )

    expect(turns).toEqual([
      {
        role: "user",
        content: "这个手机运行时噪音多大？",
      },
    ])
  })

  it("wraps plain expected output into a user and assistant conversation", () => {
    const turns = parseExpectedConversationOutput(
      "我想寄修一下手机。",
      "好的，请问您的手机是哪一款？比如 Find X8 Pro。"
    )

    expect(turns).toEqual([
      {
        role: "user",
        content: "我想寄修一下手机。",
      },
      {
        role: "assistant",
        content: "好的，请问您的手机是哪一款？比如 Find X8 Pro。",
      },
    ])
  })

  it("parses labeled multi-turn expected output as a full conversation", () => {
    const turns = parseExpectedConversationOutput(
      "User: 我想寄修一下手机。\nAssistant:\nUser: Find X9。\nAssistant:",
      "User: 我想寄修一下手机。\nAssistant: 好的，请问您的手机是哪一款？比如 Find X8 Pro。\nUser: Find X9。\nAssistant: Find X9 有 Find X9 Pro 卫星通信版、Find X9 Pro 和 Find X9 三款，您选哪一款？"
    )

    expect(turns).toEqual([
      {
        role: "user",
        content: "我想寄修一下手机。",
      },
      {
        role: "assistant",
        content: "好的，请问您的手机是哪一款？比如 Find X8 Pro。",
      },
      {
        role: "user",
        content: "Find X9。",
      },
      {
        role: "assistant",
        content: "Find X9 有 Find X9 Pro 卫星通信版、Find X9 Pro 和 Find X9 三款，您选哪一款？",
      },
    ])
  })

  it("extracts assistant intent badges from expected output transcripts", () => {
    const turns = parseExpectedConversationOutput(
      "User: 我想寄修一下手机。\nAssistant:\nUser: 地址没问题。\nAssistant:",
      "User: 我想寄修一下手机。\nAssistant: P-JX\n好的，请问您的手机是哪一款？比如 Find X8 Pro。\nUser: 地址没问题。\nAssistant: P-JX\n好的，已为您下单成功，稍后会收到短信。"
    )

    expect(turns).toEqual([
      {
        role: "user",
        content: "我想寄修一下手机。",
      },
      {
        role: "assistant",
        intent: "P-JX",
        content: "好的，请问您的手机是哪一款？比如 Find X8 Pro。",
      },
      {
        role: "user",
        content: "地址没问题。",
      },
      {
        role: "assistant",
        intent: "P-JX",
        content: "好的，已为您下单成功，稍后会收到短信。",
      },
    ])
  })
})
