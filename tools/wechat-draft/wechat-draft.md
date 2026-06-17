---
name: wechat-draft
description: 将 HTML 内容发布为微信公众号草稿，自动处理图片上传
tags: [publish, wechat, draft]
requires: [python3, coze_workload_identity]
scripts: [scripts/wechat-draft.py]
---

# /wechat-draft — 微信公众号草稿发布

将排版好的 HTML 内容一键推送为微信公众号草稿，自动下载图片 → 上传到微信 → 替换 URL → 创建草稿。

```
python3 tools/wechat-draft/scripts/wechat-draft.py publish-draft \
  --title "标题" \
  --html path/to/article.html \
  [--author "作者"] \
  [--digest "摘要"]
```

---

## 子命令

| 命令 | 功能 |
|------|------|
| `publish-draft` | 发布 HTML 为微信公众号草稿 |
| `list-drafts` | 查看草稿箱列表 |
| `delete-draft --media-id ID` | 删除草稿 |
| `test-token` | 测试 token 获取是否正常 |

---

## publish-draft 流程

1. 从自定义接口获取 access_token
2. 提取 HTML 中所有 `<img src="...">` 图片 URL
3. 逐张下载图片 → 上传到微信
   - 正文图：`uploadimg` 接口 → 返回微信内部 URL
   - 封面图（第一张）：`add_material` 接口 → 返回 media_id
4. 替换 HTML 中的原始图片 URL 为微信 URL
5. 调用 `draft/add` 创建草稿

### 图片处理说明

- 自动将非 JPEG/PNG 格式（如 JFIF）转为 JPEG
- 超过 1MB 的图片自动跳过
- 已下载的图片有本地缓存，不会重复请求
- 微信会**过滤外部图片 URL**，所以所有图片必须先上传到微信

### 字段限制

| 字段 | 微信限制 | 脚本处理 |
|------|----------|----------|
| title | 32 字 | 用户传入 |
| author | 8 字 | 自动截断 |
| digest | 120 字 | **必须由 AI 生成**，要吸引用户点击阅读，不传则微信自动抓取前54字 |
| content | 2 万字符 <1MB | 用户传入 |

---

## 参数

```bash
python3 tools/wechat-draft/scripts/wechat-draft.py publish-draft \
  --title "文章标题"           # 必填
  --html "path/to/file.html"   # 必填，HTML 文件路径
  --author "陈恒"              # 可选，作者（≤8字）
  --digest "摘要文字"          # 可选，不填则自动提取
  --cover-image "URL"          # 可选，封面图 URL（默认用第一张正文图）
  --content-source-url "URL"   # 可选，阅读原文链接
  --token-url "URL"            # 可选，自定义 token 接口
  --config "@path/to/config.json"  # 可选，配置文件
```

---

## 配置文件（可选）

可以通过 JSON 配置文件传入参数，避免每次命令行重复：

```json
{
  "token_url": "https://your-token-endpoint/...",
  "author": "陈恒",
  "cover_image": "https://example.com/cover.jpg"
}
```

使用：`--config @tools/wechat-draft/config.json`

---

## 与 law-news 联动

完整工作流：law-news 抓取资讯 → md-to-wechat 生成排版 HTML → wechat-draft 推送草稿

```bash
# 步骤 1-4：law-news 抓取、筛选、编译（详见 law-news.md）
# 假设已生成 HTML：
# tools/law-news/cache/exports/2026-06-13_法律资讯简报_2026-06-13_spring-fresh.html

# 步骤 5：推送为微信公众号草稿
python3 tools/wechat-draft/scripts/wechat-draft.py publish-draft \
  --title "法律资讯简报 2026-06-13" \
  --html "tools/law-news/cache/exports/2026-06-13_法律资讯简报_2026-06-13_spring-fresh.html" \
  --author "陈恒"
```

---

## 缓存目录

```
tools/wechat-draft/
├── wechat-draft.md           ← 本文档
├── scripts/
│   └── wechat-draft.py       ← Python 脚本
└── cache/
    └── images/               ← 下载的图片缓存
        ├── a1b2c3d4e5f6.jpg
        └── ...
```

---

## 注意事项

- **图片必须来自微信**：微信公众号会过滤所有外部图片 URL，脚本自动处理上传和替换
- **Token 接口**：使用自定义 token 接口绕过微信 IP 白名单限制
- **封面图**：微信要求草稿必须有 `thumb_media_id`（永久素材 ID），脚本自动用第一张正文图作为封面
- **图片格式**：仅支持 JPG/PNG，JFIF 等格式会自动转换
- **图片大小**：uploadimg 限制 1MB 以下
