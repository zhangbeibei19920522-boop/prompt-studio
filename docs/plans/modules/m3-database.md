# M3: 数据库层

> 依赖：M1, M2 | 产出：SQLite 数据库初始化 + 7 张表 + CRUD 操作

## 目标

使用 better-sqlite3 创建本地 SQLite 数据库，实现所有实体的 CRUD 操作。

## 文件清单

### `src/lib/db/index.ts` — 数据库连接与初始化

- 创建 `data/` 目录（如不存在）
- 初始化 SQLite 连接（`data/prompt-manager.db`）
- 启用 WAL 模式提升并发性能
- 执行建表 SQL

### `src/lib/db/schema.sql` — 建表语句

7 张表：
1. `global_settings` — 全局设置（单行）
2. `projects` — 项目
3. `prompts` — Prompt
4. `prompt_versions` — Prompt 版本历史
5. `documents` — 知识库文档
6. `sessions` — 对话会话
7. `messages` — 消息

关键设计：
- 所有 `id` 使用 nanoid 生成
- `tags`、`variables`、`references`、`metadata` 用 JSON 字符串存储
- 外键约束 + CASCADE 删除（删项目时级联删除其下的 prompt、文档、会话）

### `src/lib/db/repositories/` — 各实体的数据操作

每个文件导出一组纯函数（不修改传入参数，返回新对象）：

| 文件 | 操作 |
|------|------|
| `settings.ts` | get, update |
| `projects.ts` | findAll, findById, create, update, delete |
| `prompts.ts` | findByProject, findById, create, update, delete |
| `prompt-versions.ts` | findByPrompt, create |
| `documents.ts` | findByProject, findById, create, delete |
| `sessions.ts` | findByProject, findById, create, update, delete |
| `messages.ts` | findBySession, create |

### JSON 序列化约定

数据库存储 JSON 字符串，读取时解析：

```typescript
// 写入时
const row = { ...prompt, tags: JSON.stringify(prompt.tags) }

// 读取时
const prompt = { ...row, tags: JSON.parse(row.tags) }
```

## 关键实现细节

### 级联删除

```sql
CREATE TABLE prompts (
  ...
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE
);
```

删除项目时，自动删除其下的 prompt、文档、会话、消息。

### 版本自增

创建/修改 prompt 时自动创建 PromptVersion 记录，version 字段自增。

## 提交

```bash
git add src/lib/db/
git commit -m "feat: add SQLite database layer with 7 tables and CRUD operations"
```
