---
name: law-import
description: 导入法律条文，创建飞书文档
tags: [import, transform]
requires: [lark-cli]
scripts: []
---

# /law-import — 导入法律条文

将法律文本从URL或本地文件导入飞书在线文档，结构化呈现（章节→条款）。

```
/law-import <url|file_path> [--title "自定义标题"]
```

**参数说明：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `url` 或 `file_path` | 是 | 法律文本来源。URL 自动抓取网页正文；本地文件直接读取 |
| `--title` | 否 | 自定义文档标题，默认取法律文本第一行 |

---

## 步骤

### ① 提取内容

- 如果是 URL → 调用 `baoyu-url-to-markdown` 或 `defuddle` 提取正文
- 如果是本地文件 → `read` 读取文件内容

### ② 解析结构化

法律文本通常格式为：

```
中华人民共和国民法典
（2020年5月28日通过）

第一编 总则
第一章 基本规定
第一条 为了保护民事主体的合法权益……制定本法。
第二条 民法调整……
```

**解析规则：**
- 文件开头 → 法律名称（作为文档标题）
- `第X编`、`第X章`、`第X节` → 一级标题（`<h1>`）
- `第X条` → 独立段落（`<p id="article-X">`），`id` 用于后续锚定批注
- 普通文字 → 段落（`<p>`）

### ③ 构建 XML 内容

```xml
<title>中华人民共和国民法典</title>
<h1>第一编 总则</h1>
<h1>第一章 基本规定</h1>
<p id="article-1">第一条 为了保护民事主体的合法权益……</p>
<p id="article-2">第二条 民法调整平等主体的自然人……</p>
```

> ⚠️ **重要**：每条条文必须有唯一的 `id` 属性（如 `id="article-1"`），这是后续批量逐条批注的锚点。

### ④ 创建文档

```bash
lark-cli docs +create --api-version v2 \
  --content '<title>...</title><h1>...</h1><p id="article-1">...</p>' \
  --as user --format json
```

> 如果内容较长，XML 可能超出命令行长度限制。此时：
> - 先用 `docs +create` 创建空文档
> - 再用 `docs +update --api-version v2 --command append` 分批追加内容

### ⑤ 输出结果

返回文档 URL，格式如：`https://lawyerch.feishu.cn/docx/{document_id}`

### ⑥ 验证

```bash
# 拉取文档内容，确认结构与条文 ID 正确
lark-cli docs +fetch --api-version v2 --doc <token> --as user --format json \
  | python3 -c "import sys,json; d=json.load(sys.stdin)['data']['document']['content']; print('OK' if 'id=\"article-' in d else 'MISSING article ids')"
```

---

## 示例

```
/law-import https://flk.npc.gov.cn/民法典.txt
→ ✅ 已创建：https://lawyerch.feishu.cn/docx/xxx

/law-import /Users/bluer/Downloads/刑法.txt --title "中华人民共和国刑法"
→ ✅ 已创建：https://lawyerch.feishu.cn/docx/yyy
```
