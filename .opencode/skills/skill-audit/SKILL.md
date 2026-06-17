---
name: skill-audit
description: 审计项目内所有 skill 是否符合开发规范
tags: [audit, dev]
requires: [python3]
scripts: [scripts/audit.py]
---

# /skill-audit — 项目内工具审计

按 `AGENTS.md` 开发规范对 `tools/` 下每个 skill 做一致性检查。开发完成时跑一次。

> **本 skill 不随 npm 包发布**。位置在 `.agents/skills/skill-audit/`，项目级（开发者用），最终用户看不到。

---

## 设计理念

- 脚本做实事：自动跑机械检查（frontmatter、文件存在、gitignore 完整性等）
- AI 决策：看完报告后判断哪些需要修复
- 不强制修：警告不阻塞，但错误必须修

## 子命令

| 命令 | 功能 |
|------|------|
| `list-tools` | 列出 `tools/` 下所有工具 |
| `check <name>` | 审计单个工具 |
| `check-all` | 审计所有工具 |
| `check-gitignore` | 仅审计 `.gitignore` 完整性 |

## 调用

```bash
# 审计单个工具
python3 .agents/skills/skill-audit/scripts/audit.py check law-news

# 审计全部
python3 .agents/skills/skill-audit/scripts/audit.py check-all

# 列出所有工具
python3 .agents/skills/skill-audit/scripts/audit.py list-tools
```

## 审计维度

| 维度 | 级别 | 说明 |
|------|------|------|
| frontmatter 完整性 | ❌ 错误 | 必须有 `name`/`description`/`tags`/`requires`/`scripts` |
| frontmatter.name 一致 | ❌ 错误 | `name` 字段必须等于目录名 |
| 脚本存在性 | ❌ 错误 | 声明的 `scripts` 路径文件必须存在 |
| 首次使用章节 | ⚠️ 警告 | 含用户配置的工具必须有「首次使用」章节 |
| 数据字段表 | ⚠️ 警告 | 有数据契约的工具应列出字段表 |
| .gitignore 完整性 | ⚠️ 警告 | `cache/` 和 `*-profile.json` 必须被排除 |
| 示例配置配对 | ⚠️ 警告 | 有 `.example.json` 应配 `.json` |
| SKILL.md 注册 | ⚠️ 警告 | 工具应在 `SKILL.md` 工具索引中 |
| README.md 注册 | ⚠️ 警告 | 工具应在 `README.md` 工具索引中 |

## AI 工作流

每次完成一个工具开发后：

```bash
# 1. 跑审计
python3 .agents/skills/skill-audit/scripts/audit.py check law-news

# 2. 看报告：
#    ❌ 错误必须修（frontmatter 缺字段、脚本不存在等）
#    ⚠️  警告建议修（缺章节、缺注册等）

# 3. 修复后重跑，确认全部通过

# 4. 发布前再 check-all 跑一次，确认没影响其他工具
python3 .agents/skills/skill-audit/scripts/audit.py check-all
```

## 输出示例

```
=== law-news ===
  name: law-news
  description: 获取法律资讯，整理为文章
  tags: ['fetch', 'transform']
  requires: ['lark-cli', 'python3']
  scripts: ['scripts/law-news.py']
  ✅ 全部通过

=== law-import ===
  ⚠️  警告 (2):
    - 缺少「首次使用」章节
    - 缺少「数据字段」表

==================================================
审计汇总
==================================================
工具数: 4
错误: 0
警告: 6
✅ 全部工具通过审计
```

## 扩展检查项

在 `scripts/audit.py` 的 `audit_tool()` 函数里加新检查项即可。例：

```python
# 新增：检查示例命令是否包含 --title 参数
if not re.search(r'--title', content):
    issues.append(warn('文档示例未演示 --title 参数'))
```

## 与 AGENTS.md 规范的关系

`audit.py` 的检查项是 `AGENTS.md`「开发约定」章节的机器化体现。新增 `AGENTS.md` 规范时，应同步在 `audit.py` 加检查。规范文档是「why」+「how」的人工描述，audit 脚本是「是否做到」的机器校验。
