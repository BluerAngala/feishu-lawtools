---
name: feishu-lawtools
version: 1.1.0
description: "飞书法律工具箱。法律条文导入飞书在线文档、法律资讯获取、AI划重点标记、AI批注解读。触发方式：/law-import、/law-news、/law-highlight、/law-annotate、/法律导入、/法律资讯、/划重点、/法律批注"
compatibility: "pi, Claude Code, Codex - 任何能执行 bash 命令和调用 lark-cli 的 AI agent"
metadata:
  requires:
    bins: ["lark-cli"]
  cross-agent: true
  categories:
    import: 导入与创建
    fetch: 外部数据获取
    annotate: 标记与批注
    transform: 格式转换
    ai: AI 内容生成
  tools:
    - law-import/law-import.md
    - law-news/law-news.md
    - law-highlight/law-highlight.md
    - law-annotate/law-annotate.md
---

# 飞书法律工具箱 (feishu-lawtools)

把法律法规从URL或本地文件导入飞书在线文档，获取法律资讯并整理为文章，结构化呈现（章节→条款），并支持AI自动逐条添加批注解读。

## 安装

### pi（推荐）

```bash
pi install git:github.com/BluerAngala/feishu-lawtools
# 或
pi install npm:@bluerangala/feishu-lawtools
```

### Claude Code

```bash
mkdir -p ~/.claude/skills
git clone https://github.com/BluerAngala/feishu-lawtools ~/.claude/skills/feishu-lawtools
```

### Codex

```bash
mkdir -p ~/.codex/skills
git clone https://github.com/BluerAngala/feishu-lawtools ~/.codex/skills/feishu-lawtools
```

> 也可在 Codex 中通过 `$skill-installer` 或 `AGENTS.md` 引用安装。

### 其他 Agent（OpenCode、Grok 等）

```bash
mkdir -p ~/.agents/skills
git clone https://github.com/BluerAngala/feishu-lawtools ~/.agents/skills/feishu-lawtools
```

> 或参考你的 agent 的文档，将本 skill 目录添加到对应的配置路径中。

### 手动（通用）

```bash
git clone https://github.com/BluerAngala/feishu-lawtools.git
cd feishu-lawtools
# 然后在你的 agent 配置中指向这个目录
```

---

## ⚡ 前置检查：lark-cli 就绪保障

**每次执行任何命令前，先运行以下检查。**

### ① 检查是否安装

```bash
which lark-cli
```

如果未安装，自动安装：

```bash
npm install -g @larksuite/cli
```

### ② 检查更新

```bash
lark-cli update --check --json
```

如果返回的 JSON 中 `updateAvailable` 为 `true`（或命令非零退出），自动更新：

```bash
lark-cli update
```

### ③ 验证认证

```bash
lark-cli auth status
```

如果 `tokenStatus` 不是 `"valid"`（或为 `"needs_refresh"`，会自动刷新），提示用户重新登录：

```bash
lark-cli auth login --scope "docx:document:create,docx:document:readonly,docx:document:write_only,drive:document.comment:create"
```

> 以上三步是自动前置检查，AI agent 应在响应用户需求前自行完成，不要问用户「lark-cli 装了吗」。

---

## 流程图

```
用户输入（URL / 文件路径 / 资讯源）
       ↓
 ① 提取内容或获取资讯列表
       ├─ 法律文本 → 提取正文
       └─ 资讯源 → API 获取新闻列表
       ↓
 ② 解析结构化：法律名称 → 章节 → 条文 / 新闻 → 文章
       ↓
 ③ 创建飞书在线文档（docs +create --api-version v2）
       ↓
 ④ AI 自动批注或划重点（可选）
       ├─ 逐条批注 → drive +add-comment（隐藏评论）
       └─ 划重点 → docs +update str_replace（正文加粗/标色）
       ↓
 ⑤ 用户手动批注（飞书原生功能，无需skill）
```

## 依赖技能

本 skill 在执行过程中可能需要调用以下技能处理子任务：

| 场景 | 调用 skill |
|------|-----------|
| URL 提取正文 | `baoyu-url-to-markdown` 或 `defuddle` |
| 本地文件读取 | `read` 工具直接读取 |
| 飞书文档创建/读取 | `lark-doc` |
| 飞书文档批注 | `lark-drive`（`+add-comment`） |
| 认证/权限 | `lark-shared` |

## 使用方式

### pi agent

在 pi 中直接使用以下命令：

```
/law-import    <url|file_path> [--title "自定义标题"]
/law-news      <source> [--days 3] [--max 10] [--style 简报|深度|专题]
/law-highlight <doc_url> <term> [--style highlight|bold]
/law-annotate  <doc_url> [--scope "article-1,article-5"] [--style 通俗|专业|案例]
```

### 其他 AI agent

非 pi agent 不支持 `/command` 格式。直接向 AI 描述需求即可：

> "把这个法律导入飞书文档" → `/law-import`
> "看看最近有什么法治新闻" → `/law-news`
> "给文档里的 '故意犯罪' 划重点" → `/law-highlight`
> "给这个法律逐条加 AI 批注" → `/law-annotate`

AI agent 会根据对应工具文件的步骤说明自动调用 `lark-cli` 完成操作。

## 工具索引

| 工具 | 分类 | 文件 | 功能 |
|------|------|------|------|
| `/law-import` | import/transform | [`law-import/law-import.md`](law-import/law-import.md) | 导入法律条文，创建飞书文档 |
| `/law-news` | fetch/transform | [`law-news/law-news.md`](law-news/law-news.md) | 获取法律资讯，整理为文章 |
| `/law-highlight` | annotate/transform | [`law-highlight/law-highlight.md`](law-highlight/law-highlight.md) | 正文内标记（高亮/加粗/标色） |
| `/law-annotate` | annotate/ai | [`law-annotate/law-annotate.md`](law-annotate/law-annotate.md) | AI 逐条生成批注解读 |

## 注意事项

| 项目 | 说明 |
|------|------|
| ⏱️ 频率限制 | 添加批注时建议每条间隔 1-2 秒，避免 API 限流 |
| 📏 内容长度 | 单条批注内容建议不超过 500 字，过长可能被截断 |
| 🔑 身份 | 所有操作使用 `--as user`，确保有文档读写和评论权限 |
| 🧹 文档清理 | 创建空白文档后需先追加内容再获取 block_id |
| 🔗 文档链接 | 用户可以直接在文档 URL 末尾加 `#block_id` 跳转到指定条文 |
