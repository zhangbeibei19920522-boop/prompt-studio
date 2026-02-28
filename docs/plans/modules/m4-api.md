# M4: API 层

> 依赖：M3 | 产出：所有实体的 REST API Routes

## 目标

基于 Next.js App Router API Routes，暴露所有实体的 CRUD 接口。

## API 路由清单

### 全局设置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/settings` | 获取全局设置 |
| PUT | `/api/settings` | 更新全局设置 |

### 项目

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects` | 获取所有项目列表 |
| POST | `/api/projects` | 创建项目 |
| GET | `/api/projects/[id]` | 获取项目详情 |
| PUT | `/api/projects/[id]` | 更新项目 |
| DELETE | `/api/projects/[id]` | 删除项目（级联） |

### Prompt

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects/[id]/prompts` | 获取项目下所有 prompt |
| POST | `/api/projects/[id]/prompts` | 创建 prompt |
| GET | `/api/prompts/[id]` | 获取 prompt 详情 |
| PUT | `/api/prompts/[id]` | 更新 prompt（自动创建版本） |
| DELETE | `/api/prompts/[id]` | 删除 prompt |
| GET | `/api/prompts/[id]/versions` | 获取版本历史 |

### 知识库文档

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects/[id]/documents` | 获取项目下所有文档 |
| POST | `/api/projects/[id]/documents` | 上传文档（解析内容） |
| GET | `/api/documents/[id]` | 获取文档详情 |
| DELETE | `/api/documents/[id]` | 删除文档 |

### 会话

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects/[id]/sessions` | 获取项目下所有会话 |
| POST | `/api/projects/[id]/sessions` | 创建会话 |
| GET | `/api/sessions/[id]` | 获取会话详情 |
| DELETE | `/api/sessions/[id]` | 删除会话 |

### 消息

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sessions/[id]/messages` | 获取会话下所有消息 |

### AI / Agent

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai/chat` | Agent 对话（SSE 流式响应） |
| POST | `/api/ai/apply` | 应用 prompt 修改（保存） |

## 文件结构

```
src/app/api/
├── settings/
│   └── route.ts              # GET, PUT
├── projects/
│   ├── route.ts              # GET, POST
│   └── [id]/
│       ├── route.ts          # GET, PUT, DELETE
│       ├── prompts/
│       │   └── route.ts      # GET, POST
│       ├── documents/
│       │   └── route.ts      # GET, POST
│       └── sessions/
│           └── route.ts      # GET, POST
├── prompts/
│   └── [id]/
│       ├── route.ts          # GET, PUT, DELETE
│       └── versions/
│           └── route.ts      # GET
├── documents/
│   └── [id]/
│       └── route.ts          # GET, DELETE
├── sessions/
│   └── [id]/
│       ├── route.ts          # GET, DELETE
│       └── messages/
│           └── route.ts      # GET
└── ai/
    ├── chat/
    │   └── route.ts          # POST (SSE)
    └── apply/
        └── route.ts          # POST
```

## 统一响应格式

所有 API 返回统一格式：

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

错误时：

```json
{
  "success": false,
  "data": null,
  "error": "错误信息"
}
```

## 输入校验

每个 POST/PUT 路由在处理前校验请求体：
- 必填字段检查
- 类型检查
- 长度限制
- 返回 400 + 明确错误信息

## 提交

```bash
git add src/app/api/
git commit -m "feat: add REST API routes for all entities"
```
