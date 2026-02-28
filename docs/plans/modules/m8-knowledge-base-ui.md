# M8: 知识库 UI

> 依赖：M4, M6 | 产出：文档上传、解析、管理界面

## 目标

实现知识库文档的上传、解析、浏览和删除。

## 支持的文件格式

| 格式 | 解析方式 |
|------|---------|
| `.txt` | 直接读取文本 |
| `.md` | 直接读取文本 |
| `.pdf` | 使用 `pdf-parse` 提取文本 |
| `.docx` | 使用 `mammoth` 提取文本 |

## 组件清单

### `src/components/knowledge/document-list.tsx` — 文档列表

左侧栏中的知识库区域：
- 显示当前项目的所有文档
- 文件名 + 类型图标 + 上传时间
- 点击查看 → 右侧面板预览
- 删除按钮（确认弹窗）

### `src/components/knowledge/upload-dialog.tsx` — 上传文档弹窗

- 拖拽上传 / 点击选择文件
- 支持多文件同时上传
- 文件类型校验
- 上传进度显示

### `src/components/knowledge/document-preview.tsx` — 文档预览

右侧面板中显示：
- 文档名称和类型
- 解析后的文本内容（Markdown 渲染）
- 删除按钮

### `src/lib/parsers/document-parser.ts` — 文档解析器

```typescript
export async function parseDocument(file: File): Promise<{ name: string; type: string; content: string }>
```

根据文件类型调用对应解析器，返回纯文本内容。

## API 调用流程

```
用户选择文件 → 前端解析文件内容 → POST /api/projects/[id]/documents
                                  { name, type, content }
```

注意：文件解析在服务端 API Route 中进行（通过 FormData 上传原始文件）。

## 提交

```bash
git add src/components/knowledge/ src/lib/parsers/
git commit -m "feat: add knowledge base UI with document upload and preview"
```
