# feishu-lawtools — 项目开发规范

飞书法律工具箱 skill 包。纯 Markdown 指令集 + Python 脚本辅助。

## 项目结构

```
feishu-lawtools/
├── AGENTS.md                 ← 项目规则主入口（pi / opencode 通用）
├── SKILL.md                  ← 技能元信息 + 工具索引 + 流程图
├── tools/
│   ├── law-import/           ← URL/文件导入飞书文档
│   ├── law-news/             ← 法律资讯抓取与汇编
│   ├── law-highlight/        ← 文档 AI 划重点
│   └── law-annotate/         ← 文档 AI 批注
├── .agents/skills/           ← pi 项目技能
├── .opencode/skills/         ← opencode 项目技能（桥接至 .agents/skills/）
├── lib/                      ← 共享库
└── package.json
```

## 关键规则

- 所有操作使用 `lark-cli`，前置检查每次必做（`which lark-cli` → `lark-cli update --check --json` → `lark-cli auth status`）
- `--as user` 身份，bot 身份不可用
- 脚本产出写文件返回路径，AI 只做编排不拼接 markdown/XML
- 所有 `.py` 仅依赖 Python 标准库，无第三方依赖
- 所有工具按 AGENTS.md 五要素规范组织

## 项目级技能

| 技能 | 路径 | 用途 |
|------|------|------|
| skill-audit | `.opencode/skills/skill-audit/SKILL.md` | 审计工具是否符合开发规范 |

## 命令索引

| 技能 | 触发 | 说明 |
|------|------|------|
| law-import | `/law-import` | 导入 URL/文件为飞书文档 |
| law-news | `/law-news` | 抓取法律资讯 |
| law-highlight | `/law-highlight` | AI 划重点 |
| law-annotate | `/law-annotate` | AI 批注 |

## 开发约定

- 新增工具在 `tools/` 下建目录，然后在 `SKILL.md` + `README.md` 工具索引加一行
- 命令前缀统一为 `/law-`
- 每次开发完毕后跑 `python3 .agents/skills/skill-audit/scripts/audit.py check <name>` 审计
- 发布前跑 `python3 .agents/skills/skill-audit/scripts/audit.py check-all`
