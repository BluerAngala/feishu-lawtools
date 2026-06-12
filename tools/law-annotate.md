# /law-annotate — AI 自动添加批注

对已导入的法律文档，AI 自动为每条条文生成解读批注。

```
/law-annotate <doc_url> [--scope "article-1,article-5"] [--style "通俗"|"专业"|"案例"]
```

**参数说明：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `doc_url` | 是 | 飞书文档 URL 或 token |
| `--scope` | 否 | 指定条文范围，如 `article-1,article-5`，不填则全部 |
| `--style` | 否 | 解读风格：`通俗`（默认，适合非法律人士）/ `专业`（法言法语，引用司法解释）/ `案例`（结合典型案例） |

---

## 风格对比

以「民法典第143条（合同有效要件）」为例：

| 风格 | 输出示例 |
|:----:|----------|
| **通俗** | "本条说了合同有效的三个条件：1）双方都得是能自己做主的人；2）说的话都是真心的，没被骗；3）内容不违法、不违背公序良俗。" |
| **专业** | "本条系民事法律行为生效要件之一般规定。行为能力的判断以《民法典》第18-22条为准；意思表示真实排除通谋虚伪表示（第146条）及欺诈胁迫（第148-150条）；不得违反强制性规定需区分效力性与管理性规定（《九民纪要》第30条）。" |
| **案例** | "参考（2021）最高法民终XXX号：当事人以'意思表示不真实'主张合同无效，法院审查是否存在欺诈、胁迫或重大误解。实务中证明标准较高，需提供充分证据。" |

---

## 级别A：逐条批注（整条解读）

对每条法律条文整体添加解读批注。

### ① 获取文档 block 结构

```bash
lark-cli docs +fetch --api-version v2 --doc <token> --detail with-ids --as user --format json
```

从返回的 XML 中提取所有 `<p id="article-X">` 节点的 `id` 和文本内容。

### ② AI 生成解读

对每条条文，使用 AI（即你自身）生成解读文本。解读内容应包含：
- 条文核心含义
- 关键词解释（如有）
- 实务要点（如有）
- 风格按 `--style` 参数调整

### ③ 添加批注

```bash
# 单条添加
lark-cli drive +add-comment \
  --doc <token> \
  --block-id "<p标签的id>" \
  --content '[{"type":"text","text":"【AI解读】...解读内容..."}]' \
  --type docx \
  --as user
```

> **content 格式**：必须是 JSON 数组，元素格式为 `{"type":"text","text":"内容"}`
> **block-id**：即 XML 中 `<p id="article-1">` 的 `id` 值

---

## 级别B：词语级批注（划重点）

对条文中**特定词语或短语**添加批注，精准标记重点概念、关键词、实务要点。

### 方式一：精确短语匹配

```bash
lark-cli drive +add-comment \
  --doc <token> \
  --selection-with-ellipsis "意思表示真实" \
  --content '[{"type":"text","text":"【划重点】意思表示真实的含义..."}]' \
  --type docx \
  --as user
```

### 方式二：范围标记（start...end）

```bash
lark-cli drive +add-comment \
  --doc <token> \
  --selection-with-ellipsis "开头文字...结尾文字" \
  --content '[{"type":"text","text":"【划重点】解读内容..."}]' \
  --type docx \
  --as user
```

> **注意**：
> - `--selection-with-ellipsis` 和 `--block-id` 互斥，不能同时使用
> - 系统会自动在文档内定位匹配的文本，如果同一文本出现多次，会使用第一个匹配处
> - 建议使用足够独特的关键词确保精准命中
> - 词语级批注适合：法律术语解释、关键词定义、实务提示、易错点标注

---

## 分页处理

如果文档较长（>50条），应分批获取 block_id 和分批添加批注，避免超时。每次添加批注后等待 1-2 秒（API 有频率限制）。

---

## 示例

```
用户：/law-annotate https://lawyerch.feishu.cn/docx/xxx --style 专业
AI：  获取block结构 → 逐条生成专业解读 → 添加批注
     ✅ 已为全部1280条添加批注
```
