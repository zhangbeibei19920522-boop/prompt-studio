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
  indexParentsFilePath: string
  indexChunksFilePath: string
  indexVectorsFilePath: string
  indexIngestFilePath: string
}

export interface KnowledgeMappingArtifactPathsInput {
  projectId: string
  mappingVersionId: string
}

export interface KnowledgeMappingArtifactPaths {
  mappingDir: string
  recordsFilePath: string
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
    indexParentsFilePath: path.join(indexDir, 'parents.jsonl'),
    indexChunksFilePath: path.join(indexDir, 'chunks.jsonl'),
    indexVectorsFilePath: path.join(indexDir, 'vectors.jsonl'),
    indexIngestFilePath: path.join(indexDir, 'ingest.json'),
  }
}

export function buildKnowledgeMappingArtifactPaths(input: KnowledgeMappingArtifactPathsInput): KnowledgeMappingArtifactPaths {
  const mappingDir = path.join(process.cwd(), 'data', 'knowledge', input.projectId, 'mappings', input.mappingVersionId)

  return {
    mappingDir,
    recordsFilePath: path.join(mappingDir, 'records.jsonl'),
  }
}

export function ensureKnowledgeArtifactDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}
