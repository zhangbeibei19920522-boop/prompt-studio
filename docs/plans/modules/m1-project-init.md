# M1: 项目初始化

> 依赖：无 | 产出：可运行的 Next.js 空项目

## 目标

搭建 Next.js 项目脚手架，安装所有依赖，建立目录结构。

## 步骤

### Step 1: 创建 Next.js 项目

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

### Step 2: 安装核心依赖

```bash
# 数据库
npm install better-sqlite3
npm install -D @types/better-sqlite3

# UI 组件库
npx shadcn@latest init

# 文档解析
npm install mammoth pdf-parse

# 工具库
npm install nanoid date-fns

# Markdown
npm install react-markdown remark-gfm

# Diff 展示
npm install diff
```

### Step 3: 建立目录结构

```
src/
├── app/
│   ├── layout.tsx            # 根布局
│   ├── page.tsx              # 首页（重定向到项目）
│   ├── globals.css           # 全局样式
│   ├── api/                  # API Routes
│   │   ├── projects/
│   │   ├── prompts/
│   │   ├── documents/
│   │   ├── sessions/
│   │   ├── messages/
│   │   ├── settings/
│   │   └── ai/
│   └── (main)/               # 主应用页面组
│       ├── layout.tsx         # 三栏布局
│       ├── project/[id]/
│       └── settings/
├── components/
│   ├── ui/                    # shadcn/ui 组件
│   ├── layout/                # 布局组件（侧边栏、顶栏）
│   ├── chat/                  # 对话相关组件
│   ├── project/               # 项目管理组件
│   ├── prompt/                # Prompt 相关组件
│   └── knowledge/             # 知识库组件
├── lib/
│   ├── db/                    # 数据库层
│   ├── ai/                    # AI 服务层
│   ├── utils/                 # 工具函数
│   └── parsers/               # 文档解析器
└── types/                     # TypeScript 类型定义
```

### Step 4: 配置 shadcn/ui 基础组件

```bash
npx shadcn@latest add button input textarea card dialog dropdown-menu scroll-area badge tabs separator tooltip avatar
```

### Step 5: 验证

```bash
npm run dev
# 访问 http://localhost:3000 确认页面正常
```

### Step 6: 提交

```bash
git add .
git commit -m "feat: initialize Next.js project with dependencies and directory structure"
```

## 产出文件

- `package.json` — 项目配置和依赖
- `tsconfig.json` — TypeScript 配置
- `tailwind.config.ts` — Tailwind 配置
- `src/app/layout.tsx` — 根布局
- `src/app/page.tsx` — 首页
- 目录结构骨架
