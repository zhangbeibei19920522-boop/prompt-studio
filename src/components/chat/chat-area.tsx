"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { MessageSquarePlus, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MessageBubble } from "./message-bubble"
import { ChatInput } from "./chat-input"
import { TestSuiteCard } from "@/components/test/test-suite-card"
import { TestFlowConfigCard } from "@/components/test/test-flow-config-card"
import { TestRoutingConfigDialog } from "@/components/test/test-routing-config-dialog"
import { streamChat, streamTestChat } from "@/lib/utils/sse-client"
import type { Message, MessageReference, PreviewData, DiffData, TestSuiteRoutingConfig } from "@/types/database"
import type {
  AgentContextSummary,
  MemoryCommandData,
  TestSuiteGenerationData,
  TestSuiteProgressData,
  TestFlowConfigRequestData,
} from "@/types/ai"

function ContextLog({ summary }: { summary: AgentContextSummary }) {
  const [open, setOpen] = useState(false)

  const items: string[] = []
  if (summary.hasGlobalBusiness) items.push("全局业务信息")
  if (summary.hasProjectBusiness) items.push("项目业务信息")
  if (summary.referencedPrompts.length > 0)
    items.push(`Prompt: ${summary.referencedPrompts.map((p) => p.title).join(", ")}`)
  if (summary.referencedDocuments.length > 0)
    items.push(`文档: ${summary.referencedDocuments.map((d) => d.name).join(", ")}`)
  if (summary.globalMemoryCount > 0)
    items.push(`全局记忆: ${summary.globalMemoryCount} 条`)
  if (summary.projectMemoryCount > 0)
    items.push(`项目记忆: ${summary.projectMemoryCount} 条`)
  if (summary.historyMessageCount > 0)
    items.push(`历史消息: ${summary.historyMessageCount} 条`)

  // Always show context log — at minimum show mode info
  if (items.length === 0) items.push("已就绪，正在生成回复")

  return (
    <div className="rounded-lg border bg-muted/50 text-xs mb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <span className="font-medium">Agent 思考链</span>
        <span className="ml-auto tabular-nums">{items.length} 项上下文</span>
      </button>
      {open && (
        <ul className="px-3 pb-2 space-y-0.5 text-muted-foreground">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="mt-0.5 shrink-0">-</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface ChatAreaProps {
  messages: Message[]
  sessionId: string | null
  prompts: Array<{ id: string; title: string }>
  documents: Array<{ id: string; name: string }>
  indexVersions: Array<{ id: string; title: string }>
  onMessagesChange: () => void
  onApplyPreview?: (data: PreviewData) => void
  onApplyDiff?: (data: DiffData) => void
  onEditInPanel?: (data: PreviewData | DiffData) => void
  onViewHistory?: (promptId: string) => void
  onNewSession?: () => void
  onMemoryCommand?: (data: MemoryCommandData) => void
  onConfirmTestSuite?: (data: TestSuiteGenerationData) => void
  onSessionTitleUpdate?: (sessionId: string, title: string) => void
  useTestAgent?: boolean
}

export function ChatArea({
  messages,
  sessionId,
  prompts,
  documents,
  indexVersions,
  onMessagesChange,
  onApplyPreview,
  onApplyDiff,
  onEditInPanel,
  onViewHistory,
  onNewSession,
  onMemoryCommand,
  onConfirmTestSuite,
  onSessionTitleUpdate,
  useTestAgent,
}: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [streamingText, setStreamingText] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [contextSummary, setContextSummary] = useState<AgentContextSummary | null>(null)
  const [pendingFlowConfig, setPendingFlowConfig] = useState<TestFlowConfigRequestData | null>(null)
  const [routingDialogOpen, setRoutingDialogOpen] = useState(false)
  const [routingConfig, setRoutingConfig] = useState<TestSuiteRoutingConfig>({
    entryPromptId: "",
    routes: [{ intent: "", promptId: "" }],
  })
  const [pendingTestSuite, setPendingTestSuite] = useState<TestSuiteGenerationData | null>(null)
  const [batchProgress, setBatchProgress] = useState<TestSuiteProgressData | null>(null)
  const [continuationInfo, setContinuationInfo] = useState<{ iteration: number; maxIterations: number } | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, streamingText, pendingFlowConfig, pendingTestSuite, batchProgress, continuationInfo])

  const handleSend = useCallback(
    async (
      content: string,
      references: MessageReference[],
      options: {
        routingConfig?: TestSuiteRoutingConfig | null
      } = {}
    ) => {
      if (!sessionId) return

      setIsStreaming(true)
      setStreamingText("")
      setContextSummary(null)
      setBatchProgress(null)
      if (!options.routingConfig) {
        setPendingFlowConfig(null)
      }

      try {
        const stream = useTestAgent
          ? streamTestChat({
              sessionId,
              content,
              references,
              routingConfig: options.routingConfig ?? null,
            })
          : streamChat({ sessionId, content, references })
        for await (const event of stream) {
          switch (event.type) {
            case "context":
              setContextSummary(event.data)
              break
            case "text":
              setStreamingText((prev) => prev + event.content)
              break
            case "memory":
              onMemoryCommand?.(event.data)
              break
            case "test-flow-config":
              setPendingFlowConfig(event.data)
              setRoutingConfig({
                entryPromptId: "",
                routes: [{ intent: "", promptId: "" }],
              })
              setStreamingText("")
              setBatchProgress(null)
              break
            case "continuation":
              setContinuationInfo(event.data)
              break
            case "test-suite-progress":
              setBatchProgress(event.data)
              setStreamingText("")
              break
            case "test-suite":
              setPendingTestSuite(event.data)
              setPendingFlowConfig(null)
              setStreamingText("")
              setBatchProgress(null)
              onMessagesChange()
              break
            case "session-title":
              onSessionTitleUpdate?.(event.data.sessionId, event.data.title)
              break
            case "plan":
            case "preview":
            case "diff":
            case "done":
              // Refresh messages from server
              setStreamingText("")
              onMessagesChange()
              break
            case "error":
              console.error("Stream error:", event.message)
              setStreamingText("")
              onMessagesChange()
              break
          }
        }
      } catch (error) {
        console.error("Chat error:", error)
      } finally {
        setIsStreaming(false)
        setStreamingText("")
        setContextSummary(null)
        setBatchProgress(null)
        setContinuationInfo(null)
        onMessagesChange()
      }
    },
    [sessionId, onMemoryCommand, onMessagesChange, onSessionTitleUpdate, useTestAgent]
  )

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-stone-50">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-6">
        <div className="mx-auto flex max-w-[720px] flex-col gap-5 pb-6">
          {messages.length === 0 && !isStreaming && (
            <div className="flex min-h-[55vh] items-center justify-center py-12">
              <div className="space-y-4 text-center text-zinc-500">
                <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-zinc-100">
                  <MessageSquarePlus className="size-7 text-zinc-400" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-zinc-900">开始新对话</p>
                  <p className="max-w-sm text-sm leading-6 text-zinc-500">
                    点击输入框左侧按钮引用 Prompt 或知识库文档，描述您的需求。
                  </p>
                </div>
                {!sessionId && onNewSession && (
                  <Button
                    onClick={onNewSession}
                    className="mt-2"
                  >
                    <MessageSquarePlus className="size-4 mr-2" />
                    开始对话
                  </Button>
                )}
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onApplyPreview={onApplyPreview}
              onApplyDiff={onApplyDiff}
              onEditInPanel={onEditInPanel}
              onViewHistory={onViewHistory}
            />
          ))}
          {(contextSummary || streamingText || batchProgress || continuationInfo) && (
            <div className="flex w-full justify-start">
              <div className="max-w-[80%]">
                {contextSummary && <ContextLog summary={contextSummary} />}
                {streamingText && (
                  <div className="rounded-lg px-3 py-2 text-sm leading-relaxed bg-muted text-foreground">
                    <p className="whitespace-pre-wrap">{streamingText}</p>
                    <span className="inline-block w-1.5 h-4 bg-foreground/60 animate-pulse ml-0.5" />
                  </div>
                )}
                {continuationInfo && (
                  <div className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground bg-muted/50 mb-1">
                    内容较长，正在续写 ({continuationInfo.iteration}/{continuationInfo.maxIterations})...
                  </div>
                )}
                {batchProgress && !streamingText && (
                  <div className="rounded-lg px-3 py-2 text-sm leading-relaxed bg-muted text-foreground">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-1.5 h-4 bg-foreground/60 animate-pulse" />
                      <span>正在生成测试用例 ({batchProgress.generated}/{batchProgress.total})...</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-muted-foreground/20 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${(batchProgress.generated / batchProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {pendingFlowConfig && (
            <div className="flex w-full justify-start">
              <div className="max-w-[80%]">
                <TestFlowConfigCard
                  data={pendingFlowConfig}
                  routingConfig={routingConfig.routes[0]?.intent ? routingConfig : null}
                  onOpenConfig={() => setRoutingDialogOpen(true)}
                />
              </div>
            </div>
          )}
          {pendingTestSuite && (
            <div className="flex w-full justify-start">
              <div className="max-w-[80%]">
                <TestSuiteCard
                  data={pendingTestSuite}
                  onConfirm={(data) => {
                    onConfirmTestSuite?.(data)
                    setPendingTestSuite(null)
                  }}
                />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {pendingFlowConfig && (
        <TestRoutingConfigDialog
          open={routingDialogOpen}
          prompts={prompts}
          indexVersions={indexVersions}
          value={routingConfig}
          onOpenChange={setRoutingDialogOpen}
          onSave={(value) => {
            setRoutingConfig(value)
            setRoutingDialogOpen(false)
            void handleSend("", [], { routingConfig: value })
          }}
        />
      )}

      <ChatInput
        onSend={handleSend}
        prompts={prompts}
        documents={documents}
        disabled={isStreaming || !sessionId}
      />
    </div>
  )
}
