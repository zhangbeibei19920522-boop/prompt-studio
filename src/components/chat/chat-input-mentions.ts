export interface MentionMatch {
  start: number
  end: number
  query: string
}

function isMentionBoundary(char: string | undefined) {
  if (!char) return true
  return !/[A-Za-z0-9_.-]/.test(char)
}

export function findMentionMatch(
  content: string,
  cursor: number
): MentionMatch | null {
  const textBeforeCursor = content.slice(0, cursor)
  const mentionStart = textBeforeCursor.lastIndexOf("@")

  if (mentionStart < 0) return null

  const charBeforeAt = textBeforeCursor[mentionStart - 1]
  if (!isMentionBoundary(charBeforeAt)) {
    return null
  }

  const query = textBeforeCursor.slice(mentionStart + 1)
  if (/[\s\[\]]/.test(query)) {
    return null
  }

  return {
    start: mentionStart,
    end: cursor,
    query,
  }
}

export function applyMentionSelection(
  content: string,
  match: MentionMatch
): { content: string; cursor: number } {
  const before = content.slice(0, match.start)
  const after = content.slice(match.end)
  const nextContent = `${before}${after}`.replace(/ {2,}/g, " ")

  return {
    content: nextContent,
    cursor: before.length,
  }
}
