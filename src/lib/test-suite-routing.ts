import type {
  TestRoutingTargetType,
  TestSuiteRoute,
} from '@/types/database'

export function getTestRouteTargetType(route: Pick<TestSuiteRoute, 'targetType'>): TestRoutingTargetType {
  return route.targetType === 'index-version' ? 'index-version' : 'prompt'
}

export function getTestRouteTargetId(
  route: Pick<TestSuiteRoute, 'promptId' | 'targetId' | 'targetType'>
): string {
  if (typeof route.targetId === 'string' && route.targetId.trim().length > 0) {
    return route.targetId
  }

  return getTestRouteTargetType(route) === 'prompt' ? route.promptId : ''
}

export function normalizeTestSuiteRoute(
  route: Partial<TestSuiteRoute>
): TestSuiteRoute {
  if ((route.intent ?? '').trim() === 'R') {
    return {
      intent: 'R',
      promptId: '',
      targetType: 'prompt',
      targetId: '',
      ragPromptId: (route.ragPromptId ?? '').trim(),
      ragIndexVersionId: (route.ragIndexVersionId ?? '').trim(),
    }
  }

  const targetType = getTestRouteTargetType({
    targetType: route.targetType,
  })
  const targetId =
    typeof route.targetId === 'string' && route.targetId.trim().length > 0
      ? route.targetId.trim()
      : targetType === 'prompt'
        ? (route.promptId ?? '').trim()
        : ''

  return {
    intent: route.intent ?? '',
    promptId: targetType === 'prompt' ? targetId : '',
    targetType,
    targetId,
  }
}

export function isTestSuiteRouteComplete(route: TestSuiteRoute): boolean {
  if (route.intent.trim() === 'R') {
    return (route.ragPromptId?.trim().length ?? 0) > 0 && (route.ragIndexVersionId?.trim().length ?? 0) > 0
  }

  return route.intent.trim().length > 0 && getTestRouteTargetId(route).trim().length > 0
}
