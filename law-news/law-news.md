---
name: law-news
description: 获取法律资讯，整理为文章
tags: [fetch, transform]
requires: [lark-cli, curl, python3]
scripts: [scripts/law-news.sh]
---

# /law-news — 法律资讯获取

从资讯源获取法律新闻，整理为文章，同步到飞书知识库。

```
/law-news <source> [--days 3] [--max 10] [--style 简报|深度|专题]
```

## 脚本工具

机械操作（API 调用、JSONP 解析、文档创建）由脚本完成：

```bash
# ① 获取新闻列表（输出 JSON）
law-news/scripts/law-news.sh fetch cctv-law --days 3 --max 10 > /tmp/news.json

# ② 发布 markdown → 飞书文档
law-news/scripts/law-news.sh publish article.md --title "法律资讯简报 2026-06-13" [--wiki <space_id>]
```

## AI 负责的部分

1. 读取 `/tmp/news.json`，筛选有价值的新闻
2. 对有需要的条目，通过 `WebFetch` 获取全文
3. 按 `--style` 生成 markdown 文章（见下方格式要求）
4. 保存到临时文件，调用 `publish` 发布

## 输出格式

文章使用 markdown，脚本自动转换为飞书 XML：

```markdown
## 一级标题

### 二级标题

正文段落...

**加粗重点**

来源：央视新闻 2026-06-13
```

## 支持的信息源

| 标识 | 名称 | API |
|------|------|-----|
| `cctv-law` | 央视网法治新闻 | 脚本内封装 |

扩展新源：在 `law-news/scripts/law-news.sh` 的 `fetch_*()` 函数中添加即可。

## 示例

```bash
/law-news cctv-law --days 3 --max 10 --style 简报
→ 脚本输出 JSON → AI 筛选 → 生成 10 条简报 → 发布到飞书
```
