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
  return route.intent.trim().length > 0 && getTestRouteTargetId(route).trim().length > 0
}
