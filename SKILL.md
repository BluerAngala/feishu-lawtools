---
name: feishu-lawtools
version: 1.0.0
description: "飞书法律工具箱。法律条文导入飞书在线文档、AI划重点标记、AI批注解读。触发方式：/law-import、/law-highlight、/law-annotate、/法律导入、/划重点、/法律批注"
metadata:
  requires:
    bins: ["lark-cli"]
---

# 飞书法律工具箱 (feishu-lawtools)

## 安装

```bash
# 通过 GitHub 安装
pi install git:github.com/BluerAngala/feishu-lawtools

# 或从 npm 安装（需先发布）
# pi install npm:@bluerangala/feishu-lawtools
```

---

把法律法规从URL或本地文件导入飞书在线文档，结构化呈现（章节→条款），并支持AI自动逐条添加批注解读。

## 流程图

```
用户输入（URL / 文件路径）
       ↓
 ① 提取法律文本内容
       ↓
 ② 解析结构化：法律名称 → 章节 → 条文
       ↓
 ③ 创建飞书在线文档（docs +create --api-version v2）
       ↓
 ④ AI 自动批注或划重点（可选）
       ├─ 逐条批注 → drive +add-comment（隐藏评论）
       └─ 划重点 → docs +update str_replace（正文加粗/标色）
       ↓
 ⑤ 用户手动批注（飞书原生功能，无需skill）
```

## 依赖技能

本 skill 在执行过程中可能需要调用以下技能处理子任务：

| 场景 | 调用 skill |
|------|-----------|
| URL 提取正文 | `baoyu-url-to-markdown` 或 `defuddle`（pi 内置 skill） |
| 本地文件读取 | `read` 工具直接读取 |
| 飞书文档创建/读取 | `lark-doc`（pi 内置 skill） |
| 飞书文档批注 | `lark-drive`（pi 内置 skill，`+add-comment`） |
| 认证/权限 | `lark-shared`（pi 内置 skill） |

## 命令

### /law-import — 导入法律条文

将法律文本从URL或本地文件导入飞书在线文档。

```
/law-import <url|file_path> [--title "自定义标题"]
```

**步骤：**

1. **提取内容**
   - 如果是 URL → 调用 `baoyu-url-to-markdown` 或 `defuddle` 提取正文
   - 如果是本地文件 → `read` 读取文件内容

2. **解析结构化**
   法律文本通常格式为：
   ```
   中华人民共和国民法典
   （2020年5月28日通过）
   
   第一编 总则
   第一章 基本规定
   第一条 为了保护民事主体的合法权益……制定本法。
   第二条 民法调整……
   ```
   
   解析规则：
   - 文件开头 → 法律名称（作为文档标题）
   - `第X编`、`第X章`、`第X节` → 一级标题（`<h1>`）
   - `第X条` → 独立段落（`<p id="article-X">`），`id` 用于后续锚定批注
   - 普通文字 → 段落（`<p>`）

3. **构建 XML 内容**

   ```xml
   <title>中华人民共和国民法典</title>
   <h1>第一编 总则</h1>
   <h1>第一章 基本规定</h1>
   <p id="article-1">第一条 为了保护民事主体的合法权益……</p>
   <p id="article-2">第二条 民法调整平等主体的自然人……</p>
   ```

   > ⚠️ **重要**：每条条文必须有唯一的 `id` 属性（如 `id="article-1"`），这是后续批量逐条批注的锚点。后续若需对条文中**特定词语**做批注，也可通过文本定位方式实现（详见 `/law-annotate` 的「词语级批注」）。

4. **创建文档**

   ```bash
   lark-cli docs +create --api-version v2 \
     --content '<title>...</title><h1>...</h1><p id="article-1">...</p>' \
     --as user --format json
   ```

   > 如果内容较长，XML 可能超出命令行长度限制。此时：
   > - 先用 `docs +create` 创建空文档
   > - 再用 `docs +update --api-version v2 --command append` 分批追加内容

5. **输出结果**

   返回文档 URL，格式如：`https://lawyerch.feishu.cn/docx/{document_id}`

### /law-highlight — 划重点（正文格式化标记）

对文档中的特定词语进行**正文内标记**（加粗/标色/高亮），而不是添加隐藏的批注。

```
/law-highlight <doc_url> <term> [--style bold|color|highlight] [--color "#E8323C"]
```

**参数说明：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `doc_url` | 是 | 飞书文档 URL 或 token |
| `<term>` | 是 | 要标记的词语或短语 |
| `--style` | 否 | 标记风格：`highlight`（黄底高亮，默认）/ `bold`（加粗）/ `color`（文字颜色） |
| `--color` | 否 | 颜色值，仅 `style=color` 时生效，默认红 `#E8323C` |

**支持两种标记风格：**

#### 黄底高亮 + 加粗（默认，最明显）

需要分两步走，因为飞书简化 XML 不支持背景色，必须用原生 API：

**步骤①：找到目标文本所在的 block_id**

```bash
# 通过关键词搜索定位到 block
lark-cli docs +fetch --api-version v2 --doc <token> --scope keyword --keyword "故意犯罪" --detail with-ids --as user
```

**步骤②：获取该 block 的完整文本结构**

```bash
lark-cli api GET /open-apis/docx/v1/documents/{doc_id}/blocks/{block_id} --as user
```

**步骤③：构建带高亮的更新请求**

解析返回的 `text.elements` 数组，找到目标文本元素，将其 `text_element_style` 改为：

```json
{
  "bold": true,
  "background_color": 2
}
```

`background_color` 取值：`2`=黄色、`3`=绿色、`4`=蓝色、`5`=橙色、`6`=红色、`7`=紫色

然后将全部 elements 通过 PATCH 写回：

```bash
lark-cli api PATCH /open-apis/docx/v1/documents/{doc_id}/blocks/{block_id} \
  --data '{"update_text_elements":{"elements":[...]}}' \
  --as user
```

> ⚠️ **重要**：`update_text_elements` 必须提供该 block 的 **全部** elements，不能只传要改的那一个。漏掉任何一个 element 都会被删掉。

#### 加粗（简单，`str_replace` 直接搞定）

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

### /law-annotate — AI 自动添加批注

对已导入的法律文档，AI 自动为每条条文生成解读批注。

```
/law-annotate <doc_url> [--scope "article-1,article-5"] [--style "通俗"|"专业"|"案例"]
```

**参数说明：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `doc_url` | 是 | 飞书文档 URL 或 token |
| `--scope` | 否 | 指定条文范围，如 `article-1,article-5`，不填则全部 |
| `--style` | 否 | 批注风格：`通俗`（默认，给普通读者）/ `专业`（法言法语）/ `案例`（结合案例解读） |

**两种批注级别：**

#### 级别A：逐条批注（整条解读）

对每条法律条文整体添加解读批注。

1. **获取文档 block 结构**

   ```bash
   lark-cli docs +fetch --api-version v2 --doc <token> --detail with-ids --as user --format json
   ```

   从返回的 XML 中提取所有 `<p id="article-X">` 节点的 `id` 和文本内容。

2. **AI 生成解读**
   
   对每条条文，使用 AI（即你自身）生成解读文本。解读内容应包含：
   - 条文核心含义
   - 关键词解释（如有）
   - 实务要点（如有）
   - 风格按 `--style` 参数调整

3. **添加批注**

   ```bash
   # 单条添加
   lark-cli drive +add-comment \
     --doc <token> \
     --block-id "<p标签的id>" \
     --content '[{"type":"text","text":"【AI解读】...解读内容..."}]' \
     --type docx \
     --as user
   ```

   > **content 格式**：必须是 JSON 数组，元素格式为 `{"type":"text","text":"内容"}`
   > **block-id**：即 XML 中 `<p id="article-1">` 的 `id` 值

#### 级别B：词语级批注（划重点）

对条文中**特定词语或短语**添加批注，精准标记重点概念、关键词、实务要点。

支持两种定位方式：

**方式一：精确短语匹配**

```bash
lark-cli drive +add-comment \
  --doc <token> \
  --selection-with-ellipsis "意思表示真实" \
  --content '[{"type":"text","text":"【划重点】意思表示真实的含义..."}]' \
  --type docx \
  --as user
```

**方式二：范围标记（start...end）**

```bash
lark-cli drive +add-comment \
  --doc <token> \
  --selection-with-ellipsis "开头文字...结尾文字" \
  --content '[{"type":"text","text":"【划重点】解读内容..."}]' \
  --type docx \
  --as user
```

> **注意**：
> - `--selection-with-ellipsis` 和 `--block-id` 互斥，不能同时使用
> - 系统会自动在文档内定位匹配的文本，如果同一文本出现多次，会使用第一个匹配处
> - 建议使用足够独特的关键词确保精准命中
> - 词语级批注适合：法律术语解释、关键词定义、实务提示、易错点标注

4. **分页处理**

   如果文档较长（>50条），应分批获取 block_id 和分批添加批注，避免超时。每次添加批注后等待 1-2 秒（API 有频率限制）。

### 用户手动批注

用户直接在飞书文档界面操作：
1. 选中要批注的文本
2. 点击右侧弹出的「批注」按钮
3. 输入解读内容
4. 按 Enter 发布

这是飞书原生功能，无需 skill 支持。

## 示例

### 示例1：从URL导入并自动批注

```
用户：/law-import https://flk.npc.gov.cn/民法典.txt
AI： 提取内容 → 解析章节条文 → 创建飞书文档
     ✅ 已创建：https://lawyerch.feishu.cn/docx/xxx

用户：/law-annotate https://lawyerch.feishu.cn/docx/xxx --style 专业
AI：  获取block结构 → 逐条生成专业解读 → 添加批注
     ✅ 已为全部1280条添加批注
```

### 示例2：从本地文件导入

```
用户：/law-import /Users/bluer/Downloads/刑法.txt
AI：  读取文件 → 解析 → 创建文档
     ✅ 已创建：https://lawyerch.feishu.cn/docx/xxx
```

## 注意事项

| 项目 | 说明 |
|------|------|
| ⏱️ 频率限制 | 添加批注时建议每条间隔 1-2 秒，避免 API 限流 |
| 📏 内容长度 | 单条批注内容建议不超过 500 字，过长可能被截断 |
| 🔑 身份 | 所有操作使用 `--as user`，确保有文档读写和评论权限 |
| 🧹 文档清理 | 创建空白文档后需先追加内容再获取 block_id |
| 🔗 文档链接 | 用户可以直接在文档 URL 末尾加 `#block_id` 跳转到指定条文 |
