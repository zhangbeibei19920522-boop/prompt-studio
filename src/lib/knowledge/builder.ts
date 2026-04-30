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
  KnowledgeScopeMappingRecord,
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
  mappingId?: string | null
  mappingVersionId?: string | null
  mappingRecords?: KnowledgeScopeMappingRecord[]
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
type FaqSheetLayout = 'faq_table' | 'faq_matrix' | 'sheet_scoped_faq' | 'spec_table' | 'ignore' | 'unsupported'
type ScopeMap = Record<string, string[]>

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
  extractionKind: 'table_row' | 'platform_variant' | 'spec_table' | 'explicit_qa' | 'composite_doc' | 'manual' | 'repair'
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

interface KnowledgeDocumentDiagnostic extends Record<string, unknown> {
  documentId: string
  sourceName: string
  sheetName: string
  status: 'unsupported' | 'warning'
  reason: string
  message: string
}

interface KnowledgeScopeDiagnostic extends Record<string, unknown> {
  documentId: string
  sourceName: string
  recordId: string
  status: 'unmatched' | 'conflict'
  message: string
  metadata: Record<string, unknown>
}

interface SpreadsheetExtractionResult {
  records: StageRecord[]
  diagnostics: KnowledgeDocumentDiagnostic[]
}

interface RawRecordBuildResult {
  records: StageRecord[]
  diagnostics: KnowledgeDocumentDiagnostic[]
  scopeDiagnostics: KnowledgeScopeDiagnostic[]
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
    mappingId: input.mappingId ?? null,
    mappingVersionId: input.mappingVersionId ?? null,
    mappingRecordCount: input.mappingRecords?.length ?? 0,
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

function normalizeHeaderKey(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, '').replace(/[^\w\u4e00-\u9fa5]/g, '')
}

function isQuestionHeader(value: string): boolean {
  return /^(question|q|mq|mainquestion|userquestion|问题|主问题|用户问题)$/i.test(normalizeHeaderKey(value))
}

function isAnswerHeader(value: string): boolean {
  return /^(answer|a|response|voiceanswer|expvoiceanswer|answertext|答案|回复|话术)$/i.test(normalizeHeaderKey(value))
}

function isModelHeader(value: string): boolean {
  return /^(model|productmodel|deviceModel|devicemodel|sku|型号|产品型号)$/i.test(normalizeHeaderKey(value))
}

function isSpecTermHeader(value: string): boolean {
  return /^(specterm|specification|attribute|field|term|参数|规格项|属性)$/i.test(normalizeHeaderKey(value))
}

function isSpecValueHeader(value: string): boolean {
  return /^(specvalue|value|answer|参数值|规格值|值)$/i.test(normalizeHeaderKey(value))
}

function resolveScopeKeyFromHeader(value: string): string | null {
  const normalized = normalizeHeaderKey(value)
  if (/^(model|productmodel|devicemodel|sku|型号|产品型号)$/.test(normalized)) return 'productModel'
  if (/^(platform|os|system|平台|系统)$/.test(normalized)) return 'platform'
  if (/^(product|productcategory|category|品类|产品品类|产品)$/.test(normalized)) return 'productCategory'
  if (/^(devicecategory|device|设备品类)$/.test(normalized)) return 'deviceCategory'
  if (/^(region|market|地区|区域)$/.test(normalized)) return 'region'
  if (/^(channel|渠道)$/.test(normalized)) return 'channel'
  if (/^(appversion|version|应用版本|版本)$/.test(normalized)) return 'appVersion'
  return null
}

function findHeaderIndex(header: string[], predicate: (value: string) => boolean): number {
  return header.findIndex((cell) => predicate(cell))
}

function detectSheetLayout(sheetName: string, header: string[], rowCount: number): FaqSheetLayout {
  if (rowCount < 2) return 'unsupported'

  const questionIndex = findHeaderIndex(header, isQuestionHeader)
  const answerIndexes = header
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell }) => isAnswerHeader(cell))
    .map(({ index }) => index)
  const modelIndex = findHeaderIndex(header, isModelHeader)
  const specTermIndex = findHeaderIndex(header, isSpecTermHeader)
  const specValueIndex = findHeaderIndex(header, isSpecValueHeader)

  if (modelIndex >= 0 && specTermIndex >= 0 && specValueIndex >= 0) return 'spec_table'
  if (questionIndex >= 0 && answerIndexes.length > 0 && inferScopeFromSheetName(sheetName).scope.productModel?.length) {
    return 'sheet_scoped_faq'
  }
  if (questionIndex >= 0 && answerIndexes.length > 0) return 'faq_table'
  if (questionIndex >= 0 && header.length >= 3) return 'faq_matrix'

  return 'unsupported'
}

function addScopeValue(scope: ScopeMap, key: string, value: string | null | undefined): void {
  const normalized = normalizeWhitespace(String(value ?? ''))
  if (!normalized) return
  const current = scope[key] ?? []
  if (!current.includes(normalized)) {
    scope[key] = [...current, normalized]
  }
}

function normalizePlatformValue(value: string): string {
  const normalized = normalizeHeaderKey(value)
  if (normalized === 'roku' || normalized === 'rokutv') return 'Roku TV'
  if (normalized === 'google' || normalized === 'googletv') return 'Google TV'
  if (normalized === 'android' || normalized === 'androidtv') return 'Android TV'
  if (normalized === 'fire' || normalized === 'firetv') return 'Fire TV'
  if (normalized === 'vidaa' || normalized === 'vidaatv') return 'Vidaa TV'
  if (normalized === 'xclass' || normalized === 'xclasstv') return 'XClass TV'
  return normalizeWhitespace(value)
}

function normalizeProductCategoryValue(value: string): string {
  const normalized = normalizeHeaderKey(value)
  if (normalized === 'refrigerator') return 'Refrigerator'
  if (normalized === 'freezer') return 'Freezer'
  if (normalized === 'winecooler' || normalized === 'wine') return 'Wine Cooler'
  if (normalized === 'cdmtv' || normalized === 'tv' || normalized === 'television') return 'TV'
  return normalizeWhitespace(value)
}

function inferScopeFromVariantLabel(label: string): {
  scope: ScopeMap
  direct: Array<{ key: string; value: string; source: string }>
} {
  const scope: ScopeMap = {}
  const direct: Array<{ key: string; value: string; source: string }> = []
  const normalized = normalizeHeaderKey(label)

  if (/^(roku|google|android|fire|vidaa|xclass)(tv)?$/.test(normalized)) {
    const value = normalizePlatformValue(label)
    addScopeValue(scope, 'platform', value)
    direct.push({ key: 'platform', value, source: 'columnHeader' })
    return { scope, direct }
  }

  if (/^(refrigerator|freezer|winecooler|wine)$/.test(normalized)) {
    const value = normalizeProductCategoryValue(label)
    addScopeValue(scope, 'productCategory', value)
    direct.push({ key: 'productCategory', value, source: 'columnHeader' })
  }

  return { scope, direct }
}

function inferScopeFromSheetName(sheetName: string): {
  scope: ScopeMap
  direct: Array<{ key: string; value: string; source: string }>
  raw: Record<string, unknown>
} {
  const scope: ScopeMap = {}
  const direct: Array<{ key: string; value: string; source: string }> = []
  const raw: Record<string, unknown> = { sheetName }

  const modelMatch = /^\s*model\s*[-:：]\s*(.+)$/i.exec(sheetName)
  if (modelMatch?.[1]) {
    const value = normalizeWhitespace(modelMatch[1])
    addScopeValue(scope, 'productModel', value)
    direct.push({ key: 'productModel', value, source: 'sheetName' })
  }

  if (/refrigerator/i.test(sheetName)) {
    addScopeValue(scope, 'productCategory', 'Refrigerator')
    direct.push({ key: 'productCategory', value: 'Refrigerator', source: 'sheetName' })
  }

  return { scope, direct, raw }
}

function extractRowScope(header: string[], cells: string[]): {
  scope: ScopeMap
  direct: Array<{ key: string; value: string; source: string }>
  raw: Record<string, unknown>
} {
  const scope: ScopeMap = {}
  const direct: Array<{ key: string; value: string; source: string }> = []
  const raw: Record<string, unknown> = {}

  for (const [index, headerCell] of header.entries()) {
    const scopeKey = resolveScopeKeyFromHeader(headerCell)
    if (!scopeKey) continue
    const value = normalizeWhitespace(cells[index] ?? '')
    if (!value) continue
    const normalizedValue =
      scopeKey === 'platform'
        ? normalizePlatformValue(value)
        : scopeKey === 'productCategory' || scopeKey === 'deviceCategory'
          ? normalizeProductCategoryValue(value)
          : value
    addScopeValue(scope, scopeKey, normalizedValue)
    direct.push({ key: scopeKey, value: normalizedValue, source: 'rowColumn' })
    raw[headerCell] = value
  }

  return { scope, direct, raw }
}

function mergeScopes(...scopes: ScopeMap[]): ScopeMap {
  const merged: ScopeMap = {}
  for (const scope of scopes) {
    for (const [key, values] of Object.entries(scope)) {
      for (const value of values) {
        addScopeValue(merged, key, value)
      }
    }
  }
  return merged
}

function buildScopeSignature(scope: ScopeMap): string {
  return Object.keys(scope)
    .sort()
    .flatMap((key) => {
      const values = [...(scope[key] ?? [])].sort()
      return values.length > 0 ? [`${key}=${values.join(',')}`] : []
    })
    .join('|')
}

function normalizeMappingLookupKey(value: string): string {
  return normalizeRetrievalText(value)
}

function buildMappingLookup(records: KnowledgeScopeMappingRecord[] | undefined): Map<string, KnowledgeScopeMappingRecord> {
  const lookup = new Map<string, KnowledgeScopeMappingRecord>()
  for (const record of records ?? []) {
    const key = normalizeMappingLookupKey(record.lookupKey)
    if (!key) continue
    lookup.set(key, record)
  }
  return lookup
}

function normalizeScopeValueForKey(key: string, value: string): string {
  if (key === 'platform') return normalizePlatformValue(value)
  if (key === 'productCategory' || key === 'deviceCategory') return normalizeProductCategoryValue(value)
  return normalizeWhitespace(value)
}

function applyMappingScope(params: {
  scope: ScopeMap
  direct: Array<{ key: string; value: string; source: string }>
  mappingLookup: Map<string, KnowledgeScopeMappingRecord>
  mappingVersionId: string | null | undefined
}): {
  scope: ScopeMap
  scopeSource: Record<string, unknown>
  diagnostics: Array<{ status: 'unmatched' | 'conflict'; message: string; metadata: Record<string, unknown> }>
} {
  const lookupKey = params.scope.productModel?.[0] ?? ''
  const mappedRecord = lookupKey ? params.mappingLookup.get(normalizeMappingLookupKey(lookupKey)) : undefined
  const scope = mergeScopes(params.scope)
  const mapped: Array<{ key: string; value: string; sourceField: string }> = []
  const conflicts: Array<{ key: string; directValue: string; mappedValue: string; reason: string }> = []
  const diagnostics: Array<{ status: 'unmatched' | 'conflict'; message: string; metadata: Record<string, unknown> }> = []

  if (mappedRecord) {
    for (const [key, values] of Object.entries(mappedRecord.scope)) {
      for (const rawValue of values) {
        const mappedValue = normalizeScopeValueForKey(key, rawValue)
        const current = scope[key] ?? []
        if (current.length > 0 && !current.includes(mappedValue)) {
          const conflict = {
            key,
            directValue: current.join(','),
            mappedValue,
            reason: 'Direct scope and mapping scope disagree',
          }
          conflicts.push(conflict)
          diagnostics.push({
            status: 'conflict',
            message: `${lookupKey} 的 ${key} 与映射表结果不一致，需要人工确认`,
            metadata: conflict,
          })
          continue
        }

        addScopeValue(scope, key, mappedValue)
        mapped.push({ key, value: mappedValue, sourceField: key })
      }
    }
  } else if (params.mappingVersionId && lookupKey) {
    diagnostics.push({
      status: 'unmatched',
      message: `${lookupKey} 未在映射表中找到，已保留已识别 scope`,
      metadata: { lookupKey },
    })
  }

  return {
    scope,
    scopeSource: {
      direct: params.direct,
      mappingVersionId: params.mappingVersionId ?? null,
      lookupKey: lookupKey || undefined,
      matched: Boolean(mappedRecord),
      mapped,
      unmatchedReason: params.mappingVersionId && lookupKey && !mappedRecord ? 'mapping_lookup_missed' : undefined,
      conflicts,
    },
    diagnostics,
  }
}

function withScopeMetadata(params: {
  metadata: Record<string, unknown>
  scope: ScopeMap
  direct: Array<{ key: string; value: string; source: string }>
  scopeRaw?: Record<string, unknown>
  mappingLookup: Map<string, KnowledgeScopeMappingRecord>
  mappingVersionId?: string | null
}): {
  metadata: Record<string, unknown>
  scopeDiagnostics: Array<{ status: 'unmatched' | 'conflict'; message: string; metadata: Record<string, unknown> }>
} {
  const mapped = applyMappingScope({
    scope: params.scope,
    direct: params.direct,
    mappingLookup: params.mappingLookup,
    mappingVersionId: params.mappingVersionId,
  })

  return {
    metadata: {
      ...params.metadata,
      scope: mapped.scope,
      scopeSignature: buildScopeSignature(mapped.scope),
      scopeRaw: params.scopeRaw ?? {},
      scopeSource: mapped.scopeSource,
    },
    scopeDiagnostics: mapped.diagnostics,
  }
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

function makeUnsupportedSheetDiagnostic(document: Document, sheetName: string, reason: string): KnowledgeDocumentDiagnostic {
  return {
    documentId: document.id,
    sourceName: document.name,
    sheetName,
    status: 'unsupported',
    reason,
    message: `${document.name} 中的 ${sheetName} 工作表暂时无法解析`,
  }
}

function buildSpreadsheetRecord(params: {
  document: Document
  section: WorkbookSection
  rowOffset: number
  answerIndex?: number
  extractionKind: StageRecord['extractionKind']
  question: string
  canonicalQuestion?: string
  answer: string
  suffixes: string[]
  recordKind: string
  sheetLayout: FaqSheetLayout
  metadata: Record<string, unknown>
  scope: ScopeMap
  directScope: Array<{ key: string; value: string; source: string }>
  scopeRaw: Record<string, unknown>
  mappingLookup: Map<string, KnowledgeScopeMappingRecord>
  mappingVersionId?: string | null
}): { record: StageRecord; scopeDiagnostics: KnowledgeScopeDiagnostic[] } {
  const scoped = withScopeMetadata({
    metadata: {
      sourceType: 'document',
      documentId: params.document.id,
      documentType: params.document.type,
      sheetName: params.section.sheetName,
      sheetLayout: params.sheetLayout,
      rowIndex: params.rowOffset,
      ...params.metadata,
    },
    scope: params.scope,
    direct: params.directScope,
    scopeRaw: params.scopeRaw,
    mappingLookup: params.mappingLookup,
    mappingVersionId: params.mappingVersionId,
  })
  const recordId = buildRecordId(params.document.id, ['sheet', params.section.sheetName, params.rowOffset, params.answerIndex])
  return {
    record: {
      id: recordId,
      sourceDocumentId: params.document.id,
      sourceDocumentName: params.document.name,
      sourceType: 'document',
      extractionKind: params.extractionKind,
      question: params.question,
      canonicalQuestion: params.canonicalQuestion ?? buildCanonicalQuestion(params.question, params.suffixes),
      answer: params.answer,
      metadata: scoped.metadata,
      sourceFiles: [params.document.name],
      sourceRecordIds: [buildRecordId(params.document.id, ['sheet', params.section.sheetName, params.rowOffset])],
      routeStatus: 'include',
      reviewStatus: 'approved',
      recordKind: params.recordKind,
      structureType: 'explicit_faq',
      isHighRisk: false,
      riskReason: '',
      blockedReason: '',
      pendingReason: '',
    },
    scopeDiagnostics: scoped.scopeDiagnostics.map((diagnostic) => ({
      documentId: params.document.id,
      sourceName: params.document.name,
      recordId,
      status: diagnostic.status,
      message: diagnostic.message,
      metadata: diagnostic.metadata,
    })),
  }
}

function extractSpreadsheetRows(
  document: Document,
  suffixes: string[],
  mappingLookup: Map<string, KnowledgeScopeMappingRecord>,
  mappingVersionId?: string | null,
): SpreadsheetExtractionResult & { scopeDiagnostics: KnowledgeScopeDiagnostic[] } {
  const sections = splitWorkbookSections(document.content)
  const records: StageRecord[] = []
  const diagnostics: KnowledgeDocumentDiagnostic[] = []
  const scopeDiagnostics: KnowledgeScopeDiagnostic[] = []

  for (const section of sections) {
    if (section.rows.length === 0) continue

    const header = splitCells(section.rows[0])
    const layout = detectSheetLayout(section.sheetName, header, section.rows.length)

    if (layout === 'unsupported') {
      diagnostics.push(makeUnsupportedSheetDiagnostic(document, section.sheetName, 'Unsupported spreadsheet sheet layout'))
      continue
    }

    if (layout === 'spec_table') {
      const modelIndex = findHeaderIndex(header, isModelHeader)
      const specTermIndex = findHeaderIndex(header, isSpecTermHeader)
      const specValueIndex = findHeaderIndex(header, isSpecValueHeader)
      const sheetScope = inferScopeFromSheetName(section.sheetName)

      for (const [offset, row] of section.rows.slice(1).entries()) {
        const cells = splitCells(row)
        const model = normalizeWhitespace(cells[modelIndex] ?? '')
        const specTerm = normalizeWhitespace(cells[specTermIndex] ?? '')
        const answer = normalizeWhitespace(cells[specValueIndex] ?? '')
        if (!model || !specTerm || !answer) continue

        const rowScope = extractRowScope(header, cells)
        if (!rowScope.scope.productModel?.includes(model)) {
          addScopeValue(rowScope.scope, 'productModel', model)
          rowScope.direct.push({ key: 'productModel', value: model, source: 'rowColumn' })
        }
        const scope = mergeScopes(sheetScope.scope, rowScope.scope)
        const directScope = [...sheetScope.direct, ...rowScope.direct]
        const built = buildSpreadsheetRecord({
          document,
          section,
          rowOffset: offset + 2,
          extractionKind: 'spec_table',
          question: `${model} - ${specTerm}`,
          canonicalQuestion: `${model} - ${specTerm}`,
          answer,
          suffixes,
          recordKind: 'spec_table_record',
          sheetLayout: layout,
          metadata: {
            specTerm,
          },
          scope,
          directScope,
          scopeRaw: {
            ...sheetScope.raw,
            rowScope: rowScope.raw,
          },
          mappingLookup,
          mappingVersionId,
        })
        records.push(built.record)
        scopeDiagnostics.push(...built.scopeDiagnostics)
      }

      continue
    }

    if (layout === 'faq_table' || layout === 'sheet_scoped_faq') {
      const questionIndex = findHeaderIndex(header, isQuestionHeader)
      const answerIndexes = header
        .map((cell, index) => ({ cell, index }))
        .filter(({ cell }) => isAnswerHeader(cell))
        .map(({ index }) => index)
      const sheetScope = inferScopeFromSheetName(section.sheetName)

      for (const [offset, row] of section.rows.slice(1).entries()) {
        const cells = splitCells(row)
        const question = normalizeWhitespace(cells[questionIndex] ?? '')
        if (!question) continue

        const rowScope = extractRowScope(header, cells)
        const scope = mergeScopes(sheetScope.scope, rowScope.scope)
        const directScope = [...sheetScope.direct, ...rowScope.direct]

        for (const answerIndex of answerIndexes) {
          const answer = normalizeWhitespace(cells[answerIndex] ?? '')
          if (!answer) continue

          const built = buildSpreadsheetRecord({
            document,
            section,
            rowOffset: offset + 2,
            answer,
            answerIndex,
            extractionKind: 'table_row',
            question,
            suffixes,
            recordKind: 'explicit_spreadsheet_faq',
            sheetLayout: layout,
            metadata: {},
            scope,
            directScope,
            scopeRaw: {
              ...sheetScope.raw,
              rowScope: rowScope.raw,
            },
            mappingLookup,
            mappingVersionId,
          })
          records.push(built.record)
          scopeDiagnostics.push(...built.scopeDiagnostics)
        }
      }

      continue
    }

    if (layout === 'faq_matrix') {
      const questionIndex = findHeaderIndex(header, isQuestionHeader)
      const answerIndexes = header.map((_, index) => index).filter((index) => index !== questionIndex)
      const sheetScope = inferScopeFromSheetName(section.sheetName)

      for (const [offset, row] of section.rows.slice(1).entries()) {
        const cells = splitCells(row)
        const question = normalizeWhitespace(cells[questionIndex] ?? '')
        if (!question) continue

        const rowScope = extractRowScope(header, cells)

        for (const answerIndex of answerIndexes) {
          const answer = normalizeWhitespace(cells[answerIndex] ?? '')
          if (!answer) continue

          const variantLabel = normalizeWhitespace(header[answerIndex] ?? '')
          const variantScope = inferScopeFromVariantLabel(variantLabel)
          const scope = mergeScopes(sheetScope.scope, rowScope.scope, variantScope.scope)
          const directScope = [...sheetScope.direct, ...rowScope.direct, ...variantScope.direct]

          const built = buildSpreadsheetRecord({
            document,
            section,
            rowOffset: offset + 2,
            answerIndex,
            extractionKind: 'platform_variant',
            question,
            answer,
            suffixes,
            recordKind: 'explicit_spreadsheet_faq',
            sheetLayout: layout,
            metadata: {
              variantLabel: variantLabel || undefined,
            },
            scope,
            directScope,
            scopeRaw: {
              ...sheetScope.raw,
              rowScope: rowScope.raw,
              variantLabel: variantLabel || undefined,
            },
            mappingLookup,
            mappingVersionId,
          })
          records.push(built.record)
          scopeDiagnostics.push(...built.scopeDiagnostics)
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

      const sheetScope = inferScopeFromSheetName(section.sheetName)
      const built = buildSpreadsheetRecord({
        document,
        section,
        rowOffset: offset + 1,
        extractionKind: 'table_row',
        question,
        answer,
        suffixes,
        recordKind: 'explicit_spreadsheet_faq',
        sheetLayout: 'faq_table',
        metadata: {},
        scope: sheetScope.scope,
        directScope: sheetScope.direct,
        scopeRaw: sheetScope.raw,
        mappingLookup,
        mappingVersionId,
      })
      records.push(built.record)
      scopeDiagnostics.push(...built.scopeDiagnostics)
    }
  }

  return { records, diagnostics, scopeDiagnostics }
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
): RawRecordBuildResult {
  const rawRecords: StageRecord[] = []
  const diagnostics: KnowledgeDocumentDiagnostic[] = []
  const scopeDiagnostics: KnowledgeScopeDiagnostic[] = []
  const mappingLookup = buildMappingLookup(input.mappingRecords)

  for (const manifestRecord of sourceManifest) {
    if (!manifestRecord.isCandidateForIndex) continue
    const document = input.sourceDocuments.find((item) => item.id === manifestRecord.documentId)
    if (!document) continue

    if (manifestRecord.contentProfile === 'spreadsheet') {
      const extracted = extractSpreadsheetRows(document, suffixes, mappingLookup, input.mappingVersionId)
      rawRecords.push(...extracted.records)
      diagnostics.push(...extracted.diagnostics)
      scopeDiagnostics.push(...extracted.scopeDiagnostics)
      continue
    }

    rawRecords.push(...extractTextQuestionAnswerPairs(document, suffixes))
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

  return { records: rawRecords, diagnostics, scopeDiagnostics }
}

function cleanRecords(records: StageRecord[], suffixes: string[]): StageRecord[] {
  return records
    .map((record) => ({
      ...record,
      question: normalizeWhitespace(record.question),
      canonicalQuestion:
        record.extractionKind === 'spec_table'
          ? normalizeWhitespace(record.canonicalQuestion || record.question)
          : buildCanonicalQuestion(record.canonicalQuestion || record.question, suffixes),
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
  const scopeSignature = normalizeWhitespace(String(record.metadata.scopeSignature ?? ''))
  return [
    normalizeQuestionKey(record.canonicalQuestion || record.question),
    normalizeQuestionKey(scopeSignature),
    normalizeQuestionKey(variant),
    normalizeQuestionKey(sheet),
  ]
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
    const scope = (record.metadata.scope && typeof record.metadata.scope === 'object' ? record.metadata.scope : {}) as ScopeMap
    const scopeSignature = typeof record.metadata.scopeSignature === 'string' ? record.metadata.scopeSignature : buildScopeSignature(scope)
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
        questionAliasSignatures: [],
        sourceParentQuestions,
        isExactFaq,
        scope,
        scopeSignature,
        scopeSource: record.metadata.scopeSource ?? {
          direct: [],
          mappingVersionId: null,
          matched: false,
          mapped: [],
          conflicts: [],
        },
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
      const scopeSignature = typeof parent.metadata.scopeSignature === 'string' ? parent.metadata.scopeSignature : ''
      const scopeLine = scopeSignature ? `适用范围：${scopeSignature}\n` : ''
      return {
        id: nanoid(),
        parent_id: parent.id,
        chunk_order: index + 1,
        section_title: sectionTitle,
        chunk_text: chunkText,
        embedding_text: `主问题：${parent.question_clean}\n${scopeLine}分段标题：${sectionTitle}\n答案片段：${chunkText}\n标准答案：${parent.answer}`,
        chunk_type: 'answer',
        metadata: {
          ...parent.metadata,
          question: parent.question_clean,
          questionAliases: parent.question_aliases,
          scope: parent.metadata.scope,
          scopeSignature,
          scopeSource: parent.metadata.scopeSource,
          chunkKind: inferChunkKind(sectionTitle, chunkText),
          chunkRole: 'answer',
          chunkIndex: index + 1,
          chunkTotal: splitAnswerIntoChunks(parent.answer).length,
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
  const rawBuild = buildRawRecords(input, sourceManifest, profile.questionSuffixes)
  const rawRecords = rawBuild.records
  const documentDiagnostics = rawBuild.diagnostics
  const scopeDiagnostics = rawBuild.scopeDiagnostics
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
  if (documentDiagnostics.length > 0) {
    coverageReasons.push('Some spreadsheet sheets could not be parsed')
  }
  if (scopeDiagnostics.some((diagnostic) => diagnostic.status === 'conflict')) {
    coverageReasons.push('Some scope mappings require manual confirmation')
  }

  const coverageAudit: KnowledgeCoverageAudit = {
    coverage,
    auditStatus: coverage === 100 && coverageReasons.length === 0 ? 'normal' : 'warning',
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
    documentDiagnostics,
    scopeDiagnostics,
    stageArtifacts,
    retrievalContract: {
      version: 1,
      supportsRagRoute: true,
      supportsEvidenceAssembly: true,
      enrichedMetadataKeys: [
        'questionNormalized',
        'questionSignature',
        'questionAliasSignatures',
        'sourceParentQuestions',
        'isExactFaq',
        'scope',
        'scopeSignature',
        'scopeSource',
        'chunkKind',
      ],
    },
    cleaningContract: {
      version: 1,
      supportsScope: true,
      supportsMappingVersion: true,
      supportsSheetLayoutDiagnostics: true,
    },
  }

  const manifest: KnowledgeArtifactManifest = {
    ...manifestBase,
    snapshotHash: sha256(
      JSON.stringify({
        sourceSummary,
        stageSummary,
        coverageAudit,
        documentDiagnostics,
        scopeDiagnostics,
        stageArtifacts,
        retrievalContract: manifestBase.retrievalContract,
        cleaningContract: manifestBase.cleaningContract,
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
