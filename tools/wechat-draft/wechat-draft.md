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

**④ 配置 token 获取方式（二选一）**

**方式 A：直连微信 API（推荐）**
在配置文件中填写 `appid` + `secret`，脚本直连微信接口获取 token，无需额外部署。

```bash
cp tools/wechat-draft/wechat-draft.config.example.json tools/wechat-draft/wechat-draft.config.json
# 编辑 wechat-draft.config.json，填写你的 appid 和 secret
```

```json
{
  "appid": "wx1234567890abcdef",
  "secret": "你的AppSecret"
}
```

**方式 B：独立 token 接口（付费/中间件场景）**
部署一个返回 access_token 的 HTTP 接口，通过 `token_url` 指定。

```bash
python3 tools/wechat-draft/scripts/wechat-draft.py test-token \
  --token-url "https://你的域名/getToken"
```

详见下方「付费接口设计」章节。

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
  --author "作者"              # 可选（≤8字）
  --digest "摘要"              # 可选
  --cover-image "URL"          # 可选，封面图（默认用第一张正文图）
  --content-source-url "URL"   # 可选，阅读原文链接
  --config "@path/to/config.json"  # 可选，配置文件
```

> token_url、appid、secret 统一在配置文件中配置，不通过命令行传入（避免密钥泄露）。

---

## 配置文件

```bash
cp tools/wechat-draft/wechat-draft.config.example.json tools/wechat-draft/wechat-draft.config.json
```

编辑 `wechat-draft.config.json`：

```json
{
  "_note": "方式A: 直连微信 API（推荐）",
  "appid": "wx...",
  "secret": "..."
}
```

```json
{
  "_note": "方式B: 独立 token 接口（付费/中间件）",
  "token_url": "https://你的域名/getToken"
}
```

> ⚠ `wechat-draft.config.json` 已加入 `.gitignore`，不会提交到仓库。

---

## 付费接口设计

本工具支持部署独立的 access_token 中间接口，可用于付费授权、鉴权计费等场景。

### 接口约定

**方式 B** 通过配置 `token_url` 指向你自己的接口。脚本发送 GET 请求，期望以下响应格式：

#### ✅ 成功响应

```json
{
  "access_token": "xxx...",
  "expires_in": 7200
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `access_token` | 是 | 微信调用凭证 |
| `expires_in` | 否 | 有效期（秒），默认 7200 |

#### ❌ 付费/鉴权失败

```json
{
  "errcode": "payment_required",
  "errmsg": "请先付费购买使用权限，联系微信: your-wechat-id"
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `errcode` | 是 | 错误码，脚本根据该字段判断错误类型 |
| `errmsg` | 是 | 用户可读的错误提示，会直接展示给用户 |

脚本处理逻辑：

```python
# 伪代码：脚本中的处理逻辑
if response.get("access_token"):
    return response["access_token"]
elif response.get("errcode") == "payment_required":
    print("❌ 该 AppID 未付费，无法使用")
    print(f"   {response['errmsg']}")
    # 提示联系
else:
    print(f"❌ token 接口返回错误: {response}")
```

### 建议的计费模式

| 模式 | 说明 | 优点 |
|------|------|------|
| **按订阅（推荐）** | 月/年付费，接口返回 token | 用户无感，实现简单 |
| **按次计费** | 每次返回 token 时扣减额度 | 需要 `remaining_quota` 字段辅助 |
| **免费额度+付费** | 每月 N 次免费，超出后付费 | 降低用户试用门槛 |

### 可选增强字段

你的接口可以额外返回这些字段，脚本会展示给用户：

```json
{
  "access_token": "xxx",
  "expires_in": 7200,
  "remaining_quota": 98,
  "plan": "pro",
  "expires_at": "2026-07-13"
}
```

| 字段 | 用途 |
|------|------|
| `remaining_quota` | 剩余可用次数（按次计费时） |
| `plan` | 当前套餐名称（free/pro/enterprise） |
| `expires_at` | 订阅到期日期 |

### 对用户的好处

使用你的 token 接口，用户**不需要自己配微信 IP 白名单**——你的接口代调用微信 API，用户只需一个 token_url 即可使用，体验最爽。

### 接口对接流程

1. 你部署好 token 接口
2. 把接口地址发给用户
3. 用户配置到 `wechat-draft.config.json` 的 `token_url` 字段
4. 用户运行 `test-token` 验证
5. 后续开发中每个 wechat-draft 功能扫码

> 接口格式确定后，联系开发者适配脚本的错误提示。

---

## 与 law-news 联动

完整工作流：law-news 抓取资讯 → md-to-wechat 生成排版 HTML → wechat-draft 推送草稿

```bash
# 步骤 5：推送为微信公众号草稿
python3 tools/wechat-draft/scripts/wechat-draft.py publish-draft \
  --title "法律资讯简报 2026-06-13" \
  --html "tools/law-news/cache/exports/...html" \
  --config @tools/wechat-draft/wechat-draft.config.json
```

---

## 目录

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

- **必须先配置 token_url、appid+secret 之一**，否则所有命令都会提示配置指引
- **图片必须来自微信**：微信公众号会过滤所有外部图片 URL，脚本自动处理上传和替换
- **IP 白名单**：直连微信 API 时，服务器 IP 必须加入微信 IP 白名单；使用 token_url 方式则不需要
- **封面图**：微信要求草稿必须有 `thumb_media_id`（永久素材 ID），脚本自动用第一张正文图作为封面
- **图片格式**：仅支持 JPG/PNG，JFIF 等格式会自动转换
- **图片大小**：uploadimg 限制 1MB 以下
- **每篇文章参数**（标题、作者、摘要、封面）：通过命令行传入，不放在配置文件中
