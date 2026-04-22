import { createHash } from 'node:crypto'

import { nanoid } from 'nanoid'

import type {
  Document,
  KnowledgeCoverageAudit,
  KnowledgeManualDraftInput,
  KnowledgeProfileConfig,
  KnowledgeRepairQuestionInput,
  KnowledgeReviewStatus,
  KnowledgeStageSummary,
} from '@/types/database'

import { getKnowledgeRuntimeProfile } from './profile'

export interface KnowledgeArtifactParentRecord {
  id: string
  question: string
  question_clean: string
  answer: string
  question_aliases: string[]
  metadata: Record<string, unknown>
  source_files: string[]
  source_record_ids: string[]
  review_status: KnowledgeReviewStatus
  record_kind: string
  is_high_risk: boolean
  inherited_risk_reason: string
}

export interface KnowledgeArtifactChunkRecord {
  id: string
  parent_id: string
  chunk_order: number
  section_title: string
  chunk_text: string
  embedding_text: string
  chunk_type: string
  metadata: Record<string, unknown>
}

export interface KnowledgeArtifactManifest {
  generatedAt: string
  profileKey: string
  projectName: string
  sourceSummary: Record<string, unknown>
  stageSummary: KnowledgeStageSummary
  coverageAudit: KnowledgeCoverageAudit
  pendingRecords: Array<Record<string, unknown>>
  blockedRecords: Array<Record<string, unknown>>
  highRiskRecords: Array<Record<string, unknown>>
  snapshotHash: string
}

export interface BuildKnowledgeArtifactsInput {
  projectName: string
  profileKey: string
  profileConfig?: Partial<KnowledgeProfileConfig>
  sourceDocuments: Document[]
  manualDrafts?: KnowledgeManualDraftInput[]
  repairQuestions?: KnowledgeRepairQuestionInput[]
}

export interface BuildKnowledgeArtifactsResult {
  parents: KnowledgeArtifactParentRecord[]
  chunks: KnowledgeArtifactChunkRecord[]
  manifest: KnowledgeArtifactManifest
  sourceSummary: Record<string, unknown>
  stageSummary: KnowledgeStageSummary
  coverageAudit: KnowledgeCoverageAudit
}

interface WorkingRecord {
  id: string
  sourceType: 'document' | 'manual' | 'repair'
  question: string
  canonicalQuestion: string
  answer: string
  metadata: Record<string, unknown>
  sourceFiles: string[]
  sourceRecordIds: string[]
  reviewStatus: KnowledgeReviewStatus
  recordKind: string
  isHighRisk: boolean
  riskReason: string
  blockedReason: string
  pendingReason: string
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripExtension(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, '')
}

function removeQuestionSuffixes(value: string, suffixes: string[]): string {
  let output = value
  for (const suffix of suffixes) {
    const pattern = new RegExp(`(?:^|[\\s_-])${escapeRegex(suffix)}$`, 'i')
    output = output.replace(pattern, '').trim()
  }
  return output
}

function removeCanonicalSuffixes(value: string, suffixes: string[]): string {
  let output = value
  for (const suffix of suffixes) {
    const pattern = new RegExp(`(?:^|[\\s_-])${escapeRegex(suffix)}$`, 'i')
    output = output.replace(pattern, '').trim()
  }
  return output
}

function titleizeDocumentName(name: string, suffixes: string[]): string {
  const raw = stripExtension(name)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const withoutDate = raw
    .replace(/\b(19|20)\d{2}(?:[-_/]\d{1,2}(?:[-_/]\d{1,2})?)?\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return removeQuestionSuffixes(withoutDate || raw, suffixes) || raw
}

function buildCanonicalQuestion(value: string, suffixes: string[]): string {
  const cleaned = removeCanonicalSuffixes(
    value
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
    suffixes,
  )

  return cleaned || value.trim()
}

function normalizeQuestionKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function normalizeAnswerKey(value: string): string {
  return normalizeWhitespace(value).toLowerCase()
}

function splitAnswerIntoChunks(answer: string): string[] {
  const blocks = normalizeWhitespace(answer)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

  return blocks.length > 0 ? blocks : [normalizeWhitespace(answer)]
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function buildSourceSummary(input: BuildKnowledgeArtifactsInput): Record<string, unknown> {
  return {
    projectName: input.projectName,
    profileKey: input.profileKey,
    documentCount: input.sourceDocuments.length,
    manualDraftCount: input.manualDrafts?.length ?? 0,
    repairQuestionCount: input.repairQuestions?.length ?? 0,
    sourceCount:
      input.sourceDocuments.length +
      (input.manualDrafts?.length ?? 0) +
      (input.repairQuestions?.length ?? 0),
  }
}

export function buildKnowledgeArtifacts(input: BuildKnowledgeArtifactsInput): BuildKnowledgeArtifactsResult {
  const profile = getKnowledgeRuntimeProfile(input.profileKey, input.profileConfig)
  const riskPattern = new RegExp(`\\b(${profile.riskKeywords.map(escapeRegex).join('|')})\\b`, 'i')
  const sourceSummary = buildSourceSummary(input)

  const rawRecords: WorkingRecord[] = []
  const excludedRecords: WorkingRecord[] = []
  const highRiskRecords: WorkingRecord[] = []
  const pendingRecords: WorkingRecord[] = []
  const blockedRecords: WorkingRecord[] = []

  for (const document of input.sourceDocuments) {
    const answer = normalizeWhitespace(document.content)
    const question = titleizeDocumentName(document.name, profile.questionSuffixes)
    const canonicalQuestion = buildCanonicalQuestion(question, profile.canonicalSuffixes)
    const isHighRisk = riskPattern.test(`${question}\n${answer}`)

    const record: WorkingRecord = {
      id: document.id,
      sourceType: 'document',
      question,
      canonicalQuestion,
      answer,
      metadata: {
        sourceType: 'document',
        documentId: document.id,
        documentType: document.type,
      },
      sourceFiles: [document.name],
      sourceRecordIds: [document.id],
      reviewStatus: 'approved',
      recordKind: 'merge_ready_faq',
      isHighRisk,
      riskReason: isHighRisk ? 'Matched generic high-risk policy keywords' : '',
      blockedReason: '',
      pendingReason: '',
    }

    if (!answer) {
      excludedRecords.push(record)
      continue
    }
    if (isHighRisk) {
      record.reviewStatus = 'pending'
      highRiskRecords.push(record)
      continue
    }

    rawRecords.push(record)
  }

  for (const draft of input.manualDrafts ?? []) {
    const answer = normalizeWhitespace(draft.content)
    const question = normalizeWhitespace(draft.title)
    const canonicalQuestion = buildCanonicalQuestion(question, profile.canonicalSuffixes)
    const isHighRisk = riskPattern.test(`${question}\n${answer}`)

    const record: WorkingRecord = {
      id: `manual:${nanoid()}`,
      sourceType: 'manual',
      question,
      canonicalQuestion,
      answer,
      metadata: {
        sourceType: 'manual',
        sourceLabel: draft.source || 'manual',
      },
      sourceFiles: [draft.source || 'manual'],
      sourceRecordIds: [],
      reviewStatus: 'approved',
      recordKind: 'manual_faq',
      isHighRisk,
      riskReason: isHighRisk ? 'Matched generic high-risk policy keywords' : '',
      blockedReason: '',
      pendingReason: '',
    }

    if (!answer || !question) {
      excludedRecords.push(record)
      continue
    }
    if (isHighRisk) {
      record.reviewStatus = 'pending'
      highRiskRecords.push(record)
      continue
    }

    rawRecords.push(record)
  }

  for (const repair of input.repairQuestions ?? []) {
    const question = normalizeWhitespace(repair.query)
    const canonicalQuestion = buildCanonicalQuestion(question, profile.canonicalSuffixes)
    const record: WorkingRecord = {
      id: `repair:${nanoid()}`,
      sourceType: 'repair',
      question,
      canonicalQuestion,
      answer: '',
      metadata: {
        sourceType: 'repair',
        problem: normalizeWhitespace(repair.problem),
        direction: normalizeWhitespace(repair.direction),
      },
      sourceFiles: ['repair'],
      sourceRecordIds: [],
      reviewStatus: 'pending',
      recordKind: 'repair_request',
      isHighRisk: false,
      riskReason: '',
      blockedReason: '',
      pendingReason: 'Repair question requires an authored answer before release',
    }

    if (!question) {
      excludedRecords.push(record)
      continue
    }

    pendingRecords.push(record)
  }

  const groupedApprovedRecords = new Map<string, WorkingRecord[]>()
  for (const record of rawRecords) {
    const key = normalizeQuestionKey(record.canonicalQuestion || record.question)
    const group = groupedApprovedRecords.get(key) ?? []
    group.push(record)
    groupedApprovedRecords.set(key, group)
  }

  const mergedApprovedRecords: WorkingRecord[] = []

  for (const group of groupedApprovedRecords.values()) {
    const [winner, ...rest] = group
    const merged: WorkingRecord = {
      ...winner,
      metadata: { ...winner.metadata },
      sourceFiles: [...winner.sourceFiles],
      sourceRecordIds: [...winner.sourceRecordIds],
    }
    const winnerAnswerKey = normalizeAnswerKey(winner.answer)

    for (const candidate of rest) {
      if (normalizeAnswerKey(candidate.answer) === winnerAnswerKey) {
        merged.sourceFiles = [...new Set([...merged.sourceFiles, ...candidate.sourceFiles])]
        merged.sourceRecordIds = [...new Set([...merged.sourceRecordIds, ...candidate.sourceRecordIds])]
        continue
      }

      blockedRecords.push({
        ...candidate,
        reviewStatus: 'blocked',
        blockedReason: 'Conflicting answers were detected for the same normalized question',
      })
    }

    mergedApprovedRecords.push(merged)
  }

  const parents: KnowledgeArtifactParentRecord[] = mergedApprovedRecords.map((record) => {
    const parentId = nanoid()
    return {
      id: parentId,
      question: record.question,
      question_clean: record.canonicalQuestion,
      answer: record.answer,
      question_aliases: [],
      metadata: {
        ...record.metadata,
        profileKey: profile.key,
      },
      source_files: record.sourceFiles,
      source_record_ids: record.sourceRecordIds,
      review_status: 'approved',
      record_kind: record.recordKind,
      is_high_risk: false,
      inherited_risk_reason: '',
    }
  })

  const chunks: KnowledgeArtifactChunkRecord[] = parents.flatMap((parent) =>
    splitAnswerIntoChunks(parent.answer).map((chunkText, index) => ({
      id: nanoid(),
      parent_id: parent.id,
      chunk_order: index + 1,
      section_title: index === 0 ? '概述' : `补充 ${index + 1}`,
      chunk_text: chunkText,
      embedding_text: `主问题：${parent.question_clean}\n答案片段：${chunkText}\n标准答案：${parent.answer}`,
      chunk_type: 'answer',
      metadata: {
        ...parent.metadata,
        question: parent.question_clean,
      },
    })),
  )

  const totalSourceCount = sourceSummary.sourceCount as number
  const coverage = totalSourceCount > 0 ? Math.round((parents.length / totalSourceCount) * 100) : 100
  const coverageReasons: string[] = []

  if (highRiskRecords.length > 0) {
    coverageReasons.push('High-risk records require manual review before release')
  }
  if (blockedRecords.length > 0) {
    coverageReasons.push('Conflicting records were blocked from publication')
  }
  if (pendingRecords.length > 0) {
    coverageReasons.push('Repair requests remain pending because they have no approved answer yet')
  }

  const coverageAudit: KnowledgeCoverageAudit = {
    coverage,
    auditStatus: coverage === 100 ? 'normal' : 'warning',
    reasons: coverageReasons,
    orphanRecords: pendingRecords.map((record) => record.question),
    ambiguityRecords: blockedRecords.map((record) => record.question),
  }

  const stageSummary: KnowledgeStageSummary = {
    sourceCount: totalSourceCount,
    excludedCount: excludedRecords.length,
    rawRecordCount: totalSourceCount,
    cleanedCount: totalSourceCount - excludedRecords.length,
    includeCount: totalSourceCount - excludedRecords.length,
    highRiskCount: highRiskRecords.length,
    conflictCount: blockedRecords.length,
    pendingCount: pendingRecords.length,
    blockedCount: blockedRecords.length,
    approvedCount: parents.length,
    parentCount: parents.length,
    chunkCount: chunks.length,
    coverage: coverageAudit.coverage,
    orphanCount: coverageAudit.orphanRecords.length,
    ambiguityCount: coverageAudit.ambiguityRecords.length,
    stageCounts: [
      { stage: 'sources', value: String(totalSourceCount) },
      { stage: 'approved', value: String(parents.length) },
      { stage: 'high_risk', value: String(highRiskRecords.length) },
      { stage: 'blocked', value: String(blockedRecords.length) },
      { stage: 'pending', value: String(pendingRecords.length) },
    ],
  }

  const manifestBase = {
    generatedAt: new Date().toISOString(),
    profileKey: profile.key,
    projectName: input.projectName,
    sourceSummary,
    stageSummary,
    coverageAudit,
    pendingRecords: pendingRecords.map((record) => ({
      id: record.id,
      question: record.question,
      reason: record.pendingReason,
      metadata: record.metadata,
    })),
    blockedRecords: blockedRecords.map((record) => ({
      id: record.id,
      question: record.question,
      reason: record.blockedReason,
      metadata: record.metadata,
      sourceFiles: record.sourceFiles,
    })),
    highRiskRecords: highRiskRecords.map((record) => ({
      id: record.id,
      question: record.question,
      reason: record.riskReason,
      metadata: record.metadata,
      sourceFiles: record.sourceFiles,
    })),
  }

  const manifest: KnowledgeArtifactManifest = {
    ...manifestBase,
    snapshotHash: sha256(
      JSON.stringify({
        parents,
        chunks,
        stageSummary,
        coverageAudit,
        sourceSummary,
      }),
    ),
  }

  return {
    parents,
    chunks,
    manifest,
    sourceSummary,
    stageSummary,
    coverageAudit,
  }
}
