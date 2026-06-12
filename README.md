# feishu-lawtools 🧑‍⚖️

飞书法律工具箱 — 把法律法规导入飞书在线文档，支持 AI 划重点和批注解读。

## 能力

| 命令 | 功能 |
|:----:|------|
| `/law-import` | 从 URL 或文件导入法律文本 → 飞书在线文档（结构化章节+条文） |
| `/law-highlight` | 对文档中的法律术语划重点（🟡 黄底+加粗，荧光笔效果） |
| `/law-annotate` | AI 逐条生成解读批注（飞书侧边栏评论） |

## 技术栈

- **飞书 OpenAPI** — 文档创建、文本编辑、评论管理
- **lark-cli** — 命令行封装的飞书 API 调用
- **Pi Agent Skill** — 可被 AI agent 调用的工作流指令

## 用法

```bash
# 导入法律文本
/law-import https://flk.npc.gov.cn/民法典.txt

# 划重点
/law-highlight <doc_url> "犯罪" --style highlight

# AI 批注
/law-annotate <doc_url> --style 通俗
```

## 安装

将 `feishu-lawtools` 目录放入 pi agent 的 skills 目录即可。

## 许可证

MIT
