---
name: "md-to-wechat"
description: "将 Markdown 转换为微信公众号排版格式的 HTML，支持专业法律/商务风格排版。Invoke when user wants to convert markdown to WeChat article format, needs WeChat official account styling, or asks for 公众号排版."
---

# Markdown 转公众号排版

将 Markdown 文档转换为适合微信公众号发布的 HTML 排版，支持专业法律/商务风格。

## 功能特点

- 自动转换 Markdown 为微信公众号兼容的 HTML
- 支持专业法律/商务风格排版（参考兰迪律师事务所风格）
- 包含导语区块、章节标题、正文段落等样式
- 支持自定义配色和品牌元素
- 生成可直接复制到公众号编辑器的 HTML 代码

## 使用方法

### 命令行使用

```bash
# 转换单个 Markdown 文件
node .trae/skills/md-to-wechat/scripts/convert.js input.md output.html

# 使用自定义配置
node .trae/skills/md-to-wechat/scripts/convert.js input.md output.html --config config.json
```

### 配置选项

创建 `config.json` 文件来自定义样式：

```json
{
  "title": "文章标题",
  "subtitle": "副标题",
  "author": "作者名称",
  "brandColor": "#c41e3a",
  "accentColor": "#1e5aa8",
  "headerImage": "https://example.com/banner.jpg",
  "logo": "https://example.com/logo.png",
  "slogan": "品牌标语",
  "navLinks": ["文章", "产品", "资讯", "简报"],
  "hasLead": true,
  "leadTitle": "导语"
}
```

## 支持的 Markdown 语法

- `# 标题` - 主标题（红色大标题）
- `## 副标题` - 副标题
- `> 导语内容` - 导语区块（大号艺术字样式）
- `### 章节` - 章节标题（蓝色链接样式）
- **加粗** - 重点强调
- *斜体* - 次要强调
- [链接](url) - 蓝色链接
- 普通段落 - 两端对齐正文

## 排版样式说明

### 主标题样式
- 字体：大号加粗
- 颜色：品牌主色（默认深红色 #c41e3a）
- 居中对齐

### 导语样式
- 大号"导语"艺术字
- 金色/橙色渐变效果
- 正文段落首行缩进

### 章节标题
- 蓝色链接样式
- 第一篇、第二篇等格式

### 正文样式
- 两端对齐
- 1.8 倍行距
- 段落间距 1em
- 首行缩进 2 字符

## 示例

输入 Markdown：
```markdown
# 兰迪广州刑事团队2025年成绩单（一）

> 2025年，对于兰迪广州刑事团队而言，是深耕专业、战果辉煌的一年...

### 第一篇：网络犯罪辩护及合规服务与商事犯罪辩护

本年度，我们成功办理了多起具有全国影响力的重大案件...
```

输出效果：
- 红色大标题
- 金色"导语"艺术字 + 引言段落
- 蓝色章节链接
- 专业正文排版
