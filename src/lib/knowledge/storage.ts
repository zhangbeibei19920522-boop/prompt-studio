import fs from 'node:fs'
import path from 'node:path'

export interface KnowledgeArtifactPathsInput {
  projectId: string
  knowledgeBaseId: string
  knowledgeVersionId: string
}

export interface KnowledgeArtifactPaths {
  baseDir: string
  versionDir: string
  indexDir: string
  parentsFilePath: string
  chunksFilePath: string
  manifestFilePath: string
  indexManifestFilePath: string
}

export function buildKnowledgeArtifactPaths(input: KnowledgeArtifactPathsInput): KnowledgeArtifactPaths {
  const baseDir = path.join(process.cwd(), 'data', 'knowledge', input.projectId, input.knowledgeBaseId)
  const versionDir = path.join(baseDir, 'versions', input.knowledgeVersionId)
  const indexDir = path.join(baseDir, 'indexes', input.knowledgeVersionId)

  return {
    baseDir,
    versionDir,
    indexDir,
    parentsFilePath: path.join(versionDir, 'parents.jsonl'),
    chunksFilePath: path.join(versionDir, 'chunks.jsonl'),
    manifestFilePath: path.join(versionDir, 'manifest.json'),
    indexManifestFilePath: path.join(indexDir, 'manifest.json'),
  }
}

export function ensureKnowledgeArtifactDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

