# Markdown 转微信公众号排版工具

将 Markdown 文档转换为微信公众号编辑器兼容的 HTML 排版，支持多种专业主题风格。

## 目录

- [功能特点](#功能特点)
- [快速开始](#快速开始)
- [CLI 命令](#cli-命令)
- [主题系统](#主题系统)
- [Markdown Frontmatter](#markdown-frontmatter)
- [主题配置（JSON）](#主题配置json)
- [目录结构](#目录结构)

## 功能特点

- ✅ **纯内联样式**，完美兼容微信公众号编辑器
- ✅ **18+ 专业主题**，包括法律商务、春日清新、秋日温暖、赛博朋克等
- ✅ **双模式支持**：
  - 内置主题（无需配置，直接使用）
  - 自定义 JSON 主题配置（完全自定义配色和样式）
- ✅ **自动颜色对比度优化**，确保文字清晰可读
- ✅ **AI 主题风格**，参考 md2wechat-skill 的专业排版
- ✅ **模块化架构**，易于扩展新功能

## 快速开始

### 方式一：使用内置主题（推荐）

```bash
# 基础转换（使用默认 legal 主题）
node .trae/skills/md-to-wechat/scripts/cli.js converter convert input.md -o output.html

# 指定主题
node .trae/skills/md-to-wechat/scripts/cli.js converter convert input.md --theme spring-fresh -o output.html

# 查看所有可用主题
node .trae/skills/md-to-wechat/scripts/cli.js converter themes
```

### 方式二：使用自定义 JSON 配置（兼容旧版）

```bash
# 使用旧的 convert.js 脚本
node .trae/skills/md-to-wechat/scripts/convert.js input.md output.html --config config.json
```

### 复制到公众号

1. 打开生成的 `output.html` 文件
2. 全选并复制内容
3. 粘贴到微信公众号编辑器

## CLI 命令

### 转换命令

```bash
md2wechat converter convert <input-file> [options]

Options:
  --theme <name>    指定主题名称（默认: legal）
  -o, --output <file>  输出文件路径（默认: 输出到控制台）

Examples:
  # 使用春日清新主题
  node .trae/skills/md-to-wechat/scripts/cli.js converter convert article.md --theme spring-fresh -o article.html

  # 使用赛博朋克主题
  node .trae/skills/md-to-wechat/scripts/cli.js converter convert article.md --theme cyber -o article.html
```

### 查看主题列表

```bash
node .trae/skills/md-to-wechat/scripts/cli.js converter themes
```

输出示例：
```
📋 可用主题列表:

  legal           - 法律商务
  minimal         - 简约现代
  academic        - 学术严谨
  tech            - 科技现代
  warm            - 温暖人文
  spring-fresh    - 春日清新
  autumn-warm     - 秋日温暖
  ocean-calm      - 海洋宁静
  cyber           - 赛博朋克
  ...

共 18 个主题
```

## 主题系统

### 内置主题分类

| 类别 | 主题名称 | 描述 |
|------|----------|------|
| **专业商务** | `legal` | 法律商务风格（默认） |
| | `academic` | 学术严谨风格 |
| | `tech` | 科技现代风格 |
| | `minimal` | 简约现代风格 |
| **自然季节** | `spring-fresh` | 春日清新（绿色调） |
| | `autumn-warm` | 秋日温暖（橙色调） |
| | `ocean-calm` | 海洋宁静（蓝色调） |
| **特色风格** | `cyber` | 赛博朋克（霓虹效果） |
| | `chinese` | 中式传统 |
| | `elegant-gold` | 优雅金色 |
| | `bytedance` | 字节跳动风格 |
| | `sports` | 运动活力 |

### 主题特点

- **春日清新** (`spring-fresh`): 淡绿背景，白色卡片，点状纹理，❀ 符号标题
- **秋日温暖** (`autumn-warm`): 暖白背景，方格纹理，▶ 符号标题
- **海洋宁静** (`ocean-calm`): 淡蓝背景，点状纹理，◆ 符号标题
- **赛博朋克** (`cyber`): 黑色背景，霓虹发光边框，▸ 符号标题

## Markdown Frontmatter

在 Markdown 文件顶部添加 YAML frontmatter 来设置文章元数据：

```markdown
---
title: 文章标题
subtitle: 副标题
author: 作者名称
date: 2026-05-24
---

# 正文开始

正文内容...
```

### Frontmatter 字段

| 字段 | 说明 | 示例 |
|------|------|------|
| `title` | 文章主标题 | `title: 我的文章` |
| `subtitle` | 副标题 | `subtitle: 第一篇` |
| `author` | 作者名称 | `author: 张三` |
| `date` | 发布日期 | `date: 2026-05-24` |

### 示例 Markdown 文件

```markdown
---
title: 春日赏花指南
subtitle: 发现身边的美丽
author: 园艺爱好者
---

# 引言

春天是赏花的最佳季节，让我们一起探索城市中的花海。

## 樱花季

**樱花**是春天最具代表性的花卉之一。

> 樱花的花期通常在3月下旬到4月上旬。

### 推荐地点

- 中山公园
- 武汉大学
- 顾村公园

### 注意事项

1. 提前预约门票
2. 避开周末高峰
3. 带上相机

---

**结语**

愿你在春日里找到属于自己的美好！
```

## 主题配置（JSON）

> ⚠️ **注意**：JSON 配置方式兼容旧版，但推荐使用新的内置主题系统。

### 完整配置示例

```json
{
  "subtitle": "第一篇",
  "author": "作者名称",
  "date": "2026年2月2日",
  "logo": "品牌名称",
  "slogan": "品牌标语",
  "navLinks": ["文章", "产品", "资讯", "简报"],
  "brandColor": "#c41e3a",
  "accentColor": "#1e5aa8",
  "leadColor": "#c9a227",
  "textColor": "#333333",
  "secondaryColor": "#666666"
}
```

### 配置项说明

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `subtitle` | string | - | 副标题 |
| `author` | string | - | 作者名称 |
| `date` | string | - | 发布日期 |
| `logo` | string | - | 品牌Logo文字 |
| `slogan` | string | - | 品牌标语 |
| `navLinks` | array | [] | 导航链接数组 |
| `brandColor` | string | `#c41e3a` | 品牌主色 |
| `accentColor` | string | `#1e5aa8` | 强调色 |
| `leadColor` | string | `#c9a227` | 导语金色 |
| `textColor` | string | `#333333` | 正文颜色 |
| `secondaryColor` | string | `#666666` | 次要文字颜色 |

## 目录结构

```
.trae/skills/md-to-wechat/
├── README.md                 # 本说明文档
├── SKILL.md                  # Skill 元数据
├── DEVELOPMENT.md            # 开发文档
├── scripts/
│   ├── cli.js               # CLI 入口
│   ├── convert.js           # 旧版转换脚本（兼容）
│   ├── generate-all-themes.js  # 生成所有主题测试文件
│   ├── check-theme-contrast.js # 对比度检查工具
│   └── compare-with-md2wechat.js # 与 md2wechat-skill 对比
├── modules/
│   └── converter/
│       ├── index.js         # 转换器核心
│       └── themes/
│           ├── design-system.js    # 设计系统（AI 主题样式）
│           ├── legal.json          # 法律商务主题
│           ├── spring-fresh.json   # 春日清新主题
│           └── ...                 # 其他主题
└── example/
    ├── sample.md            # 示例 Markdown
    └── theme-*.html         # 生成的主题测试文件
```

## 常见问题

### Q: 新旧版本有什么区别？

**新版（推荐）**：
- 使用 `cli.js` 入口
- 支持 18+ 内置主题
- 自动优化颜色对比度
- 支持 AI 风格排版

**旧版（兼容）**：
- 使用 `convert.js` 入口
- 需要 JSON 配置文件
- 样式较简单

### Q: 如何选择合适的主题？

根据文章内容和受众选择：
- **商务/法律文章**：`legal`, `academic`, `minimal`
- **生活方式/自然**：`spring-fresh`, `autumn-warm`, `ocean-calm`
- **科技/互联网**：`tech`, `cyber`, `bytedance`
- **传统文化**：`chinese`, `elegant-gold`

### Q: 生成的 HTML 在公众号编辑器中样式错乱？

1. 确保使用的是**纯内联样式**（本工具已自动处理）
2. 不要在公众号编辑器中再添加样式
3. 直接粘贴 HTML 内容，不要粘贴到富文本编辑器

### Q: 可以自定义新主题吗？

可以！参考 `modules/converter/themes/design-system.js` 添加新的设计系统配置。
