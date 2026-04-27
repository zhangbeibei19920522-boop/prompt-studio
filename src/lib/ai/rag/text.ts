export function normalizeText(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '').trim()
}

export function tokenizeText(input: string): string[] {
  return (
    input
      .toLowerCase()
      .match(/[a-z0-9]+|[\u4e00-\u9fff]/g)
      ?.filter(Boolean) ?? []
  )
}

export function lexicalOverlapScore(query: string, candidate: string): number {
  const queryTokens = new Set(tokenizeText(query))
  if (queryTokens.size === 0) return 0

  const candidateTokens = new Set(tokenizeText(candidate))
  if (candidateTokens.size === 0) return 0

  let matchedWeight = 0
  let totalWeight = 0
  for (const token of queryTokens) {
    totalWeight += token.length
    if (candidateTokens.has(token)) {
      matchedWeight += token.length
    }
  }

  return totalWeight > 0 ? matchedWeight / totalWeight : 0
}

export function phraseOverlapBonus(query: string, candidate: string): number {
  const normalizedQuery = normalizeText(query)
  const normalizedCandidate = normalizeText(candidate)
  if (!normalizedQuery || !normalizedCandidate) return 0

  if (normalizedCandidate === normalizedQuery) {
    return 1
  }

  if (normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate)) {
    return 0.6
  }

  return 0
}

const GENERIC_QUERY_SNIPPETS = [
  '怎么',
  '如何',
  '设置',
  '方法',
  '是什么',
  '什么',
  '作用',
  '介绍',
  '说明',
  '处理',
  '怎么办',
  '路径',
  '功能',
  '可以',
  '吗',
  '的',
]

function extractAnchorPhrases(text: string): string[] {
  let simplified = normalizeText(text)
  if (!simplified) return []

  for (const snippet of [...GENERIC_QUERY_SNIPPETS].sort((left, right) => right.length - left.length)) {
    simplified = simplified.replaceAll(snippet, ' ')
  }

  const phrases = new Set<string>()
  for (const run of simplified.match(/[\u4e00-\u9fff]+/g) ?? []) {
    const maxSize = Math.min(run.length, 8)
    for (let size = maxSize; size > 1; size--) {
      for (let index = 0; index <= run.length - size; index++) {
        phrases.add(run.slice(index, index + size))
      }
    }
  }

  for (const token of simplified.match(/[a-z0-9]+/g) ?? []) {
    if (token.length >= 2) {
      phrases.add(token)
    }
  }

  return [...phrases].filter(Boolean).sort((left, right) => {
    if (right.length !== left.length) return right.length - left.length
    return left.localeCompare(right)
  })
}

export function anchorPhraseScore(query: string, candidate: string): number {
  const normalizedCandidate = normalizeText(candidate)
  if (!normalizedCandidate) return 0

  const anchors = extractAnchorPhrases(query).slice(0, 5)
  if (anchors.length === 0) return 0

  let matchedWeight = 0
  let totalWeight = 0
  for (const anchor of anchors) {
    const weight = Math.max(1, anchor.length)
    totalWeight += weight
    if (normalizedCandidate.includes(anchor)) {
      matchedWeight += weight
    }
  }

  return totalWeight > 0 ? matchedWeight / totalWeight : 0
}

function hashText(input: string): number {
  let hash = 2166136261
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function createLocalTextVector(input: string, dimensions = 64): number[] {
  const vector = new Array(dimensions).fill(0)
  const normalized = normalizeText(input)
  const features = [
    ...tokenizeText(input),
    ...Array.from({ length: Math.max(0, normalized.length - 2) }, (_, index) =>
      normalized.slice(index, index + 3)
    ),
  ].filter(Boolean)

  for (const feature of features) {
    const hash = hashText(feature)
    const bucket = hash % dimensions
    const sign = hash % 2 === 0 ? 1 : -1
    vector[bucket] += sign
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + (value * value), 0))
  return magnitude > 0 ? vector.map((value) => value / magnitude) : vector
}

export function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length)
  if (length === 0) return 0

  let dot = 0
  let leftMagnitude = 0
  let rightMagnitude = 0
  for (let index = 0; index < length; index++) {
    const leftValue = left[index] ?? 0
    const rightValue = right[index] ?? 0
    dot += leftValue * rightValue
    leftMagnitude += leftValue * leftValue
    rightMagnitude += rightValue * rightValue
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) return 0
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude))
}
