import { buildKnowledgeArtifacts } from '@/lib/knowledge/builder'

describe('knowledge builder', () => {
  it('builds generic artifacts and keeps high-risk or conflicting records out of approved output', () => {
    const artifacts = buildKnowledgeArtifacts({
      projectName: 'Project 1',
      profileKey: 'generic_customer_service',
      sourceDocuments: [
        {
          id: 'doc-1',
          name: 'Router Password Reset.txt',
          type: 'txt',
          content: 'Reset the router by holding the Reset button for 10 seconds, then log in again.',
        },
        {
          id: 'doc-2',
          name: 'Refund Policy 2026.txt',
          type: 'txt',
          content: 'Refunds are available within 7 days of purchase. This policy is valid through 2026-12-31.',
        },
        {
          id: 'doc-3',
          name: 'Router Password Reset Legacy.txt',
          type: 'txt',
          content: 'Reset the router by holding the Reset button for 5 seconds.',
        },
      ],
      manualDrafts: [
        {
          title: 'How to contact customer support',
          content: 'Email support@example.com for help.',
          source: 'manual',
        },
      ],
      repairQuestions: [
        {
          query: 'How to restore factory settings?',
          problem: 'Existing content is missing the button hold duration.',
          direction: 'Keep the full procedure and warnings.',
        },
      ],
    })

    expect(artifacts.parents.length).toBeGreaterThanOrEqual(2)
    expect(artifacts.chunks.length).toBeGreaterThanOrEqual(artifacts.parents.length)
    expect(artifacts.stageSummary.sourceCount).toBe(5)
    expect(artifacts.stageSummary.highRiskCount).toBe(1)
    expect(artifacts.stageSummary.blockedCount).toBe(1)
    expect(artifacts.stageSummary.approvedCount).toBe(artifacts.parents.length)
    expect(artifacts.coverageAudit.coverage).toBeLessThan(100)
    expect(artifacts.parents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          question_clean: 'Router Password Reset',
          source_files: ['Router Password Reset.txt'],
        }),
        expect.objectContaining({
          question_clean: 'How to contact customer support',
          source_files: ['manual'],
        }),
      ]),
    )
    expect(artifacts.chunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parent_id: expect.any(String),
          chunk_text: expect.stringContaining('Reset'),
          embedding_text: expect.stringContaining('主问题：'),
        }),
      ]),
    )
    expect(artifacts.manifest.snapshotHash).toHaveLength(64)
  })
})
