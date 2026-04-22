interface PromptOption {
  id: string
  title: string
}

function isEquivalentSeparator(char: string): boolean {
  return char === "-" || char === "_" || /\s/.test(char)
}

export function normalizeRoutingKey(value: string): string {
  const trimmed = value.trim().toLowerCase()
  let normalized = ""

  for (const char of trimmed) {
    if (isEquivalentSeparator(char)) {
      continue
    }
    normalized += char
  }

  return normalized
}

export function buildRoutesFromPrompts(
  prompts: PromptOption[],
  entryPromptId: string
): Array<{ intent: string; promptId: string; targetType: "prompt"; targetId: string }> {
  return prompts
    .filter((prompt) => prompt.id !== entryPromptId)
    .map((prompt) => ({
      intent: prompt.title,
      promptId: prompt.id,
      targetType: "prompt",
      targetId: prompt.id,
    }))
}

export function findUniquePromptMatch(
  intent: string,
  prompts: PromptOption[],
  entryPromptId: string
): PromptOption | null {
  const normalizedIntent = normalizeRoutingKey(intent)
  if (!normalizedIntent) {
    return null
  }

  const matches = prompts.filter(
    (prompt) =>
      prompt.id !== entryPromptId &&
      normalizeRoutingKey(prompt.title) === normalizedIntent
  )

  return matches.length === 1 ? matches[0] : null
}
