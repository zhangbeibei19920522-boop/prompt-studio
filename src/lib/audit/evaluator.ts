import { extractJson } from '@/lib/ai/test-evaluator'
import type { KnowledgeChunk } from '@/lib/audit/knowledge-chunker'
import type { AiProvider, ChatMessage } from '@/types/ai'

export interface ConversationAuditEvaluationInput {
  userMessage: string
  botReply: string
  knowledge: KnowledgeChunk[]
}

export interface ConversationAuditEvaluationResult {
  hasIssue: boolean | null
  knowledgeAnswer: string
}

interface RawEvaluationResult {
  hasIssue: boolean
  knowledgeAnswer: string
}

function formatKnowledge(knowledge: KnowledgeChunk[]): string {
  if (knowledge.length === 0) {
    return 'No relevant knowledge retrieved.'
  }

  return knowledge
    .map((chunk, index) => {
      const location = chunk.sheetName ? ` / Sheet: ${chunk.sheetName}` : ''
      return `${index + 1}. ${chunk.sourceName}${location}\n${chunk.content}`
    })
    .join('\n\n')
}

export async function evaluateConversationAuditTurn(
  provider: AiProvider,
  input: ConversationAuditEvaluationInput
): Promise<ConversationAuditEvaluationResult> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a conversation audit evaluator.
Use only the provided knowledge. Do not invent any policy or answer.
Decide whether the bot reply has an issue relative to the knowledge and provide the original knowledge-grounded answer.
Return strict JSON only:
{
  "hasIssue": true,
  "knowledgeAnswer": "..."
}`,
    },
    {
      role: 'user',
      content: `User message:
${input.userMessage}

Bot reply:
${input.botReply || '(empty)'}

Retrieved knowledge:
${formatKnowledge(input.knowledge)}`,
    },
  ]

  try {
    const response = await provider.chat(messages, { temperature: 0 })
    const result = extractJson<RawEvaluationResult>(response)

    if (result && typeof result.hasIssue === 'boolean' && typeof result.knowledgeAnswer === 'string') {
      return {
        hasIssue: result.hasIssue,
        knowledgeAnswer: result.knowledgeAnswer,
      }
    }
  } catch {
    // fall through to parse fallback
  }

  return {
    hasIssue: null,
    knowledgeAnswer: '',
  }
}
