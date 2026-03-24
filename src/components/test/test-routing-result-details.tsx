"use client"

import type { TestCase, TestCaseResult, TestCaseRoutingStep } from "@/types/database"

interface RoutingStepDiagnosticsDetailsProps {
  title: string
  routingSteps?: TestCaseRoutingStep[] | null
}

export function RoutingStepDiagnosticsDetails({
  title,
  routingSteps,
}: RoutingStepDiagnosticsDetailsProps) {
  const rawRouterOutputs =
    routingSteps
      ?.map((step) => ({
        turnIndex: step.turnIndex,
        userInput: step.userInput,
        output: step.rawIntentOutput?.trim() ?? "",
        routingError: step.routingError?.trim() ?? "",
      }))
      .filter((step) => step.output || step.routingError) ?? []

  if (rawRouterOutputs.length === 0) {
    return null
  }

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1">
        {title}
      </p>
      <div className="space-y-2">
        {rawRouterOutputs.map((step) => (
          <div key={`${step.turnIndex}-${step.userInput}`} className="bg-muted/50 rounded p-2 space-y-1">
            {rawRouterOutputs.length > 1 && (
              <p className="text-xs font-medium text-muted-foreground">
                第 {step.turnIndex + 1} 轮
              </p>
            )}
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
              用户输入：{step.userInput}
            </p>
            {step.output && (
              <p className="text-sm whitespace-pre-wrap">
                {step.output}
              </p>
            )}
            {step.routingError && (
              <p className="text-xs whitespace-pre-wrap text-destructive">
                {step.routingError}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

interface TestRoutingResultDetailsProps {
  testCase: TestCase
  result: TestCaseResult
}

export function TestRoutingResultDetails({
  testCase: _testCase,
  result,
}: TestRoutingResultDetailsProps) {
  if (!result.replyReason && !result.routingSteps?.length) {
    return null
  }

  return (
    <div className="space-y-3">
      <RoutingStepDiagnosticsDetails
        title="入口 Prompt 原始输出"
        routingSteps={result.routingSteps}
      />
      {result.replyReason && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">
            回复评估
          </p>
          <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded p-2">
            {result.replyReason}
          </p>
        </div>
      )}
    </div>
  )
}
