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

> lark-cli 已内置自动更新检测（`lark-cli update --check`），无需手动关注版本。

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
```

> 非 pi agent 直接描述需求即可，agent 会自动匹配对应工具。

---

## 工具索引

| 命令 | 工具文件 | 功能 |
|------|----------|------|
| `/law-import` | [`tools/law-import.md`](tools/law-import.md) | 从 URL 或本地文件导入法律条文，创建飞书在线文档 |
| `/law-highlight` | [`tools/law-highlight.md`](tools/law-highlight.md) | 对文档中的特定词语进行正文内标记（高亮/加粗/标色） |
| `/law-annotate` | [`tools/law-annotate.md`](tools/law-annotate.md) | AI 自动为每条法律条文生成解读批注 |

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
├── SKILL.md                     ← 总调度：元信息、前置检查、流程图、工具索引
├── README.md                    ← 本文件（人类可读的说明文档）
├── package.json                 ← npm 包信息
├── AGENTS.md                    ← agent 操作指南
├── law-import/
│   └── law-import.md            ← /law-import 命令详解
├── law-news/
│   ├── law-news.md              ← /law-news 命令详解
│   └── scripts/
│       └── law-news.sh          ← 机械操作脚本，降低 token 消耗
├── law-highlight/
│   └── law-highlight.md         ← /law-highlight 命令详解
└── law-annotate/
    └── law-annotate.md          ← /law-annotate 命令详解
```

### 结构规则

- **每个 skill 独立目录**：`law-<name>/` 下辖说明文档 + 可选 `scripts/`
- **脚本归所属 skill**：`scripts/` 在 skill 目录内，避免误以为是全局工具
- **纯指令 skill 无需脚本**：无机械操作时，只放 `.md` 即可

---

## 开发指南

### 新增一个命令

```bash
mkdir -p law-summarize
# 创建 law-summarize/law-summarize.md
# 在 SKILL.md 工具索引加一行
# 如有机械操作，在 law-summarize/scripts/ 下加脚本
```

SKILL.md 工具索引格式：
```markdown
| `/law-summarize` | [`law-summarize/law-summarize.md`](law-summarize/law-summarize.md) | 功能简述 |
```

### 开发原则

1. **命令前缀统一**：`/law-`
2. **认证**：始终 `--as user`
3. **频率**：批量操作间隔 1-2 秒
4. **前置检查**：操作前确保 lark-cli 就绪
5. **token 优化**：机械操作（curl/API/格式转换）写脚本，AI 只做内容生成

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

---

## 许可证

MIT
