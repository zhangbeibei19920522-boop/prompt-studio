import { extractJson } from '@/lib/ai/test-evaluator'
import type { KnowledgeChunk } from '@/lib/audit/knowledge-chunker'
import type {
  ConversationAuditProcessStatus,
  ConversationAuditProcessStep,
} from '@/types/database'
import type { AiProvider, ChatMessage } from '@/types/ai'

export interface ConversationAuditConversationEvaluationInput {
  transcript: string
  knowledge: KnowledgeChunk[]
}

export interface ConversationAuditConversationEvaluationResult {
  processStatus: ConversationAuditProcessStatus
  summary: string
  processSteps: ConversationAuditProcessStep[]
}

interface RawConversationEvaluationResult {
  processStatus: ConversationAuditProcessStatus
  summary: string
  processSteps: Array<{
    name: string
    status: ConversationAuditProcessStep['status']
    reason: string
    sourceNames?: string[]
  }>
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value: string): string[] {
  const normalized = normalizeText(value)
  const tokens = normalized
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean)

  const chineseSequences = normalized.match(/[\u4e00-\u9fff]+/g) ?? []
  const chineseTokens = chineseSequences.flatMap((sequence) => {
    if (sequence.length <= 2) {
      return [sequence, ...sequence.split('')]
    }

    const grams: string[] = []
    for (let index = 0; index < sequence.length - 1; index += 1) {
      grams.push(sequence.slice(index, index + 2))
    }

    return [...sequence.split(''), ...grams]
  })

  return Array.from(new Set([...tokens, ...chineseTokens]))
}

const PROCESS_KEYWORDS = [
  '流程',
  '步骤',
  '先',
  '再',
  '然后',
  '之后',
  '必须',
  '需要',
  '核验',
  '确认',
  '判断',
  '告知',
  '规范',
  'sop',
  'process',
  'step',
  'workflow',
  'procedure',
  'must',
  'should',
  'before',
  'after',
  'verify',
  'confirm',
]

function getProcessSignal(chunk: KnowledgeChunk): number {
  const content = normalizeText(chunk.content)
  const sourceName = normalizeText(chunk.sourceName)

  let signal = 0

  for (const keyword of PROCESS_KEYWORDS) {
    if (content.includes(keyword) || sourceName.includes(keyword)) {
      signal += 4
    }
  }

  return signal
}

function scoreProcessChunk(chunk: KnowledgeChunk, transcript: string): number {
  const transcriptTokens = new Set(tokenize(transcript))
  const chunkTokens = tokenize(chunk.content)
  let score = getProcessSignal(chunk)

  for (const token of chunkTokens) {
    if (transcriptTokens.has(token)) {
      score += 1
    }
  }

  if (chunk.content.length >= 30) {
    score += 1
  }

  return score
}

export function selectProcessKnowledge(knowledge: KnowledgeChunk[], transcript: string, limit = 6): KnowledgeChunk[] {
  const scored = knowledge
    .map((chunk) => ({
      chunk,
      score: scoreProcessChunk(chunk, transcript),
      processSignal: getProcessSignal(chunk),
    }))

  const processHeavy = scored
    .filter((result) => result.processSignal > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((result) => result.chunk)

  if (processHeavy.length > 0) {
    return processHeavy
  }

  return scored
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((result) => result.chunk)
}

function formatKnowledge(knowledge: KnowledgeChunk[]): string {
  if (knowledge.length === 0) {
    return 'No relevant knowledge retrieved.'
  }

  return knowledge
    .map((chunk, index) => `${index + 1}. ${chunk.sourceName}\n${chunk.content}`)
    .join('\n\n')
}

export async function evaluateConversationAuditConversation(
  provider: AiProvider,
  input: ConversationAuditConversationEvaluationInput
): Promise<ConversationAuditConversationEvaluationResult> {
  if (input.knowledge.length === 0) {
    return {
      processStatus: 'unknown',
      summary: '未检索到足够的流程知识，暂时无法判断流程是否合规。',
      processSteps: [],
    }
  }

  const selectedKnowledge = selectProcessKnowledge(input.knowledge, input.transcript)

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You evaluate whether a full conversation follows the process described in the provided knowledge.
Focus only on process, required steps, ordering, prerequisites, and must-do actions.
Ignore pure FAQ facts unless they directly define a process step.
Return strict JSON only:
{
  "processStatus": "passed",
  "summary": "...",
  "processSteps": [
    {
      "name": "step name",
      "status": "passed",
      "reason": "...",
      "sourceNames": ["file.ext"]
    }
  ]
}`,
    },
    {
      role: 'user',
      content: `Conversation transcript:
${input.transcript}

Retrieved knowledge:
${formatKnowledge(selectedKnowledge)}`,
    },
  ]

  try {
    const response = await provider.chat(messages, { temperature: 0 })
    const parsed = extractJson<RawConversationEvaluationResult>(response)

    if (
      parsed
      && (parsed.processStatus === 'passed' || parsed.processStatus === 'failed' || parsed.processStatus === 'unknown')
      && typeof parsed.summary === 'string'
      && Array.isArray(parsed.processSteps)
    ) {
      return {
        processStatus: parsed.processStatus,
        summary: parsed.summary,
        processSteps: parsed.processSteps
          .filter((step) => typeof step.name === 'string' && (step.status === 'passed' || step.status === 'failed' || step.status === 'out_of_order'))
          .map((step) => ({
            name: step.name,
            status: step.status,
            reason: typeof step.reason === 'string' ? step.reason : '',
            sourceNames: Array.isArray(step.sourceNames) ? step.sourceNames.filter((name): name is string => typeof name === 'string') : [],
          })),
      }
    }
  } catch (error) {
    console.error('[ConversationAudit] Conversation evaluation request failed', error)
  }

  return {
    processStatus: 'unknown',
    summary: '流程评估结果解析失败。',
    processSteps: [],
  }
}
