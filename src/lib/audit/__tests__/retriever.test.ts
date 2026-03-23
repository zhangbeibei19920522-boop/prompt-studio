describe('conversation audit retrieval', () => {
  it('merges a short title block with the following body block', async () => {
    const { buildKnowledgeChunks } = await import('@/lib/audit/knowledge-chunker')

    const chunks = buildKnowledgeChunks({
      sourceName: 'faq.docx',
      sourceType: 'docx',
      content: [
        '密码重置',
        '',
        '请在登录页点击忘记密码，然后按照短信验证码提示完成重置。',
        '',
        '修改手机号',
        '',
        '请在个人设置中更新手机号。',
      ].join('\n'),
    })

    expect(chunks).toEqual([
      {
        sourceName: 'faq.docx',
        sourceType: 'docx',
        sheetName: null,
        chunkIndex: 0,
        content: '密码重置\n请在登录页点击忘记密码，然后按照短信验证码提示完成重置。',
      },
      {
        sourceName: 'faq.docx',
        sourceType: 'docx',
        sheetName: null,
        chunkIndex: 1,
        content: '修改手机号\n请在个人设置中更新手机号。',
      },
    ])
  })

  it('splits paragraph content into multiple knowledge chunks', async () => {
    const { buildKnowledgeChunks } = await import('@/lib/audit/knowledge-chunker')

    const chunks = buildKnowledgeChunks({
      sourceName: 'faq.docx',
      sourceType: 'docx',
      content: 'Reset your password from the login page.\n\nUpdate your phone number in profile settings.',
    })

    expect(chunks).toHaveLength(2)
    expect(chunks).toEqual([
      {
        sourceName: 'faq.docx',
        sourceType: 'docx',
        sheetName: null,
        chunkIndex: 0,
        content: 'Reset your password from the login page.',
      },
      {
        sourceName: 'faq.docx',
        sourceType: 'docx',
        sheetName: null,
        chunkIndex: 1,
        content: 'Update your phone number in profile settings.',
      },
    ])
  })

  it('splits workbook-style content into row-oriented chunks with sheet metadata', async () => {
    const { buildKnowledgeChunks } = await import('@/lib/audit/knowledge-chunker')

    const chunks = buildKnowledgeChunks({
      sourceName: 'kb.xlsx',
      sourceType: 'xlsx',
      content: [
        'Sheet: FAQ',
        'Question | Answer',
        'Reset password | Use the password reset link',
        'Change phone | Go to profile settings',
        '',
        'Sheet: Policy',
        'Topic | Rule',
        'Verification | Support must verify identity',
      ].join('\n'),
    })

    expect(chunks).toEqual([
      {
        sourceName: 'kb.xlsx',
        sourceType: 'xlsx',
        sheetName: 'FAQ',
        chunkIndex: 0,
        content: 'Question | Answer',
      },
      {
        sourceName: 'kb.xlsx',
        sourceType: 'xlsx',
        sheetName: 'FAQ',
        chunkIndex: 1,
        content: 'Reset password | Use the password reset link',
      },
      {
        sourceName: 'kb.xlsx',
        sourceType: 'xlsx',
        sheetName: 'FAQ',
        chunkIndex: 2,
        content: 'Change phone | Go to profile settings',
      },
      {
        sourceName: 'kb.xlsx',
        sourceType: 'xlsx',
        sheetName: 'Policy',
        chunkIndex: 3,
        content: 'Topic | Rule',
      },
      {
        sourceName: 'kb.xlsx',
        sourceType: 'xlsx',
        sheetName: 'Policy',
        chunkIndex: 4,
        content: 'Verification | Support must verify identity',
      },
    ])
  })

  it('ranks the most relevant chunks first for a query', async () => {
    const { retrieveRelevantKnowledge } = await import('@/lib/audit/retriever')

    const results = retrieveRelevantKnowledge(
      [
        {
          sourceName: 'faq.docx',
          sourceType: 'docx',
          sheetName: null,
          chunkIndex: 0,
          content: 'Reset password | Use the password reset link and check your inbox.',
        },
        {
          sourceName: 'faq.docx',
          sourceType: 'docx',
          sheetName: null,
          chunkIndex: 1,
          content: 'Change phone number | Open profile settings.',
        },
        {
          sourceName: 'policy.html',
          sourceType: 'html',
          sheetName: null,
          chunkIndex: 2,
          content: 'Support must verify identity before manual account recovery.',
        },
      ],
      'How do I reset my password if I do not receive the email?',
      2
    )

    expect(results).toHaveLength(2)
    expect(results[0]?.chunk.content).toContain('Reset password')
    expect(results[0]!.score).toBeGreaterThan(results[1]!.score)
  })

  it('retrieves Chinese knowledge content for Chinese questions', async () => {
    const { retrieveRelevantKnowledge } = await import('@/lib/audit/retriever')

    const results = retrieveRelevantKnowledge(
      [
        {
          sourceName: 'faq.docx',
          sourceType: 'docx',
          sheetName: null,
          chunkIndex: 0,
          content: '密码重置\n请在登录页点击忘记密码，然后按照短信验证码提示完成重置。',
        },
        {
          sourceName: 'invoice.docx',
          sourceType: 'docx',
          sheetName: null,
          chunkIndex: 1,
          content: '发票申请\n请在订单页提交开票信息。',
        },
      ],
      '用户问怎么重置密码',
      1
    )

    expect(results).toHaveLength(1)
    expect(results[0]?.chunk.content).toContain('请在登录页点击忘记密码')
    expect(results[0]!.score).toBeGreaterThan(0)
  })

  it('caps retrieval to the requested top N results', async () => {
    const { retrieveRelevantKnowledge } = await import('@/lib/audit/retriever')

    const results = retrieveRelevantKnowledge(
      [
        {
          sourceName: 'a',
          sourceType: 'txt',
          sheetName: null,
          chunkIndex: 0,
          content: 'reset password',
        },
        {
          sourceName: 'b',
          sourceType: 'txt',
          sheetName: null,
          chunkIndex: 1,
          content: 'reset password email',
        },
        {
          sourceName: 'c',
          sourceType: 'txt',
          sheetName: null,
          chunkIndex: 2,
          content: 'password recovery reset email link',
        },
      ],
      'reset password email',
      2
    )

    expect(results).toHaveLength(2)
  })

  it('drops zero-score chunks instead of returning arbitrary leading documents', async () => {
    const { retrieveRelevantKnowledge } = await import('@/lib/audit/retriever')

    const results = retrieveRelevantKnowledge(
      [
        {
          sourceName: 'title.docx',
          sourceType: 'docx',
          sheetName: null,
          chunkIndex: 0,
          content: '互动桌面壁纸黑屏',
        },
        {
          sourceName: 'member.docx',
          sourceType: 'docx',
          sheetName: null,
          chunkIndex: 1,
          content: 'OPPO会员分为4个等级',
        },
        {
          sourceName: 'answer.docx',
          sourceType: 'docx',
          sheetName: null,
          chunkIndex: 2,
          content: '互动桌面壁纸出现黑屏时，请先重启主题商店并重新应用壁纸。',
        },
      ],
      '互动桌面壁纸黑屏怎么办',
      5
    )

    expect(results).toHaveLength(2)
    expect(results.every((result) => result.score > 0)).toBe(true)
    expect(results[0]?.chunk.sourceName).toBe('answer.docx')
  })
})
