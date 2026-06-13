# feishu-lawtools

飞书法律工具箱 skill 包。纯 Markdown 指令集，无可执行代码、无测试、无构建。

## 性质

- 这是一个 **Agent Skills 标准** 包（不是常规应用）。Agent 通过读取 `SKILL.md` + `tools/*.md` 获取操作指令。
- 入口：`SKILL.md`（元信息、前置检查、流程图、工具索引）
- 子工具：`tools/law-import/law-import.md`、`tools/law-news/law-news.md`、`tools/law-highlight/law-highlight.md`、`tools/law-annotate/law-annotate.md`
- 机械操作脚本：`tools/law-news/scripts/law-news.sh`（curl/解析/飞书 API），降低 token 消耗
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

### Skill 元信息

每个 `law-<name>/law-<name>.md` 头部包含 YAML frontmatter：

```yaml
---
name: law-<name>
description: 一句话描述
tags: [分类标签]       # 取值: import, fetch, annotate, transform, ai
requires: [lark-cli]   # 依赖的 CLI 工具
scripts: [scripts/...] # 关联脚本路径，无脚本留空数组
---
```

### 脚本接口规范

有脚本的 skill 统一以下模式：

- 子命令分发：`scripts/<name>.sh fetch|publish|...`
- `--help` 输出用法
- 成功输出 JSON 到 stdout，错误信息到 stderr，非零退出码

### 共享库

当 2+ 个 skill 用到同一段逻辑时，抽到 `lib/<name>.sh`，在各自脚本中 `source` 引用。暂免重复。

### 依赖预检

`lark-cli` 是全局强依赖，其他工具依赖在各 skill 的 `requires` 中声明。新增依赖时同步更新对应 frontmatter。
