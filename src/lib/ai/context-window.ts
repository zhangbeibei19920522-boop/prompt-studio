import type { ChatMessage } from "@/types/ai"
import type { Document, Message, Prompt } from "@/types/database"

const MAX_REFERENCED_PROMPTS = 2
const MAX_REFERENCED_DOCUMENTS = 2
const MAX_PROMPT_CONTENT_CHARS = 6000
const MAX_DOCUMENT_CONTENT_CHARS = 8000
const MAX_HISTORY_MESSAGES = 8
const MAX_HISTORY_MESSAGE_CHARS = 2000

function truncateContent(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value
  }

  return `${value.slice(0, maxChars)}\n\n[内容已截断，原始长度 ${value.length} 字符，仅保留前 ${maxChars} 字符]`
}

export function appendBoundedPromptReferences(system: string, prompts: Prompt[]): string {
  if (prompts.length === 0) {
    return system
  }

  const includedPrompts = prompts.slice(0, MAX_REFERENCED_PROMPTS)
  let nextSystem = `${system}\n\n## 引用的 Prompt`

  for (const prompt of includedPrompts) {
    nextSystem += `\n\n### ${prompt.title} (ID: ${prompt.id})`
    if (prompt.description) nextSystem += `\n说明: ${prompt.description}`
    nextSystem += `\n内容:\n${truncateContent(prompt.content, MAX_PROMPT_CONTENT_CHARS)}`
  }

  if (prompts.length > includedPrompts.length) {
    nextSystem += `\n\n另有 ${prompts.length - includedPrompts.length} 个 Prompt 未注入本轮上下文，请在必要时缩小引用范围后重试。`
  }

  return nextSystem
}

export function appendBoundedDocumentReferences(system: string, documents: Document[]): string {
  if (documents.length === 0) {
    return system
  }

  const includedDocuments = documents.slice(0, MAX_REFERENCED_DOCUMENTS)
  let nextSystem = `${system}\n\n## 引用的知识库文档`

  for (const document of includedDocuments) {
    nextSystem += `\n\n### ${document.name} (${document.type})`
    nextSystem += `\n${truncateContent(document.content, MAX_DOCUMENT_CONTENT_CHARS)}`
  }

  if (documents.length > includedDocuments.length) {
    nextSystem += `\n\n另有 ${documents.length - includedDocuments.length} 个知识库文档未注入本轮上下文，请在必要时缩小引用范围后重试。`
  }

  return nextSystem
}

export function buildBoundedHistoryMessages(sessionHistory: Message[]): ChatMessage[] {
  return sessionHistory.slice(-MAX_HISTORY_MESSAGES).map((message) => ({
    role: message.role,
    content: truncateContent(message.content, MAX_HISTORY_MESSAGE_CHARS),
  }))
}
