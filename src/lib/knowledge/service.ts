import fs from 'node:fs'

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
  KnowledgeVersionPushResponse,
} from '@/types/api'
import type {
  Document,
  KnowledgeBase,
  KnowledgeBuildTask,
  KnowledgeIndexVersion,
  KnowledgeTaskInput,
  KnowledgeVersion,
} from '@/types/database'

import { buildKnowledgeArtifacts } from './builder'
import { ensureIndexIngestArtifacts, resolveIndexEmbeddingClient } from './index-ingest'
import { buildKnowledgeArtifactPaths, ensureKnowledgeArtifactDir } from './storage'

function writeJsonLines(filePath: string, rows: unknown[]): void {
  ensureKnowledgeArtifactDir(filePath)
  const content = rows.map((row) => JSON.stringify(row)).join('\n')
  fs.writeFileSync(filePath, content ? `${content}\n` : '', 'utf-8')
}

function writeJsonFile(filePath: string, data: unknown): void {
  ensureKnowledgeArtifactDir(filePath)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

function normalizeTaskInput(request: CreateKnowledgeBuildTaskRequest): KnowledgeTaskInput {
  return {
    documentIds: [...new Set(request.documentIds ?? [])],
    manualDrafts: request.manualDrafts ?? [],
    repairQuestions: request.repairQuestions ?? [],
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

  const input = normalizeTaskInput(request)
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
