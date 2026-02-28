import type { Project, Prompt, Document, Session, Message } from '@/types/database'

export const mockProjects: Project[] = [
  {
    id: 'proj-1',
    name: '客服机器人',
    description: '智能客服系统的 Prompt 管理',
    businessDescription: '面向电商平台的智能客服系统。强制规则：1. 所有回复必须包含礼貌用语 2. 涉及退款问题必须引导至人工客服',
    businessGoal: '提升客服回复质量和效率，降低人工客服工作量',
    businessBackground: '当前客服系统使用 GPT-4o 处理用户咨询，prompt 分布在欢迎语、问题分类、回复生成三个环节',
    createdAt: '2026-02-28T10:00:00Z',
    updatedAt: '2026-02-28T10:00:00Z',
  },
  {
    id: 'proj-2',
    name: '内容审核',
    description: '内容安全审核系统',
    businessDescription: '社交平台内容审核系统',
    businessGoal: '自动识别违规内容，降低人工审核成本',
    businessBackground: '审核系统对接用户发布的图文内容',
    createdAt: '2026-02-27T10:00:00Z',
    updatedAt: '2026-02-27T10:00:00Z',
  },
]

export const mockPrompts: Prompt[] = [
  {
    id: 'prompt-1',
    projectId: 'proj-1',
    title: '欢迎语 Prompt',
    content: '你是一个专业的电商客服助手。当用户首次进入对话时，请用热情友好的语气打招呼。\n\n要求：\n1. 自我介绍\n2. 询问用户需要什么帮助\n3. 使用{{语言}}回复\n\n注意：保持简洁，不超过3句话。',
    description: '用于客服机器人的欢迎语生成',
    tags: ['客服', '欢迎语'],
    variables: [{ name: '语言', description: '回复语言', defaultValue: '中文' }],
    version: 2,
    status: 'active',
    createdAt: '2026-02-28T10:00:00Z',
    updatedAt: '2026-02-28T12:00:00Z',
  },
  {
    id: 'prompt-2',
    projectId: 'proj-1',
    title: '问题分类 Prompt',
    content: '你是一个问题分类助手。请将用户的问题分类到以下类别之一：\n\n- 商品咨询\n- 订单查询\n- 退换货\n- 投诉建议\n- 其他\n\n输出格式：{"category": "类别名", "confidence": 0.95}',
    description: '对用户问题进行自动分类',
    tags: ['客服', '分类'],
    variables: [],
    version: 1,
    status: 'active',
    createdAt: '2026-02-28T10:30:00Z',
    updatedAt: '2026-02-28T10:30:00Z',
  },
  {
    id: 'prompt-3',
    projectId: 'proj-1',
    title: '回复生成 Prompt',
    content: '你是{{品牌名}}的客服代表。根据以下信息生成回复：\n\n用户问题：{{用户问题}}\n问题类别：{{问题类别}}\n\n要求：\n1. 保持礼貌专业\n2. 直接回答问题\n3. 如涉及退款，引导至人工客服',
    description: '根据分类结果生成最终回复',
    tags: ['客服', '回复'],
    variables: [
      { name: '品牌名', description: '品牌名称' },
      { name: '用户问题', description: '用户原始问题' },
      { name: '问题类别', description: '分类结果' },
    ],
    version: 3,
    status: 'active',
    createdAt: '2026-02-28T11:00:00Z',
    updatedAt: '2026-02-28T14:00:00Z',
  },
]

export const mockDocuments: Document[] = [
  {
    id: 'doc-1',
    projectId: 'proj-1',
    name: '产品手册.pdf',
    type: 'pdf',
    content: '这是产品手册的解析内容...',
    createdAt: '2026-02-28T10:00:00Z',
  },
  {
    id: 'doc-2',
    projectId: 'proj-1',
    name: 'FAQ 文档.md',
    type: 'md',
    content: '# 常见问题\n\n## Q1: 如何退货？\n...',
    createdAt: '2026-02-28T10:00:00Z',
  },
]

export const mockSessions: Session[] = [
  {
    id: 'session-1',
    projectId: 'proj-1',
    title: '优化欢迎语多语言支持',
    createdAt: '2026-02-28T10:00:00Z',
    updatedAt: '2026-02-28T14:00:00Z',
  },
  {
    id: 'session-2',
    projectId: 'proj-1',
    title: '新增售后回复 Prompt',
    createdAt: '2026-02-28T09:00:00Z',
    updatedAt: '2026-02-28T11:00:00Z',
  },
]

export const mockMessages: Message[] = [
  {
    id: 'msg-1',
    sessionId: 'session-1',
    role: 'user',
    content: '请帮我优化欢迎语 prompt，增加多语言支持，能根据用户的语言自动切换。',
    references: [
      { type: 'prompt', id: 'prompt-1', title: '欢迎语 Prompt' },
      { type: 'document', id: 'doc-1', title: '产品手册.pdf' },
    ],
    metadata: null,
    createdAt: '2026-02-28T10:00:00Z',
  },
  {
    id: 'msg-2',
    sessionId: 'session-1',
    role: 'assistant',
    content: '好的，我已经分析了您的需求。根据当前的业务说明和欢迎语 Prompt 的内容，我制定了以下修改规划：',
    references: [],
    metadata: {
      type: 'plan',
      data: {
        keyPoints: [
          {
            index: 1,
            description: '修改欢迎语 Prompt，增加语言检测和多语言支持逻辑',
            action: 'modify',
            targetPromptId: 'prompt-1',
            targetPromptTitle: '欢迎语 Prompt',
          },
          {
            index: 2,
            description: '新建语言检测 Prompt，用于自动识别用户语言',
            action: 'create',
            targetPromptTitle: '语言检测 Prompt',
          },
        ],
        status: 'pending',
      },
    },
    createdAt: '2026-02-28T10:01:00Z',
  },
  {
    id: 'msg-3',
    sessionId: 'session-1',
    role: 'user',
    content: '规划看起来不错，请开始执行。',
    references: [],
    metadata: null,
    createdAt: '2026-02-28T10:02:00Z',
  },
  {
    id: 'msg-4',
    sessionId: 'session-1',
    role: 'assistant',
    content: '已完成修改，请查看以下变更：',
    references: [],
    metadata: {
      type: 'diff',
      data: {
        promptId: 'prompt-1',
        title: '欢迎语 Prompt',
        oldContent: '你是一个专业的电商客服助手。当用户首次进入对话时，请用热情友好的语气打招呼。\n\n要求：\n1. 自我介绍\n2. 询问用户需要什么帮助\n3. 使用{{语言}}回复\n\n注意：保持简洁，不超过3句话。',
        newContent: '你是一个专业的电商客服助手。当用户首次进入对话时，请用热情友好的语气打招呼。\n\n要求：\n1. 自我介绍\n2. 询问用户需要什么帮助\n3. 根据用户的语言自动检测并使用对应语言回复\n4. 支持的语言：中文、英文、日文、韩文\n\n注意：保持简洁，不超过3句话。',
      },
    },
    createdAt: '2026-02-28T10:03:00Z',
  },
]
