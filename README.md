# feishu-lawtools 🧑‍⚖️

飞书法律工具箱 — 基于 **飞书（Lark）OpenAPI** 和 **lark-cli** 的命令集，由 AI agent 驱动，实现法律条文的导入、划重点、批注解读全流程。

<p align="center">
  <strong>pi</strong> · <strong>Claude Code</strong> · <strong>Codex</strong>
  <br>
  <span>兼容主流 AI coding agent</span>
</p>

---

## 目录

- [兼容性矩阵](#兼容性矩阵)
- [安装](#安装)
- [依赖与前提](#依赖与前提)
- [前置检查](#前置检查)
- [快速开始](#快速开始)
- [工具索引](#工具索引)
- [用户手动操作](#用户手动操作)
- [完整工作流示例](#完整工作流示例)
- [项目结构](#项目结构)
- [开发指南](#开发指南)
- [常见问题](#常见问题)

---

## 兼容性矩阵

| Agent | 安装方式 | 触发方式 | 状态 |
|-------|----------|----------|------|
| **pi** | `pi install` | `/law-import` 等 skill command | ✅ 原生支持 |
| **Claude Code** | git clone → `~/.claude/skills/` | 直接描述需求给 AI | ✅ 适配 |
| **Codex** | git clone → `~/.codex/skills/` | 直接描述需求给 AI | ✅ 适配 |
| **OpenCode / Grok 等** | git clone → `~/.agents/skills/` | 直接描述需求给 AI | ✅ 适配 |

> 本 skill 遵循 [Agent Skills 标准](https://agentskills.io/specification)，任何兼容该标准的 agent 均可使用。核心操作依赖 `lark-cli` 命令行工具，只要有 bash 执行能力的 agent 都能驱动。

---

## 安装

### pi

```bash
# 从 GitHub 安装（推荐）
pi install git:github.com/BluerAngala/feishu-lawtools

# 或从 npm 安装
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
# 在你的 agent 配置中指向这个目录
```

---

## 依赖与前提

### 必须安装

| 依赖 | 用途 | 安装方式 |
|------|------|----------|
| [lark-cli](https://github.com/earendil-works/lark-cli) | 调用飞书 OpenAPI | `npm install -g @larksuite/cli` |
| Python 3 | 跑 `law-news` 抓取脚本 | 系统自带 / [python.org](https://python.org) |

> lark-cli 已内置自动更新检测（`lark-cli update --check`），无需手动关注版本。
> Python 仅 `law-news` 工具需要，所有脚本仅依赖标准库，**无需 `pip install`**。

### 飞书权限（OAuth Scopes）

| Scope | 用途 |
|-------|------|
| `docx:document:create` | 创建文档 |
| `docx:document:readonly` | 读取文档内容 |
| `docx:document:write_only` | 编辑文档内容 |
| `drive:file:upload` | 上传资源 |
| `drive:document.comment:create` | 添加批注评论 |

### 认证

所有操作使用 **用户身份**（`--as user`），首次使用需登录：

```bash
# 登录飞书用户身份
lark-cli auth login --scope "docx:document:create,docx:document:readonly,docx:document:write_only,drive:document.comment:create"

# 验证登录状态
lark-cli auth status --format json
```

返回 `tokenStatus: "valid"` 即表示认证通过。

---

## 前置检查

**AI agent 每次执行命令前，会自动完成以下三步**（详见 SKILL.md 的「前置检查」）：

1. 检查 `lark-cli` 是否安装，未安装则自动安装
2. 通过 `lark-cli update --check --json` 检测更新，有新版本自动升级
3. 通过 `lark-cli auth status --format json` 验证认证状态

用户无需关心这些步骤，agent 会在后台自动处理。

---

## 快速开始

```bash
# 1. 从 URL 导入一部法律
/law-import https://flk.npc.gov.cn/民法典.txt

# 2. 对关键术语划重点
/law-highlight https://lawyerch.feishu.cn/docx/xxx "犯罪"

# 3. AI 自动添加批注解读
/law-annotate https://lawyerch.feishu.cn/docx/xxx --style 通俗

# 4. 抓取最新法律资讯并汇编成简报（一步到位发布到飞书）
/law-news cctv-law --days 3 --max 10 --style 简报
```

> 非 pi agent 直接描述需求即可，agent 会自动匹配对应工具。

---

## 工具索引

| 命令 | 工具文件 | 功能 |
|------|----------|------|
| `/law-import` | [`tools/law-import/law-import.md`](tools/law-import/law-import.md) | 从 URL 或本地文件导入法律条文，创建飞书在线文档 |
| `/law-news` | [`tools/law-news/law-news.md`](tools/law-news/law-news.md) | 抓取法律资讯（央视网等），按风格汇编为简报/深度/专题文章并发布 |
| `/law-highlight` | [`tools/law-highlight/law-highlight.md`](tools/law-highlight/law-highlight.md) | 对文档中的特定词语进行正文内标记（高亮/加粗/标色） |
| `/law-annotate` | [`tools/law-annotate/law-annotate.md`](tools/law-annotate/law-annotate.md) | AI 自动为每条法律条文生成解读批注 |

每个工具的详细步骤说明见对应文件。

---

## 用户手动操作

以下操作无需 skill 支持，直接在飞书客户端完成：

### 手动添加批注

1. 在飞书文档中选中要批注的文本
2. 点击右侧弹出的「批注」按钮
3. 输入解读内容
4. 按 Enter 发布

### 跳转到指定条文

在文档 URL 后添加 `#block_id`：

```
https://lawyerch.feishu.cn/docx/xxx#doxcn123456
```

---

## 完整工作流示例

### 场景：从全国人大网站导入《民法典》并批注

```bash
# ① 导入
/law-import https://flk.npc.gov.cn/民法典.txt
→ ✅ https://lawyerch.feishu.cn/docx/abc123

# ② 划重点（关键术语）
/law-highlight https://lawyerch.feishu.cn/docx/abc123 "民事法律行为"
/law-highlight https://lawyerch.feishu.cn/docx/abc123 "公序良俗"
/law-highlight https://lawyerch.feishu.cn/docx/abc123 "强制性规定"

# ③ AI 批注
/law-annotate https://lawyerch.feishu.cn/docx/abc123 --style 通俗
→ ✅ 已为 1260 条条文添加批注

# ④ 你在飞书里手动补充自己的批注
```

### 场景：从本地文件导入《刑法》

```bash
/law-import /Users/bluer/Downloads/刑法.txt --title "中华人民共和国刑法"
→ ✅ https://lawyerch.feishu.cn/docx/def456
```

---

## 项目结构

```
feishu-lawtools/
├── SKILL.md                                  ← 总调度：元信息、前置检查、流程图、工具索引
├── AGENTS.md                                 ← agent 操作指南 + 开发规范
├── README.md                                 ← 本文件（人类可读的说明文档）
├── package.json                              ← npm 包信息
├── lib/                                      ← 共享脚本库
└── tools/                                    ← 所有 skill 目录（标准结构）
    ├── law-import/
    │   └── law-import.md
    ├── law-news/
    │   ├── law-news.md                       ← skill 文档
    │   ├── scripts/
    │   │   └── law-news.py                   ← 机械操作脚本
    │   ├── cache/                            ← 工具自带缓存（git 忽略）
    │   │   ├── raw/                          ← fetch 原始 JSON
    │   │   ├── articles/                     ← 单篇正文（.json + .md）
    │   │   └── exports/                      ← 汇编稿件（.md）
    │   ├── lawyer-profile.example.json       ← 用户配置示例（git 提交）
    │   └── lawyer-profile.json               ← 用户实际配置（git 忽略）
    ├── law-highlight/
    │   └── law-highlight.md
    └── law-annotate/
        └── law-annotate.md
```

### 结构规则

每个 skill 目录都按统一标准结构组织，**五要素不可缺一**：

| 要素 | 作用 |
|------|------|
| `law-<name>.md` | skill 文档，AI agent 读这个驱动工具 |
| `scripts/law-<name>.py` | 抓取 / 解析 / 排版 / 缓存 / 存盘 / 发布的实现 |
| `cache/` | 工具自带缓存（`raw/` + `articles/` + `exports/`），git 忽略 |
| `<name>-profile.example.json` | 用户配置**示例**，git 提交用于参考 |
| `<name>-profile.json` | 用户实际配置（如「律师说」评论风格），git 忽略 |

- 缓存根目录默认 `tools/<name>/cache/`，环境变量 `{NAME}_DIR` 可覆盖
- 工具自包含，删除整个 `tools/<name>/` 不影响其他工具
- 共享逻辑放 `lib/`：多个 skill 共用的函数抽到 `lib/<name>.py`（或 `.sh`）
- **首次使用**：skill 文档开头放「首次使用」章节，引导用户 `cp` 示例配置

---

## 开发指南

### 设计理念：脚本做实事，AI 只做编排

| 谁 | 负责 | 不负责 |
|----|------|--------|
| **脚本** | 抓取 / 解析 / 排版 / 缓存 / 存盘 / 发布 / 配图自适应 | 理解文章内容、做价值判断 |
| **AI** | 浏览成品、判断选哪些、指定风格、触发命令 | 拼接 markdown / 写 XML / 管理临时文件 |

**绝对规则**：脚本必须把交付物写好存盘，返回**文件路径**。AI 只需 `read` 该路径，不得在上下文中拼接 markdown 或 XML。

### 子命令规范

| 操作 | 子命令 | 说明 |
|------|--------|------|
| 获取原始数据 | `fetch` | 拉取列表/正文，保存到本地 |
| 汇编成品 | `compile` | 将多条数据按风格汇编为最终稿件 |
| 发布到飞书 | `publish` | 将本地文件推送到飞书 |
| 查看缓存 | `list-cache` | 展示已缓存的数据 |

### 新增一个命令

按标准五要素结构搭建：

```bash
mkdir -p tools/law-summarize/scripts
touch tools/law-summarize/law-summarize.md
touch tools/law-summarize/scripts/law-summarize.py
chmod +x tools/law-summarize/scripts/law-summarize.py
# 如果有用户配置：写一份示例 + .gitignore 中排除实际配置文件
touch tools/law-summarize/law-summarize-profile.example.json
```

1. 在 `tools/law-summarize/law-summarize.md` 写 skill 文档（**开头必须有「首次使用」章节**）
2. 在 `SKILL.md` 工具索引加一行
3. Python 脚本实现 `fetch` / `compile` / `publish` / `list-cache` 子命令
4. 缓存自动落到 `tools/law-summarize/cache/`

SKILL.md 工具索引格式：
```markdown
| `/law-summarize` | [`tools/law-summarize/law-summarize.md`](tools/law-summarize/law-summarize.md) | 功能简述 |
```

### 开发原则

1. **命令前缀统一**：`/law-`
2. **认证**：始终 `--as user`
3. **频率**：批量操作间隔 1-2 秒
4. **前置检查**：操作前确保 lark-cli 就绪
5. **脚本化**：机械操作（API/格式转换/图片处理）写脚本，AI 只做内容生成
6. **跨平台**：Python 脚本用 `python3` + 仅标准库，Windows/macOS/Linux 三端可跑
7. **缓存可追溯**：数据存工具自带 `cache/`，`.gitignore` 已排除
8. **五要素齐备**：每个 skill 都按 `md + 脚本 + cache + .example.json + .json` 模板组织
9. **配置隐私**：用户个人配置 `*.json` 必须 `.gitignore` 排除

---

## 常见问题

### Q: 为什么不用 `str_replace` 直接加背景色？

飞书简化 XML 不支持 `<span style="background-color:...">`。背景色需要调用原生 OpenAPI 的 `PATCH .../blocks/{id}` 接口，在 `text_element_style` 中设置 `background_color`。

### Q: 批量划重点有什么注意事项？

`str_replace` 是全文替换，如果同一词语在多条条文中出现，会全部标记。如果只想标记某个特定位置的词语，用更长前缀+后缀做 `--pattern` 确保唯一性，或使用批注方式。

### Q: 批注内容有长度限制吗？

建议每条批注不超过 500 字。过长可能导致 API 截断或显示不佳。

### Q: 能否多人协作？

可以。飞书文档本身支持多人实时编辑。批注和划重点的操作会同步给所有有权限的协作者。

### Q: 文档导入后还能继续编辑吗？

能。导入生成的飞书文档是标准的飞书在线文档，你可以在飞书客户端直接编辑、删除、分享。

### Q: 如何确保 lark-cli 是最新版？

本 skill 的前置检查会自动执行 `lark-cli update --check --json`，有新版本会自动升级。你也可以手动运行 `lark-cli update`。

### Q: `law-news` 怎么用？

```bash
/law-news cctv-law --days 3 --max 10 --style 简报
```

AI 会自动跑完 `fetch` → `fetch-article` → `compile` → `publish` 全流程，最终输出飞书文档 URL。所有抓取的数据缓存在 `tools/law-news/cache/`，可 `list-cache` 核查。

### Q: `law-news` 配图大小不一致怎么办？

`publish` 步骤已内置自适应：先用纯标准库读图片 header 拿到原宽高，再算 `scale = 600 / 原宽`，所以无论原图大小，最终显示都是统一的视觉尺寸（飞书 `scale` 支持 > 1.0 放大）。

### Q: 「律师说」评论怎么改成我自己的？

复制示例配置，编辑 `tools/law-news/lawyer-profile.json`：

```bash
cp tools/law-news/lawyer-profile.example.json tools/law-news/lawyer-profile.json
```

三个字段：

- `label`：评论块标题（如「陈律师说」）
- `signature`：简短署名（格式「姓名 · 律所」）
- `style_prompt`：风格提示词，**给 AI 自己看**，告诉它写评论的角度和风格

使用时传：

```bash
python3 tools/law-news/scripts/law-news.py compile \
  --lawyer-comments "@/tmp/comments.json" \
  --lawyer-profile "@tools/law-news/lawyer-profile.json"
```

`lawyer-profile.json` 已在 `.gitignore` 排除，不会被提交。

---

## 许可证

MIT
