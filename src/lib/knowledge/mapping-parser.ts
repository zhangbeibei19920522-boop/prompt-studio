import type { KnowledgeScopeMappingRecord } from '@/types/database'

export interface ParseKnowledgeScopeMappingResult {
  rowCount: number
  keyField: string
  scopeFields: string[]
  records: KnowledgeScopeMappingRecord[]
}

type ScopeMap = Record<string, string[]>

function normalizeWhitespace(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

function normalizeHeaderKey(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, '').replace(/[^\w\u4e00-\u9fa5]/g, '')
}

function normalizeRetrievalText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '').trim()
}

function splitCells(row: string): string[] {
  return row.split('|').map((cell) => cell.trim())
}

function normalizeScopeField(value: string): string | null {
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
  if (normalized === 'cdmtv' || normalized === 'tv' || normalized === 'television') return 'TV'
  if (normalized === 'refrigerator') return 'Refrigerator'
  if (normalized === 'freezer') return 'Freezer'
  if (normalized === 'winecooler' || normalized === 'wine') return 'Wine Cooler'
  return normalizeWhitespace(value)
}

function normalizeScopeValue(key: string, value: string): string {
  if (key === 'platform') return normalizePlatformValue(value)
  if (key === 'productCategory' || key === 'deviceCategory') return normalizeProductCategoryValue(value)
  return normalizeWhitespace(value)
}

function addScopeValue(scope: ScopeMap, key: string, value: string): void {
  const normalized = normalizeScopeValue(key, value)
  if (!normalized) return
  const current = scope[key] ?? []
  if (!current.includes(normalized)) {
    scope[key] = [...current, normalized]
  }
}

function getContentRows(content: string): string[] {
  return normalizeWhitespace(content)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^Sheet:\s*/i.test(line))
}

function parseKeyValueCell(cell: string): { key: string; value: string } | null {
  const match = /^(.+?)\s*(?:-|:|：)\s*(.+)$/.exec(cell)
  if (!match) return null
  const scopeKey = normalizeScopeField(match[1] ?? '')
  const value = normalizeWhitespace(match[2] ?? '')
  if (!scopeKey || !value) return null
  return { key: scopeKey, value }
}

function findKeyField(scopeFields: string[]): string {
  if (scopeFields.includes('productModel')) return 'productModel'
  return scopeFields[0] ?? 'lookupKey'
}

function dedupeRecords(records: KnowledgeScopeMappingRecord[]): KnowledgeScopeMappingRecord[] {
  const byLookupKey = new Map<string, KnowledgeScopeMappingRecord>()

  for (const record of records) {
    const key = normalizeRetrievalText(record.lookupKey)
    if (!key) continue
    const existing = byLookupKey.get(key)
    if (!existing) {
      byLookupKey.set(key, record)
      continue
    }

    for (const [scopeKey, values] of Object.entries(record.scope)) {
      for (const value of values) {
        addScopeValue(existing.scope, scopeKey, value)
      }
    }
  }

  return [...byLookupKey.values()]
}

function parseHeaderTable(rows: string[]): ParseKnowledgeScopeMappingResult | null {
  const header = splitCells(rows[0] ?? '')
  const fields = header.map((cell) => normalizeScopeField(cell))
  const scopeFields = fields.filter((field): field is string => Boolean(field))

  if (scopeFields.length < 2) return null

  const keyField = findKeyField(scopeFields)
  const keyIndex = fields.findIndex((field) => field === keyField)
  const records: KnowledgeScopeMappingRecord[] = []

  for (const row of rows.slice(1)) {
    const cells = splitCells(row)
    const lookupKey = normalizeWhitespace(cells[keyIndex] ?? '')
    if (!lookupKey) continue

    const scope: ScopeMap = {}
    for (const [index, field] of fields.entries()) {
      if (!field) continue
      const value = normalizeWhitespace(cells[index] ?? '')
      if (!value) continue
      addScopeValue(scope, field, value)
    }

    if (Object.keys(scope).length > 0) {
      records.push({ lookupKey, scope })
    }
  }

  const deduped = dedupeRecords(records)
  return {
    rowCount: deduped.length,
    keyField,
    scopeFields: [...new Set(scopeFields)],
    records: deduped,
  }
}

function parseKeyValueRows(rows: string[]): ParseKnowledgeScopeMappingResult {
  const records: KnowledgeScopeMappingRecord[] = []
  const scopeFieldSet = new Set<string>()

  for (const row of rows) {
    const pairs = splitCells(row)
      .map(parseKeyValueCell)
      .filter((pair): pair is { key: string; value: string } => Boolean(pair))
    if (pairs.length < 2) continue

    const scope: ScopeMap = {}
    for (const pair of pairs) {
      scopeFieldSet.add(pair.key)
      addScopeValue(scope, pair.key, pair.value)
    }

    const keyField = findKeyField([...scopeFieldSet])
    const lookupKey = scope[keyField]?.[0] ?? pairs[0]?.value ?? ''
    if (lookupKey) {
      records.push({ lookupKey, scope })
    }
  }

  const scopeFields = [...scopeFieldSet]
  const keyField = findKeyField(scopeFields)
  const deduped = dedupeRecords(records)
  return {
    rowCount: deduped.length,
    keyField,
    scopeFields,
    records: deduped,
  }
}

export function parseKnowledgeScopeMappingContent(content: string): ParseKnowledgeScopeMappingResult {
  const rows = getContentRows(content)
  if (rows.length === 0) {
    return {
      rowCount: 0,
      keyField: 'lookupKey',
      scopeFields: [],
      records: [],
    }
  }

  return parseHeaderTable(rows) ?? parseKeyValueRows(rows)
}
