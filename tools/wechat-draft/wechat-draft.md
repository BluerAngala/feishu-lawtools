---
name: wechat-draft
description: 将 HTML 内容发布为微信公众号草稿，自动处理图片上传
tags: [publish, wechat, draft]
requires: [python3, requests]
scripts: [scripts/wechat-draft.py]
---

# /wechat-draft — 微信公众号草稿发布

将排版好的 HTML 内容一键推送为微信公众号草稿，自动下载图片 → 上传到微信 → 替换 URL → 创建草稿。

## 首次使用

使用本工具前，你**必须拥有一个微信公众号**（订阅号或服务号），并完成以下配置：

```bash
# 查看完整的配置指引
python3 tools/wechat-draft/scripts/wechat-draft.py show-setup
```

### 配置步骤

**① 登录微信公众号后台**
打开 [https://mp.weixin.qq.com](https://mp.weixin.qq.com)

**② 获取 AppID 和 AppSecret**
开发 → 基本配置 → 查看 AppID / 重置 AppSecret

**③ 配置 IP 白名单**
开发 → 基本配置 → IP 白名单
添加你部署 token 接口的服务器公网 IP。
> 📸 详细操作截图见 `tools/wechat-draft/联系我.jpg`

**④ 部署 access_token 接口**
你需要一个返回 `{"access_token": "..."}` 的 HTTP 接口。
可以用云函数简单实现：

```python
# 示例：Cloud Function 或你自己的服务器
def handle(request):
    appid = request.args['appid']
    secret = request.args['secret']
    # 调用微信 API 获取 token
    # return {"access_token": "xxx"}
```

**⑤ 配置 token_url**
```bash
# 方式一：命令行传入
python3 tools/wechat-draft/scripts/wechat-draft.py test-token \
  --token-url "https://你的域名/api/getToken?appid=...&secret=..."

# 方式二：配置文件（推荐）
cp tools/wechat-draft/wechat-draft.config.example.json tools/wechat-draft/wechat-draft.config.json
# 编辑 wechat-draft.config.json，填入你的 token_url
python3 tools/wechat-draft/scripts/wechat-draft.py test-token \
  --config @tools/wechat-draft/wechat-draft.config.json

# 方式三：环境变量
export WECHAT_TOKEN_URL="https://..."
python3 tools/wechat-draft/scripts/wechat-draft.py test-token
```

---

## 子命令

| 命令 | 功能 |
|------|------|
| `show-setup` | 显示首次使用配置指引 |
| `test-token` | 测试 token 获取是否正常 |
| `publish-draft` | 发布 HTML 为微信公众号草稿 |
| `list-drafts` | 查看草稿箱列表 |
| `delete-draft --media-id ID` | 删除草稿 |

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
  --token-url "URL"            # 必填，token 接口（或用 --config）
  --author "作者"              # 可选（≤8字）
  --digest "摘要"              # 可选
  --cover-image "URL"          # 可选，封面图（默认用第一张正文图）
  --content-source-url "URL"   # 可选，阅读原文链接
  --config "@path/to/config.json"  # 可选，配置文件
```

---

## 配置文件

```bash
cp tools/wechat-draft/wechat-draft.config.example.json tools/wechat-draft/wechat-draft.config.json
```

编辑 `wechat-draft.config.json`：

```json
{
  "token_url": "https://你的域名/api/getToken?appid=APPID&secret=SECRET",
  "author": "作者名",
  "cover_image": "https://example.com/cover.jpg"
}
```

使用：`--config @tools/wechat-draft/wechat-draft.config.json`

> ⚠ `wechat-draft.config.json` 已加入 `.gitignore`，不会提交到仓库。

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
  --html "tools/law-news/cache/exports/...html" \
  --config @tools/wechat-draft/wechat-draft.config.json
```

---

## 缓存目录

```
tools/wechat-draft/
├── wechat-draft.md                    ← 本文档
├── wechat-draft.config.example.json   ← 配置示例
├── 联系我.jpg                         ← 配置操作截图
├── scripts/
│   └── wechat-draft.py                ← Python 脚本
└── cache/
    └── images/                        ← 下载的图片缓存
```

---

## 注意事项

- **必须先配置 token_url**，否则所有命令都会提示配置指引
- **图片必须来自微信**：微信公众号会过滤所有外部图片 URL，脚本自动处理上传和替换
- **IP 白名单**：token 接口的服务器 IP 必须加入微信 IP 白名单，否则 API 调用会返回 40164 错误
- **封面图**：微信要求草稿必须有 `thumb_media_id`（永久素材 ID），脚本自动用第一张正文图作为封面
- **图片格式**：仅支持 JPG/PNG，JFIF 等格式会自动转换
- **图片大小**：uploadimg 限制 1MB 以下
