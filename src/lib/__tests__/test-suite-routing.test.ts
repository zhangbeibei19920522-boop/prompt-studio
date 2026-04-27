import {
  isTestSuiteRouteComplete,
  normalizeTestSuiteRoute,
} from '@/lib/test-suite-routing'

describe('test suite routing helpers', () => {
  it('keeps non-R prompt routes on the existing target contract', () => {
    expect(
      normalizeTestSuiteRoute({
        intent: 'refund',
        promptId: 'prompt-refund',
        ragPromptId: 'prompt-rag',
        ragIndexVersionId: 'index-1',
      }),
    ).toEqual({
      intent: 'refund',
      promptId: 'prompt-refund',
      targetType: 'prompt',
      targetId: 'prompt-refund',
    })
  })

  it('normalizes R routes to ragPromptId and ragIndexVersionId only', () => {
    expect(
      normalizeTestSuiteRoute({
        intent: 'R',
        promptId: 'legacy-prompt',
        targetType: 'prompt',
        targetId: 'legacy-prompt',
        ragPromptId: 'prompt-rag',
        ragIndexVersionId: 'index-1',
      }),
    ).toEqual({
      intent: 'R',
      promptId: '',
      targetType: 'prompt',
      targetId: '',
      ragPromptId: 'prompt-rag',
      ragIndexVersionId: 'index-1',
    })
  })

  it('requires both rag fields for R routes', () => {
    expect(
      isTestSuiteRouteComplete(
        normalizeTestSuiteRoute({
          intent: 'R',
          ragPromptId: 'prompt-rag',
        }),
      ),
    ).toBe(false)

    expect(
      isTestSuiteRouteComplete(
        normalizeTestSuiteRoute({
          intent: 'R',
          ragPromptId: 'prompt-rag',
          ragIndexVersionId: 'index-1',
        }),
      ),
    ).toBe(true)
  })
})
