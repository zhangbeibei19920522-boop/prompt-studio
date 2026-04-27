import type { AiProvider, ChatMessage, ChatOptions } from "@/types/ai"
import type {
  Prompt,
  TestCase,
  TestCaseRoutingStep,
  TestSuite,
} from "@/types/database"
import { generateAnswer } from "@/lib/ai/rag/answer-generator"
import { searchIndexIngest } from "@/lib/ai/rag/retriever"
import { createGlobalRagLlmReranker } from "@/lib/ai/rag/llm-reranker"
import { ensureIndexIngestForIndexVersionId } from "@/lib/knowledge/index-ingest"
import { extractJson } from "./test-evaluator"
import { throwIfAborted } from "@/lib/test-run-abort"

export interface RoutingRunOptions {
  routePrompts?: Record<string, Prompt>
  signal?: AbortSignal
}

interface PromptExecutionDebugContext {
  workflowMode: "single" | "routing"
  provider?: string
  model?: string
  caseId?: string
  caseTitle?: string
}

interface PromptExecutionOptions {
  debugContext?: PromptExecutionDebugContext
  signal?: AbortSignal
}

interface PromptExecutionLogPayload {
  workflowMode: "single" | "routing"
  stage: "single" | "entry" | "target"
  caseId?: string
  caseTitle?: string
  turnIndex?: number
  provider?: string
  model?: string
  promptId: string
  promptTitle: string
  messages: ChatMessage[]
  rawResponse?: string
  rawIntent?: string | null
  resolvedIntent?: string | null
  matchedPromptId?: string | null
  matchedPromptTitle?: string | null
  routingError?: string | null
  error?: string
}

export interface RoutingExecutionResult {
  actualOutput: string
  actualIntent: string | null
  matchedPromptId: string | null
  matchedPromptTitle: string | null
  routingSteps: TestCaseRoutingStep[]
}

const DEFAULT_PROMPT_OPTIONS = {
  temperature: 0.7,
} as const

const ENTRY_ROUTER_OPTIONS = {
  temperature: 0.1,
  maxTokens: 20,
} as const

const RAG_RETRIEVAL_TOP_K = 10
const RAG_LLM_RERANK_CANDIDATE_TOP_K = 40

function isLikelyIntentValue(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (trimmed.includes("\n")) return false
  if (/[，。！？：；、"'“”‘’（）()]/.test(trimmed)) return false
  return /^[\p{L}\p{N}_./-]+$/u.test(trimmed)
}

function isAssistantPlaceholderContent(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed) return true

  const normalized = trimmed
    .replace(/^[（(]\s*/, "")
    .replace(/\s*[）)]$/, "")
    .trim()

  return /^(应|仍应)/.test(normalized)
}

export function parseConversationTurns(
  input: string
): Array<{ role: "user" | "assistant"; content: string }> | null {
  const lines = input.split("\n")
  const turns: Array<{ role: "user" | "assistant"; content: string }> = []
  let currentRole: "user" | "assistant" | null = null
  let currentContent = ""

  for (const line of lines) {
    const userMatch = line.match(/^User[:：]\s*(.*)/)
    const assistantMatch = line.match(/^Assistant[:：]\s*(.*)/)

    if (userMatch) {
      if (currentRole) {
        turns.push({ role: currentRole, content: currentContent.trim() })
      }
      currentRole = "user"
      currentContent = userMatch[1]
    } else if (assistantMatch) {
      if (currentRole) {
        turns.push({ role: currentRole, content: currentContent.trim() })
      }
      currentRole = "assistant"
      currentContent = isAssistantPlaceholderContent(assistantMatch[1]) ? "" : assistantMatch[1]
    } else if (currentRole) {
      currentContent += "\n" + line
    }
  }

  if (currentRole) {
    turns.push({ role: currentRole, content: currentContent.trim() })
  }

  const userTurns = turns.filter((turn) => turn.role === "user")
  if (userTurns.length < 2) return null

  return turns
}

function buildConversationMessages(
  prompt: Prompt,
  context: string,
  turns: Array<{ role: "user" | "assistant"; content: string }>
): ChatMessage[] {
  return [
    { role: "system", content: prompt.content },
    ...buildConversationContextMessages(context, turns),
  ]
}

function buildConversationContextMessages(
  context: string,
  turns: Array<{ role: "user" | "assistant"; content: string }>
): ChatMessage[] {
  const messages: ChatMessage[] = []

  if (context) {
    messages.push({ role: "system", content: `Context: ${context}` })
  }

  for (const turn of turns) {
    messages.push({ role: turn.role, content: turn.content })
  }

  return messages
}

function logPromptExecution(payload: PromptExecutionLogPayload) {
  console.log("[TestPromptExecution]", payload)
}

async function executePromptMessages(
  provider: AiProvider,
  messages: ChatMessage[],
  options: ChatOptions = DEFAULT_PROMPT_OPTIONS
): Promise<string> {
  throwIfAborted(options.signal)
  let response = ""
  const stream = provider.chatStream(messages, options)
  for await (const chunk of stream) {
    throwIfAborted(options.signal)
    response += chunk
  }
  throwIfAborted(options.signal)
  return response
}

export async function executePromptForCase(
  provider: AiProvider,
  prompt: Prompt,
  testCase: Pick<TestCase, "id" | "title" | "input" | "context">,
  options: PromptExecutionOptions = {}
): Promise<string> {
  const { debugContext, signal } = options
  const turns = parseConversationTurns(testCase.input)

  if (turns) {
    const history: Array<{ role: "user" | "assistant"; content: string }> = []
    const conversationParts: string[] = []
    let generatedTurnIndex = 0

    for (const turn of turns) {
      if (turn.role === "user") {
        history.push({ role: "user", content: turn.content })
        conversationParts.push(`User: ${turn.content}`)
      } else if (turn.content) {
        history.push({ role: "assistant", content: turn.content })
        conversationParts.push(`Assistant: ${turn.content}`)
      } else {
        const messages = buildConversationMessages(prompt, testCase.context, history)
        const response = await executePromptMessages(provider, messages, {
          ...DEFAULT_PROMPT_OPTIONS,
          signal,
        })
        logPromptExecution({
          workflowMode: debugContext?.workflowMode ?? "single",
          stage: "single",
          caseId: debugContext?.caseId ?? testCase.id,
          caseTitle: debugContext?.caseTitle ?? testCase.title,
          turnIndex: generatedTurnIndex,
          provider: debugContext?.provider,
          model: debugContext?.model,
          promptId: prompt.id,
          promptTitle: prompt.title,
          messages,
          rawResponse: response,
        })
        history.push({ role: "assistant", content: response })
        conversationParts.push(`Assistant: ${response}`)
        generatedTurnIndex += 1
      }
    }

    return conversationParts.join("\n")
  }

  const messages: ChatMessage[] = [{ role: "system", content: prompt.content }]

  let userContent = ""
  if (testCase.context) {
    userContent += `${testCase.context}\n\n`
  }
  userContent += testCase.input

  messages.push({ role: "user", content: userContent })

  const actualOutput = await executePromptMessages(provider, messages, {
    ...DEFAULT_PROMPT_OPTIONS,
    signal,
  })
  logPromptExecution({
    workflowMode: debugContext?.workflowMode ?? "single",
    stage: "single",
    caseId: debugContext?.caseId ?? testCase.id,
    caseTitle: debugContext?.caseTitle ?? testCase.title,
    turnIndex: 0,
    provider: debugContext?.provider,
    model: debugContext?.model,
    promptId: prompt.id,
    promptTitle: prompt.title,
    messages,
    rawResponse: actualOutput,
  })

  return actualOutput
}

function extractIntentValue(output: string): string | null {
  const structured = extractJson<{ intent?: string }>(output)
  if (structured?.intent && typeof structured.intent === "string") {
    const intent = structured.intent.trim()
    return isLikelyIntentValue(intent) ? intent : null
  }

  const trimmed = output
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim()
    .replace(/^["']|["']$/g, "")

  if (!trimmed) return null

  const lines = trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  const firstLine = lines[0] ?? null
  return firstLine && isLikelyIntentValue(firstLine) ? firstLine : null
}

export async function executeRoutingPromptForCase(
  provider: AiProvider,
  entryPrompt: Prompt,
  testCase: TestCase,
  suite: TestSuite,
  options: RoutingRunOptions,
  debugContext?: PromptExecutionDebugContext
): Promise<RoutingExecutionResult> {
  const turns = parseConversationTurns(testCase.input)

  if (!suite.routingConfig) {
    return {
      actualOutput: "",
      actualIntent: null,
      matchedPromptId: null,
      matchedPromptTitle: null,
      routingSteps: [],
    }
  }

  let lastResolvedIntent: string | null = null

  async function routeSingleTurn(
    history: Array<{ role: "user" | "assistant"; content: string }>,
    userInput: string,
    turnIndex: number
  ): Promise<TestCaseRoutingStep> {
    const entryMessages = buildConversationMessages(entryPrompt, testCase.context, history)
    const intentOutput = await executePromptMessages(provider, entryMessages, {
      ...ENTRY_ROUTER_OPTIONS,
      signal: options.signal,
    })
    const rawIntent = extractIntentValue(intentOutput)
    const resolvedIntent = rawIntent === "G" ? lastResolvedIntent : rawIntent
    const matchedRoute = resolvedIntent
      ? suite.routingConfig?.routes.find((route) => route.intent === resolvedIntent)
      : null
    const actualIntent = matchedRoute ? resolvedIntent : null
    const isRagRoute = matchedRoute?.intent === "R"
    const matchedPromptId = matchedRoute
      ? (isRagRoute ? matchedRoute.ragPromptId?.trim() ?? "" : matchedRoute.promptId)
      : ""
    const matchedPrompt = matchedPromptId ? options.routePrompts?.[matchedPromptId] : null
    const routingError = !rawIntent
      ? "入口 Prompt 未返回有效的 intent"
      : rawIntent === "G" && !lastResolvedIntent
        ? 'intent "G" 缺少可沿用的上一轮 intent'
        : !matchedRoute
          ? `未找到 intent "${resolvedIntent}" 对应的 Prompt`
          : !matchedPrompt
            ? `未找到目标 Prompt: ${matchedPromptId}`
            : null

    logPromptExecution({
      workflowMode: debugContext?.workflowMode ?? "routing",
      stage: "entry",
      caseId: debugContext?.caseId ?? testCase.id,
      caseTitle: debugContext?.caseTitle ?? testCase.title,
      turnIndex,
      provider: debugContext?.provider,
      model: debugContext?.model,
      promptId: entryPrompt.id,
      promptTitle: entryPrompt.title,
      messages: entryMessages,
      rawResponse: intentOutput,
      rawIntent,
      resolvedIntent,
      matchedPromptId: matchedPromptId || null,
      matchedPromptTitle: matchedPrompt?.title ?? null,
      routingError,
    })

    if (!rawIntent) {
      return {
        turnIndex,
        userInput,
        rawIntent: null,
        rawIntentOutput: intentOutput,
        actualIntent: null,
        matchedPromptId: null,
        matchedPromptTitle: null,
        actualReply: "",
        routingError,
      }
    }

    if (rawIntent === "G" && !lastResolvedIntent) {
      return {
        turnIndex,
        userInput,
        rawIntent,
        rawIntentOutput: intentOutput,
        actualIntent: null,
        matchedPromptId: null,
        matchedPromptTitle: null,
        actualReply: "",
        routingError,
      }
    }

    if (!matchedRoute) {
      return {
        turnIndex,
        userInput,
        rawIntent,
        rawIntentOutput: intentOutput,
        actualIntent: null,
        matchedPromptId: null,
        matchedPromptTitle: null,
        actualReply: "",
        routingError,
      }
    }

    if (!matchedPrompt) {
      return {
        turnIndex,
        userInput,
        rawIntent,
        rawIntentOutput: intentOutput,
        actualIntent,
        matchedPromptId: matchedPromptId || null,
        matchedPromptTitle: null,
        actualReply: "",
        routingError,
      }
    }

    if (isRagRoute) {
      const ragPromptId = matchedRoute.ragPromptId?.trim() ?? ""
      const ragIndexVersionId = matchedRoute.ragIndexVersionId?.trim() ?? ""

      if (!ragPromptId || !ragIndexVersionId) {
        return {
          turnIndex,
          userInput,
          rawIntent,
          rawIntentOutput: intentOutput,
          actualIntent,
          matchedPromptId: ragPromptId || null,
          matchedPromptTitle: matchedPrompt.title,
          actualReply: "",
          routeMode: "rag",
          ragPromptId: ragPromptId || null,
          ragIndexVersionId: ragIndexVersionId || null,
          retrievalTopK: RAG_RETRIEVAL_TOP_K,
          routingError: 'intent "R" 需要同时配置 ragPromptId 和 ragIndexVersionId',
        }
      }

      if (!matchedPrompt.content.includes("{rag_qas_text}")) {
        return {
          turnIndex,
          userInput,
          rawIntent,
          rawIntentOutput: intentOutput,
          actualIntent,
          matchedPromptId: ragPromptId,
          matchedPromptTitle: matchedPrompt.title,
          actualReply: "",
          routeMode: "rag",
          ragPromptId,
          ragIndexVersionId,
          retrievalTopK: RAG_RETRIEVAL_TOP_K,
          routingError: 'RAG Prompt 必须包含 {rag_qas_text}',
        }
      }

      try {
        const llmReranker = createGlobalRagLlmReranker()
        const retrievalTopK = llmReranker ? RAG_LLM_RERANK_CANDIDATE_TOP_K : RAG_RETRIEVAL_TOP_K
        const ingestResult = await ensureIndexIngestForIndexVersionId(ragIndexVersionId, {
          query: userInput,
        })
        const retrievalResult = searchIndexIngest({
          query: userInput,
          ingest: ingestResult.ingest,
          topK: retrievalTopK,
          queryVector: ingestResult.queryVector,
        })
        const recallResults = llmReranker
          ? await llmReranker.rerank(userInput, retrievalResult.results, RAG_RETRIEVAL_TOP_K)
          : retrievalResult.results
        const answer = await generateAnswer({
          query: userInput,
          recallResults,
          promptTemplate: matchedPrompt.content,
          contextMessages: buildConversationContextMessages(testCase.context, history),
          llmClient: {
            generate: (messages, chatOptions) =>
              executePromptMessages(provider, messages, {
                ...DEFAULT_PROMPT_OPTIONS,
                ...chatOptions,
                signal: options.signal,
              }),
          },
        })

        logPromptExecution({
          workflowMode: debugContext?.workflowMode ?? "routing",
          stage: "target",
          caseId: debugContext?.caseId ?? testCase.id,
          caseTitle: debugContext?.caseTitle ?? testCase.title,
          turnIndex,
          provider: debugContext?.provider,
          model: debugContext?.model,
          promptId: matchedPrompt.id,
          promptTitle: matchedPrompt.title,
          messages: answer.llmMessages,
          rawResponse: answer.answerText,
          rawIntent,
          resolvedIntent: actualIntent,
          matchedPromptId: matchedPrompt.id,
          matchedPromptTitle: matchedPrompt.title,
        })

        lastResolvedIntent = actualIntent

        return {
          turnIndex,
          userInput,
          rawIntent,
          rawIntentOutput: intentOutput,
          actualIntent,
          matchedPromptId: matchedPrompt.id,
          matchedPromptTitle: matchedPrompt.title,
          actualReply: answer.answerText,
          routeMode: "rag",
          ragPromptId,
          ragIndexVersionId,
          retrievalTopK: RAG_RETRIEVAL_TOP_K,
          selectedDocId: answer.selectedDocId,
          selectedChunkIds: answer.selectedChunkIds,
          selectionMargin: answer.selectionMargin,
          answerMode: answer.answerMode,
          ingestBackfilled: ingestResult.backfilled,
        }
      } catch (error) {
        return {
          turnIndex,
          userInput,
          rawIntent,
          rawIntentOutput: intentOutput,
          actualIntent,
          matchedPromptId: ragPromptId || null,
          matchedPromptTitle: matchedPrompt.title,
          actualReply: "",
          routeMode: "rag",
          ragPromptId: ragPromptId || null,
          ragIndexVersionId: ragIndexVersionId || null,
          retrievalTopK: RAG_RETRIEVAL_TOP_K,
          routingError: error instanceof Error ? error.message : String(error),
        }
      }
    }

    const targetMessages = buildConversationMessages(matchedPrompt, testCase.context, history)
    const actualReply = await executePromptMessages(provider, targetMessages, {
      ...DEFAULT_PROMPT_OPTIONS,
      signal: options.signal,
    })

    logPromptExecution({
      workflowMode: debugContext?.workflowMode ?? "routing",
      stage: "target",
      caseId: debugContext?.caseId ?? testCase.id,
      caseTitle: debugContext?.caseTitle ?? testCase.title,
      turnIndex,
      provider: debugContext?.provider,
      model: debugContext?.model,
      promptId: matchedPrompt.id,
      promptTitle: matchedPrompt.title,
      messages: targetMessages,
      rawResponse: actualReply,
      rawIntent,
      resolvedIntent: actualIntent,
      matchedPromptId: matchedPrompt.id,
      matchedPromptTitle: matchedPrompt.title,
    })

    lastResolvedIntent = actualIntent

    return {
      turnIndex,
      userInput,
      rawIntent,
      rawIntentOutput: intentOutput,
      actualIntent,
      matchedPromptId: matchedPromptId || null,
      matchedPromptTitle: matchedPrompt.title,
      actualReply,
      routeMode: "prompt",
    }
  }

  if (!turns) {
    const history = [{ role: "user", content: testCase.input }] as Array<{
      role: "user" | "assistant"
      content: string
    }>
    const step = await routeSingleTurn(history, testCase.input, 0)

    return {
      actualOutput: step.actualReply,
      actualIntent: step.actualIntent,
      matchedPromptId: step.matchedPromptId,
      matchedPromptTitle: step.matchedPromptTitle,
      routingSteps: [step],
    }
  }

  const history: Array<{ role: "user" | "assistant"; content: string }> = []
  const conversationParts: string[] = []
  const routingSteps: TestCaseRoutingStep[] = []
  let generatedTurnIndex = 0

  for (let index = 0; index < turns.length; index++) {
    const turn = turns[index]

    if (turn.role === "assistant") {
      if (turn.content) {
        history.push({ role: "assistant", content: turn.content })
        conversationParts.push(`Assistant: ${turn.content}`)
      }
      continue
    }

    history.push({ role: "user", content: turn.content })
    conversationParts.push(`User: ${turn.content}`)

    const nextTurn = turns[index + 1]
    if (nextTurn?.role === "assistant" && nextTurn.content) {
      history.push({ role: "assistant", content: nextTurn.content })
      conversationParts.push(`Assistant: ${nextTurn.content}`)
      index += 1
      continue
    }

    if (nextTurn?.role === "assistant" && !nextTurn.content) {
      index += 1
    }

    const step = await routeSingleTurn(history, turn.content, generatedTurnIndex)
    generatedTurnIndex += 1
    routingSteps.push(step)
    if (step.actualReply) {
      history.push({ role: "assistant", content: step.actualReply })
      conversationParts.push(`Assistant: ${step.actualReply}`)
    }
  }

  return {
    actualOutput: conversationParts.join("\n"),
    actualIntent:
      routingSteps.length > 1
        ? routingSteps.map((step) => step.actualIntent ?? "").join("\n")
        : (routingSteps[0]?.actualIntent ?? null),
    matchedPromptId:
      routingSteps.length > 1
        ? routingSteps.map((step) => step.matchedPromptId ?? "").join("\n")
        : (routingSteps[0]?.matchedPromptId ?? null),
    matchedPromptTitle:
      routingSteps.length > 1
        ? routingSteps.map((step) => step.matchedPromptTitle ?? "").join("\n")
        : (routingSteps[0]?.matchedPromptTitle ?? null),
    routingSteps,
  }
}

export function formatRoutingExpectedTranscript(
  testCaseInput: string,
  routingResult: Pick<RoutingExecutionResult, "routingSteps" | "actualOutput">
): string {
  const turns = parseConversationTurns(testCaseInput)

  if (!turns) {
    const firstStep = routingResult.routingSteps[0]
    if (!firstStep?.actualReply || !firstStep.actualIntent) {
      return routingResult.actualOutput
    }
    return `User: ${testCaseInput}\nAssistant: ${firstStep.actualIntent}\n${firstStep.actualReply}`
  }

  const conversationParts: string[] = []
  let generatedStepIndex = 0
  for (let index = 0; index < turns.length; index++) {
    const turn = turns[index]

    if (turn.role === "user") {
      conversationParts.push(`User: ${turn.content}`)

      const nextTurn = turns[index + 1]
      const needsGeneratedAssistant = !nextTurn || (nextTurn.role === "assistant" && !nextTurn.content)

      if (needsGeneratedAssistant) {
        const step = routingResult.routingSteps[generatedStepIndex]
        generatedStepIndex += 1

        if (!step?.actualReply) {
          continue
        }

        if (step.actualIntent) {
          conversationParts.push(`Assistant: ${step.actualIntent}\n${step.actualReply}`)
        } else {
          conversationParts.push(`Assistant: ${step.actualReply}`)
        }
      }

      continue
    }

    if (turn.content) {
      conversationParts.push(`Assistant: ${turn.content}`)
      continue
    }
  }

  return conversationParts.join("\n")
}
