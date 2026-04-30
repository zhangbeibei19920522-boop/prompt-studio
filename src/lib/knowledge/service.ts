import fs from 'node:fs'
import { createHash } from 'node:crypto'

import { nanoid } from 'nanoid'

import {
  createKnowledgeBase,
  findKnowledgeBaseById,
  findKnowledgeBaseByProjectId,
  updateKnowledgeBase,
} from '@/lib/db/repositories/knowledge-bases'
import {
  createKnowledgeBuildTask,
  findKnowledgeBuildTaskById,
  findKnowledgeBuildTasksByProject,
  updateKnowledgeBuildTask,
} from '@/lib/db/repositories/knowledge-build-tasks'
import {
  createKnowledgeScopeMappingVersion,
  findKnowledgeScopeMappingVersionById,
  findKnowledgeScopeMappingVersionsByProject,
} from '@/lib/db/repositories/knowledge-mapping-versions'
import {
  createKnowledgeScopeMapping,
  createKnowledgeScopeMappingRecord,
  deleteKnowledgeScopeMapping,
  deleteKnowledgeScopeMappingRecord,
  findKnowledgeScopeMappingById,
  findKnowledgeScopeMappingRecordById,
  findKnowledgeScopeMappingRecords,
  findKnowledgeScopeMappingsByProject,
  refreshKnowledgeScopeMappingSummary,
  updateKnowledgeScopeMapping,
  updateKnowledgeScopeMappingRecord,
} from '@/lib/db/repositories/knowledge-scope-mappings'
import { findDocumentById, findDocumentsByProject } from '@/lib/db/repositories/documents'
import {
  createKnowledgeIndexVersion,
  findKnowledgeIndexVersionByKnowledgeVersionId,
  findKnowledgeIndexVersionsByProject,
  updateKnowledgeIndexVersion,
} from '@/lib/db/repositories/knowledge-index-versions'
import { findProjectById } from '@/lib/db/repositories/projects'
import {
  createKnowledgeVersion,
  findKnowledgeVersionById,
  findKnowledgeVersionsByProject,
  replaceKnowledgeChunks,
  replaceKnowledgeParents,
  updateKnowledgeVersion,
} from '@/lib/db/repositories/knowledge-versions'
import type {
  CreateKnowledgeBaseRequest,
  CreateKnowledgeBuildTaskRequest,
  CreateKnowledgeBuildTaskResponse,
  CreateKnowledgeMappingVersionRequest,
  CreateKnowledgeScopeMappingRecordRequest,
  CreateKnowledgeScopeMappingRequest,
  KnowledgeVersionPushResponse,
  UpdateKnowledgeScopeMappingRecordRequest,
  UpdateKnowledgeScopeMappingRequest,
} from '@/types/api'
import type {
  Document,
  KnowledgeBase,
  KnowledgeBuildTask,
  KnowledgeIndexVersion,
  KnowledgeScopeMapping,
  KnowledgeScopeMappingDetail,
  KnowledgeScopeMappingRecord,
  KnowledgeScopeMappingVersion,
  KnowledgeTaskInput,
  KnowledgeVersion,
} from '@/types/database'

import { buildKnowledgeArtifacts } from './builder'
import { ensureIndexIngestArtifacts, resolveIndexEmbeddingClient } from './index-ingest'
import { parseKnowledgeScopeMappingContent } from './mapping-parser'
import { buildKnowledgeArtifactPaths, buildKnowledgeMappingArtifactPaths, ensureKnowledgeArtifactDir } from './storage'

function writeJsonLines(filePath: string, rows: unknown[]): void {
  ensureKnowledgeArtifactDir(filePath)
  const content = rows.map((row) => JSON.stringify(row)).join('\n')
  fs.writeFileSync(filePath, content ? `${content}\n` : '', 'utf-8')
}

function writeJsonFile(filePath: string, data: unknown): void {
  ensureKnowledgeArtifactDir(filePath)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function normalizeTaskInput(request: CreateKnowledgeBuildTaskRequest): KnowledgeTaskInput {
  return {
    documentIds: [...new Set(request.documentIds ?? [])],
    mappingId: request.mappingId ?? null,
    mappingVersionId: request.mappingVersionId ?? null,
    mappingRecords: request.mappingRecords ?? [],
    manualDrafts: request.manualDrafts ?? [],
    repairQuestions: request.repairQuestions ?? [],
  }
}

function resolveMappingVersionForTask(projectId: string, input: KnowledgeTaskInput): KnowledgeTaskInput {
  if (input.mappingId) {
    const mapping = findKnowledgeScopeMappingById(input.mappingId)
    if (!mapping || mapping.projectId !== projectId) {
      throw new Error(`Scope mapping "${input.mappingId}" was not found in project "${projectId}"`)
    }

    return {
      ...input,
      mappingId: mapping.id,
      mappingVersionId: null,
      mappingRecords: findKnowledgeScopeMappingRecords(mapping.id),
    }
  }

  if (!input.mappingVersionId) {
    return {
      ...input,
      mappingId: null,
      mappingVersionId: null,
      mappingRecords: input.mappingRecords ?? [],
    }
  }

  const mappingVersion = findKnowledgeScopeMappingVersionById(input.mappingVersionId)
  if (!mappingVersion || mappingVersion.projectId !== projectId) {
    throw new Error(`Mapping version "${input.mappingVersionId}" was not found in project "${projectId}"`)
  }

  return {
    ...input,
    mappingId: null,
    mappingVersionId: mappingVersion.id,
    mappingRecords: mappingVersion.records,
  }
}

function resolveDocumentsForTask(projectId: string, taskType: CreateKnowledgeBuildTaskRequest['taskType'], documentIds: string[]): Document[] {
  if (taskType === 'full' && documentIds.length === 0) {
    return findDocumentsByProject(projectId)
  }

  return documentIds.map((documentId) => {
    const document = findDocumentById(documentId)
    if (!document || document.projectId !== projectId) {
      throw new Error(`Document "${documentId}" was not found in project "${projectId}"`)
    }
    return document
  })
}

function mapStatusForArchivedVersion(versionId: string, currentProdVersionId: string | null): KnowledgeVersion['status'] {
  return versionId === currentProdVersionId ? 'prod' : 'draft'
}

function buildIndexManifest(version: KnowledgeVersion, knowledgeBase: KnowledgeBase, indexVersion: KnowledgeIndexVersion): Record<string, unknown> {
  return {
    knowledgeBaseId: knowledgeBase.id,
    knowledgeVersionId: version.id,
    knowledgeIndexVersionId: indexVersion.id,
    name: indexVersion.name,
    profileKey: indexVersion.profileKey,
    status: indexVersion.status,
    parentCount: indexVersion.parentCount,
    chunkCount: indexVersion.chunkCount,
    stageSummary: indexVersion.stageSummary,
    sourceSummary: version.sourceSummary,
    manifestFilePath: version.manifestFilePath,
    builtAt: indexVersion.builtAt,
    publishedAt: indexVersion.publishedAt,
  }
}

function resolvePostBuildTaskState(stageSummary: KnowledgeVersion['stageSummary']) {
  if (stageSummary.highRiskCount > 0 || stageSummary.blockedCount > 0) {
    return {
      status: 'pending' as const,
      currentStep: 'risk_review',
      progress: 100,
      completedAt: null,
    }
  }

  return {
    status: 'pending' as const,
    currentStep: 'result_review',
    progress: 100,
    completedAt: null,
  }
}

function getTaskProgressForStage(stage: string): number {
  switch (stage) {
    case 'stage1_source_manifest':
      return 12
    case 'stage2_raw_records':
      return 20
    case 'stage3_cleaned_records':
      return 28
    case 'stage4_routing':
      return 36
    case 'stage5_structure':
      return 44
    case 'stage6_promotion':
      return 52
    case 'stage7_merge':
      return 62
    case 'stage8_conflict_detection':
      return 72
    case 'stage9_release_gating':
      return 82
    case 'stage10_parents':
      return 90
    case 'stage11_coverage_audit':
      return 96
    default:
      return 10
  }
}

export function findKnowledgeBaseForProject(projectId: string): KnowledgeBase | null {
  return findKnowledgeBaseByProjectId(projectId)
}

export function createKnowledgeBaseForProject(projectId: string, request: CreateKnowledgeBaseRequest): KnowledgeBase {
  return createKnowledgeBase({
    projectId,
    name: request.name,
    profileKey: request.profileKey,
    profileConfig: request.profileConfig,
    repairConfig: request.repairConfig,
  })
}

export function listKnowledgeBuildTasks(projectId: string): KnowledgeBuildTask[] {
  return findKnowledgeBuildTasksByProject(projectId)
}

export function listKnowledgeVersions(projectId: string): KnowledgeVersion[] {
  return findKnowledgeVersionsByProject(projectId)
}

export function listKnowledgeIndexVersions(projectId: string): KnowledgeIndexVersion[] {
  return findKnowledgeIndexVersionsByProject(projectId)
}

export function listKnowledgeMappingVersions(projectId: string): KnowledgeScopeMappingVersion[] {
  return findKnowledgeScopeMappingVersionsByProject(projectId)
}

function buildKnowledgeScopeMappingDetail(mapping: KnowledgeScopeMapping): KnowledgeScopeMappingDetail {
  return {
    ...mapping,
    records: findKnowledgeScopeMappingRecords(mapping.id),
  }
}

function normalizeManagedScopeRecord(record: KnowledgeScopeMappingRecord): KnowledgeScopeMappingRecord {
  const scope = (record.scope && typeof record.scope === 'object' ? record.scope : {}) as Record<string, unknown>
  return {
    ...record,
    lookupKey: String(record.lookupKey ?? '').trim(),
    scope: Object.fromEntries(
      Object.entries(scope).flatMap(([key, values]) => {
        const normalizedValues = (Array.isArray(values) ? values : [values])
          .map((value) => String(value).trim())
          .filter(Boolean)
        return normalizedValues.length > 0 ? [[key, [...new Set(normalizedValues)]]] : []
      }),
    ),
    raw: record.raw && typeof record.raw === 'object' ? record.raw : {},
  }
}

function normalizeManagedLookupKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '').trim()
}

function assertUniqueManagedLookupKey(mappingId: string, lookupKey: string, currentRecordId?: string): void {
  const normalizedLookupKey = normalizeManagedLookupKey(lookupKey)
  const duplicated = findKnowledgeScopeMappingRecords(mappingId).find((record) => {
    return record.id !== currentRecordId && normalizeManagedLookupKey(record.lookupKey) === normalizedLookupKey
  })

  if (duplicated) {
    throw new Error(`Mapping record lookupKey "${lookupKey}" already exists`)
  }
}

function validateManagedScopeRecord(record: KnowledgeScopeMappingRecord): KnowledgeScopeMappingRecord {
  const normalized = normalizeManagedScopeRecord(record)
  if (!normalized.lookupKey) {
    throw new Error('Mapping record lookupKey is required')
  }
  if (Object.keys(normalized.scope).length === 0) {
    throw new Error('Mapping record scope is required')
  }
  return normalized
}

export function listKnowledgeScopeMappings(projectId: string): KnowledgeScopeMapping[] {
  return findKnowledgeScopeMappingsByProject(projectId)
}

export function getKnowledgeScopeMappingDetail(mappingId: string): KnowledgeScopeMappingDetail {
  const mapping = findKnowledgeScopeMappingById(mappingId)
  if (!mapping) {
    throw new Error(`Scope mapping "${mappingId}" was not found`)
  }

  return buildKnowledgeScopeMappingDetail(mapping)
}

export function createKnowledgeScopeMappingForProject(
  projectId: string,
  request: CreateKnowledgeScopeMappingRequest,
): KnowledgeScopeMappingDetail {
  const project = findProjectById(projectId)
  if (!project) {
    throw new Error(`Project "${projectId}" was not found`)
  }

  const parsed = parseKnowledgeScopeMappingContent(request.content)
  if (parsed.records.length === 0) {
    throw new Error(`${request.fileName} 映射表暂时无法解析：未识别到可用映射记录`)
  }

  const mapping = createKnowledgeScopeMapping({
    projectId,
    name: request.name,
    sourceFileName: request.fileName,
    sourceFileHash: sha256(request.content),
    keyField: parsed.keyField,
    scopeFields: parsed.scopeFields,
    rowCount: 0,
  })

  for (const [index, record] of parsed.records.entries()) {
    const normalized = validateManagedScopeRecord(record)
    createKnowledgeScopeMappingRecord({
      mappingId: mapping.id,
      lookupKey: normalized.lookupKey,
      scope: normalized.scope,
      raw: {
        sourceFileName: request.fileName,
        rowIndex: index + 1,
      },
    })
  }

  const updated = refreshKnowledgeScopeMappingSummary(mapping.id) ?? mapping
  return buildKnowledgeScopeMappingDetail(updated)
}

export function updateKnowledgeScopeMappingForProject(
  mappingId: string,
  request: UpdateKnowledgeScopeMappingRequest,
): KnowledgeScopeMappingDetail {
  const mapping = findKnowledgeScopeMappingById(mappingId)
  if (!mapping) {
    throw new Error(`Scope mapping "${mappingId}" was not found`)
  }

  const updated = updateKnowledgeScopeMapping(mappingId, {
    name: request.name?.trim() || undefined,
  })
  if (!updated) {
    throw new Error(`Scope mapping "${mappingId}" was not found`)
  }

  return buildKnowledgeScopeMappingDetail(updated)
}

export function deleteKnowledgeScopeMappingForProject(mappingId: string): void {
  const deleted = deleteKnowledgeScopeMapping(mappingId)
  if (!deleted) {
    throw new Error(`Scope mapping "${mappingId}" was not found`)
  }
}

export function createKnowledgeScopeMappingRecordForMapping(
  mappingId: string,
  request: CreateKnowledgeScopeMappingRecordRequest,
): KnowledgeScopeMappingRecord {
  const mapping = findKnowledgeScopeMappingById(mappingId)
  if (!mapping) {
    throw new Error(`Scope mapping "${mappingId}" was not found`)
  }

  const normalized = validateManagedScopeRecord({
    lookupKey: request.lookupKey,
    scope: request.scope,
    raw: request.raw ?? {},
  })
  assertUniqueManagedLookupKey(mappingId, normalized.lookupKey)
  const record = createKnowledgeScopeMappingRecord({
    mappingId,
    lookupKey: normalized.lookupKey,
    scope: normalized.scope,
    raw: normalized.raw,
  })
  refreshKnowledgeScopeMappingSummary(mappingId)
  return record
}

export function updateKnowledgeScopeMappingRecordForMapping(
  recordId: string,
  request: UpdateKnowledgeScopeMappingRecordRequest,
): KnowledgeScopeMappingRecord {
  const existing = findKnowledgeScopeMappingRecordById(recordId)
  if (!existing?.mappingId) {
    throw new Error(`Scope mapping record "${recordId}" was not found`)
  }

  const normalized = validateManagedScopeRecord({
    ...existing,
    lookupKey: request.lookupKey ?? existing.lookupKey,
    scope: request.scope ?? existing.scope,
    raw: request.raw ?? existing.raw ?? {},
  })
  assertUniqueManagedLookupKey(existing.mappingId, normalized.lookupKey, existing.id)
  const updated = updateKnowledgeScopeMappingRecord(recordId, {
    lookupKey: normalized.lookupKey,
    scope: normalized.scope,
    raw: normalized.raw,
  })
  if (!updated) {
    throw new Error(`Scope mapping record "${recordId}" was not found`)
  }

  refreshKnowledgeScopeMappingSummary(existing.mappingId)
  return updated
}

export function deleteKnowledgeScopeMappingRecordForMapping(recordId: string): void {
  const existing = findKnowledgeScopeMappingRecordById(recordId)
  if (!existing?.mappingId) {
    throw new Error(`Scope mapping record "${recordId}" was not found`)
  }

  const deleted = deleteKnowledgeScopeMappingRecord(recordId)
  if (!deleted) {
    throw new Error(`Scope mapping record "${recordId}" was not found`)
  }
  refreshKnowledgeScopeMappingSummary(existing.mappingId)
}

export function createKnowledgeMappingVersionForProject(
  projectId: string,
  request: CreateKnowledgeMappingVersionRequest,
): KnowledgeScopeMappingVersion {
  const project = findProjectById(projectId)
  if (!project) {
    throw new Error(`Project "${projectId}" was not found`)
  }

  const parsed = parseKnowledgeScopeMappingContent(request.content)
  if (parsed.records.length === 0) {
    throw new Error(`${request.fileName} 映射表暂时无法解析：未识别到可用映射记录`)
  }

  const mappingVersionId = nanoid()
  const paths = buildKnowledgeMappingArtifactPaths({ projectId, mappingVersionId })
  writeJsonLines(paths.recordsFilePath, parsed.records)

  return createKnowledgeScopeMappingVersion({
    id: mappingVersionId,
    projectId,
    name: request.name,
    fileName: request.fileName,
    fileHash: sha256(request.content),
    rowCount: parsed.rowCount,
    keyField: parsed.keyField,
    scopeFields: parsed.scopeFields,
    recordsFilePath: paths.recordsFilePath,
    records: parsed.records,
  })
}

export function startKnowledgeBuildTaskForProject(
  projectId: string,
  request: CreateKnowledgeBuildTaskRequest,
): CreateKnowledgeBuildTaskResponse {
  const project = findProjectById(projectId)
  if (!project) {
    throw new Error(`Project "${projectId}" was not found`)
  }

  const knowledgeBase = findKnowledgeBaseByProjectId(projectId)
  if (!knowledgeBase) {
    throw new Error(`Knowledge base for project "${projectId}" was not found`)
  }

  const input = resolveMappingVersionForTask(projectId, normalizeTaskInput(request))
  resolveDocumentsForTask(projectId, request.taskType, input.documentIds)

  const task = createKnowledgeBuildTask({
    projectId,
    knowledgeBaseId: knowledgeBase.id,
    name: request.name,
    taskType: request.taskType,
    baseVersionId: request.baseVersionId ?? null,
    input,
  })

  const queuedTask = updateKnowledgeBuildTask(task.id, {
    status: 'running',
    currentStep: 'queued',
    progress: 0,
    errorMessage: null,
  })

  return {
    task: queuedTask ?? task,
    version: null,
  }
}

export async function runKnowledgeBuildTask(taskId: string): Promise<void> {
  const task = findKnowledgeBuildTaskById(taskId)
  if (!task) {
    throw new Error(`Knowledge build task "${taskId}" was not found`)
  }

  if (task.completedAt || task.currentStep === 'risk_review' || task.currentStep === 'result_review' || task.currentStep === 'completed') {
    return
  }

  const project = findProjectById(task.projectId)
  if (!project) {
    throw new Error(`Project "${task.projectId}" was not found`)
  }

  const knowledgeBase = findKnowledgeBaseById(task.knowledgeBaseId)
  if (!knowledgeBase) {
    throw new Error(`Knowledge base "${task.knowledgeBaseId}" was not found`)
  }

  const documents = resolveDocumentsForTask(task.projectId, task.taskType, task.input.documentIds)

  try {
    const startedAt = task.startedAt ?? new Date().toISOString()
    updateKnowledgeBuildTask(task.id, {
      status: 'running',
      currentStep: 'building_artifacts',
      progress: 10,
      startedAt,
      errorMessage: null,
    })

    const artifacts = buildKnowledgeArtifacts({
      projectName: project.name,
      profileKey: knowledgeBase.profileKey,
      profileConfig: knowledgeBase.profileConfig,
      sourceDocuments: documents,
      mappingId: task.input.mappingId,
      mappingVersionId: task.input.mappingVersionId,
      mappingRecords: task.input.mappingRecords,
      manualDrafts: task.input.manualDrafts,
      repairQuestions: task.input.repairQuestions,
      onStageChange: (stage) => {
        updateKnowledgeBuildTask(task.id, {
          status: 'running',
          currentStep: 'building_artifacts',
          progress: getTaskProgressForStage(stage),
        })
      },
    })

    const knowledgeVersionId = nanoid()
    const paths = buildKnowledgeArtifactPaths({
      projectId: task.projectId,
      knowledgeBaseId: knowledgeBase.id,
      knowledgeVersionId,
    })

    writeJsonLines(paths.parentsFilePath, artifacts.parents)
    writeJsonLines(paths.chunksFilePath, artifacts.chunks)
    writeJsonFile(paths.manifestFilePath, artifacts.manifest)

    updateKnowledgeBuildTask(task.id, {
      status: 'running',
      currentStep: 'building_artifacts',
      progress: 98,
    })

    createKnowledgeVersion({
      id: knowledgeVersionId,
      knowledgeBaseId: knowledgeBase.id,
      taskId: task.id,
      name: task.name,
      buildProfile: knowledgeBase.profileKey,
      sourceSummary: artifacts.sourceSummary,
      stageSummary: artifacts.stageSummary,
      coverageAudit: artifacts.coverageAudit,
      qaPairCount: artifacts.parents.length,
      parentCount: artifacts.parents.length,
      chunkCount: artifacts.chunks.length,
      pendingCount: artifacts.stageSummary.pendingCount,
      blockedCount: artifacts.stageSummary.blockedCount,
      parentsFilePath: paths.parentsFilePath,
      chunksFilePath: paths.chunksFilePath,
      manifestFilePath: paths.manifestFilePath,
    })

    replaceKnowledgeParents(
      knowledgeVersionId,
      artifacts.parents.map((parent) => ({
        id: parent.id,
        question: parent.question,
        answer: parent.answer,
        questionAliases: parent.question_aliases,
        metadata: parent.metadata,
        sourceFiles: parent.source_files,
        sourceRecordIds: parent.source_record_ids,
        reviewStatus: parent.review_status,
        recordKind: parent.record_kind,
        isHighRisk: parent.is_high_risk,
        inheritedRiskReason: parent.inherited_risk_reason,
      })),
    )

    replaceKnowledgeChunks(
      knowledgeVersionId,
      artifacts.chunks.map((chunk) => ({
        id: chunk.id,
        parentId: chunk.parent_id,
        chunkOrder: chunk.chunk_order,
        sectionTitle: chunk.section_title,
        chunkText: chunk.chunk_text,
        embeddingText: chunk.embedding_text,
        chunkType: chunk.chunk_type,
        metadata: chunk.metadata,
      })),
    )

    const nextTaskState = resolvePostBuildTaskState(artifacts.stageSummary)
    updateKnowledgeBuildTask(task.id, {
      status: nextTaskState.status,
      currentStep: nextTaskState.currentStep,
      progress: nextTaskState.progress,
      knowledgeVersionId,
      stageSummary: artifacts.stageSummary,
      completedAt: nextTaskState.completedAt,
    })

    updateKnowledgeBase(knowledgeBase.id, {
      currentDraftVersionId: knowledgeVersionId,
    })
  } catch (error) {
    updateKnowledgeBuildTask(task.id, {
      status: 'failed',
      currentStep: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown build error',
      completedAt: new Date().toISOString(),
    })
    throw error
  }
}

export function ensureKnowledgeIndexVersion(versionId: string): KnowledgeIndexVersion {
  const version = findKnowledgeVersionById(versionId)
  if (!version) {
    throw new Error(`Knowledge version "${versionId}" was not found`)
  }

  const knowledgeBase = findKnowledgeBaseById(version.knowledgeBaseId)
  if (!knowledgeBase) {
    throw new Error(`Knowledge base "${version.knowledgeBaseId}" was not found`)
  }

  const existing = findKnowledgeIndexVersionByKnowledgeVersionId(versionId)
  if (existing) {
    const paths = buildKnowledgeArtifactPaths({
      projectId: knowledgeBase.projectId,
      knowledgeBaseId: knowledgeBase.id,
      knowledgeVersionId: version.id,
    })
    ensureIndexIngestArtifacts({ paths })
    writeJsonFile(paths.indexManifestFilePath, buildIndexManifest(version, knowledgeBase, existing))
    return existing
  }

  const paths = buildKnowledgeArtifactPaths({
    projectId: knowledgeBase.projectId,
    knowledgeBaseId: knowledgeBase.id,
    knowledgeVersionId: version.id,
  })

  const indexVersion = createKnowledgeIndexVersion({
    knowledgeBaseId: knowledgeBase.id,
    knowledgeVersionId: version.id,
    name: `${version.name} Index`,
    profileKey: knowledgeBase.profileKey,
    parentCount: version.parentCount,
    chunkCount: version.chunkCount,
    stageSummary: version.stageSummary,
    manifestFilePath: paths.indexManifestFilePath,
  })

  ensureIndexIngestArtifacts({ paths })
  writeJsonFile(paths.indexManifestFilePath, buildIndexManifest(version, knowledgeBase, indexVersion))
  return indexVersion
}

export async function ensureKnowledgeIndexVersionWithEmbedding(versionId: string): Promise<KnowledgeIndexVersion> {
  const version = findKnowledgeVersionById(versionId)
  if (!version) {
    throw new Error(`Knowledge version "${versionId}" was not found`)
  }

  const knowledgeBase = findKnowledgeBaseById(version.knowledgeBaseId)
  if (!knowledgeBase) {
    throw new Error(`Knowledge base "${version.knowledgeBaseId}" was not found`)
  }

  const embeddingClient = resolveIndexEmbeddingClient()
  const existing = findKnowledgeIndexVersionByKnowledgeVersionId(versionId)
  const paths = buildKnowledgeArtifactPaths({
    projectId: knowledgeBase.projectId,
    knowledgeBaseId: knowledgeBase.id,
    knowledgeVersionId: version.id,
  })

  if (existing) {
    if (embeddingClient) {
      await ensureIndexIngestArtifacts({
        paths,
        embeddingClient,
      })
    } else {
      ensureIndexIngestArtifacts({
        paths,
      })
    }
    writeJsonFile(paths.indexManifestFilePath, buildIndexManifest(version, knowledgeBase, existing))
    return existing
  }

  const indexVersion = createKnowledgeIndexVersion({
    knowledgeBaseId: knowledgeBase.id,
    knowledgeVersionId: version.id,
    name: `${version.name} Index`,
    profileKey: knowledgeBase.profileKey,
    parentCount: version.parentCount,
    chunkCount: version.chunkCount,
    stageSummary: version.stageSummary,
    manifestFilePath: paths.indexManifestFilePath,
  })

  if (embeddingClient) {
    await ensureIndexIngestArtifacts({
      paths,
      embeddingClient,
    })
  } else {
    ensureIndexIngestArtifacts({
      paths,
    })
  }
  writeJsonFile(paths.indexManifestFilePath, buildIndexManifest(version, knowledgeBase, indexVersion))
  return indexVersion
}

export async function pushKnowledgeVersionToStg(versionId: string): Promise<KnowledgeVersionPushResponse> {
  const version = findKnowledgeVersionById(versionId)
  if (!version) {
    throw new Error(`Knowledge version "${versionId}" was not found`)
  }

  const knowledgeBase = findKnowledgeBaseById(version.knowledgeBaseId)
  if (!knowledgeBase) {
    throw new Error(`Knowledge base "${version.knowledgeBaseId}" was not found`)
  }

  const indexVersion = await ensureKnowledgeIndexVersionWithEmbedding(versionId)
  const previousStgVersionId = knowledgeBase.currentStgVersionId
  const previousStgIndexVersionId = knowledgeBase.currentStgIndexVersionId
  const now = new Date().toISOString()

  if (
    previousStgVersionId &&
    previousStgVersionId !== versionId &&
    previousStgVersionId !== knowledgeBase.currentProdVersionId
  ) {
    updateKnowledgeVersion(previousStgVersionId, {
      status: mapStatusForArchivedVersion(previousStgVersionId, knowledgeBase.currentProdVersionId),
      publishedAt: null,
    })
  }

  if (
    previousStgIndexVersionId &&
    previousStgIndexVersionId !== indexVersion.id &&
    previousStgIndexVersionId !== knowledgeBase.currentProdIndexVersionId
  ) {
    updateKnowledgeIndexVersion(previousStgIndexVersionId, {
      status: 'ready',
      publishedAt: null,
    })
  }

  const updatedVersion = updateKnowledgeVersion(versionId, {
    status: 'stg',
    publishedAt: now,
  })!
  const updatedIndexVersion = updateKnowledgeIndexVersion(indexVersion.id, {
    status: 'stg',
    publishedAt: now,
  })!
  const updatedKnowledgeBase = updateKnowledgeBase(knowledgeBase.id, {
    currentStgVersionId: versionId,
    currentStgIndexVersionId: indexVersion.id,
  })!

  if (version.taskId) {
    updateKnowledgeBuildTask(version.taskId, {
      status: 'succeeded',
      currentStep: 'completed',
      progress: 100,
      knowledgeIndexVersionId: indexVersion.id,
      completedAt: now,
      errorMessage: null,
    })
  }

  return {
    knowledgeBase: updatedKnowledgeBase,
    version: updatedVersion,
    indexVersion: updatedIndexVersion,
  }
}

export async function pushKnowledgeVersionToProd(versionId: string): Promise<KnowledgeVersionPushResponse> {
  const version = findKnowledgeVersionById(versionId)
  if (!version) {
    throw new Error(`Knowledge version "${versionId}" was not found`)
  }

  const knowledgeBase = findKnowledgeBaseById(version.knowledgeBaseId)
  if (!knowledgeBase) {
    throw new Error(`Knowledge base "${version.knowledgeBaseId}" was not found`)
  }

  const indexVersion = await ensureKnowledgeIndexVersionWithEmbedding(versionId)
  const previousProdVersionId = knowledgeBase.currentProdVersionId
  const previousProdIndexVersionId = knowledgeBase.currentProdIndexVersionId
  const now = new Date().toISOString()

  if (previousProdVersionId && previousProdVersionId !== versionId) {
    updateKnowledgeVersion(previousProdVersionId, {
      status: 'archived',
      publishedAt: null,
    })
  }

  if (previousProdIndexVersionId && previousProdIndexVersionId !== indexVersion.id) {
    updateKnowledgeIndexVersion(previousProdIndexVersionId, {
      status: 'archived',
      publishedAt: null,
    })
  }

  const updatedVersion = updateKnowledgeVersion(versionId, {
    status: 'prod',
    publishedAt: now,
  })!
  const updatedIndexVersion = updateKnowledgeIndexVersion(indexVersion.id, {
    status: 'prod',
    publishedAt: now,
  })!
  const updatedKnowledgeBase = updateKnowledgeBase(knowledgeBase.id, {
    currentProdVersionId: versionId,
    currentProdIndexVersionId: indexVersion.id,
    currentStgVersionId: versionId,
    currentStgIndexVersionId: indexVersion.id,
  })!

  if (version.taskId) {
    updateKnowledgeBuildTask(version.taskId, {
      status: 'succeeded',
      currentStep: 'completed',
      progress: 100,
      knowledgeIndexVersionId: indexVersion.id,
      completedAt: now,
      errorMessage: null,
    })
  }

  return {
    knowledgeBase: updatedKnowledgeBase,
    version: updatedVersion,
    indexVersion: updatedIndexVersion,
  }
}

export async function rollbackKnowledgeVersion(versionId: string): Promise<KnowledgeVersionPushResponse> {
  return pushKnowledgeVersionToProd(versionId)
}
