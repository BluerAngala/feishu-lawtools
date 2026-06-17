# 小黑配图 Prompt 模板

基于 ian-xiaohei-illustrations 风格，为法律资讯文章生成正文配图。

## 使用方式

由 Agent 根据文章内容填充变量后，调用 image_generate 生成。

## Prompt 模板

```
Generate one standalone 16:9 horizontal Chinese article illustration.

Visual DNA:
Pure white background. Minimalist black hand-drawn line art. Slightly wobbly pen lines. Lots of empty white space. Sparse red/orange/blue handwritten Chinese annotations. Clean absurd product-sketch feeling. No gradients, no shadows, no paper texture, no complex background, no commercial vector style, no PPT infographic look, no cute mascot poster, no children's illustration, no realistic UI.

Recurring IP character required:
小黑, a small solid-black absurd creature with white dot eyes, tiny thin legs, blank serious expression, slightly uneven hand-drawn body shape. 小黑 must perform the core conceptual action, not decorate the scene. Make 小黑 serious, deadpan, and slightly bizarre, not cute.

Theme:
{主题：从文章提炼的法律概念或争议焦点}

Structure type:
{结构类型：概念隐喻 / 前后对比 / 角色状态 / Workflow / 系统局部 / 方法分层}

Core idea:
{核心意思：1-2句话概括这张图要表达的法律要点}

Composition:
{具体画面：小黑在哪里、正在做什么、主要物件是什么、信息如何流动}

Suggested elements:
{元素1} / {元素2} / {元素3} / {元素4}

Chinese handwritten labels:
{标注词1} / {标注词2} / {标注词3} / {标注词4}

Color use:
Black for main line art and 小黑. Orange for main flow/path/arrows. Red only for key warnings/problems/results. Blue only for secondary notes or feedback/system state.

Constraints:
One image explains only one core structure. Keep the main subject around 40%-60% of the canvas. Preserve at least 35% blank white space. Use at most 5-8 short handwritten Chinese labels. Do not write a title in the top-left corner. Do not write the structure type on the image. Do not make it a formal diagram, course slide, or dense explainer. Invent a fresh visual metaphor for this specific article. It should be clear but not instructional, interesting but not childish, strange but clean.
```

## 变量填充指引

Agent 根据文章内容填充以下变量：

| 变量 | 说明 | 示例 |
|------|------|------|
| Theme | 法律概念/争议焦点 | 商标维权中的混淆性近似认定 |
| Structure type | 适合的构图类型 | 概念隐喻、前后对比、角色状态 |
| Core idea | 1-2句核心法律要点 | "渝"为行政区划简称，"小面"为通用名称，均属公共资源 |
| Composition | 小黑动作+场景 | 小黑站在放大镜下，比对两碗面 |
| Suggested elements | 4个视觉元素 | 放大镜 / 两碗面对比 / 小黑举牌 / 简称标签 |
| Chinese handwritten labels | 4-5个中文标注 | 混淆性近似？ / 渝=重庆 / 公共资源 |

## 结构类型选择

- **概念隐喻**：将抽象法律概念具象化（如"必留份"→小黑从遗产盘里护住一块）
- **前后对比**：法律规定前后对比（如维权前vs维权后）
- **角色状态**：当事人/法官/律师的状态变化
- **Workflow**：法律程序/流程（如审判流程、维权步骤）
- **系统局部**：法律体系的某个环节（如商标审查机制）

## 颜色使用规范

- **黑色**：主体线稿、小黑、框线
- **橙色**：主流程、路径、箭头
- **红色**：重点提醒、问题、关键结果
- **蓝色**：补充说明、系统状态（可选，非必须）

## 常见法律主题对应构图

| 法律主题 | 推荐结构 | 构图思路 |
|---------|---------|---------|
| 商标侵权 | 概念隐喻 | 小黑比对两个相似标志 |
| 刑事案件 | 前后对比 | 犯罪→审判→量刑 |
| 民事纠纷 | 角色状态 | 原告vs被告天平 |
| 行政处罚 | Workflow | 违规→查处→处罚→整改 |
| 合同纠纷 | 系统局部 | 合同条款的天平/放大镜 |
| 知识产权 | 概念隐喻 | 小黑守护创意果实 |
| 劳动纠纷 | 前后对比 | 维权前vs维权后 |
