import type { KnowledgeProfileConfig } from '@/types/database'

export interface KnowledgeRuntimeProfile {
  key: string
  riskKeywords: string[]
  questionSuffixes: string[]
  canonicalSuffixes: string[]
}

const DEFAULT_RISK_KEYWORDS = [
  'refund',
  'reimbursement',
  'chargeback',
  'contract',
  'compliance',
  'legal',
  'medical',
  'gift card',
  'destroy',
]

const DEFAULT_QUESTION_SUFFIXES = [
  'faq',
  'guide',
  'manual',
  'instructions',
  'instruction',
  'knowledge base',
]

const DEFAULT_CANONICAL_SUFFIXES = [
  'legacy',
  'old',
  'draft',
  'deprecated',
  'archive',
  'backup',
  'copy',
  'v2',
  'v3',
]

function readStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
}

export function getKnowledgeRuntimeProfile(
  profileKey: string,
  profileConfig?: Partial<KnowledgeProfileConfig>,
): KnowledgeRuntimeProfile {
  const riskRules = profileConfig?.riskRules as Record<string, unknown> | undefined
  const cleaningRules = profileConfig?.cleaningRules as Record<string, unknown> | undefined

  return {
    key: profileKey || 'generic_customer_service',
    riskKeywords: [
      ...new Set([
        ...DEFAULT_RISK_KEYWORDS,
        ...readStringList(riskRules?.keywords),
      ]),
    ],
    questionSuffixes: [
      ...new Set([
        ...DEFAULT_QUESTION_SUFFIXES,
        ...readStringList(cleaningRules?.questionSuffixes),
      ]),
    ],
    canonicalSuffixes: [
      ...new Set([
        ...DEFAULT_CANONICAL_SUFFIXES,
        ...readStringList(cleaningRules?.canonicalSuffixes),
      ]),
    ],
  }
}
