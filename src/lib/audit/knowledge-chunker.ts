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

export function buildKnowledgeChunks(input: BuildKnowledgeChunksInput): KnowledgeChunk[] {
  const lines = input.content.split('\n')
  const hasSheetMarkers = lines.some((line) => line.trim().startsWith('Sheet: '))

  if (!hasSheetMarkers) {
    return input.content
      .split(/\n\s*\n/g)
      .map(normalizeBlockContent)
      .filter(Boolean)
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
