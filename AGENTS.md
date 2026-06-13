# feishu-lawtools

飞书法律工具箱 skill 包。纯 Markdown 指令集，无可执行代码、无测试、无构建。

## 性质

- 这是一个 **Agent Skills 标准** 包（不是常规应用）。Agent 通过读取 `SKILL.md` + `tools/*.md` 获取操作指令。
- 入口：`SKILL.md`（元信息、前置检查、流程图、工具索引）
- 子工具：`tools/law-import/law-import.md`、`tools/law-news/law-news.md`、`tools/law-highlight/law-highlight.md`、`tools/law-annotate/law-annotate.md`
- 机械操作脚本：`tools/law-news/scripts/law-news.py`（Python），降低 token 消耗
- 无 `package.json` scripts，无 CI，无 linter，无 typecheck

## 前置检查（每次操作前必做）

```bash
# 1. 检查 lark-cli 是否安装
which lark-cli

# 2. 检查更新
lark-cli update --check --json

# 3. 验证认证状态
lark-cli auth status
# 返回 JSON 中的 identity 应为 "user"，tokenStatus 不应为 "invalid"
# 若 tokenStatus 为 "needs_refresh" 则自动刷新；无效时提示用户 `lark-cli auth login`
```

## 关键规则

- 所有操作使用 `--as user`（bot 身份不可用）
- 操作前始终运行上述前置检查，**不要**问用户"装了吗/登录了吗"
- 飞书简化 XML 不支持 `background-color`，背景高亮须走原生 OpenAPI（`PATCH .../blocks/{id}`），使用 `text_element_style.background_color`
- `str_replace` 是全文替换；`update_text_elements` 必须提供 block 的**全部** elements
- 批量批注时每条间隔 1-2 秒，单条不超过 500 字
- 文档创建支持分批追加（`docs +create` 空文档 → `docs +update --command append`）

## 命令速览

| 命令 | 做什么 | 核心 API |
|------|--------|----------|
| law-import | URL/本地文件 → 飞书文档 | `docs +create` / `docs +update` |
| law-news | 资讯源 → 法律文章 → 飞书 | `curl` + `docs +create` / `wiki +move` |
| law-highlight | 正文加粗/标色 | `docs +update str_replace` 或 `PATCH blocks/{id}` |
| law-annotate | 逐条 AI 批注 | `drive +add-comment` |

## 维护

- 新增命令：在 `tools/` 建 `.md` 文件，然后在 `SKILL.md` 工具索引加一行
- 命令前缀统一为 `/law-`
- 包发布：更新 `package.json` 版本号 → `npm publish`

## 开发约定

### 核心理念：脚本做实事，AI 只做编排

本工具箱的所有工具遵循同一设计哲学：

| 谁 | 负责 | 不负责 |
|----|------|--------|
| **脚本** | 抓取 / 解析 / 排版 / 缓存 / 存盘 / 发布 | 理解文章内容、做价值判断 |
| **AI** | 浏览成品、判断选哪些、指定风格、触发命令 | 拼接 markdown / 写 XML / 管理临时文件 |

> **绝对规则**：脚本必须把交付物写好存盘，返回 **文件路径**。AI 只需 `read` 该路径，不得在上下文中拼接 markdown 或 XML。这直接决定 token 消耗和输出鲁棒性。

### Skill 元信息

每个 `law-<name>/law-<name>.md` 头部包含 YAML frontmatter：

```yaml
---
name: law-<name>
description: 一句话描述
tags: [分类标签]       # 取值: import, fetch, annotate, transform, ai
requires: [lark-cli]   # 依赖的 CLI 工具
scripts: [scripts/...] # 关联脚本路径（Python 用 .py，Shell 用 .sh），无脚本留空数组
---
```

### 脚本接口规范

所有有脚本的 skill **必须**遵循以下接口约定：

#### 子命令模式

```
scripts/<name>.py <subcommand> [args...]
```

子命令命名规范：

| 操作 | 子命令 | 说明 |
|------|--------|------|
| 获取原始数据 | `fetch` | 拉取列表/正文，保存到本地 |
| 汇编成品 | `compile` | 将多条数据按风格汇编为最终稿件 |
| 发布到飞书 | `publish` | 将本地文件推送到飞书 |
| 查看缓存 | `list-cache` | 展示已缓存的数据 |

> 禁止用 `--format json` 输出 JSON 到 stdout 作为主交付方式。JSON 只作为中间缓存格式存盘（备查），人机交互的交付物必须是 **markdown 文件路径**。

#### 输出规范

```
stdout — 只输出一线交付物（文件路径 / ✅ URL），一行搞定
stderr — 错误信息
exit 0 — 成功
exit 1 — 失败
```

**不要**把正文内容打到 stdout。正文写到文件，返回路径。

#### 文件层级规范

每个脚本自带缓存目录，放在工具文件夹内，保持独立：

```
tools/law-news/
├── law-news.md
├── scripts/law-news.py
└── cache/                  ← 由 {NAME}_DIR 控制（默认 tools/<name>/cache/）
    ├── raw/                ← fetch 原始响应（JSON，备查）
    ├── articles/           ← fetch-article 结果（.json + .md）
    └── exports/            ← 最终交付物（.md）
```

- 缓存根目录默认 `tools/<name>/cache/`，环境变量 `{NAME}_DIR` 可覆盖
- `.gitignore` 中已排除 `cache/`
- `list-cache` 子命令展示所有缓存，支持按来源筛选

#### compile 约定

需要「多选 → 汇编」的 skill 必须提供 `compile` 子命令：

```bash
scripts/<name>.py compile --articles "id1,id2" --style <style> [--title "标题"]
```

- `--articles`：逗号分隔的文章/条目 ID
- `--style`：内置排版风格（如 `简报|深度|专题`）
- 输出：最终 `.md` 文件路径

AI **不是**把多条正文拼起来。而是说「用简报风格，把这 5 篇汇编一下」，脚本完成排版。

#### 缓存策略

- `fetch` 类命令自动检查缓存，同一天/同 ID 不重复拉 API
- 缓存以 `原始 JSON` + `排版 .md` 双格式保存，前者备查，后者即交付物
- 消费者（AI/用户）只看 `.md`

### Python 环境初始化

依赖 `python3` 的 skill 在 frontmatter `requires` 中注明 `python3`。首次运行 Python 脚本前：

```bash
# 确认 python3 可用
python3 --version

# 使用标准库（禁止引入第三方依赖），本工具箱所有 .py 脚本仅依赖标准库
```

> 所有 `.py` 脚本仅使用 `python3` 标准库，无第三方依赖。无需 `pip install`，无需 virtualenv。
> 若未来确需第三方库，必须在 `requires` 中声明并在 skill 文档中注明安装方式。

### 共享库

当 2+ 个 skill 用到同一段逻辑时，抽到 `lib/<name>.sh`，在各自脚本中 `source` 引用。常见共享逻辑：

- 飞书 XML 转换（markdown → XML）
- lark-cli 发布封装
- 通用缓存读写

### 依赖预检

`lark-cli` 是全局强依赖，其他工具依赖在各 skill 的 `requires` 中声明。新增依赖时同步更新对应 frontmatter。

### 写法红线

1. **禁止脚本把内容打到 stdout 让 AI 去处理** — 内容要写文件，返回路径
2. **禁止 AI 在上下文中拼接 markdown/XML** — `compile` 命令做排版，`publish` 做 XML 转换
3. **禁止重复请求** — 必须缓存，`list-cache` 可核查
4. **禁止输出无结构的数据** — 每个命令的返回数据必须文档化（字段表 + 示例）
