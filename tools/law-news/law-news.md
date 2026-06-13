---
name: law-news
description: 获取法律资讯，整理为文章
tags: [fetch, transform]
requires: [lark-cli, python3, requests]
scripts: [scripts/law-news.py]
---

# /law-news — 法律资讯获取

从资讯源获取法律新闻，自动整理为格式化的 markdown 稿件，同步到飞书知识库。

```
/law-news cctv-law [--days 3] [--max 10] [--style 简报|深度|专题]
```

---

## ⚠️ 首次使用：必读

**`compile` 命令的「律师说」评论块需要一份个人档案配置。** 在使用前：

1. 复制示例配置：
   ```bash
   cp tools/law-news/lawyer-profile.example.json tools/law-news/lawyer-profile.json
   ```
2. 编辑 `tools/law-news/lawyer-profile.json`，填你自己的：
   - `label`：评论块标题（如「陈律师说」「XX 团队解读」）
   - `signature`：简短署名（格式「姓名 · 律所」，如「陈恒 · XX 律师事务所」）
   - `style_prompt`：风格提示词，**给 AI 自己看的**，告诉它写评论的角度、风格、不要写成什么。**重要：必须包含划重点要求**——核心关键词、法条、处罚后果用 `**加粗**` 标记，渲染后为红色加粗
3. 调用时传 `--lawyer-profile @tools/law-news/lawyer-profile.json`

不传这个参数，「律师说」评论块依然能写（AI 自己生成内容），只是无署名 + 默认 label「律师说」。

> 示例配置已用 `.gitignore` 排除个人档案，用户自己填的 `lawyer-profile.json` 不会被提交。`.example.json` 留作参考。

---

## 设计理念

**脚本做实事，AI 只做判断和编排。**

- 脚本负责：抓取 → 解析 → 缓存 → 排版 → 存盘 → 配图尺寸自适应
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
| `publish-wechat` | 🔥 一键联动：抓取 → 汇编 → 公众号 HTML | `.md` + `.html` 路径 |
| `list-cache` | 查看已缓存的数据 | 终端列表 |

> `compile` 支持 `--wechat [theme]` 参数，在生成 markdown 的同时自动生成微信公众号 HTML。参见下方「公众号联动」章节。

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

# ③ 可选：汇编同时生成公众号 HTML
tools/law-news/scripts/law-news.py compile \
  --articles "ARTIxxx,ARTIyyy" \
  --style 简报 \
  --title "法律资讯简报 2026-06-13" \
  --wechat spring-fresh
# ← tools/law-news/cache/exports/2026-06-13_法律资讯简报.md
# ← tools/law-news/cache/exports/2026-06-13_法律资讯简报_spring-fresh.html

# ④ 发布到飞书（自动缩放配图、等比不变形）
tools/law-news/scripts/law-news.py publish \
  tools/law-news/cache/exports/2026-06-13_法律资讯简报_2026-06-13.md \
  --title "法律资讯简报 2026-06-13" [--wiki <space_id>]
# ← ✅ https://...

# ⑤ 一键联动：抓取 → 汇编 → 公众号 HTML（2 条命令直达公众号）
tools/law-news/scripts/law-news.py publish-wechat cctv-law \
  --max 5 --theme spring-fresh --style 简报
# ← tools/law-news/cache/exports/...md
# ← tools/law-news/cache/exports/...html

# ⑥ 核查缓存
tools/law-news/scripts/law-news.py list-cache
```

---

## 数据目录结构

```
tools/law-news/
├── law-news.md                       ← skill 文档
├── scripts/law-news.py               ← Python 脚本（仅标准库）
├── cache/                            ← 由 LAW_NEWS_DIR 控制（默认 tools/law-news/cache/）
│   ├── raw/
│   │   └── cctv-law/
│   │       └── 2026-06-13.json       ← fetch 原始 API 响应
│   ├── articles/
│   │   ├── ARTIxxx.json              ← fetch-article 原始 JSON
│   │   └── ARTIxxx.md                ← fetch-article 排版后 .md
│   └── exports/
│       ├── 2026-06-13_cctv-law_索引.md  ← fetch 生成的索引
│       └── 2026-06-13_法律资讯简报.md    ← compile 生成的稿件
├── lawyer-profile.example.json       ← 用户配置示例（git 提交）
└── lawyer-profile.json               ← 用户实际配置（git 忽略）
```

- 缓存目录默认 `tools/law-news/cache/`，环境变量 `LAW_NEWS_DIR` 可覆盖
- `lawyer-profile.json` 在 `.gitignore` 排除，不会被提交
- `list-cache` 随时查看所有缓存，支持按来源筛选

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
| `images` | string[] | 正文内嵌图片 URL（央视网正文图片通常为空，缩略图走 `image`） |
| `image` | string | 资讯列表中的主图（从 raw 缓存查找回填） |
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
| **简报** | 每条结构：标题（点击跳转原文）→ 配图 → 摘要（前两句）→ 引用块（日期/来源/原文链接） |
| **深度** | 全文保留，文章间以 `---` 分隔 |
| **专题** | 文章按顺序排列，每篇完整保留 |

### 简报输出结构（已实测验证）

```markdown
## [1. 标题](原文链接)

![](配图URL)

正文摘要（首两句）

> 日期：2026-06-13
> 来源：央视网
> 原文链接：[https://news.cctv.com/...](原文URL)
```

- 标题是**可点击链接**（`<h1><a href="url">标题</a></h1>`）
- 配图是**居中块**（飞书自动 `<img>` 块渲染）
- 摘要紧跟图片（首 2 句 `。` `！` `？` 切分）
- 可选：摘要下插入 `**律师说**` 评论（1-2 句律师角度解读，详见下一节）
- 底部三项走**引用块样式**（`<blockquote>`），信息分类清晰

---

## 「律师说」评论（可选）

为增强专业感，每条摘要下可加一段 1-2 句的「律师说」评论，AI 视角生成。

### 1. 准备个人档案

```bash
cp tools/law-news/lawyer-profile.example.json tools/law-news/lawyer-profile.json
# 编辑：填入你的姓名、律所、风格提示
```

`lawyer-profile.json` 字段：

| 字段 | 必填 | 说明 |
|------|------|------|
| `label` | 否 | 评论块标题（默认「律师说」），如「陈律师说」 |
| `signature` | 否 | 简短署名（格式「姓名 · 律所」），如「陈恒 · XX 律师事务所」 |
| `style_prompt` | 否 | 风格提示词，**给 AI 自己看的**，告诉它写评论的角度和风格。**必须包含划重点要求**——核心信息用 `**加粗**` 标记 |

不传 `signature` 就不显示署名，只显示评论内容。点到即止，不带联系方式、不带服务介绍。

### 2. 准备评论内容（JSON 文件）

```json
{
  "ARTIQ0IPGdzmEUmdemWnY5nJ260613": "做私域带货的朋友注意：你以为朋友圈是私人分享，但只要涉及持续引流+获利，监管眼里就是经营行为。建议把营销素材先发我审一遍，能避开 90% 的坑。",
  "ARTIxxx": "另一条评论……"
}
```

### 3. 调用

```bash
python3 tools/law-news/scripts/law-news.py compile \
  --articles "ARTIxxx,ARTIyyy" \
  --style 简报 \
  --lawyer-comments "@/tmp/comments.json" \
  --lawyer-profile "@tools/law-news/lawyer-profile.json"
```

输出示例：

```markdown
正文摘要（首两句）

**陈律师说**：做私域带货、朋友圈卖货的朋友注意……
—— 陈恒 · XX 律师事务所

> 日期：2026-06-13
> 来源：央视网
> 原文链接：[...]
```

- 评论 JSON 支持 inline 字符串：`--lawyer-comments '{"ID1":"...","ID2":"..."}'`
- 配置文件同理：`@/path/to/file.json` 或 inline 字符串
- **不传 `--lawyer-comments` 就不输出「律师说」块**，可选用

---

## 配图尺寸自适应

**关键问题**：央视网图片宽高不一（实测 273×154 到 1024×576），用固定 `width`/`height` 飞书会**忽略**（标准化为 `scale`）。

**解决方案**：`publish` 时先用纯标准库读 PNG/JPEG/GIF/WebP 的 header 拿到原宽高，再计算 `scale = 600 / orig_w`（可超过 1.0），输出 `<img scale="..." href="..."/>`。

```xml
<!-- 332px 宽小图：放大到 600px，scale=1.81 -->
<img scale="1.8072" href="https://..." />

<!-- 1024px 宽大图：缩到 600px，scale=0.59 -->
<img scale="0.5859" href="https://..." />
```

- 飞书自动抓取 URL 上传到自家 CDN
- `scale` 支持 > 1.0（实测可用），小图也能放大到统一视觉尺寸
- 结果：**多图视觉等大、不变形、不模糊**

---

## 飞书简化 XML 转换（publish 内部）

| 源（markdown） | 目标（XML） | 行为 |
|---------------|------------|------|
| `## [标题](url)` | `<h1><a href="url">标题</a></h1>` | 可点击标题 |
| `## 标题` | `<h1>标题</h1>` | 普通标题 |
| `### 标题` | `<h2>标题</h2>` | 二级标题 |
| `![](url)` / 纯 URL 图片行 | `<img scale="..." href="url"/>` | 自动上传 + 自适应 |
| `> 单行` / `> 多行` | `<blockquote><p>...</p>...</blockquote>` | 块级引用 |
| `**粗体**` | `<b>粗体</b>` | 内联粗体 |
| `[文本](url)` | `<a href="url">文本</a>` | 内联链接 |
| `*斜体*` | `（删除标记）` | 飞书简化 XML 不支持斜体 |
| `---` | （空行） | 飞书无水平线，去掉 |
| `# 标题` | （跳过） | 文档标题已通过 `--title` 传递 |

---

## AI 工作流（完整示例）

```bash
# ===== 第 1 步：获取新闻列表 =====
fetch_path=$(tools/law-news/scripts/law-news.py fetch cctv-law --days 3)
# ← tools/law-news/cache/exports/2026-06-13_cctv-law_索引.md

# AI read 该文件，浏览标题和摘要，选出有价值的条目
# → 选中: url1, url2, url3

# ===== 第 2 步：获取全文 =====
tools/law-news/scripts/law-news.py fetch-article "$url1"
tools/law-news/scripts/law-news.py fetch-article "$url2"
tools/law-news/scripts/law-news.py fetch-article "$url3"
# ← tools/law-news/cache/articles/ARTIxxx.md
# ← tools/law-news/cache/articles/ARTIyyy.md
# ← tools/law-news/cache/articles/ARTIzzz.md

# ===== 第 3 步（可选）：生成「律师说」评论 =====
# AI 读自己配置风格 (tools/law-news/lawyer-profile.json) 和每篇正文
# 输出 JSON 文件：{"ID1":"评论...","ID2":"评论..."}，写到 /tmp/comments.json

# ===== 第 4 步：汇编稿件 =====（脚本完成排版，AI 不拼接 markdown）
news_path=$(tools/law-news/scripts/law-news.py compile \
  --articles "ARTIxxx,ARTIyyy,ARTIzzz" \
  --style 简报 \
  --title "法律资讯简报 $(date +%Y-%m-%d)" \
  --lawyer-comments "@/tmp/comments.json" \
  --lawyer-profile "@tools/law-news/lawyer-profile.json")
# ← tools/law-news/cache/exports/2026-06-13_法律资讯简报.md

# ===== 第 5 步：发布到飞书 =====（自动处理配图缩放）
tools/law-news/scripts/law-news.py publish "$news_path" \
  --title "法律资讯简报 $(date +%Y-%m-%d)"
# ← ✅ https://...
```

### 快捷路径：一条命令直达公众号

如果不需要 AI 筛选，直接用 `publish-wechat` 一条命令跑完：

```bash
tools/law-news/scripts/law-news.py publish-wechat cctv-law \
  --max 5 --theme spring-fresh --style 简报
# ← tools/law-news/cache/exports/...md
# ← tools/law-news/cache/exports/...html
```

### AI 职责清单

1. **运行 `fetch`** → `read` 返回的索引 `.md`，判断选哪些文章
2. **运行 `fetch-article`** 获取选中文章的正文 `.md`
3. **（可选）生成「律师说」评论**：参考 `lawyer-profile.json` 的 `style_prompt` 给每条文章写 1-2 句律师视角的解读，存为 JSON 文件
4. **运行 `compile`** 指定文章 ID 列表和风格 → 脚本自动排版，返回稿件路径
5. **（可选）运行 `compile --wechat`** 同时生成微信公众号 HTML
6. **运行 `publish`** 发布稿件路径到飞书

> 快捷选项：不需要筛选时，一条 `publish-wechat` 代替步骤 1→2→4→5

全程 AI **不需要**：
- 拼接 markdown 格式（`compile` 完成）
- 生成 XML（`publish` 完成）
- 算图片缩放（`publish` 内置 `get_image_dimensions` 完成）
- 管理缓存路径（脚本自动处理）

---

## 公众号联动

`compile` 支持 `--wechat [theme]` 参数，在生成 markdown 稿件的同时，自动调用 `tools/md-to-wechat/scripts/cli.js` 生成微信公众号兼容的 HTML 文件。

### 用法

```bash
# 汇编简报，同时生成 WeChat HTML（使用 spring-fresh 主题）
tools/law-news/scripts/law-news.py compile \
  --articles "ARTIxxx,ARTIyyy,ARTIzzz" \
  --style 简报 \
  --title "法律资讯简报 2026-06-13" \
  --wechat spring-fresh
# ← tools/law-news/cache/exports/2026-06-13_法律资讯简报.md
# ← tools/law-news/cache/exports/2026-06-13_法律资讯简报_spring-fresh.html

# 不指定主题，默认 legal
--wechat
# 等价于 --wechat legal
```

### 主题推荐

| 文章类型 | 主题 |
|----------|------|
| 法律资讯简报 | `spring-fresh`（清新专业）、`legal`（权威商务） |
| 深度法律分析 | `academic`（学术严谨）、`minimal`（简约） |
| 行业动态 | `tech`（科技现代）、`warm`（温暖人文） |

### 依赖

`--wechat` 需要 `node` 可用。首次使用前检查：

```bash
node --version
```

如果不可用，请安装 Node.js >= 16：<https://nodejs.org>

### 输出文件

HTML 文件与 markdown 稿件在同一目录（`cache/exports/`），命名规则：`<原文件名>_<主题>.html`。AI 拿到路径后 `read` 该文件确认效果，然后全选复制到公众号编辑器即可。

### 一键联动：publish-wechat

如果不需要 AI 筛选文章，直接抓最新 N 条 → 汇编 → 生成公众号 HTML，一条命令搞定：

```bash
tools/law-news/scripts/law-news.py publish-wechat cctv-law \
  --max 5 --theme spring-fresh --style 简报
# ← tools/law-news/cache/exports/...md
# ← tools/law-news/cache/exports/...html
```

**参数：**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `source` | 信息源标识 | `cctv-law` |
| `--max <n>` | 最大条数（最新 N 条） | `5` |
| `--style <风格>` | 简报/深度/专题 | `简报` |
| `--theme <主题>` | 公众号排版主题 | `legal` |

**内部流程：**
1. `fetch` 获取列表 → 2. `fetch-article` 自动抓取每篇全文（缓存命中跳过） → 3. `compile --wechat` 汇编 + 生成 HTML

**输出（stdout）：**
```
tools/law-news/cache/exports/2026-06-13_央视网简报_2026-06-13.md
tools/law-news/cache/exports/2026-06-13_央视网简报_2026-06-13_spring-fresh.html
```

> 无需 AI 判断的场景用这个（比如固定每天推一期简报）。需要筛选文章的场合，依然分步：`fetch` → AI 看索引 → `fetch-article` → `compile --wechat`。

---

> 更多用法（转换已有飞书文档、独立转换本地 markdown、查看所有主题）请参考 `tools/md-to-wechat/README.md`。

---

## 支持的信息源

| 标识 | 名称 | 文件 |
|------|------|------|
| `cctv-law` | 央视网法治新闻 | `scripts/sources/cctv-law.py` |

每个信息源是一个独立的 Python 文件，放在 `scripts/sources/` 目录下，**自动发现注册**，无需修改主脚本。

### 源脚本接口约定

在 `scripts/sources/` 下创建 `<标识>.py`，必须暴露以下接口：

```python
# 必填：信息源标识和显示名
ID = 'mysource'
NAME = '我的信息源'

# 必填：获取资讯列表
def fetch_list(days: int = 3, max_items: int = 10) -> list:
    """
    返回 list of dict，每项含:
      title, date, url, brief, image, image2, image3, keywords, source
    """
    ...

# 可选：从 URL 提取文章全文
def fetch_article(url: str) -> dict:
    """
    返回 dict，含:
      title, url, date, content, images
    """
    ...

# 可选：从 URL 提取文章 ID（用于缓存和 compile 中的引用）
def article_id_from_url(url: str) -> str or None:
    ...
```

- `fetch_list()` 只需返回列表数据，主脚本负责缓存和索引生成
- 不实现 `fetch_article()` 的信息源，`fetch-article` 命令会自动跳过
- 不实现 `article_id_from_url()` 的信息源，用 URL hash 作为缓存 key

### 实现示例

参考现有 `scripts/sources/cctv-law.py`。源码结构：

```
scripts/
├── law-news.py              ← 编排层：fetch / compile / publish / list-cache
└── sources/
    ├── __init__.py           ← 空文件
    └── cctv-law.py           ← 央视网（示例）
    └── mysource.py           ← 你的新源（新建）
```

新增源只需要在 sources/ 下创建文件，**无需修改 law-news.py 任何代码**。
