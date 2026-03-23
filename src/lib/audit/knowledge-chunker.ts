export interface KnowledgeChunk {
  sourceName: string
  sourceType: string
  sheetName: string | null
  chunkIndex: number
  content: string
}

interface BuildKnowledgeChunksInput {
  sourceName: string
  sourceType: string
  content: string
}

function normalizeBlockContent(block: string): string {
  return block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}

function isLikelyHeadingBlock(block: string): boolean {
  return (
    block.length > 0
    && block.length <= 24
    && !block.includes('|')
    && !/[.!?。！？:：;；]/.test(block)
  )
}

function mergeNarrativeBlocks(blocks: string[]): string[] {
  const merged: string[] = []

  for (let index = 0; index < blocks.length; index += 1) {
    const current = blocks[index]!
    const next = blocks[index + 1]

    if (next && isLikelyHeadingBlock(current) && next.length > current.length) {
      merged.push(`${current}\n${next}`)
      index += 1
      continue
    }

    merged.push(current)
  }

  return merged
}

export function buildKnowledgeChunks(input: BuildKnowledgeChunksInput): KnowledgeChunk[] {
  const lines = input.content.split('\n')
  const hasSheetMarkers = lines.some((line) => line.trim().startsWith('Sheet: '))

  if (!hasSheetMarkers) {
    const blocks = input.content
      .split(/\n\s*\n/g)
      .map(normalizeBlockContent)
      .filter(Boolean)
    const mergedBlocks = mergeNarrativeBlocks(blocks)

    return mergedBlocks
      .map((content, index) => ({
        sourceName: input.sourceName,
        sourceType: input.sourceType,
        sheetName: null,
        chunkIndex: index,
        content,
      }))
  }

  const chunks: KnowledgeChunk[] = []
  let currentSheetName: string | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }

    if (line.startsWith('Sheet: ')) {
      currentSheetName = line.slice('Sheet: '.length).trim() || null
      continue
    }

    chunks.push({
      sourceName: input.sourceName,
      sourceType: input.sourceType,
      sheetName: currentSheetName,
      chunkIndex: chunks.length,
      content: line,
    })
  }

  return chunks
}
