---
name: docx-skill
description: 让 AI 能稳定地看清 docx 结构、按段落定位、批量修改、留痕审阅。跨 run 安全匹配，零外部依赖。
tags: [transform]
requires: [node]
scripts: [scripts/docx.mjs]
---

# docx-skill

让 AI 能稳定地"看清 docx 结构、按段落定位、批量修改、留痕审阅"的工具。一份 `ops.json` 描述全部修改，先 `--dry-run` 看命中报告再落盘。

## 为什么需要

Word 把 `2025年8月8日` 这种短文本经常切成 **13 个 `<w:r>` run**，常见 docx 库直接 `keyword.indexOf` 会大量漏命中。本工具用「虚拟文本流 + runMap」做跨 run 安全切片：

- 旧方案在真实合同上：3 个修订关键词，命中 1 个（33%）
- 本工具：5 个跨 run 关键词，全部命中（100%）

## 首次使用

```bash
# 1. 确认 Node.js >= 20
node --version

# 2. 查看所有命令
./docx help

# 3. 测试一把
./docx inspect 合同.docx
```

## AI 标准操作流程

所有命令使用 `scripts/docx.mjs`（纯 Node.js 标准库，零 npm 依赖）：

### 第一步：让 AI 看清文档

```bash
node scripts/docx.mjs ai-context 合同.docx
node scripts/docx.mjs outline 合同.docx
node scripts/docx.mjs dump 合同.docx --md
node scripts/docx.mjs find 合同.docx "金额" -c 30
```

### 第二步：AI 写 ops.json

参照 `ai-context` 输出，用稳定段 ID + keyword/regex 定位。

### 第三步：dry-run 看命中报告

```bash
node scripts/docx.mjs apply 合同.docx ops.json --dry-run
```

### 第四步：确认无误后落盘

```bash
node scripts/docx.mjs apply 合同.docx ops.json -o 合同-修订版.docx --author "AI 审查助手"
```

## CLI 命令

```bash
node scripts/docx.mjs <command> [args]
```

| 命令 | 作用 |
|---|---|
| `inspect <file>` | 段/run/表/批注/修订/页眉 统计 JSON |
| `outline <file>` | 标题大纲（按 `pStyle: Heading1..`） |
| `dump <file> [--json] [--md] [--all]` | 全段落列表，带稳定 ID |
| `find <file> <needle> [--regex] [-c N]` | 全文搜索，输出 `段ID [start,end) 上下文` |
| `ai-context <file> [--limit N]` | 一份 JSON 喂给 LLM 让它写 ops |
| `headers <file>` | 列出所有 header.xml 与文本 |
| `apply <file> <ops.json> [-o out] [--dry-run] [--author N] [--date ISO]` | 批量应用 |

## ops.json 格式

```json
{
  "meta": { "author": "AI 审查助手", "date": "2026-06-13T10:00:00Z" },
  "ops": [
    { "type": "header.set", "value": "SWXCBHT-2026-045" },
    { "type": "comment.add",    "locate": { "keyword": "示例律师事务所" }, "text": "请确认甲方主体" },
    { "type": "comment.add",    "locate": { "paragraph": "P0020", "keyword": "壹拾陆万伍仟元整" }, "text": "中文大写需校对" },
    { "type": "revise.replace", "locate": { "keyword": "2025年8月8日" }, "to": "2025年08月08日" },
    { "type": "revise.replace", "locate": { "keyword": "千分之三" }, "to": "千分之五" },
    { "type": "revise.insert",  "locate": { "paragraph": "P0001", "keyword": "项目委托合同" }, "text": "（修订版）", "mode": "after" },
    { "type": "revise.delete",  "locate": { "keyword": "本合同一式伍份" } },
    { "type": "replace",        "locate": { "regex": "¥\\s*165000" }, "to": "¥ 165,000.00" },
    { "type": "insert",         "locate": { "paragraph": "P0073", "keyword": "费用明细" }, "text": "（见附件一）", "mode": "after" },
    { "type": "delete",         "locate": { "paragraph": "P0079", "keyword": "日期：   年   月   日" } }
  ]
}
```

### op 类型

| type | 是否留痕 | 必填 | 选填 |
|---|---|---|---|
| `replace`        | 否 | `locate`, `to` | — |
| `insert`         | 否 | `locate`, `text` | `mode: before\|after`（默认 before） |
| `delete`         | 否 | `locate` | — |
| `revise.replace` | 是 | `locate`, `to` | `author`, `date` |
| `revise.insert`  | 是 | `locate`, `text` | `mode`, `author`, `date` |
| `revise.delete`  | 是 | `locate` | `author`, `date` |
| `comment.add`    | 是 | `locate`, `text` | `author`, `date`, `initials` |
| `header.set`     | — | `value` | `headerType: default\|first\|even`（默认 default），`mode: replace\|append`（默认 replace） |

### locate 三选一

- **关键词**：`{ "keyword": "..." }` —— 全文匹配；可加 `paragraph: "P0020"` 限定段
- **正则**：`{ "regex": "..." }` —— JS 正则；可加 `paragraph`
- **段内偏移**：`{ "paragraph": "P0020", "offset": 25, "length": 8 }` 或 `end` 替 `length`

可选过滤：
- `nth: 0` 只取第 N 个命中（0 起算）
- `all: false` 只取第一个

## Node API

```js
import { apply, formatReport, aiContext, find } from './scripts/index.mjs';

const ctx = await aiContext('contract.docx');
const ops = [
  { type: 'header.set', value: 'NUM-001' },
  { type: 'comment.add', locate: { keyword: '甲方' }, text: '请核对主体' },
  { type: 'revise.replace', locate: { keyword: '千分之三' }, to: '千分之五' },
];

// dry-run
const { report } = await apply('contract.docx', ops, { dryRun: true });
console.error(formatReport(report));

// 落盘
await apply('contract.docx', ops, { outPath: 'out.docx', author: 'AI' });
```

## 跨 run 命中能力

| 实际段落原文 | Word 实际拆成 | 旧 keyword.indexOf | 本工具 |
|---|---|---|---|
| `2025年8月8日至2025年8月10日。` | 13 个 run（每字一片） | 漏 | ✓ |
| `…合同总额千分之三作为违约金…` | `千` / `分之三作为…` 跨 2 run | 漏 | ✓ |
| `本合同一式伍份…执贰份…` | `本合同一式伍份…` / `贰` / `份…` 跨 3 run | 半命中 | ✓ |

## 冲突检测

dry-run 会自动检测同段重叠 edit，输出：

```
[ERR] op[__commit__] __commit__  paragraph edit conflict: paragraph P0020 has conflicting edits [36,36) vs [34,42)
```

## 目录结构

```
docx-skill/                         ← 自包含 skill 包，零 npm 依赖
├── docx-skill.md                   ← skill 文档（本文件）
├── docx                            ← 入口脚本（`./docx <command>`）
├── scripts/
│   ├── docx.mjs                    ← CLI 入口
│   ├── index.mjs                   ← Node API 入口
│   ├── core/
│   │   ├── zip.mjs                 ← ZIP 读写（纯 Node.js 标准库）
│   │   ├── xml.mjs                 ← XML 工具函数
│   │   ├── ids.mjs                 ← ID 池管理
│   │   └── relations.mjs           ← 文档关系管理
│   ├── inspect.mjs                 ← 只读操作（dump/find/ai-context）
│   ├── apply.mjs                   ← 批量应用操作
│   ├── model/
│   │   ├── paragraph.mjs           ← 段落模型（跨 run 匹配核心）
│   │   └── outline.mjs             ← 大纲提取
│   └── ops/
│       ├── locate.mjs              ← 定位器
│       ├── replace.mjs             ← 替换/插入/删除（不留痕）
│       ├── revision.mjs            ← 修订（留痕）
│       ├── comment.mjs             ← 批注
│       └── header.mjs              ← 页眉
├── cache/                          ← 工具缓存
│   ├── raw/
│   ├── articles/
│   └── exports/
└── docx-profile.example.json       ← 用户配置示例
```

## License

MIT
