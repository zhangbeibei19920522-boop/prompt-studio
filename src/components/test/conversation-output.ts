import type { TestCaseResult } from "@/types/database"

export interface ConversationTurn {
  role: "user" | "assistant"
  content: string
  intent?: string | null
}

function isRoutingErrorContent(content: string): boolean {
  return content.trim().startsWith("[ROUTING_ERROR]")
}

function isDisplayableIntent(intent: string | null | undefined): intent is string {
  const trimmed = intent?.trim()
  if (!trimmed) return false
  if (trimmed.includes("\n")) return false
  if (/[，。！？：；、"'“”‘’（）()]/.test(trimmed)) return false
  return /^[\p{L}\p{N}_./-]+$/u.test(trimmed)
}

function parseLabeledTurns(text: string): Array<{ role: "user" | "assistant"; content: string }> {
  const turns: Array<{ role: "user" | "assistant"; content: string }> = []
  const lines = text.split("\n")
  let currentRole: "user" | "assistant" | null = null
  let currentContent = ""

  for (const line of lines) {
    const userMatch = line.match(/^User[:：]\s*(.*)/)
    const assistantMatch = line.match(/^Assistant[:：]\s*(.*)/)

    if (userMatch) {
      if (currentRole) {
        turns.push({ role: currentRole, content: currentContent.trim() })
      }
      currentRole = "user"
      currentContent = userMatch[1]
    } else if (assistantMatch) {
      if (currentRole) {
        turns.push({ role: currentRole, content: currentContent.trim() })
      }
      currentRole = "assistant"
      currentContent = assistantMatch[1]
    } else if (currentRole) {
      currentContent += "\n" + line
    }
  }

  if (currentRole) {
    turns.push({ role: currentRole, content: currentContent.trim() })
  }

  return turns.filter((turn) => turn.content)
}

function extractExpectedAssistantIntent(content: string): {
  intent: string | null
  content: string
} {
  const trimmed = content.trim()
  if (!trimmed) {
    return { intent: null, content: trimmed }
  }

  const [firstLine, ...restLines] = trimmed.split("\n")
  const normalizedIntent = firstLine?.trim() ?? ""
  if (!isDisplayableIntent(normalizedIntent)) {
    return { intent: null, content: trimmed }
  }

  const remainingContent = restLines.join("\n").trim()
  if (!remainingContent) {
    return { intent: null, content: trimmed }
  }

  return {
    intent: normalizedIntent,
    content: remainingContent,
  }
}

export function parseExpectedConversationOutput(
  input: string,
  expectedOutput: string
): ConversationTurn[] {
  const expectedTurns = parseLabeledTurns(expectedOutput)
  if (expectedTurns.length > 0) {
    return expectedTurns.map((turn) => {
      if (turn.role !== "assistant") {
        return turn
      }

      const parsed = extractExpectedAssistantIntent(turn.content)
      if (!parsed.intent) {
        return {
          role: "assistant" as const,
          content: parsed.content,
        }
      }
      return {
        role: "assistant",
        intent: parsed.intent,
        content: parsed.content,
      }
    })
  }

  const inputTurns = parseLabeledTurns(input).filter((turn) => turn.role === "user")
  const userContent =
    inputTurns.length === 1
      ? inputTurns[0].content
      : input.trim()

  const turns: ConversationTurn[] = [
    { role: "user", content: userContent },
    { role: "assistant", content: expectedOutput.trim() },
  ]

  return turns.filter((turn) => turn.content)
}

export function parseConversationOutput(
  actualOutput: string,
  input: string,
  result?: Pick<TestCaseResult, "actualIntent" | "routingSteps">
): ConversationTurn[] {
  if (isRoutingErrorContent(actualOutput)) {
    const inputTurns = parseLabeledTurns(input).filter((turn) => turn.role === "user")
    if (inputTurns.length > 0) {
      return inputTurns
    }
    return input.trim() ? [{ role: "user", content: input.trim() }] : []
  }

  const turns: ConversationTurn[] = []
  const lines = actualOutput.split("\n")
  let currentRole: "user" | "assistant" | null = null
  let currentContent = ""

  for (const line of lines) {
    const userMatch = line.match(/^User[:：]\s*(.*)/)
    const assistantMatch = line.match(/^Assistant[:：]\s*(.*)/)

    if (userMatch) {
      if (currentRole) {
        turns.push({ role: currentRole, content: currentContent.trim() })
      }
      currentRole = "user"
      currentContent = userMatch[1]
    } else if (assistantMatch) {
      if (currentRole) {
        turns.push({ role: currentRole, content: currentContent.trim() })
      }
      currentRole = "assistant"
      currentContent = assistantMatch[1]
    } else if (currentRole) {
      currentContent += "\n" + line
    }
  }

  if (currentRole) {
    turns.push({ role: currentRole, content: currentContent.trim() })
  }

  const nonEmptyTurns = turns.filter(
    (turn) => turn.content && !(turn.role === "assistant" && isRoutingErrorContent(turn.content))
  )
  const fallbackIntent =
    result?.routingSteps?.length
      ? null
      : (result?.actualIntent?.includes("\n") ? null : result?.actualIntent)

  if (nonEmptyTurns.length >= 2) {
    let assistantIndex = 0

    return nonEmptyTurns.map((turn) => {
      if (turn.role !== "assistant") {
        return turn
      }

      const intent =
        result?.routingSteps?.[assistantIndex]?.actualIntent ??
        (assistantIndex === 0 ? fallbackIntent : null)
      assistantIndex += 1

      return {
        role: "assistant",
        content: turn.content,
        intent: isDisplayableIntent(intent) ? intent.trim() : null,
      }
    })
  }

  const fallbackTurns: ConversationTurn[] = [
    { role: "user", content: input },
    {
      role: "assistant",
      content: actualOutput,
      intent: isDisplayableIntent(fallbackIntent) ? fallbackIntent.trim() : null,
    },
  ]

  return fallbackTurns.filter(
    (turn) => turn.content && !(turn.role === "assistant" && isRoutingErrorContent(turn.content))
  )
}
