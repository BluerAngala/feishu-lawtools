---
name: law-news
description: 获取法律资讯，整理为文章
tags: [fetch, transform]
requires: [lark-cli, python3]
scripts: [scripts/law-news.py]
---

# /law-news — 法律资讯获取

从资讯源获取法律新闻，自动整理为格式化的 markdown 稿件，同步到飞书知识库。

```
/law-news cctv-law [--days 3] [--max 10] [--style 简报|深度|专题]
```

---

## 设计理念

**脚本做实事，AI 只做判断和编排。**

- 脚本负责：抓取 → 解析 → 缓存 → 排版 → 存盘
- AI 负责：浏览索引 → 判断选哪些 → 指定风格 → 触发发布
- 所有交付物是 **文件路径**，AI `read` 即可，无需在上下文中拼接 markdown/XML

---

## 子命令总览

| 命令 | 功能 | 交付物 |
|------|------|--------|
| `fetch` | 获取资讯列表，生成索引文档 | `.md` 文件路径 |
| `fetch-article` | 获取单篇全文正文，生成文章文档 | `.md` 文件路径 |
| `compile` | 多篇文章按风格汇编为最终稿件 | `.md` 文件路径 |
| `publish` | 发布 markdown 为飞书文档 | `✅ 飞书 URL` |
| `list-cache` | 查看已缓存的数据 | 终端列表 |

所有数据自动缓存到 `tools/law-news/cache/`，无需重复请求，随时可追溯核查。

---

## 脚本工具

```bash
# ① 获取新闻列表 → 返回 .md 路径
tools/law-news/scripts/law-news.py fetch cctv-law --days 3 --max 10
# ← tools/law-news/cache/exports/2026-06-13_cctv-law_索引.md

# ② 获取单篇文章全文 → 返回 .md 路径
tools/law-news/scripts/law-news.py fetch-article <url>
# ← tools/law-news/cache/articles/ARTIxxx.md

# ③ 汇编最终稿件 → 返回 .md 路径
tools/law-news/scripts/law-news.py compile \
  --articles "ARTIxxx,ARTIyyy" \
  --style 简报 \
  --title "法律资讯简报 2026-06-13"
# ← tools/law-news/cache/exports/2026-06-13_法律资讯简报_2026-06-13.md

# ④ 发布到飞书
tools/law-news/scripts/law-news.py publish \
  tools/law-news/cache/exports/2026-06-13_法律资讯简报_2026-06-13.md \
  --title "法律资讯简报 2026-06-13" [--wiki <space_id>]
# ← ✅ https://...
```

---

## 数据目录结构

```
tools/law-news/
├── law-news.md                    ← skill 文档
├── scripts/law-news.py            ← 脚本
└── cache/                         ← 由 LAW_NEWS_DIR 控制
    ├── raw/
    │   └── cctv-law/
    │       └── 2026-06-13.json    ← fetch 原始 API 响应
    ├── articles/
    │   ├── ARTIxxx.json           ← fetch-article 原始 JSON
    │   └── ARTIxxx.md             ← fetch-article 排版后 .md
    └── exports/
        ├── 2026-06-13_cctv-law_索引.md  ← fetch 生成的索引
        └── 2026-06-13_法律资讯简报.md    ← compile 生成的稿件
```

- 缓存目录默认 `tools/law-news/cache/`，环境变量 `LAW_NEWS_DIR` 可覆盖
- `list-cache` 随时查看所有缓存

---

## 数据字段

### fetch — JSON 字段（存于 `raw/<source>/<date>.json`）

| 字段 | 类型 | 说明 |
|------|------|------|
| `source` | string | `cctv-law` |
| `count` | number | 本次返回条数 |
| `items` | array | 新闻列表 |
| ↳ `title` | string | 标题 |
| ↳ `date` | string | `"YYYY-MM-DD HH:mm:ss"` |
| ↳ `url` | string | 原文链接 |
| ↳ `brief` | string | 摘要（**仅筛选用**，`fetch-article` 拿正文） |
| ↳ `image` | string | 首张配图 URL |
| ↳ `image2` | string | 第二张配图 URL |
| ↳ `image3` | string | 第三张配图 URL |
| ↳ `keywords` | string[] | 关键词列表 |

#### fetch → 索引 .md 示例

```markdown
# 央视网法治新闻 · 资讯列表

获取时间: 2026-06-13T07:30:00+0800
> 共 8 条 | 原始数据: tools/law-news/cache/raw/cctv-law/2026-06-13.json

## 1. 当事人以微信朋友圈、私聊推销商品 监管部门罚2万元

- **日期**: 2026-06-13 07:12:43
- **摘要**: 6月12日，四川眉山市市场监督管理局通报了…
- **关键词**: 微信、当事人、虚假宣传、反不正当竞争法
- **原文**: https://news.cctv.com/...
```

---

### fetch-article — JSON 字段（存于 `articles/<id>.json`）

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | string | 标题 |
| `url` | string | 原文链接 |
| `date` | string | 发布日期（URL 提取） |
| `content` | string | 纯净正文，**远多于 brief**，典型 800-1700 字 |
| `content_html` | string | 原始 HTML（备查） |
| `images` | string[] | 正文内嵌图片 URL |
| `keywords` | string[] | 关键词 |
| `cached_at` | string | 缓存时间 |

#### fetch-article → 文章 .md 示例

```markdown
# 当事人以微信朋友圈、私聊推销商品 监管部门罚2万元

**来源**: 央视网 | 2026-06-13 | [原文链接](https://news.cctv.com/...)

6月12日，四川眉山市市场监督管理局通报了…

【基本案情】自2025年4月2日起…

【本案焦点】宋某某认为自己未直接向消费者销售…

---

*缓存: tools/law-news/cache/articles/ARTIQ0IPGdzmEUmdemWnY5nJ260613.json*
```

---

## compile 风格

| 风格 | 说明 |
|------|------|
| **简报** | 每条 1-2 段 + 日期 + 核心要点。适合日常推送 |
| **深度** | 全文保留 + 编者按。适合重要判例/法规解读 |
| **专题** | 文章按顺序排列，每篇完整保留。适合系列报道 |

---

## AI 工作流（完整示例）

```bash
# ===== 第 1 步：获取新闻列表 =====
fetch_path=$(tools/law-news/scripts/law-news.py fetch cctv-law --days 3)
# ← tools/law-news/cache/exports/2026-06-13_cctv-law_索引.md

# AI read 该文件，浏览标题和摘要，选出有价值的 2-3 条
# → 选中: url1, url2

# ===== 第 2 步：获取全文 =====
tools/law-news/scripts/law-news.py fetch-article "$url1"
tools/law-news/scripts/law-news.py fetch-article "$url2"
# ← tools/law-news/cache/articles/ARTIxxx.md
# ← tools/law-news/cache/articles/ARTIyyy.md

# ===== 第 3 步：汇编稿件 =====（脚本完成排版，AI 不拼接 markdown）
news_path=$(tools/law-news/scripts/law-news.py compile \
  --articles "ARTIxxx,ARTIyyy" \
  --style 简报 \
  --title "法律资讯简报 $(date +%Y-%m-%d)")
# ← tools/law-news/cache/exports/2026-06-13_法律资讯简报.md

# ===== 第 4 步：发布到飞书 =====
tools/law-news/scripts/law-news.py publish "$news_path" \
  --title "法律资讯简报 $(date +%Y-%m-%d)"
# ← ✅ https://...
```

### AI 职责清单

1. **运行 `fetch`** → `read` 返回的索引 `.md`，判断选哪些文章
2. **运行 `fetch-article`** 获取选中文章的正文 `.md`
3. **运行 `compile`** 指定文章 ID 列表和风格 → 脚本自动排版，返回稿件路径
4. **运行 `publish`** 发布稿件路径到飞书

全程 AI **不需要**：
- 拼接 markdown 格式（`compile` 完成）
- 生成 XML（`publish` 完成）
- 管理缓存路径（脚本自动处理）

---

## 支持的信息源

| 标识 | 名称 | API |
|------|------|------|
| `cctv-law` | 央视网法治新闻 | 脚本内封装 |

扩展新源：在 `scripts/law-news.py` 添加 `fetch_<name>()` 函数即可。

### 新源函数约定

```python
def fetch_mysource(days: int, max_items: int) -> dict:
    """返回字典，格式同 fetch JSON 字段表"""
```

- 返回的字典字段必须与 `fetch JSON 字段表` 一致
- 主流程负责缓存、`list-cache` 和 `.md` 生成
