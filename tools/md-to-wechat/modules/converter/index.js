/**
 * Converter Module - 文章排版转换模块
 *
 * 职责：Markdown → 微信 HTML 转换
 * 包含：主题系统、排版模块、本地预览
 * 实现方式：参考 md2wechat-skill 的 AI 主题，使用纯内联样式
 */

const fs = require('fs');
const path = require('path');
const { getTheme, listThemes, loadCustomThemes } = require('./themes');
const { getDesignSystem, generateInlineStyles, generateHeadingHTML, generateParagraphHTML, generateBlockquoteHTML, generateStrongHTML, generateHrHTML, generateLinkHTML } = require('./themes/design-system');

const MODULE_NAME = 'converter';
const MODULE_DESC = '文章排版转换：Markdown → 微信 HTML';

let moduleConfig = {};
let customThemes = {};

/**
 * 检查模块是否可用
 * 此模块为基础模块，始终可用
 */
function isAvailable() {
  return true;
}

/**
 * 模块初始化
 */
function init(config) {
  moduleConfig = config.converter || {};

  // 加载用户自定义主题
  const customThemesDir = path.join(
    require('os').homedir(),
    '.config',
    'md-to-wechat',
    'themes'
  );
  customThemes = loadCustomThemes(customThemesDir);

  console.log(`[${MODULE_NAME}] 模块已初始化`);
  console.log(`[${MODULE_NAME}] 默认主题: ${moduleConfig.defaultTheme || 'legal'}`);
  console.log(`[${MODULE_NAME}] 可用主题: ${listThemes().length} 个`);
  if (Object.keys(customThemes).length > 0) {
    console.log(`[${MODULE_NAME}] 自定义主题: ${Object.keys(customThemes).join(', ')}`);
  }
}

/**
 * 转换 Markdown 为微信 HTML
 */
async function convertMarkdown(inputFile, options = {}) {
  // 检查文件是否存在
  if (!fs.existsSync(inputFile)) {
    throw new Error(`文件不存在: ${inputFile}`);
  }

  // 读取 Markdown 内容
  const content = fs.readFileSync(inputFile, 'utf-8');

  // 解析 frontmatter
  const { frontmatter, body } = parseFrontmatter(content);

  // 获取主题
  const themeName = options.theme || frontmatter.theme || moduleConfig.defaultTheme || 'legal';
  const theme = getTheme(themeName, customThemes);

  console.log(`使用主题: ${theme.name} (${theme.description || ''})`);

  // 渲染 HTML
  const html = renderHTML(body, theme, frontmatter, themeName);

  return {
    html,
    theme: theme.name,
    frontmatter
  };
}

/**
 * 解析 frontmatter
 */
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterText = match[1];
  const body = match[2];

  // 简单 YAML 解析
  const frontmatter = {};
  const lines = frontmatterText.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim().replace(/^["']|["']$/g, '');
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
}

/**
 * 渲染 HTML - 使用内联样式，参考 md2wechat-skill AI 主题
 */
function renderHTML(markdown, theme, frontmatter, themeName) {
  // 获取设计系统
  const ds = getDesignSystem(themeName, theme.colors);

  // 转换 Markdown 为带内联样式的 HTML
  const contentHtml = markdownToInlineHTML(markdown, ds);

  // 构建完整 HTML
  const title = frontmatter.title || '未命名文章';
  const containerStyles = generateInlineStyles(ds.container);
  const cardStyles = generateInlineStyles(ds.card);

  // 标题样式（使用主题配置）
  const { typography, components } = theme;
  const headerBg = components.header?.bg || theme.colors.bg;
  const headerColor = getContrastColor(headerBg);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body>
  <div style="${containerStyles}">
    <section style="${cardStyles}">
      <header style="${generateComponentStyles(components.header)}; margin: -25px -25px 24px -25px; padding: 36px 25px; text-align: center;">
        <h1 style="font-size: ${typography.title.size}; font-weight: ${typography.title.weight}; color: ${headerColor}; margin: 0; ${typography.title.letterSpacing ? `letter-spacing: ${typography.title.letterSpacing};` : ''}">${title}</h1>
        ${frontmatter.subtitle ? `<p style="font-size: ${typography.subtitle.size}; color: ${headerColor}; opacity: 0.85; margin: 12px 0 0 0;">${frontmatter.subtitle}</p>` : ''}
      </header>
      ${contentHtml}
      ${frontmatter.author ? `<footer style="margin-top: 32px; padding-top: 20px; border-top: 1px solid rgba(0,0,0,0.1); text-align: center;">
        <p style="font-size: 14px; color: ${ds.paragraph?.color || '#333333'}; margin: 0;">作者：${frontmatter.author}</p>
      </footer>` : ''}
    </section>
  </div>
</body>
</html>`;
}

/**
 * Markdown 转 HTML - 使用内联样式
 */
function markdownToInlineHTML(markdown, ds) {
  let html = markdown;

  // 转义 HTML 特殊字符
  html = html.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;');

  // 处理代码块（在段落处理之前）
  html = processCodeBlocks(html);

  // 处理引用块（在段落处理之前）
  html = processBlockquotes(html, ds);

  // 处理标题 - 使用设计系统的双 span 结构
  html = html.replace(/^### (.*$)/gim, (match, text) => {
    return generateHeadingHTML(3, text.trim(), ds);
  });
  html = html.replace(/^## (.*$)/gim, (match, text) => {
    return generateHeadingHTML(2, text.trim(), ds);
  });
  html = html.replace(/^# (.*$)/gim, (match, text) => {
    return generateHeadingHTML(1, text.trim(), ds);
  });

  // 处理分割线
  html = html.replace(/^---$/gim, generateHrHTML(ds));
  html = html.replace(/^\*\*\*$/gim, generateHrHTML(ds));

  // 处理粗体 - 使用设计系统样式
  html = html.replace(/\*\*(.*?)\*\*/g, (match, text) => {
    return generateStrongHTML(text, ds);
  });
  html = html.replace(/__(.*?)__/g, (match, text) => {
    return generateStrongHTML(text, ds);
  });

  // 处理斜体
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');

  // 处理链接 - 使用设计系统样式
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, href) => {
    return generateLinkHTML(text, href, ds);
  });

  // 处理图片
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; height: auto; display: block; margin: 20px auto;" />');

  // 处理无序列表
  html = processUnorderedLists(html, ds);

  // 处理有序列表
  html = processOrderedLists(html, ds);

  // 处理段落 - 使用设计系统样式
  html = processParagraphs(html, ds);

  return html;
}

/**
 * 处理代码块
 */
function processCodeBlocks(html) {
  // 多行代码块 ```code```
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const escapedCode = code.trim()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<pre style="background: #f5f5f5; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 14px; line-height: 1.6;"><code>${escapedCode}</code></pre>`;
  });

  // 行内代码 `code`
  html = html.replace(/`([^`]+)`/g, '<code style="background: #f5f5f5; padding: 2px 6px; border-radius: 4px; font-size: 14px; font-family: monospace;">$1</code>');

  return html;
}

/**
 * 处理引用块
 */
function processBlockquotes(html, ds) {
  const lines = html.split('\n');
  const result = [];
  let inBlockquote = false;
  let blockquoteContent = [];

  for (let rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    const trimmed = line.trim();
    if (trimmed.startsWith('&gt; ') || trimmed === '&gt;') {
      if (!inBlockquote) {
        inBlockquote = true;
        blockquoteContent = [];
      }
      if (trimmed.startsWith('&gt; ')) {
        blockquoteContent.push(trimmed.slice(5));
      }
    } else if (trimmed === '') {
      if (inBlockquote) {
        blockquoteContent.push('');
      }
      result.push(line);
    } else {
      if (inBlockquote) {
        const content = blockquoteContent.map(l => `<p style="margin: 0.6em 0; word-break: break-all; overflow-wrap: break-word;">${l}</p>`).join('');
        result.push(generateBlockquoteHTML(content, ds));
        inBlockquote = false;
        blockquoteContent = [];
      }
      result.push(line);
    }
  }

  if (inBlockquote) {
    const content = blockquoteContent.map(l => `<p style="margin: 0.6em 0; word-break: break-all; overflow-wrap: break-word;">${l}</p>`).join('');
    result.push(generateBlockquoteHTML(content, ds));
  }

  return result.join('\n');
}

/**
 * 处理无序列表 - 使用设计系统样式
 */
function processUnorderedLists(html, ds) {
  const lines = html.split('\n');
  const result = [];
  let inList = false;
  let listItems = [];

  // 获取列表样式
  const listStyles = ds.list || {};
  const listItemStyles = ds.listItem || {};

  const listStyleStr = generateInlineStyles(listStyles);
  const listItemStyleStr = generateInlineStyles(listItemStyles);

  for (const line of lines) {
    const match = line.match(/^\s*[-*+] (.*$)/);
    if (match) {
      if (!inList) {
        inList = true;
        listItems = [];
      }
      listItems.push(match[1]);
    } else {
      if (inList) {
        // 结束列表
        const items = listItems.map(item => `<li style="${listItemStyleStr || 'margin: 8px 0; line-height: 1.75;'}">• ${item}</li>`).join('');
        result.push(`<ul style="${listStyleStr || 'margin: 16px 0; padding-left: 24px;'}">${items}</ul>`);
        inList = false;
        listItems = [];
      }
      result.push(line);
    }
  }

  // 处理未闭合的列表
  if (inList) {
    const items = listItems.map(item => `<li style="${listItemStyleStr || 'margin: 8px 0; line-height: 1.75;'}">• ${item}</li>`).join('');
    result.push(`<ul style="${listStyleStr || 'margin: 16px 0; padding-left: 24px;'}">${items}</ul>`);
  }

  return result.join('\n');
}

/**
 * 处理有序列表 - 使用设计系统样式
 */
function processOrderedLists(html, ds) {
  const lines = html.split('\n');
  const result = [];
  let inList = false;
  let listItems = [];
  let itemIndex = 1;

  // 获取列表样式
  const listStyles = ds.list || {};
  const listItemStyles = ds.listItem || {};

  const listStyleStr = generateInlineStyles(listStyles);
  const listItemStyleStr = generateInlineStyles(listItemStyles);

  for (const line of lines) {
    const match = line.match(/^\s*\d+\. (.*$)/);
    if (match) {
      if (!inList) {
        inList = true;
        listItems = [];
        itemIndex = 1;
      }
      listItems.push({ index: itemIndex, content: match[1] });
      itemIndex++;
    } else {
      if (inList) {
        // 结束列表
        const items = listItems.map(item => `<li style="${listItemStyleStr || 'margin: 8px 0; line-height: 1.75;'}">${item.index}. ${item.content}</li>`).join('');
        result.push(`<ol style="${listStyleStr || 'margin: 16px 0; padding-left: 24px;'}">${items}</ol>`);
        inList = false;
        listItems = [];
      }
      result.push(line);
    }
  }

  // 处理未闭合的列表
  if (inList) {
    const items = listItems.map(item => `<li style="${listItemStyleStr || 'margin: 8px 0; line-height: 1.75;'}">${item.index}. ${item.content}</li>`).join('');
    result.push(`<ol style="${listStyleStr || 'margin: 16px 0; padding-left: 24px;'}">${items}</ol>`);
  }

  return result.join('\n');
}

/**
 * 处理段落 - 使用设计系统样式
 */
function processParagraphs(html, ds) {
  const lines = html.split('\n');
  const result = [];
  let paragraphBuffer = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // 如果是空行，结束当前段落
    if (trimmedLine === '') {
      if (paragraphBuffer.length > 0) {
        const text = paragraphBuffer.join(' ');
        result.push(generateParagraphHTML(text, ds));
        paragraphBuffer = [];
      }
      continue;
    }

    // 如果是块级元素，结束当前段落并保留该行
    if (trimmedLine.match(/^<(h[1-6]|ul|ol|blockquote|pre|hr|section|header|footer)/)) {
      if (paragraphBuffer.length > 0) {
        const text = paragraphBuffer.join(' ');
        result.push(generateParagraphHTML(text, ds));
        paragraphBuffer = [];
      }
      result.push(line);
      continue;
    }

    // 如果是闭合标签，保留
    if (trimmedLine.match(/^<\/(h[1-6]|ul|ol|blockquote|pre|section|header|footer)/)) {
      result.push(line);
      continue;
    }

    // 普通文本，加入段落缓冲区
    paragraphBuffer.push(line);
  }

  // 处理最后未闭合的段落
  if (paragraphBuffer.length > 0) {
    const text = paragraphBuffer.join(' ');
    result.push(generateParagraphHTML(text, ds));
  }

  return result.join('\n');
}

/**
 * 生成组件样式
 */
function generateComponentStyles(component) {
  if (!component) return '';

  const styles = [];

  if (component.bg) styles.push(`background: ${component.bg};`);
  if (component.color) styles.push(`color: ${component.color};`);
  if (component.padding) styles.push(`padding: ${component.padding};`);
  if (component.borderRadius) styles.push(`border-radius: ${component.borderRadius};`);
  if (component.border) styles.push(`border: ${component.border};`);
  if (component.borderTop) styles.push(`border-top: ${component.borderTop};`);
  if (component.borderBottom) styles.push(`border-bottom: ${component.borderBottom};`);
  if (component.borderLeft) styles.push(`border-left: ${component.borderLeft};`);

  return styles.join(' ');
}

/**
 * 获取对比色（黑或白）
 */
function getContrastColor(bgColor) {
  const rgb = hexToRgb(bgColor);
  if (!rgb) return '#FFFFFF';

  // 计算亮度 (YIQ 公式)
  const yiq = ((rgb[0] * 299) + (rgb[1] * 587) + (rgb[2] * 114)) / 1000;
  return yiq >= 128 ? '#000000' : '#FFFFFF';
}

/**
 * Hex 转 RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : null;
}

/**
 * 模块命令定义
 */
const commands = {
  'convert': {
    description: '转换 Markdown 为微信 HTML',
    args: ['<input-file>'],
    options: [
      { name: '--theme', description: '指定主题' },
      { name: '-o, --output', description: '输出文件路径' }
    ],
    run: async (args) => {
      // CLI 格式: md2wechat converter convert <file> [options]
      // args._[0] = 'converter', args._[1] = 'convert', args._[2] = <file>
      const inputFile = args._[2];
      const outputFile = args.output || args.o;
      const theme = args.theme || 'legal';

      if (!inputFile) {
        console.error('❌ 错误: 请指定输入文件');
        console.log('用法: md2wechat converter convert <input-file> --theme <theme> -o <output>');
        return { success: false, error: 'Missing input file' };
      }

      try {
        const result = await convertMarkdown(inputFile, { theme });

        if (outputFile) {
          fs.writeFileSync(outputFile, result.html, 'utf-8');
          console.log(`✅ 转换成功，已保存到: ${outputFile}`);
        } else {
          console.log(result.html);
        }

        return { success: true, theme: result.theme };
      } catch (err) {
        console.error(`❌ 转换失败: ${err.message}`);
        return { success: false, error: err.message };
      }
    }
  },
  'themes': {
    description: '列出可用主题',
    run: () => {
      const themes = listThemes();
      console.log('\n📋 可用主题列表:\n');
      themes.forEach(t => {
        console.log(`  ${t.name.padEnd(15)} - ${t.desc}`);
      });
      console.log(`\n共 ${themes.length} 个主题\n`);
      return { success: true, themes };
    }
  }
};

module.exports = {
  name: MODULE_NAME,
  description: MODULE_DESC,
  isAvailable,
  init,
  commands,
  convertMarkdown
};
