---
name: law-highlight
description: 正文内标记（高亮/加粗/标色）
tags: [annotate, transform]
requires: [lark-cli]
scripts: []
---

# /law-highlight — 划重点（正文格式化标记）

对文档中的特定词语进行**正文内标记**（加粗/标色/高亮），而不是添加隐藏的批注。

```
/law-highlight <doc_url> <term> [--style highlight|bold] [--color "#E8323C"]
```

**参数说明：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `doc_url` | 是 | 飞书文档 URL 或 token |
| `<term>` | 是 | 要标记的词语或短语 |
| `--style` | 否 | 标记风格：`highlight`（黄底高亮，默认）\| `bold`（加粗）\| `color`（文字颜色） |
| `--color` | 否 | 颜色值，仅 `style=color` 时生效，默认红 `#E8323C` |

---

## 与批注的区别

| | 划重点 | 批注 |
|:---|:-------|:-----|
| **位置** | 直接在正文中修改文字样式 | 侧边栏评论，不占正文 |
| **可见性** | 打开文档一目了然 | 需要点击批注图标展开 |
| **适合场景** | 关键术语、易错点、核心概念 | 完整解读、案例分析、实务提示 |

---

## 黄底高亮 + 加粗（默认，最明显）

需要分两步走，因为飞书简化 XML 不支持背景色，必须用原生 API。

### 步骤①：找到目标文本所在的 block_id

```bash
# 通过关键词搜索定位到 block
lark-cli docs +fetch --api-version v2 --doc <token> --scope keyword --keyword "故意犯罪" --detail with-ids --as user
```

### 步骤②：获取该 block 的完整文本结构

```bash
lark-cli api GET /open-apis/docx/v1/documents/{doc_id}/blocks/{block_id} --as user
```

### 步骤③：构建带高亮的更新请求

解析返回的 `text.elements` 数组，找到目标文本元素，将其 `text_element_style` 改为：

```json
{
  "bold": true,
  "background_color": 2
}
```

**`background_color` 取值：**

| 值 | 颜色 | 适用场景 |
|:--:|:----:|----------|
| `2` | 🟡 **黄色** | **默认**，高亮最醒目 |
| `3` | 🟢 绿色 | 正面案例、合规要点 |
| `4` | 🔵 蓝色 | 程序性规定 |
| `5` | 🟠 橙色 | 警告、注意 |
| `6` | 🔴 红色 | 禁止性规定、易错点 |
| `7` | 🟣 紫色 | 特殊概念、定义 |

### 步骤④：PATCH 写回

```bash
lark-cli api PATCH /open-apis/docx/v1/documents/{doc_id}/blocks/{block_id} \
  --data '{"update_text_elements":{"elements":[...]}}' \
  --as user
```

> ⚠️ **重要**：`update_text_elements` 必须提供该 block 的 **全部** elements，不能只传要改的那一个。漏掉任何一个 element 都会被删掉。

---

## 加粗（简单，`str_replace` 直接搞定）

如果只需要加粗，用 `str_replace` 即可，一步完成：

```bash
lark-cli docs +update --api-version v2 \
  --doc <token> \
  --command str_replace \
  --pattern "意思表示真实" \
  --content '<b>意思表示真实</b>' \
  --revision-id -1 \
  --as user
```

> **注意：**
> - `str_replace` 是全文替换，如果同一词语在多处出现会全部标记
> - 如需标记单个特定位置，用更长前缀+后缀做 `--pattern` 确保唯一性
> - `--revision-id -1` 表示使用最新版本
> - 标记操作不可逆，建议先备份或用批注方式标记不确定的内容

---

## 示例

```bash
# 黄底高亮「犯罪」（默认）
/law-highlight https://lawyerch.feishu.cn/docx/xxx "犯罪"

# 黄底高亮「故意犯罪」
/law-highlight https://lawyerch.feishu.cn/docx/xxx "故意犯罪"

# 仅加粗「意思表示真实」
/law-highlight https://lawyerch.feishu.cn/docx/xxx "意思表示真实" --style bold
```
