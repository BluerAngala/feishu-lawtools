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

Word 把 `2026年7月1日` 这种短文本经常切成 **13 个 `<w:r>` run**，常见 docx 库直接 `keyword.indexOf` 会大量漏命中。本工具用「虚拟文本流 + runMap」做跨 run 安全切片：

- 旧方案：关键词跨 run 时大量漏命中
- 本工具：跨 run 关键词也可 100% 命中

## 首次使用

```bash
# 1. 确认 Node.js >= 20
node --version

# 2. 查看所有命令
./docx help

# 3. 用示例 ops 体验完整流程
./docx inspect document.docx
./docx apply document.docx examples/demo-ops.json --dry-run
./docx apply document.docx examples/demo-ops.json -o document-revised.docx
```

## AI 标准操作流程

所有命令使用 `scripts/docx.mjs`（纯 Node.js 标准库，零 npm 依赖）：

### 第一步：让 AI 看清文档

```bash
node scripts/docx.mjs ai-context document.docx
node scripts/docx.mjs outline document.docx
node scripts/docx.mjs dump document.docx --md
node scripts/docx.mjs find document.docx "关键词" -c 30
```

### 第二步：AI 写 ops.json

参照 `ai-context` 输出，用稳定段 ID + keyword/regex 定位。可参考 `examples/demo-ops.json` 的格式。

### 第三步：dry-run 看命中报告

```bash
node scripts/docx.mjs apply document.docx ops.json --dry-run
```

### 第四步：确认无误后落盘

```bash
node scripts/docx.mjs apply document.docx ops.json -o document-revised.docx --author "AI Editor"
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
  "meta": { "author": "AI Editor", "date": "2026-06-13T10:00:00Z" },
  "ops": [
    { "type": "header.set",      "value": "DRAFT-v2.3", "headerType": "default" },
    { "type": "comment.add",     "locate": { "keyword": "项目方案" }, "text": "建议补充具体实施时间表" },
    { "type": "comment.add",     "locate": { "paragraph": "P0020", "keyword": "2024年1月1日" }, "text": "日期已过时，请核实" },
    { "type": "revise.replace",  "locate": { "keyword": "2024年1月1日" }, "to": "2026年7月1日" },
    { "type": "revise.insert",   "locate": { "paragraph": "P0001", "keyword": "会议纪要" }, "text": "（修订版）", "mode": "after" },
    { "type": "revise.delete",   "locate": { "keyword": "待补充" } },
    { "type": "replace",         "locate": { "regex": "预算.*?\\d+" }, "to": "预算：¥50,000" },
    { "type": "insert",          "locate": { "paragraph": "P0010", "keyword": "费用明细" }, "text": "（详见附件一）", "mode": "after" },
    { "type": "delete",          "locate": { "paragraph": "P0012", "keyword": "旧版说明" } }
  ]
}
```

完整示例见 `examples/demo-ops.json`（涵盖全部 op 类型）。其他场景示例见 `examples/scenario-*.json`。

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

const ctx = await aiContext('document.docx');
const ops = [
  { type: 'header.set', value: 'DRAFT-v2' },
  { type: 'comment.add', locate: { keyword: '方案概述' }, text: '建议补充量化指标' },
  { type: 'revise.replace', locate: { keyword: '旧版数据' }, to: '新版数据' },
];

// dry-run
const { report } = await apply('document.docx', ops, { dryRun: true });
console.error(formatReport(report));

// 落盘
await apply('document.docx', ops, { outPath: 'out.docx', author: 'AI Editor' });
```

## 跨 run 命中能力

Word 经常把看似连续的文本切成多个 `<w:r>` run，本工具通过「虚拟文本流」安全匹配：

| 实际段落原文 | Word 实际拆成 | 旧 keyword.indexOf | 本工具 |
|---|---|---|---|
| `2026年7月1日至2026年7月31日` | 13 个 run（每字一片） | 漏 | ✓ |
| `总预算¥50,000其中包括…` | `总预算¥` / `50,000` / `其中` 跨 3 run | 漏 | ✓ |
| `数据收集与分析报告` | `数据收集` / `与` / `分析报告` 跨 3 run | 半命中 | ✓ |

## 冲突检测

dry-run 会自动检测同段重叠 edit，输出：

```
[ERR] op[__commit__] __commit__  paragraph edit conflict:
       paragraph P0020 has conflicting edits [36,36) vs [34,42)
```

## 场景示例

`examples/` 目录下提供多个场景的 ops.json 参考：

| 文件 | 场景 | 涵盖操作 |
|------|------|----------|
| `demo-ops.json` | 通用演示（推荐新手入门） | 全部 8 种 op 类型 |
| `scenario-contract-review.json` | 合同审查 | comment + revise |

AI 可根据文档内容自由组合，不限于上述场景。

## 目录结构

```
docx-skill/                         ← 自包含 skill 包，零 npm 依赖
├── docx-skill.md                   ← skill 文档（本文件）
├── docx                            ← 入口脚本（`./docx <command>`）
├── examples/
│   ├── demo-ops.json               ← 通用示例（推荐入门用）
│   └── scenario-contract-review.json  ← 合同审查场景示例
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
