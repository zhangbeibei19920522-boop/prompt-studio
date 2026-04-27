import { buildKnowledgeArtifacts } from '@/lib/knowledge/builder'

describe('knowledge builder', () => {
  it('extracts multiple faq records from workbook-style content instead of collapsing one spreadsheet into one parent', () => {
    const artifacts = buildKnowledgeArtifacts({
      projectName: 'Project 1',
      profileKey: 'generic_customer_service',
      sourceDocuments: [
        {
          id: 'doc-xlsx-1',
          name: 'model-spec.xlsx',
          type: 'xlsx',
          content: [
            'Sheet: model - 85QD7N',
            'Question | answer',
            'How long is the Warranty? | The warranty is 1 year.',
            'How many HDMI does it have? | It has a total of 4 HDMI ports.',
            'Sheet: Top Question',
            'MQ | Roku | Google',
            'The TV will not turn on | Check the power cable first. | Hold the power button for 10 seconds and try again.',
          ].join('\n'),
        },
      ],
    })

    expect(artifacts.stageSummary.sourceCount).toBe(1)
    expect(artifacts.stageSummary.rawRecordCount).toBeGreaterThanOrEqual(4)
    expect(artifacts.parents.length).toBeGreaterThanOrEqual(4)
    expect(artifacts.parents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          question_clean: 'How long is the Warranty?',
          source_files: ['model-spec.xlsx'],
        }),
        expect.objectContaining({
          question_clean: 'How many HDMI does it have?',
          source_files: ['model-spec.xlsx'],
        }),
        expect.objectContaining({
          question_clean: 'The TV will not turn on',
          metadata: expect.objectContaining({
            sheetName: 'Top Question',
            variantLabel: 'Roku',
          }),
        }),
        expect.objectContaining({
          question_clean: 'The TV will not turn on',
          metadata: expect.objectContaining({
            sheetName: 'Top Question',
            variantLabel: 'Google',
          }),
        }),
      ]),
    )
  })

  it('records explicit Stage 1-11 artifacts in the manifest instead of only emitting flattened parents and chunks', () => {
    const artifacts = buildKnowledgeArtifacts({
      projectName: 'Project 1',
      profileKey: 'generic_customer_service',
      sourceDocuments: [
        {
          id: 'doc-1',
          name: 'router-faq.txt',
          type: 'txt',
          content: 'Q: How do I reset the router?\nA: Hold the reset button for 10 seconds.\n',
        },
      ],
    })

    expect(artifacts.manifest.stageArtifacts).toBeDefined()
    expect(artifacts.manifest.stageArtifacts).toEqual(
      expect.objectContaining({
        sourceManifest: expect.any(Array),
        rawRecords: expect.any(Array),
        cleanedRecords: expect.any(Array),
        routedRecords: expect.any(Array),
        structuredRecords: expect.any(Array),
        promotedRecords: expect.any(Array),
        mergedRecords: expect.any(Array),
        conflictRecords: expect.any(Array),
        gatedRecords: expect.any(Array),
        parents: expect.any(Array),
        chunks: expect.any(Array),
      }),
    )
    expect(artifacts.stageSummary.stageCounts.map((entry) => entry.stage)).toEqual([
      'stage1_source_manifest',
      'stage2_raw_records',
      'stage3_cleaned_records',
      'stage4_routing',
      'stage5_structure',
      'stage6_promotion',
      'stage7_merge',
      'stage8_conflict_detection',
      'stage9_release_gating',
      'stage10_parents',
      'stage11_coverage_audit',
    ])
  })

  it('promotes composite policy sections into separate stage-6 faq records when headings are present', () => {
    const artifacts = buildKnowledgeArtifacts({
      projectName: 'Project 1',
      profileKey: 'generic_customer_service',
      sourceDocuments: [
        {
          id: 'doc-policy-1',
          name: 'rv-fridge-guide.docx',
          type: 'docx',
          content: [
            'RV Fridge Guide',
            '',
            'Level 1 Repair',
            'Services completed at local site depending on tech availability.',
            'If no tech is available, the unit needs to be taken to a servicing dealer.',
            '',
            'Level 2 Repair',
            'Address of servicing dealer provided by customer.',
            'Confirmed date of drop off and complete service based on fridge removal date.',
          ].join('\n'),
        },
      ],
    })

    expect(artifacts.stageSummary.stageCounts.find((entry) => entry.stage === 'stage6_promotion')?.value).toBe('2')
    expect(artifacts.parents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          question_clean: 'rv fridge Level 1 Repair',
          record_kind: 'promoted_composite_faq',
        }),
        expect.objectContaining({
          question_clean: 'rv fridge Level 2 Repair',
          record_kind: 'promoted_composite_faq',
        }),
      ]),
    )
  })

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

  it('keeps high-risk records out of pending follow-up buckets', () => {
    const artifacts = buildKnowledgeArtifacts({
      projectName: 'Project 1',
      profileKey: 'generic_customer_service',
      sourceDocuments: [
        {
          id: 'doc-risk-1',
          name: 'gift-card-policy.txt',
          type: 'txt',
          content: 'Gift card refunds require manager approval and compliance review.',
        },
      ],
    })

    expect(artifacts.stageSummary.highRiskCount).toBe(1)
    expect(artifacts.stageSummary.pendingCount).toBe(0)
    expect(artifacts.manifest.highRiskRecords).toEqual([
      expect.objectContaining({
        question: 'gift card policy',
      }),
    ])
    expect(artifacts.manifest.pendingRecords).toEqual([])
    expect(artifacts.coverageAudit.orphanRecords).toEqual([])
  })

  it('does not classify generic payment-and-fees faqs as high risk by default', () => {
    const artifacts = buildKnowledgeArtifacts({
      projectName: 'Project 1',
      profileKey: 'generic_customer_service',
      sourceDocuments: [
        {
          id: 'doc-payment-1',
          name: 'streaming-faq.xlsx',
          type: 'xlsx',
          content: [
            'Sheet: subscriptions',
            'Question | Answer',
            'Netflix payment and fees | Open Netflix settings to review your subscription charge and billing date.',
          ].join('\n'),
        },
      ],
    })

    expect(artifacts.stageSummary.highRiskCount).toBe(0)
    expect(artifacts.manifest.highRiskRecords).toEqual([])
    expect(artifacts.parents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          question_clean: 'Netflix payment and fees',
        }),
      ]),
    )
  })

  it('collapses duplicate conflicting rows with the same answer into one conflict item', () => {
    const artifacts = buildKnowledgeArtifacts({
      projectName: 'Project 1',
      profileKey: 'generic_customer_service',
      sourceDocuments: [
        {
          id: 'doc-conflict-1',
          name: 'agent-assist.xlsx',
          type: 'xlsx',
          content: [
            'Sheet: Top Question',
            'Question | Answer',
            'If the TV still does not turn on | Check the power cable and try again.',
            'If the TV still does not turn on | Perform a hard reset by unplugging the power cord for 30 seconds, then plug it back in and try again.',
            'If the TV still does not turn on | Perform a hard reset by unplugging the power cord for 30 seconds, then plug it back in and try again.',
          ].join('\n'),
        },
      ],
    })

    expect(artifacts.stageSummary.conflictCount).toBe(1)
    expect(artifacts.manifest.blockedRecords).toHaveLength(1)
    expect(artifacts.manifest.stageArtifacts.conflictRecords).toHaveLength(1)
  })

  it('emits generic retrieval metadata and a retrieval manifest contract', () => {
    const artifacts = buildKnowledgeArtifacts({
      projectName: 'Project 1',
      profileKey: 'generic_customer_service',
      sourceDocuments: [
        {
          id: 'doc-faq-1',
          name: 'router-faq.txt',
          type: 'txt',
          content: 'Q: How do I reset the router?\nA: Hold the reset button for 10 seconds.\n',
        },
      ],
    })

    expect(artifacts.manifest.retrievalContract).toEqual(
      expect.objectContaining({
        version: 1,
        supportsRagRoute: true,
        supportsEvidenceAssembly: true,
        enrichedMetadataKeys: expect.arrayContaining([
          'questionNormalized',
          'questionSignature',
          'sourceParentQuestions',
          'isExactFaq',
          'chunkKind',
        ]),
      }),
    )
    expect(artifacts.parents[0]?.metadata).toEqual(
      expect.objectContaining({
        questionNormalized: 'howdoiresettherouter',
        questionSignature: expect.any(String),
        sourceParentQuestions: ['How do I reset the router?'],
        isExactFaq: true,
      }),
    )
    expect(artifacts.chunks[0]?.metadata).toEqual(
      expect.objectContaining({
        questionNormalized: 'howdoiresettherouter',
        questionSignature: expect.any(String),
        sourceParentQuestions: ['How do I reset the router?'],
        isExactFaq: true,
        chunkKind: expect.any(String),
      }),
    )
  })
})
