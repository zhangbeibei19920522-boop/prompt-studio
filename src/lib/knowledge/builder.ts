import { createHash } from 'node:crypto'

import { nanoid } from 'nanoid'

import type {
  Document,
  KnowledgeArtifactManifest,
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

export interface BuildKnowledgeArtifactsInput {
  projectName: string
  profileKey: string
  profileConfig?: Partial<KnowledgeProfileConfig>
  sourceDocuments: Document[]
  manualDrafts?: KnowledgeManualDraftInput[]
  repairQuestions?: KnowledgeRepairQuestionInput[]
  onStageChange?: (stage: string) => void
}

export interface BuildKnowledgeArtifactsResult {
  parents: KnowledgeArtifactParentRecord[]
  chunks: KnowledgeArtifactChunkRecord[]
  manifest: KnowledgeArtifactManifest
  sourceSummary: Record<string, unknown>
  stageSummary: KnowledgeStageSummary
  coverageAudit: KnowledgeCoverageAudit
}

type SourceContentProfile = 'spreadsheet' | 'explicit_qa' | 'composite_doc' | 'plain_text'
type CandidateStatus = 'include' | 'exclude'
type RouteStatus = 'include' | 'exclude' | 'high_risk'
type StructureType = 'explicit_faq' | 'composite_doc'

interface SourceManifestRecord {
  id: string
  documentId: string
  sourceName: string
  sourceType: string
  contentProfile: SourceContentProfile
  isCandidateForIndex: boolean
  candidateStatus: CandidateStatus
  riskLevel: 'normal' | 'high'
  riskReason: string
  sourcePriority: number
}

interface StageRecord {
  id: string
  sourceDocumentId: string
  sourceDocumentName: string
  sourceType: 'document' | 'manual' | 'repair'
  extractionKind: 'table_row' | 'platform_variant' | 'explicit_qa' | 'composite_doc' | 'manual' | 'repair'
  question: string
  canonicalQuestion: string
  answer: string
  metadata: Record<string, unknown>
  sourceFiles: string[]
  sourceRecordIds: string[]
  routeStatus: RouteStatus
  reviewStatus: KnowledgeReviewStatus
  recordKind: string
  structureType: StructureType
  isHighRisk: boolean
  riskReason: string
  blockedReason: string
  pendingReason: string
}

interface WorkbookSection {
  sheetName: string
  rows: string[]
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

function normalizeRetrievalText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '').trim()
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

function inferChunkKind(sectionTitle: string, chunkText: string): string {
  const combined = `${sectionTitle}\n${chunkText}`.toLowerCase()
  if (/(步骤|路径|操作|进入|点击|打开|设置|step|path|click|open)/i.test(combined)) {
    return 'steps'
  }
  if (/(注意|提示|温馨|warning|note|tip)/i.test(combined)) {
    return 'note'
  }
  if (/(条件|适用|支持|限制|if|when|condition|support)/i.test(combined)) {
    return 'condition'
  }
  if (/(定义|介绍|说明|是什么|definition|overview|intro)/i.test(combined)) {
    return 'definition'
  }
  return 'faq'
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

function buildRiskPattern(keywords: string[]): RegExp | null {
  if (keywords.length === 0) return null
  return new RegExp(`\\b(${keywords.map(escapeRegex).join('|')})\\b`, 'i')
}

function splitWorkbookSections(content: string): WorkbookSection[] {
  const lines = normalizeWhitespace(content)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const sections: WorkbookSection[] = []
  let currentSheetName = 'Sheet1'
  let currentRows: string[] = []

  function flushCurrent() {
    if (currentRows.length === 0) return
    sections.push({
      sheetName: currentSheetName,
      rows: mergeWorkbookContinuationLines(currentRows),
    })
    currentRows = []
  }

  for (const line of lines) {
    const match = /^Sheet:\s*(.+)$/i.exec(line)
    if (match) {
      flushCurrent()
      currentSheetName = match[1].trim() || 'Sheet1'
      continue
    }
    currentRows.push(line)
  }

  flushCurrent()
  return sections
}

function mergeWorkbookContinuationLines(lines: string[]): string[] {
  const rows: string[] = []
  for (const line of lines) {
    if (line.includes('|') || rows.length === 0) {
      rows.push(line)
      continue
    }

    rows[rows.length - 1] = `${rows[rows.length - 1]}\n${line}`
  }
  return rows
}

function splitCells(row: string): string[] {
  return row.split('|').map((cell) => cell.trim())
}

function looksLikeHeaderRow(cells: string[]): boolean {
  return cells.some((cell) => /^(question|q|问题|answer|a|答案|response)$/i.test(cell)) || cells.length >= 3
}

function buildRecordId(documentId: string, parts: Array<string | number | null | undefined>): string {
  return [documentId, ...parts.filter(Boolean)].join(':')
}

function detectContentProfile(document: Document): SourceContentProfile {
  const content = normalizeWhitespace(document.content)
  if (!content) return 'plain_text'
  if (document.type === 'xlsx' || document.type === 'xls' || document.type === 'csv' || /^Sheet:/m.test(content)) {
    return 'spreadsheet'
  }
  if (/^\s*Q\s*[:：]/im.test(content) && /^\s*A\s*[:：]/im.test(content)) {
    return 'explicit_qa'
  }
  return 'composite_doc'
}

function buildSourceManifest(input: BuildKnowledgeArtifactsInput, riskPattern: RegExp | null): SourceManifestRecord[] {
  return input.sourceDocuments.map((document) => {
    const content = normalizeWhitespace(document.content)
    const contentProfile = detectContentProfile(document)
    const isCandidateForIndex = content.length > 0
    const isHighRisk = riskPattern ? riskPattern.test(`${document.name}\n${content.slice(0, 4000)}`) : false

    return {
      id: `source:${document.id}`,
      documentId: document.id,
      sourceName: document.name,
      sourceType: document.type,
      contentProfile,
      isCandidateForIndex,
      candidateStatus: isCandidateForIndex ? 'include' : 'exclude',
      riskLevel: isHighRisk ? 'high' : 'normal',
      riskReason: isHighRisk ? 'Matched generic high-risk policy keywords' : '',
      sourcePriority: contentProfile === 'spreadsheet' ? 90 : contentProfile === 'explicit_qa' ? 80 : 60,
    }
  })
}

function extractSpreadsheetRows(document: Document, suffixes: string[]): StageRecord[] {
  const sections = splitWorkbookSections(document.content)
  const records: StageRecord[] = []

  for (const section of sections) {
    if (section.rows.length === 0) continue

    const firstCells = splitCells(section.rows[0])
    const hasHeader = looksLikeHeaderRow(firstCells)

    if (hasHeader) {
      const header = firstCells
      const questionIndex = header.findIndex((cell) => /^(question|q|问题)$/i.test(cell))
      const answerIndexes = header
        .map((cell, index) => ({ cell, index }))
        .filter(({ cell }) => /^(answer|a|答案|response)$/i.test(cell))
        .map(({ index }) => index)

      for (const [offset, row] of section.rows.slice(1).entries()) {
        const cells = splitCells(row)
        const effectiveQuestionIndex = questionIndex >= 0 ? questionIndex : 0
        const question = normalizeWhitespace(cells[effectiveQuestionIndex] ?? '')
        if (!question) continue

        const effectiveAnswerIndexes =
          answerIndexes.length > 0
            ? answerIndexes
            : header.map((_, index) => index).filter((index) => index !== effectiveQuestionIndex)

        for (const answerIndex of effectiveAnswerIndexes) {
          const answer = normalizeWhitespace(cells[answerIndex] ?? '')
          if (!answer) continue

          const variantLabel =
            answerIndexes.length > 0 && answerIndexes.length === 1 ? undefined : normalizeWhitespace(header[answerIndex] ?? '')

          records.push({
            id: buildRecordId(document.id, ['sheet', section.sheetName, offset + 2, answerIndex]),
            sourceDocumentId: document.id,
            sourceDocumentName: document.name,
            sourceType: 'document',
            extractionKind: variantLabel ? 'platform_variant' : 'table_row',
            question,
            canonicalQuestion: buildCanonicalQuestion(question, suffixes),
            answer,
            metadata: {
              sourceType: 'document',
              documentId: document.id,
              documentType: document.type,
              sheetName: section.sheetName,
              rowIndex: offset + 2,
              variantLabel: variantLabel || undefined,
            },
            sourceFiles: [document.name],
            sourceRecordIds: [buildRecordId(document.id, ['sheet', section.sheetName, offset + 2])],
            routeStatus: 'include',
            reviewStatus: 'approved',
            recordKind: 'explicit_spreadsheet_faq',
            structureType: 'explicit_faq',
            isHighRisk: false,
            riskReason: '',
            blockedReason: '',
            pendingReason: '',
          })
        }
      }

      continue
    }

    for (const [offset, row] of section.rows.entries()) {
      const cells = splitCells(row)
      if (cells.length < 2) continue
      const question = normalizeWhitespace(cells[0] ?? '')
      const answer = normalizeWhitespace(cells.slice(1).join(' | '))
      if (!question || !answer) continue

      records.push({
        id: buildRecordId(document.id, ['sheet', section.sheetName, offset + 1]),
        sourceDocumentId: document.id,
        sourceDocumentName: document.name,
        sourceType: 'document',
        extractionKind: 'table_row',
        question,
        canonicalQuestion: buildCanonicalQuestion(question, suffixes),
        answer,
        metadata: {
          sourceType: 'document',
          documentId: document.id,
          documentType: document.type,
          sheetName: section.sheetName,
          rowIndex: offset + 1,
        },
        sourceFiles: [document.name],
        sourceRecordIds: [buildRecordId(document.id, ['sheet', section.sheetName, offset + 1])],
        routeStatus: 'include',
        reviewStatus: 'approved',
        recordKind: 'explicit_spreadsheet_faq',
        structureType: 'explicit_faq',
        isHighRisk: false,
        riskReason: '',
        blockedReason: '',
        pendingReason: '',
      })
    }
  }

  return records
}

function extractTextQuestionAnswerPairs(document: Document, suffixes: string[]): StageRecord[] {
  const content = normalizeWhitespace(document.content)
  const pairs: StageRecord[] = []
  const qaPattern = /(?:^|\n)\s*Q\s*[:：]\s*(.+?)\n\s*A\s*[:：]\s*([\s\S]*?)(?=(?:\n\s*Q\s*[:：])|$)/gi

  for (const match of content.matchAll(qaPattern)) {
    const question = normalizeWhitespace(match[1] ?? '')
    const answer = normalizeWhitespace(match[2] ?? '')
    if (!question || !answer) continue

    const sequence = pairs.length + 1
    pairs.push({
      id: buildRecordId(document.id, ['qa', sequence]),
      sourceDocumentId: document.id,
      sourceDocumentName: document.name,
      sourceType: 'document',
      extractionKind: 'explicit_qa',
      question,
      canonicalQuestion: buildCanonicalQuestion(question, suffixes),
      answer,
      metadata: {
        sourceType: 'document',
        documentId: document.id,
        documentType: document.type,
      },
      sourceFiles: [document.name],
      sourceRecordIds: [buildRecordId(document.id, ['qa', sequence])],
      routeStatus: 'include',
      reviewStatus: 'approved',
      recordKind: 'explicit_doc_faq',
      structureType: 'explicit_faq',
      isHighRisk: false,
      riskReason: '',
      blockedReason: '',
      pendingReason: '',
    })
  }

  if (pairs.length > 0) {
    return pairs
  }

  const question = titleizeDocumentName(document.name, suffixes)
  return [
    {
      id: document.id,
      sourceDocumentId: document.id,
      sourceDocumentName: document.name,
      sourceType: 'document',
      extractionKind: 'composite_doc',
      question,
      canonicalQuestion: buildCanonicalQuestion(question, suffixes),
      answer: content,
      metadata: {
        sourceType: 'document',
        documentId: document.id,
        documentType: document.type,
      },
      sourceFiles: [document.name],
      sourceRecordIds: [document.id],
      routeStatus: 'include',
      reviewStatus: 'approved',
      recordKind: 'residual_composite_doc',
      structureType: 'composite_doc',
      isHighRisk: false,
      riskReason: '',
      blockedReason: '',
      pendingReason: '',
    },
  ]
}

function buildRawRecords(
  input: BuildKnowledgeArtifactsInput,
  sourceManifest: SourceManifestRecord[],
  suffixes: string[],
): StageRecord[] {
  const rawRecords: StageRecord[] = []

  for (const manifestRecord of sourceManifest) {
    if (!manifestRecord.isCandidateForIndex) continue
    const document = input.sourceDocuments.find((item) => item.id === manifestRecord.documentId)
    if (!document) continue

    const extracted =
      manifestRecord.contentProfile === 'spreadsheet'
        ? extractSpreadsheetRows(document, suffixes)
        : extractTextQuestionAnswerPairs(document, suffixes)

    rawRecords.push(...extracted)
  }

  for (const draft of input.manualDrafts ?? []) {
    const question = normalizeWhitespace(draft.title)
    const answer = normalizeWhitespace(draft.content)
    if (!question || !answer) continue

    rawRecords.push({
      id: `manual:${nanoid()}`,
      sourceDocumentId: 'manual',
      sourceDocumentName: draft.source || 'manual',
      sourceType: 'manual',
      extractionKind: 'manual',
      question,
      canonicalQuestion: buildCanonicalQuestion(question, suffixes),
      answer,
      metadata: {
        sourceType: 'manual',
        sourceLabel: draft.source || 'manual',
      },
      sourceFiles: [draft.source || 'manual'],
      sourceRecordIds: [],
      routeStatus: 'include',
      reviewStatus: 'approved',
      recordKind: 'manual_faq',
      structureType: 'explicit_faq',
      isHighRisk: false,
      riskReason: '',
      blockedReason: '',
      pendingReason: '',
    })
  }

  for (const repair of input.repairQuestions ?? []) {
    const question = normalizeWhitespace(repair.query)
    if (!question) continue

    rawRecords.push({
      id: `repair:${nanoid()}`,
      sourceDocumentId: 'repair',
      sourceDocumentName: 'repair',
      sourceType: 'repair',
      extractionKind: 'repair',
      question,
      canonicalQuestion: buildCanonicalQuestion(question, suffixes),
      answer: '',
      metadata: {
        sourceType: 'repair',
        problem: normalizeWhitespace(repair.problem),
        direction: normalizeWhitespace(repair.direction),
      },
      sourceFiles: ['repair'],
      sourceRecordIds: [],
      routeStatus: 'include',
      reviewStatus: 'pending',
      recordKind: 'repair_request',
      structureType: 'explicit_faq',
      isHighRisk: false,
      riskReason: '',
      blockedReason: '',
      pendingReason: 'Repair question requires an authored answer before release',
    })
  }

  return rawRecords
}

function cleanRecords(records: StageRecord[], suffixes: string[]): StageRecord[] {
  return records
    .map((record) => ({
      ...record,
      question: normalizeWhitespace(record.question),
      canonicalQuestion: buildCanonicalQuestion(record.canonicalQuestion || record.question, suffixes),
      answer: normalizeWhitespace(record.answer),
    }))
    .filter((record) => {
      if (record.sourceType === 'repair') return record.question.length > 0
      if (record.structureType === 'composite_doc') return record.question.length > 0 && record.answer.length > 0
      return record.question.length > 0 && record.answer.length > 0
    })
}

function routeRecords(records: StageRecord[], riskPattern: RegExp | null): StageRecord[] {
  return records.map((record) => {
    if (record.sourceType === 'repair') {
      return {
        ...record,
        reviewStatus: 'pending',
        routeStatus: 'include',
      }
    }

    if (!record.answer) {
      return {
        ...record,
        reviewStatus: 'blocked',
        routeStatus: 'exclude',
        blockedReason: 'Missing answer content after extraction',
      }
    }

    const isHighRisk = riskPattern ? riskPattern.test(`${record.question}\n${record.answer}`) : false
    if (isHighRisk) {
      return {
        ...record,
        isHighRisk: true,
        routeStatus: 'high_risk',
        reviewStatus: 'pending',
        riskReason: 'Matched generic high-risk policy keywords',
      }
    }

    return {
      ...record,
      routeStatus: 'include',
      reviewStatus: 'approved',
    }
  })
}

function structureRecords(records: StageRecord[]): StageRecord[] {
  return records.map((record) => ({
    ...record,
    structureType:
      record.extractionKind === 'composite_doc' && record.sourceType === 'document' ? 'composite_doc' : 'explicit_faq',
  }))
}

function detectHeading(line: string): boolean {
  if (!line) return false
  if (/^Level\s+\d+/i.test(line)) return true
  if (/^(Level\s+\d+\s+Repair|Level\s+\d+|When the customer calls|Level 3)$/i.test(line)) return true
  return /^[A-Z][A-Za-z0-9/&(),'" -]{4,80}$/.test(line) && !/[.?!:]$/.test(line)
}

function promoteCompositeRecords(records: StageRecord[], suffixes: string[]): StageRecord[] {
  const promoted: StageRecord[] = []

  for (const record of records) {
    if (record.structureType !== 'composite_doc' || record.sourceType !== 'document') {
      promoted.push(record)
      continue
    }

    const lines = normalizeWhitespace(record.answer)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    const title = titleizeDocumentName(record.sourceDocumentName, suffixes)
    const sections: Array<{ heading: string; body: string[] }> = []
    let currentSection: { heading: string; body: string[] } | null = null

    for (const line of lines) {
      if (detectHeading(line)) {
        if (currentSection && currentSection.body.length > 0) {
          sections.push(currentSection)
        }
        currentSection = { heading: line, body: [] }
        continue
      }

      if (!currentSection) {
        currentSection = { heading: title, body: [] }
      }
      currentSection.body.push(line)
    }

    if (currentSection && currentSection.body.length > 0) {
      sections.push(currentSection)
    }

    const promotedSections = sections.filter((section) => section.heading !== title && normalizeWhitespace(section.body.join('\n')).length >= 40)

    if (promotedSections.length === 0) {
      promoted.push(record)
      continue
    }

    for (const [index, section] of promotedSections.entries()) {
      const answer = normalizeWhitespace(section.body.join('\n'))
      if (!answer) continue

      promoted.push({
        ...record,
        id: buildRecordId(record.id, ['promoted', index + 1]),
        extractionKind: 'explicit_qa',
        question: `${title} - ${section.heading}`,
        canonicalQuestion: buildCanonicalQuestion(`${title} - ${section.heading}`, suffixes),
        answer,
        metadata: {
          ...record.metadata,
          sectionTitle: section.heading,
        },
        recordKind: 'promoted_composite_faq',
        structureType: 'explicit_faq',
      })
    }

    const residualSections = sections.filter((section) => !promotedSections.includes(section))
    const residualAnswer = normalizeWhitespace(residualSections.map((section) => `${section.heading}\n${section.body.join('\n')}`).join('\n\n'))

    if (residualAnswer) {
      promoted.push({
        ...record,
        answer: residualAnswer,
        metadata: {
          ...record.metadata,
          promotedSectionCount: promotedSections.length,
        },
        recordKind: 'residual_composite_doc',
      })
    }
  }

  return promoted
}

function buildMergeKey(record: StageRecord): string {
  const variant = normalizeWhitespace(String(record.metadata.variantLabel ?? ''))
  const sheet = normalizeWhitespace(String(record.metadata.sheetName ?? ''))
  return [normalizeQuestionKey(record.canonicalQuestion || record.question), normalizeQuestionKey(variant), normalizeQuestionKey(sheet)]
    .filter(Boolean)
    .join('::')
}

function mergeRecords(records: StageRecord[]): { mergedRecords: StageRecord[]; conflictRecords: StageRecord[] } {
  const groups = new Map<string, StageRecord[]>()

  for (const record of records) {
    const key = buildMergeKey(record)
    const group = groups.get(key) ?? []
    group.push(record)
    groups.set(key, group)
  }

  const mergedRecords: StageRecord[] = []
  const conflictRecords: StageRecord[] = []

  for (const group of groups.values()) {
    const [winner, ...rest] = group
    const merged: StageRecord = {
      ...winner,
      metadata: { ...winner.metadata },
      sourceFiles: [...winner.sourceFiles],
      sourceRecordIds: [...winner.sourceRecordIds],
    }
    const winnerAnswerKey = normalizeAnswerKey(winner.answer)
    const conflictVariants = new Map<string, StageRecord>()

    for (const candidate of rest) {
      if (normalizeAnswerKey(candidate.answer) === winnerAnswerKey) {
        merged.sourceFiles = [...new Set([...merged.sourceFiles, ...candidate.sourceFiles])]
        merged.sourceRecordIds = [...new Set([...merged.sourceRecordIds, ...candidate.sourceRecordIds])]
        continue
      }

      const candidateAnswerKey = normalizeAnswerKey(candidate.answer)
      const existingConflict = conflictVariants.get(candidateAnswerKey)
      if (existingConflict) {
        existingConflict.sourceFiles = [...new Set([...existingConflict.sourceFiles, ...candidate.sourceFiles])]
        existingConflict.sourceRecordIds = [...new Set([...existingConflict.sourceRecordIds, ...candidate.sourceRecordIds])]
        continue
      }

      conflictVariants.set(candidateAnswerKey, {
        ...candidate,
        reviewStatus: 'blocked',
        blockedReason: 'Conflicting answers were detected for the same normalized question',
      })
    }

    conflictRecords.push(...conflictVariants.values())
    mergedRecords.push(merged)
  }

  return { mergedRecords, conflictRecords }
}

function gateRecords(records: StageRecord[]): { approvedRecords: StageRecord[]; pendingRecords: StageRecord[] } {
  const approvedRecords: StageRecord[] = []
  const pendingRecords: StageRecord[] = []

  for (const record of records) {
    if (record.sourceType === 'repair') {
      pendingRecords.push(record)
      continue
    }

    if (record.routeStatus === 'high_risk' || record.isHighRisk) {
      continue
    }

    approvedRecords.push({
      ...record,
      reviewStatus: 'approved',
    })
  }

  return { approvedRecords, pendingRecords }
}

function buildParentsAndChunks(records: StageRecord[], profileKey: string): {
  parents: KnowledgeArtifactParentRecord[]
  chunks: KnowledgeArtifactChunkRecord[]
} {
  const parents: KnowledgeArtifactParentRecord[] = records.map((record) => {
    const parentId = nanoid()
    const questionNormalized = normalizeRetrievalText(record.canonicalQuestion)
    const questionSignature = normalizeQuestionKey(record.canonicalQuestion)
    const sourceParentQuestions = [record.canonicalQuestion || record.question].filter(Boolean)
    const isExactFaq = record.structureType === 'explicit_faq'
    return {
      id: parentId,
      question: record.question,
      question_clean: record.canonicalQuestion,
      answer: record.answer,
      question_aliases: [],
      metadata: {
        ...record.metadata,
        profileKey,
        questionNormalized,
        questionSignature,
        sourceParentQuestions,
        isExactFaq,
      },
      source_files: record.sourceFiles,
      source_record_ids: record.sourceRecordIds,
      review_status: record.reviewStatus,
      record_kind: record.recordKind,
      is_high_risk: false,
      inherited_risk_reason: '',
    }
  })

  const chunks: KnowledgeArtifactChunkRecord[] = parents.flatMap((parent) =>
    splitAnswerIntoChunks(parent.answer).map((chunkText, index) => {
      const sectionTitle = index === 0 ? '概述' : `补充 ${index + 1}`
      return {
        id: nanoid(),
        parent_id: parent.id,
        chunk_order: index + 1,
        section_title: sectionTitle,
        chunk_text: chunkText,
        embedding_text: `主问题：${parent.question_clean}\n答案片段：${chunkText}\n标准答案：${parent.answer}`,
        chunk_type: 'answer',
        metadata: {
          ...parent.metadata,
          question: parent.question_clean,
          questionAliases: parent.question_aliases,
          chunkKind: inferChunkKind(sectionTitle, chunkText),
        },
      }
    }),
  )

  return { parents, chunks }
}

function stageArtifactRows(records: StageRecord[]): Array<Record<string, unknown>> {
  return records.map((record) => ({
    id: record.id,
    sourceDocumentId: record.sourceDocumentId,
    sourceDocumentName: record.sourceDocumentName,
    sourceType: record.sourceType,
    extractionKind: record.extractionKind,
    question: record.question,
    canonicalQuestion: record.canonicalQuestion,
    answerPreview: record.answer.slice(0, 240),
    routeStatus: record.routeStatus,
    reviewStatus: record.reviewStatus,
    recordKind: record.recordKind,
    structureType: record.structureType,
    metadata: record.metadata,
    sourceFiles: record.sourceFiles,
    sourceRecordIds: record.sourceRecordIds,
    riskReason: record.riskReason,
    blockedReason: record.blockedReason,
    pendingReason: record.pendingReason,
  }))
}

export function buildKnowledgeArtifacts(input: BuildKnowledgeArtifactsInput): BuildKnowledgeArtifactsResult {
  const profile = getKnowledgeRuntimeProfile(input.profileKey, input.profileConfig)
  const riskPattern = buildRiskPattern(profile.riskKeywords)
  const sourceSummary = buildSourceSummary(input)

  const sourceManifest = buildSourceManifest(input, riskPattern)
  input.onStageChange?.('stage1_source_manifest')
  const rawRecords = buildRawRecords(input, sourceManifest, profile.questionSuffixes)
  input.onStageChange?.('stage2_raw_records')
  const cleanedRecords = cleanRecords(rawRecords, profile.canonicalSuffixes)
  input.onStageChange?.('stage3_cleaned_records')
  const routedRecords = routeRecords(cleanedRecords, riskPattern)
  input.onStageChange?.('stage4_routing')
  const structuredRecords = structureRecords(routedRecords)
  input.onStageChange?.('stage5_structure')
  const promotedRecords = promoteCompositeRecords(structuredRecords, profile.questionSuffixes)
  input.onStageChange?.('stage6_promotion')

  const mergeCandidates = promotedRecords.filter((record) => record.routeStatus !== 'exclude')
  const { mergedRecords, conflictRecords } = mergeRecords(mergeCandidates.filter((record) => record.sourceType !== 'repair'))
  input.onStageChange?.('stage7_merge')
  const gatedInput = [...mergedRecords, ...promotedRecords.filter((record) => record.sourceType === 'repair')]
  const { approvedRecords, pendingRecords } = gateRecords(gatedInput)
  input.onStageChange?.('stage8_conflict_detection')
  input.onStageChange?.('stage9_release_gating')
  const { parents, chunks } = buildParentsAndChunks(approvedRecords, profile.key)
  input.onStageChange?.('stage10_parents')

  const highRiskRecords = promotedRecords.filter((record) => record.routeStatus === 'high_risk')
  const excludedCount =
    sourceManifest.filter((record) => !record.isCandidateForIndex).length +
    routedRecords.filter((record) => record.routeStatus === 'exclude').length
  const includeCount = promotedRecords.filter((record) => record.routeStatus !== 'exclude').length
  const coverage = rawRecords.length > 0 ? Math.round((approvedRecords.length / rawRecords.length) * 100) : 100
  const coverageReasons: string[] = []

  if (highRiskRecords.length > 0) {
    coverageReasons.push('High-risk records require manual review before release')
  }
  if (conflictRecords.length > 0) {
    coverageReasons.push('Conflicting records were blocked from publication')
  }
  if (pendingRecords.some((record) => record.sourceType === 'repair')) {
    coverageReasons.push('Repair requests remain pending because they have no approved answer yet')
  }

  const coverageAudit: KnowledgeCoverageAudit = {
    coverage,
    auditStatus: coverage === 100 ? 'normal' : 'warning',
    reasons: coverageReasons,
    orphanRecords: pendingRecords.map((record) => record.question),
    ambiguityRecords: conflictRecords.map((record) => record.question),
  }
  input.onStageChange?.('stage11_coverage_audit')

  const stageSummary: KnowledgeStageSummary = {
    sourceCount: sourceSummary.sourceCount as number,
    excludedCount,
    rawRecordCount: rawRecords.length,
    cleanedCount: cleanedRecords.length,
    includeCount,
    highRiskCount: highRiskRecords.length,
    conflictCount: conflictRecords.length,
    pendingCount: pendingRecords.length,
    blockedCount: conflictRecords.length,
    approvedCount: approvedRecords.length,
    parentCount: parents.length,
    chunkCount: chunks.length,
    coverage: coverageAudit.coverage,
    orphanCount: coverageAudit.orphanRecords.length,
    ambiguityCount: coverageAudit.ambiguityRecords.length,
    stageCounts: [
      { stage: 'stage1_source_manifest', value: String(sourceManifest.length) },
      { stage: 'stage2_raw_records', value: String(rawRecords.length) },
      { stage: 'stage3_cleaned_records', value: String(cleanedRecords.length) },
      { stage: 'stage4_routing', value: String(routedRecords.filter((record) => record.routeStatus !== 'exclude').length) },
      { stage: 'stage5_structure', value: String(structuredRecords.length) },
      { stage: 'stage6_promotion', value: String(promotedRecords.length) },
      { stage: 'stage7_merge', value: String(mergedRecords.length) },
      { stage: 'stage8_conflict_detection', value: String(conflictRecords.length) },
      { stage: 'stage9_release_gating', value: String(approvedRecords.length) },
      { stage: 'stage10_parents', value: String(parents.length) },
      { stage: 'stage11_coverage_audit', value: String(coverageAudit.coverage) },
    ],
  }

  const stageArtifacts: Record<string, Array<Record<string, unknown>>> = {
    sourceManifest: sourceManifest.map((record) => ({
      id: record.id,
      documentId: record.documentId,
      sourceName: record.sourceName,
      sourceType: record.sourceType,
      contentProfile: record.contentProfile,
      isCandidateForIndex: record.isCandidateForIndex,
      candidateStatus: record.candidateStatus,
      riskLevel: record.riskLevel,
      riskReason: record.riskReason,
      sourcePriority: record.sourcePriority,
    })),
    rawRecords: stageArtifactRows(rawRecords),
    cleanedRecords: stageArtifactRows(cleanedRecords),
    routedRecords: stageArtifactRows(routedRecords),
    structuredRecords: stageArtifactRows(structuredRecords),
    promotedRecords: stageArtifactRows(promotedRecords),
    mergedRecords: stageArtifactRows(mergedRecords),
    conflictRecords: stageArtifactRows(conflictRecords),
    gatedRecords: stageArtifactRows(approvedRecords),
    parents: parents.map((parent) => ({
      id: parent.id,
      question: parent.question,
      questionClean: parent.question_clean,
      recordKind: parent.record_kind,
      sourceFiles: parent.source_files,
      sourceRecordIds: parent.source_record_ids,
      metadata: parent.metadata,
    })),
    chunks: chunks.map((chunk) => ({
      id: chunk.id,
      parentId: chunk.parent_id,
      chunkOrder: chunk.chunk_order,
      sectionTitle: chunk.section_title,
      chunkType: chunk.chunk_type,
      metadata: chunk.metadata,
    })),
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
      reason: record.pendingReason || record.riskReason,
      metadata: record.metadata,
      sourceFiles: record.sourceFiles,
    })),
    blockedRecords: conflictRecords.map((record) => ({
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
    stageArtifacts,
    retrievalContract: {
      version: 1,
      supportsRagRoute: true,
      supportsEvidenceAssembly: true,
      enrichedMetadataKeys: [
        'questionNormalized',
        'questionSignature',
        'sourceParentQuestions',
        'isExactFaq',
        'chunkKind',
      ],
    },
  }

  const manifest: KnowledgeArtifactManifest = {
    ...manifestBase,
    snapshotHash: sha256(
      JSON.stringify({
        sourceSummary,
        stageSummary,
        coverageAudit,
        stageArtifacts,
        retrievalContract: manifestBase.retrievalContract,
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
