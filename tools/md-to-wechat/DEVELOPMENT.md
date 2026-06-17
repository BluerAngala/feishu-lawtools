# md-to-wechat Skill 开发文档

> 本文档记录从 md2wechat CLI (Go) 复刻功能到 Skill (Node.js) 的设计思路和注意事项
> 目标：模块化重构，保留核心功能思路，不照抄代码

---

## 一、总体设计原则

### 1.1 复刻不等于复制
- **复刻思路**：理解原功能的核心逻辑和用户体验，用 Node.js 重新实现
- **不照抄代码**：不翻译 Go 代码到 JS，而是根据需求重新设计实现
- **简化优先**：去掉过度工程化的部分，保留实用功能

### 1.2 模块化设计
- 按功能大类划分模块，每个模块独立可运行
- 模块之间通过统一接口通信，避免循环依赖
- 配置集中管理，模块懒加载

### 1.3 渐进式实现
- 先实现核心功能（converter），再扩展其他模块
- 每个模块先实现 MVP，再迭代优化
- 保持向后兼容，不破坏现有功能

---

## 二、功能大类划分

### 模块1：文章排版转换 (converter)
**对应原功能**：`convert`, `inspect`, `preview`, `layout`

#### 核心思路
原 CLI 的核心价值在于 **43 个高级排版模块** 和 **主题系统**。但原实现是服务端渲染（API 模式），Skill 版本需要：

1. **主题系统本地化**
   - 原主题定义在 YAML 文件中，包含颜色和样式规则
   - Skill 版本将主题定义为 JS 对象或 JSON 配置
   - 保留原有主题概念：default, legal, apple, chinese 等

2. **排版模块简化**
   - 原 43 个模块通过 `:::block` 语法触发服务端渲染
   - Skill 版本选择最常用的 10-15 个模块本地实现
   - 用 Markdown 扩展语法或 HTML 注释标记模块

3. **转换流程**
   ```
   Markdown → 解析 frontmatter → 提取模块标记 → 应用主题样式 → 内联 CSS HTML
   ```

#### 注意事项
- **CSS 必须内联**：微信公众号编辑器不支持外部样式
- **图片占位符**：本地图片先保留占位符，上传后替换 URL
- **主题继承**：支持主题继承和覆盖，类似原 `api_theme` 机制

---

### 模块2：AI 写作辅助 (ai-writer)
**对应原功能**：`write`, `humanize`

#### 核心思路
原功能依赖外部 AI 服务，Skill 版本需要：

1. **风格写作 (write)**
   - 原功能：根据主题风格生成完整文章 + 封面提示词
   - Skill 版本：构建结构化提示词模板，调用 LLM API
   - 保留风格概念：dan-koe, gentle, aggressive 等

2. **去痕 (humanize)**
   - 原功能：4 级强度（gentle/medium/aggressive/authentic）
   - Skill 版本：定义不同强度的提示词策略
   - 输入文章 → 应用去痕提示词 → 输出润色后文章

#### 注意事项
- **提示词模板化**：将提示词抽离为 YAML/JSON，便于维护
- **多 Provider 支持**：OpenAI, OpenRouter, Gemini 等
- **流式输出**：大文章考虑流式返回，避免超时

---

### 模块3：图片处理 (image-assistant)
**对应原功能**：`generate_image`, `generate_cover`, `generate_infographic`, `upload_image`

#### 核心思路
原功能支持多种图片 Provider 和上传微信素材库：

1. **AI 图片生成**
   - 封面生成：根据文章标题/摘要生成封面提示词
   - 信息图生成：根据数据生成图表风格图片
   - 支持多种风格 preset（从原 prompts/image 复刻）

2. **图片处理**
   - 压缩：微信要求图片 < 2MB，自动压缩
   - 格式转换：转为微信友好的格式

3. **微信上传**（可选）
   - 需要微信 AppID/Secret
   - 上传后返回微信 URL，用于文章替换

#### 注意事项
- **Provider 抽象**：统一接口，支持多种 AI 图片服务
- **本地缓存**：生成的图片本地缓存，避免重复生成
- **异步处理**：图片生成耗时，考虑异步或进度提示

---

### 模块4：微信发布 (wechat-publisher)
**对应原功能**：`convert --draft`, `create_image_post`

#### 核心思路
原功能是完整的微信草稿管理：

1. **图文草稿**
   - 上传封面图 → 上传正文图片 → 创建草稿
   - 支持标题、作者、摘要、原文链接等元数据

2. **图片帖子 (newspic)**
   - 小红书风格的图片帖子
   - 上传多张图片，生成图文草稿

#### 注意事项
- **配置敏感**：微信凭证需要安全存储
- **错误处理**：微信 API 有限流，需要重试机制
- **可选模块**：此模块为可选，无配置时不加载

---

## 三、技术架构

### 3.1 目录结构
```
modules/
├── converter/          # 文章排版（核心，必须）
├── ai-writer/          # AI 写作（可选，需 API Key）
├── image-assistant/    # 图片处理（可选，需 API Key）
└── wechat-publisher/   # 微信发布（可选，需微信配置）
```

### 3.2 模块接口规范
每个模块必须实现：
```javascript
module.exports = {
  name: '模块名',
  description: '模块描述',
  
  // 检查模块是否可用（配置是否完整）
  isAvailable: () => boolean,
  
  // 模块命令列表
  commands: {
    'command-name': {
      description: '命令描述',
      run: (args) => Promise<result>
    }
  },
  
  // 模块初始化（可选）
  init: (config) => void
};
```

### 3.3 配置管理
统一配置文件：`~/.config/md-to-wechat/config.json`
```json
{
  "converter": {
    "defaultTheme": "legal"
  },
  "aiWriter": {
    "provider": "openai",
    "apiKey": "sk-xxx"
  },
  "image": {
    "provider": "openai",
    "apiKey": "sk-xxx"
  },
  "wechat": {
    "appId": "wx-xxx",
    "secret": "xxx"
  }
}
```

---

## 四、复刻要点对照表

| 原 CLI 功能 | Skill 模块 | 复刻思路 | 注意事项 |
|------------|-----------|---------|---------|
| `convert` | converter | Markdown → HTML，本地主题渲染 | 去掉 API 模式，纯本地转换 |
| `inspect` | converter | 解析 frontmatter，检查 readiness | 简化检查项，聚焦关键问题 |
| `preview` | converter | 生成本地 HTML 文件 | 直接调用 convert + 保存文件 |
| `layout` | converter | 10-15 个核心排版模块 | 用 JS 实现，不依赖服务端 |
| `write` | ai-writer | 风格提示词 + LLM 调用 | 模板化提示词，支持多 provider |
| `humanize` | ai-writer | 4 级去痕策略 | 每级一个提示词模板 |
| `generate_cover` | image-assistant | 封面提示词生成 + 图片生成 | 复刻原 preset 设计 |
| `generate_infographic` | image-assistant | 信息图提示词 + 生成 | 支持图表风格 |
| `upload_image` | image-assistant/wechat | 本地/远程图片上传微信 | 可选功能 |
| `convert --draft` | wechat-publisher | 完整发布流程 | 保持原子操作 |
| `create_image_post` | wechat-publisher | 图片帖子创建 | 简化参数 |

---

## 五、实现优先级

### Phase 1：核心功能（必须）
- [ ] converter 模块重构
  - [ ] 主题系统（复刻现有 themes.js）
  - [ ] 5-10 个核心排版模块
  - [ ] 命令：convert, inspect, preview

### Phase 2：AI 增强（推荐）
- [ ] ai-writer 模块
  - [ ] write 命令
  - [ ] humanize 命令
- [ ] image-assistant 模块
  - [ ] generate 命令

### Phase 3：微信集成（可选）
- [ ] wechat-publisher 模块
  - [ ] draft 命令
  - [ ] image-post 命令

---

## 六、现有代码复用

### 6.1 直接保留
- `scripts/themes.js`：主题系统基础
- `scripts/convert.js`：转换逻辑核心
- `example/`：示例文件

### 6.2 需要重构
- 将 `convert.js` 拆分为：parser.js, renderer.js, layout-modules/
- 将主题配置从代码抽离为 JSON/YAML
- 添加模块加载器和命令路由

### 6.3 新增内容
- `modules/` 目录结构
- 统一 CLI 入口
- 配置管理系统
- 模块接口规范

---

## 七、关键决策记录

### 决策1：是否支持 `:::block` 语法？
**建议**：支持，但简化实现
- 原语法：`:::block hero title=xxx`
- Skill 实现：解析为特定 HTML 结构，应用主题样式
- 不支持复杂嵌套，保持简单

### 决策2：主题系统如何设计？
**建议**：JSON 配置 + CSS 变量
- 每个主题一个 JSON 文件
- 定义颜色、字体、间距等变量
- 渲染时注入内联样式

### 决策3：AI 模块是否必须？
**建议**：可选，懒加载
- 无配置时命令提示用户配置
- 不阻塞核心排版功能

### 决策4：微信发布是否保留？
**建议**：保留，但独立为可选模块
- 大部分用户可能只需要排版
- 微信配置复杂，不强制要求

---

## 八、参考资料

- 原 CLI 文档：`md2wechat-skill/docs/`
- 现有 Skill：`scripts/convert.js`, `scripts/themes.js`
- 主题定义：`md2wechat-skill/internal/assets/builtin/themes/`
- 排版模块：`md2wechat-skill/internal/assets/builtin/layout/`

---

## 九、开发检查清单

每个模块开发完成后检查：

- [ ] 模块接口符合规范
- [ ] 命令行参数与原功能对齐
- [ ] 配置文件读取正常
- [ ] 错误处理完善
- [ ] 文档已更新
- [ ] 示例可运行

---

*文档版本：v1.0*
*最后更新：2026-05-24*
