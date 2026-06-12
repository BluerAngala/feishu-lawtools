# feishu-lawtools 🧑‍⚖️

飞书法律工具箱 — 基于 **飞书（Lark）OpenAPI** 和 **lark-cli** 的命令集，由 AI agent 驱动，实现法律条文的导入、划重点、批注解读全流程。

---

## 目录

- [依赖与前提](#依赖与前提)
- [快速开始](#快速开始)
- [命令详解](#命令详解)
  - [/law-import — 导入法律条文](#lawimport--导入法律条文)
  - [/law-highlight — 划重点](#lawhighlight--划重点)
  - [/law-annotate — AI 批注解读](#lawannotate--ai-批注解读)
- [用户手动操作](#用户手动操作)
- [完整工作流示例](#完整工作流示例)
- [技术架构](#技术架构)
- [开发指南](#开发指南)
- [常见问题](#常见问题)

---

## 依赖与前提

### 必须安装

| 依赖 | 用途 | 安装方式 |
|------|------|----------|
| [lark-cli](https://github.com/earendil-works/lark-cli) | 调用飞书 OpenAPI | `npm install -g @earendil-works/lark-cli` |
| 飞书开发者应用 | 提供 API 凭证 | [飞书开发者后台](https://open.feishu.cn/app) 创建应用 |

### 飞书权限（OAuth Scopes）

| Scope | 用途 |
|-------|------|
| `docx:document:create` | 创建文档 |
| `docx:document:readonly` | 读取文档内容 |
| `docx:document:write_only` | 编辑文档内容 |
| `drive:file:upload` | 上传资源 |
| `drive:document.comment:create` | 添加批注评论 |

### 认证

所有操作使用 **用户身份**（`--as user`），首次使用需登录：

```bash
# 登录飞书用户身份
lark-cli auth login --scope "docx:document:create,docx:document:readonly,docx:document:write_only,drive:document.comment:create"

# 验证登录状态
lark-cli auth status --format json
```

返回 `tokenStatus: "valid"` 即表示认证通过。

---

## 快速开始

```bash
# 1. 从 URL 导入一部法律
/law-import https://flk.npc.gov.cn/民法典.txt

# 2. 对关键术语划重点
/law-highlight https://lawyerch.feishu.cn/docx/xxx "犯罪"

# 3. AI 自动添加批注解读
/law-annotate https://lawyerch.feishu.cn/docx/xxx --style 通俗
```

---

## 命令详解

### /law-import — 导入法律条文

**功能**：从 URL 或本地文件提取法律文本，解析为「章节→条目」结构，创建飞书在线文档。

#### 输入

```
/law-import <url|file_path> [--title "自定义标题"]
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `url` 或 `file_path` | 是 | 法律文本来源。URL 自动抓取网页正文；本地文件直接读取 |
| `--title` | 否 | 自定义文档标题，默认取法律文本第一行 |

#### 支持的文件格式

| 格式 | 说明 |
|------|------|
| `.txt` | 纯文本，UTF-8 编码 |
| `.md` | Markdown，自动转换标题层级 |
| URL | 网页链接，自动提取正文（依赖 `baoyu-url-to-markdown` 或 `defuddle`） |

#### 解析规则

输入文本格式示例：

```
中华人民共和国民法典
（2020年5月28日通过）

第一编 总则
第一章 基本规定
第一条 为了保护民事主体的合法权益……制定本法。
第二条 民法调整平等主体的自然人……
```

解析后生成的飞书文档结构：

```
[标题] 中华人民共和国民法典
  ├─ [h1] 第一编 总则
  │   ├─ [h1] 第一章 基本规定
  │   │   ├─ [p] 第一条 为了保护民事主体的合法权益……
  │   │   └─ [p] 第二条 民法调整平等主体的自然人……
```

每条条文对应一个独立段落（`<p>`），并带有唯一的 `id` 属性（如 `id="article-1"`），供后续划重点和批注定位。

#### 幕后流程

```
用户输入 URL/文件
       ↓
 ① 提取文本内容
    └─ URL → baoyu-url-to-markdown / defuddle 提取正文
    └─ 文件 → read 工具直接读取
       ↓
 ② 解析结构化
    └─ 正则匹配 "第X编" "第X章" "第X条"
    └─ 每一条生成独立的 <p id="article-N">
       ↓
 ③ 构建飞书 XML
    └─ <title>法律名称</title>
    └─ <h1>第X章 章名</h1>
    └─ <p id="article-1">第一条 内容</p>
       ↓
 ④ 调用飞书 API
    └─ lark-cli docs +create --api-version v2 --content '<xml>' --as user
       ↓
 ⑤ 返回文档 URL
    └─ https://lawyerch.feishu.cn/docx/{document_id}
```

#### lark-cli 命令

```bash
# 创建文档
lark-cli docs +create --api-version v2 \
  --content '<title>中华人民共和国民法典</title><h1>第一编 总则</h1><p id="article-1">第一条 ...</p>' \
  --as user --format json
```

> **注意**：如果内容较长超出命令行参数限制，先创建空文档，再分批追加：
> ```bash
> # 创建空文档
> lark-cli docs +create --api-version v2 --content '<title>法律名称</title>' --as user
> 
> # 逐章追加
> lark-cli docs +update --api-version v2 --doc <token> --command append --content '<h1>第一章</h1><p id="article-1">...</p>' --as user
> ```

---

### /law-highlight — 划重点

**功能**：在飞书文档正文中对指定法律术语进行可视化标记，支持黄底高亮（荧光笔效果）和加粗。

#### 与批注的区别

| | 划重点 | 批注 |
|:---|:-------|:-----|
| **位置** | 直接在正文中修改文字样式 | 侧边栏评论，不占正文 |
| **可见性** | 打开文档一目了然 | 需要点击批注图标展开 |
| **适合场景** | 关键术语、易错点、核心概念 | 完整解读、案例分析、实务提示 |

#### 输入

```
/law-highlight <doc_url> <term> [--style highlight|bold]
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `doc_url` | 是 | 飞书文档 URL 或 token |
| `term` | 是 | 要标记的词语或短语 |
| `--style` | 否 | `highlight`（黄底+加粗，默认）\| `bold`（仅加粗） |

#### 完整示例

```bash
# 示例1：黄底高亮「犯罪」（默认）
/law-highlight https://lawyerch.feishu.cn/docx/xxx "犯罪"

# 示例2：黄底高亮「故意犯罪」
/law-highlight https://lawyerch.feishu.cn/docx/xxx "故意犯罪"

# 示例3：仅加粗「意思表示真实」
/law-highlight https://lawyerch.feishu.cn/docx/xxx "意思表示真实" --style bold
```

#### 幕后流程（高亮模式）

高亮不能通过简化的 XML `str_replace` 实现，因为飞书简化 XML 不支持 `background-color`，必须使用原生 OpenAPI 逐 block 编辑。

步骤分解：

```
 ① 关键词定位
    └─ docs +fetch --scope keyword --keyword "犯罪" --detail with-ids
    └─ 返回匹配的 block_id 列表
       ↓
 ② 获取 block 完整结构
    └─ GET /open-apis/docx/v1/documents/{doc_id}/blocks/{block_id}
    └─ 返回 text.elements 数组，每个 element 包含 text_run.content 和 text_element_style
       ↓
 ③ 构建更新数据
    └─ 找到目标文本所在的 element
    └─ 将其 text_element_style 改为 {"bold": true, "background_color": 2}
    └─ 保留其他所有 element 不动
       ↓
 ④ PATCH 写回
    └─ PATCH .../blocks/{block_id} --data '{"update_text_elements":{"elements":[...]}}'
```

> ⚠️ **关键约束**：`update_text_elements` 必须提供该 block 的 **全部** text elements。只传要修改的那个会导致其他文本丢失。

#### background_color 取值

| 值 | 颜色 | 适用场景 |
|:--:|:----:|----------|
| `2` | 🟡 **黄色** | **默认**，高亮最醒目 |
| `3` | 🟢 绿色 | 正面案例、合规要点 |
| `4` | 🔵 蓝色 | 程序性规定 |
| `5` | 🟠 橙色 | 警告、注意 |
| `6` | 🔴 红色 | 禁止性规定、易错点 |
| `7` | 🟣 紫色 | 特殊概念、定义 |

#### 幕后流程（加粗模式）

加粗可以直接用飞书简化 XML 的 `str_replace` 一步完成：

```bash
lark-cli docs +update --api-version v2 \
  --doc <token> \
  --command str_replace \
  --pattern "意思表示真实" \
  --content '<b>意思表示真实</b>' \
  --revision-id -1 \
  --as user
```

---

### /law-annotate — AI 批注解读

**功能**：对已导入的法律文档，AI（即当前 agent）逐条生成专业的条文解读，通过飞书评论系统添加到对应条文旁。

#### 输入

```
/law-annotate <doc_url> [--scope "article-1,article-5"] [--style 通俗|专业|案例]
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `doc_url` | 是 | 飞书文档 URL 或 token |
| `--scope` | 否 | 限定批注范围，如 `article-1,article-5`。不填则全部条文 |
| `--style` | 否 | 解读风格：`通俗`（默认，适合非法律人士）/ `专业`（法言法语，引用司法解释）/ `案例`（结合典型案例） |

#### 风格对比

以「民法典第143条（合同有效要件）」为例：

| 风格 | 输出示例 |
|:----:|----------|
| **通俗** | "本条说了合同有效的三个条件：1）双方都得是能自己做主的人；2）说的话都是真心的，没被骗；3）内容不违法、不违背公序良俗。" |
| **专业** | "本条系民事法律行为生效要件之一般规定。行为能力的判断以《民法典》第18-22条为准；意思表示真实排除通谋虚伪表示（第146条）及欺诈胁迫（第148-150条）；不得违反强制性规定需区分效力性与管理性规定（《九民纪要》第30条）。" |
| **案例** | "参考（2021）最高法民终XXX号：当事人以'意思表示不真实'主张合同无效，法院审查是否存在欺诈、胁迫或重大误解。实务中证明标准较高，需提供充分证据。" |

#### 幕后流程

```
 ① 获取文档结构
    └─ docs +fetch --detail with-ids
    └─ 提取所有 <p id="article-N"> 的 block_id 和文本内容
       ↓
 ② AI 逐条生成解读
    └─ 根据 style 参数调整输出风格
    └─ 每条解读控制在 200-500 字
       ↓
 ③ 添加飞书评论
    └─ drive +add-comment --doc <token> --block-id <block_id>
    └─ --content '[{"type":"text","text":"【AI解读】..."}]'
    └─ --type docx --as user
       ↓
 ④ 频率控制
    └─ 每条间隔 1-2 秒，避免 API 限流
```

#### lark-cli 命令

```bash
# 添加批注
lark-cli drive +add-comment \
  --doc <token> \
  --block-id "<p标签的block_id>" \
  --content '[{"type":"text","text":"【AI解读】解读内容..."}]' \
  --type docx \
  --as user
```

---

## 用户手动操作

以下操作无需 skill 支持，直接在飞书客户端完成：

### 手动添加批注

1. 在飞书文档中选中要批注的文本
2. 点击右侧弹出的「批注」按钮
3. 输入解读内容
4. 按 Enter 发布

### 跳转到指定条文

在文档 URL 后添加 `#block_id`：

```
https://lawyerch.feishu.cn/docx/xxx#doxcn123456
```

---

## 完整工作流示例

### 场景：从全国人大网站导入《民法典》并批注

```bash
# ① 导入
/law-import https://flk.npc.gov.cn/民法典.txt
→ ✅ https://lawyerch.feishu.cn/docx/abc123

# ② 划重点（关键术语）
/law-highlight https://lawyerch.feishu.cn/docx/abc123 "民事法律行为"
/law-highlight https://lawyerch.feishu.cn/docx/abc123 "公序良俗"
/law-highlight https://lawyerch.feishu.cn/docx/abc123 "强制性规定"

# ③ AI 批注
/law-annotate https://lawyerch.feishu.cn/docx/abc123 --style 通俗
→ ✅ 已为 1260 条条文添加批注

# ④ 你在飞书里手动补充自己的批注
```

### 场景：从本地文件导入《刑法》

```bash
/law-import /Users/bluer/Downloads/刑法.txt --title "中华人民共和国刑法"
→ ✅ https://lawyerch.feishu.cn/docx/def456
```

---

## 技术架构

### 系统依赖

```
feishu-lawtools (SKILL.md)
       │
       ├── 调用 ── lark-cli ── 飞书 OpenAPI
       │              │
       │              ├── docs +create       文档创建
       │              ├── docs +fetch        文档读取
       │              ├── docs +update       文档编辑（str_replace）
       │              ├── drive +add-comment  添加批注
       │              ├── api GET/PATCH      原生 API 调用
       │              └── auth login/status  认证管理
       │
       └── 依赖 ── pi agent 内置技能
                    ├── baoyu-url-to-markdown  URL 正文提取
                    ├── defuddle              URL 正文提取（备选）
                    ├── lark-doc              飞书文档读写
                    └── lark-drive            飞书评论管理
```

### 数据流

```
文本来源 ─→ 结构化解析 ─→ 飞书 XML ─→ OpenAPI ─→ 飞书云端文档
  (URL/文件)     (章节+条文)      (格式化)     (lark-cli)     (在线可访问)
```

### 关键 API

| 操作 | API 路径 | 方法 | 通过 lark-cli |
|------|----------|:----:|:-------------:|
| 创建文档 | `/open-apis/docx/v1/documents` | POST | `docs +create` |
| 读取文档 | `/open-apis/docx/v1/documents/{id}/raw_content` | GET | `docs +fetch` |
| 全文替换 | `/open-apis/docx/v1/documents/{id}/blocks/{id}/update` | PATCH | `docs +update --command str_replace` |
| 逐 block 编辑 | `/open-apis/docx/v1/documents/{id}/blocks/{id}` | PATCH | `api PATCH` |
| 添加评论 | `/open-apis/drive/v1/files/{token}/new_comments` | POST | `drive +add-comment` |

---

## 开发指南

### 项目结构

```
feishu-lawtools/
├── SKILL.md       ← AI agent 技能指令（核心）
├── README.md      ← 本文件
└── .gitignore
```

### 如何新增一个命令

假设要新增 `law-summarize`（AI 摘要）命令：

**1. 在 SKILL.md 中添加命令文档**

```markdown
### /law-summarize — 条文摘要

快速生成法律文档的摘要。

/law-summarize <doc_url> [--max-length 500]

步骤：
1. docs +fetch 获取文档内容
2. AI 生成摘要
3. 返回摘要文本或追加到文档末尾
```

**2. 实现步骤（在 SKILL.md 中写清）**

```markdown
步骤：

1. 获取文档全文
   lark-cli docs +fetch --api-version v2 --doc <token> --as user

2. AI 分析每条条文并生成摘要
   （由 agent 自行完成，依据 skill 指令）

3. 将摘要追加到文档末尾
   lark-cli docs +update --api-version v2 --doc <token> --command append \
     --content '<callout>【摘要】...</callout>' --as user
```

**3. 测试**

在 pi agent 中调用 `/law-summarize <doc_url>` 验证。

### 开发原则

1. **命令前缀统一**：所有命令以 `/law-` 开头，便于 AI agent 识别和路由
2. **依赖显式声明**：在 SKILL.md 的 `metadata.requires` 中标明依赖的 CLI 工具
3. **认证优先**：所有操作使用 `--as user`，不依赖 bot 身份
4. **幂等操作**：划重点和批注支持重复调用，多次执行不会破坏文档
5. **频率控制**：批量操作时每条间隔 1-2 秒

### 发布流程

```bash
# 提交代码
git add -A
git commit -m "feat: add law-summarize command"
git push origin main
```

---

## 常见问题

### Q: 为什么不用 `str_replace` 直接加背景色？

飞书简化 XML 不支持 `<span style="background-color:...">`。背景色需要调用原生 OpenAPI 的 `PATCH .../blocks/{id}` 接口，在 `text_element_style` 中设置 `background_color`。

### Q: 批量划重点有什么注意事项？

`str_replace` 是全文替换，如果同一词语在多条条文中出现，会全部标记。如果只想标记某个特定位置的词语，用 `--scope` 限定范围或手动操作。

### Q: 批注内容有长度限制吗？

建议每条批注不超过 500 字。过长可能导致 API 截断或显示不佳。

### Q: 能否多人协作？

可以。飞书文档本身支持多人实时编辑。批注和划重点的操作会同步给所有有权限的协作者。

### Q: 文档导入后还能继续编辑吗？

能。导入生成的飞书文档是标准的飞书在线文档，你可以在飞书客户端直接编辑、删除、分享。

---

## 许可证

MIT
