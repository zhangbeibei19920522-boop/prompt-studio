import { getSettings } from '@/lib/db/repositories/settings'
import { findSessionById } from '@/lib/db/repositories/sessions'
import { findProjectById } from '@/lib/db/repositories/projects'
import { findPromptById } from '@/lib/db/repositories/prompts'
import { findDocumentById } from '@/lib/db/repositories/documents'
import { findMessagesBySession } from '@/lib/db/repositories/messages'
import type { AgentContext, BusinessInfo } from '@/types/ai'
import type { MessageReference } from '@/types/database'

const EMPTY_BUSINESS: BusinessInfo = {
  description: '',
  goal: '',
  background: '',
}

const MAX_HISTORY_MESSAGES = 20

/**
 * Collect all context needed for the Agent before calling the LLM.
 *
 * Steps:
 * 1. Global settings → globalBusiness
 * 2. Session → project → projectBusiness
 * 3. References → referencedPrompts / referencedDocuments
 * 4. Session messages (last 20) → sessionHistory
 */
export function collectAgentContext(
  sessionId: string,
  userMessage: string,
  references: MessageReference[]
): AgentContext {
  // 1. Global business info from settings
  const settings = getSettings()
  const globalBusiness: BusinessInfo = {
    description: settings.businessDescription ?? '',
    goal: settings.businessGoal ?? '',
    background: settings.businessBackground ?? '',
  }

  // 2. Session → project business info
  let projectBusiness: BusinessInfo = EMPTY_BUSINESS

  const session = findSessionById(sessionId)
  if (session) {
    const project = findProjectById(session.projectId)
    if (project) {
      projectBusiness = {
        description: project.businessDescription ?? '',
        goal: project.businessGoal ?? '',
        background: project.businessBackground ?? '',
      }
    }
  }

  // 3. Resolve references
  const referencedPrompts = references
    .filter((ref) => ref.type === 'prompt')
    .map((ref) => findPromptById(ref.id))
    .filter((p): p is NonNullable<typeof p> => p !== null)

  const referencedDocuments = references
    .filter((ref) => ref.type === 'document')
    .map((ref) => findDocumentById(ref.id))
    .filter((d): d is NonNullable<typeof d> => d !== null)

  // 4. Session history (last N messages)
  const allMessages = findMessagesBySession(sessionId)
  const sessionHistory = allMessages.slice(-MAX_HISTORY_MESSAGES)

  return {
    globalBusiness,
    projectBusiness,
    referencedPrompts,
    referencedDocuments,
    sessionHistory,
    userMessage,
  }
}
