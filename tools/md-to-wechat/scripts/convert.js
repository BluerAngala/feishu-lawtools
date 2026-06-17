#!/usr/bin/env node

/**
 * Markdown 转微信公众号排版 HTML
 * 使用公众号编辑器兼容的内联样式
 * 
 * 支持两种输入格式：
 * 1. 旧格式: .md 文件 + --config config.json
 * 2. 新格式: .json 文章文件（v2.0 分组配置 + 主题系统）
 */

const fs = require('fs');
const path = require('path');
const { getTheme, generateStyles, resolveColor } = require('./themes');

// 默认配置（v2.0 分组结构）
const defaultConfig = {
  header: {
    type: 'logo',  // 'logo' | 'image' | null
    logo: '',
    slogan: '',
    image: ''
  },
  nav: {
    enabled: true,
    links: []
  },
  footer: {
    enabled: true,
    author: '',
    date: ''
  },
  theme: 'legal',
  leadTitle: '导语'
};

/**
 * 转义 HTML 特殊字符
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 解析行内元素（加粗、斜体、链接等）
 */
function parseInline(text, styles) {
  let html = escapeHtml(text);

  // 图片 ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
    return `<img src="${url}" alt="${alt}" style="max-width:100%;display:block;margin:0 auto;">`;
  });

  // 链接 [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
    return `<a href="${url}" style="color:${styles.colors.brand};text-decoration:none;">${linkText}</a>`;
  });

  // 加粗 **text** 或 __text__
  html = html.replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (match, p1, p2) => {
    const content = p1 || p2;
    return `<strong style="color:${styles.colors.brand};">${content}</strong>`;
  });

  // 斜体 *text* 或 _text_
  html = html.replace(/\*([^*]+)\*|_([^_]+)_/g, (match, p1, p2) => {
    const content = p1 || p2;
    return `<em>${content}</em>`;
  });

  // 行内代码 `code`
  html = html.replace(/`([^`]+)`/g, (match, code) => {
    return `<span style="background:#f4f4f4;padding:2px 4px;border-radius:2px;font-family:monospace;font-size:0.9em;color:#666;">${code}</span>`;
  });

  return html;
}

/**
 * 生成头部
 */
function generateHeader(config, styles) {
  if (!config.header || config.header.type === null) return '';
  
  const headerStyle = styles.components.header;
  
  if (config.header.type === 'image' && config.header.image) {
    return `<div style="margin-bottom:20px;"><img src="${config.header.image}" style="width:100%;display:block;" alt="header"></div>`;
  }
  
  if (config.header.logo || config.header.slogan) {
    let html = `<div style="background:${headerStyle.bg};padding:${headerStyle.padding};text-align:center;margin-bottom:20px;`;
    if (headerStyle.color) html += `color:${headerStyle.color};`;
    if (headerStyle.borderBottom) html += `border-bottom:${headerStyle.borderBottom};`;
    if (headerStyle.boxShadow) html += `box-shadow:${headerStyle.boxShadow};`;
    html += '">';
    
    if (config.header.logo) {
      html += `<div style="font-size:24px;font-weight:bold;margin-bottom:8px;letter-spacing:2px;">${config.header.logo}</div>`;
    }
    if (config.header.slogan) {
      html += `<div style="font-size:13px;opacity:0.8;letter-spacing:1px;">${config.header.slogan}</div>`;
    }
    html += '</div>';
    return html;
  }
  
  return '';
}

/**
 * 生成导航栏
 */
function generateNav(config, styles) {
  if (!config.nav || !config.nav.enabled || !config.nav.links || config.nav.links.length === 0) {
    return '';
  }
  
  const navStyle = styles.components.nav;
  let html = `<nav style="text-align:center;padding:${navStyle.padding};background:${navStyle.bg};margin-bottom:20px;`;
  if (navStyle.borderBottom) html += `border-bottom:${navStyle.borderBottom};`;
  if (navStyle.boxShadow) html += `box-shadow:${navStyle.boxShadow};`;
  html += '">';
  
  config.nav.links.forEach((link, index) => {
    html += `<span style="font-size:14px;color:${styles.colors.secondary};">${link}</span>`;
    if (index < config.nav.links.length - 1) {
      html += `<span style="color:${styles.colors.border};margin:0 8px;">|</span>`;
    }
  });
  html += '</nav>';
  return html;
}

/**
 * 生成页脚
 */
function generateFooter(config, styles) {
  if (!config.footer || !config.footer.enabled) return '';
  
  const footerStyle = styles.components.footer;
  let html = `<footer style="text-align:center;padding:${footerStyle.padding};margin-top:30px;`;
  if (footerStyle.borderTop) html += `border-top:${footerStyle.borderTop};`;
  if (footerStyle.bg) html += `background:${footerStyle.bg};`;
  if (footerStyle.color) html += `color:${footerStyle.color};`;
  html += '">';
  
  if (config.footer.author) {
    html += `<p style="font-size:14px;color:${footerStyle.color || styles.colors.text};margin:0 0 5px 0;">${config.footer.author}</p>`;
  }
  if (config.footer.date) {
    html += `<p style="font-size:12px;color:${footerStyle.color || styles.colors.muted};margin:0;">${config.footer.date}</p>`;
  }
  html += '</footer>';
  return html;
}

/**
 * 生成导语区块
 */
function generateLeadSection(paragraphs, config, styles) {
  const leadStyle = styles.components.leadSection;
  let html = `<section style="margin:25px 16px;padding:${leadStyle.padding};background:${leadStyle.bg};`;
  if (leadStyle.borderRadius) html += `border-radius:${leadStyle.borderRadius};`;
  if (leadStyle.border) html += `border:${leadStyle.border};`;
  if (leadStyle.borderLeft) html += `border-left:${leadStyle.borderLeft};`;
  html += '">';
  
  // 导语标题
  html += `<h2 style="text-align:center;font-size:32px;color:${styles.colors.lead};margin:0 0 20px 0;font-weight:bold;letter-spacing:6px;text-shadow:1px 1px 2px rgba(0,0,0,0.1);">${config.leadTitle}</h2>`;
  
  // 导语段落
  paragraphs.forEach((paragraph, index) => {
    const isLast = index === paragraphs.length - 1;
    html += `<p style="font-size:${styles.lead.fontSize};color:${styles.lead.color};line-height:${styles.lead.lineHeight};text-align:justify;text-indent:${styles.lead.textIndent};margin:0 0 ${isLast ? '0' : '12px'} 0;`;
    if (styles.lead.fontStyle !== 'normal') html += `font-style:${styles.lead.fontStyle};`;
    html += `">${parseInline(paragraph, styles)}</p>`;
  });
  
  html += '</section>';
  return html;
}

/**
 * 生成标题
 */
function generateHeading(text, level, styles, hasSubtitle = false) {
  const style = level === 1 ? styles.heading1 : level === 2 ? styles.heading2 : styles.heading3;
  
  let html = '';
  
  if (level === 1) {
    html += `<h1 style="font-size:${style.fontSize};font-weight:${style.fontWeight};text-align:${style.textAlign};color:${style.color};margin:25px 16px 5px 16px;letter-spacing:${style.letterSpacing};">${escapeHtml(text)}</h1>`;
    if (hasSubtitle) {
      html += `<p style="font-size:${styles.subtitle.fontSize};color:${styles.subtitle.color};text-align:${styles.subtitle.textAlign};margin:0 16px 25px 16px;">${escapeHtml(hasSubtitle)}</p>`;
    }
  } else if (level === 2) {
    html += `<h2 style="font-size:${style.fontSize};font-weight:${style.fontWeight};text-align:${style.textAlign};color:${style.color};margin:0 16px 20px 16px;">${escapeHtml(text)}</h2>`;
  } else {
    html += `<h3 style="font-size:${style.fontSize};font-weight:${style.fontWeight};color:${style.color};margin:${style.marginTop} 16px ${style.marginBottom} 16px;`;
    if (style.paddingBottom) html += `padding:0 0 ${style.paddingBottom} 0;`;
    if (style.borderBottom && style.borderBottom !== 'none') html += `border-bottom:${style.borderBottom};`;
    html += `">${escapeHtml(text)}</h3>`;
  }
  
  return html;
}

/**
 * 生成段落
 */
function generateParagraph(text, styles) {
  return `<p style="font-size:${styles.paragraph.fontSize};color:${styles.paragraph.color};line-height:${styles.paragraph.lineHeight};text-align:${styles.paragraph.textAlign};text-indent:${styles.paragraph.textIndent};margin:0 16px 15px 16px;">${parseInline(text, styles)}</p>`;
}

/**
 * 生成列表
 */
function generateList(items, ordered, styles) {
  const tag = ordered ? 'ol' : 'ul';
  let html = `<${tag} style="margin:15px 16px;padding-left:20px;">`;
  items.forEach(item => {
    html += `<li style="font-size:${styles.paragraph.fontSize};color:${styles.paragraph.color};line-height:${styles.paragraph.lineHeight};margin-bottom:8px;">${parseInline(item, styles)}</li>`;
  });
  html += `</${tag}>`;
  return html;
}

/**
 * 生成分隔线
 */
function generateDivider(styles) {
  const dividerStyle = styles.components.divider;
  let html = `<hr style="border:none;margin:25px 16px;`;
  if (dividerStyle.height) html += `height:${dividerStyle.height};`;
  if (dividerStyle.bg) html += `background:${dividerStyle.bg};`;
  html += '">';
  return html;
}

/**
 * 生成引用块 - 使用优雅引号装饰，支持多种样式
 */
function generateBlockquote(text, styles) {
  const bqStyle = styles.components.blockquote;
  const quoteColor = bqStyle.quoteColor || styles.colors.accent;
  
  let html = `<blockquote style="margin:20px 16px;padding:${bqStyle.padding};background:${bqStyle.bg};`;
  if (bqStyle.borderRadius) html += `border-radius:${bqStyle.borderRadius};`;
  if (bqStyle.fontStyle) html += `font-style:${bqStyle.fontStyle};`;
  if (bqStyle.borderTop) html += `border-top:${bqStyle.borderTop};`;
  if (bqStyle.borderBottom) html += `border-bottom:${bqStyle.borderBottom};`;
  if (bqStyle.borderLeft) html += `border-left:${bqStyle.borderLeft};`;
  html += `position:relative;">`;
  
  // 使用优雅的引号装饰
  html += `<span style="position:absolute;top:12px;left:16px;font-size:32px;color:${quoteColor};opacity:0.4;line-height:1;font-family:Georgia,serif;">"</span>`;
  html += `<div style="padding-left:24px;color:${styles.colors.secondary};font-size:${styles.paragraph.fontSize};line-height:1.8;">${parseInline(text, styles)}</div>`;
  html += `</blockquote>`;
  return html;
}

/**
 * 生成图片
 */
function generateImage(src, alt, caption, styles) {
  let html = `<figure style="margin:20px 16px;text-align:center;">`;
  html += `<img src="${src}" alt="${alt || ''}" style="max-width:100%;display:block;margin:0 auto;border-radius:4px;">`;
  if (caption) {
    html += `<figcaption style="font-size:${styles.caption.fontSize};color:${styles.caption.color};text-align:${styles.caption.textAlign};margin-top:10px;`;
    if (styles.caption.fontStyle !== 'normal') html += `font-style:${styles.caption.fontStyle};`;
    html += `">${escapeHtml(caption)}</figcaption>`;
  }
  html += '</figure>';
  return html;
}

/**
 * 生成联系区块
 */
function generateContact(title, text, styles) {
  const contactStyle = styles.components.contact;
  let html = `<section style="margin:25px 16px;padding:${contactStyle.padding};background:${contactStyle.bg};`;
  if (contactStyle.borderRadius) html += `border-radius:${contactStyle.borderRadius};`;
  if (contactStyle.border) html += `border:${contactStyle.border};`;
  html += '">';
  html += `<h3 style="font-size:16px;color:${styles.colors.brand};font-weight:bold;margin:0 0 15px 0;text-align:center;">${escapeHtml(title)}</h3>`;
  html += `<p style="font-size:${styles.paragraph.fontSize};color:${styles.paragraph.color};line-height:${styles.paragraph.lineHeight};text-align:center;margin:0;">${parseInline(text, styles)}</p>`;
  html += '</section>';
  return html;
}

/**
 * 从 sections 数组生成 HTML
 */
function generateHTMLFromSections(sections, contentConfig, leadTitle, styles) {
  let html = '';
  let hasMainTitle = false;

  for (const section of sections) {
    switch (section.type) {
      case 'lead':
        html += generateLeadSection(section.paragraphs, { leadTitle }, styles);
        break;
      case 'heading':
        if (section.level === 1 && !hasMainTitle) {
          html += generateHeading(section.text, 1, styles, contentConfig.subtitle);
          hasMainTitle = true;
        } else {
          html += generateHeading(section.text, section.level || 3, styles);
        }
        break;
      case 'paragraph':
        html += generateParagraph(section.text, styles);
        break;
      case 'list':
        html += generateList(section.items, section.ordered, styles);
        break;
      case 'blockquote':
        html += generateBlockquote(section.text, styles);
        break;
      case 'image':
        html += generateImage(section.src, section.alt, section.caption, styles);
        break;
      case 'divider':
        html += generateDivider(styles);
        break;
      case 'contact':
        html += generateContact(section.title || '联系我们', section.text, styles);
        break;
      default:
        console.warn(`未知的 section type: ${section.type}`);
    }
  }

  return html;
}

/**
 * 生成完整的 HTML 文档（v2.0 JSON 格式）
 */
function generateHTMLFromJSON(articleData) {
  // 合并配置
  const config = {
    header: { ...defaultConfig.header, ...articleData.config?.header },
    nav: { ...defaultConfig.nav, ...articleData.config?.nav },
    footer: { ...defaultConfig.footer, ...articleData.config?.footer },
    theme: articleData.config?.theme || defaultConfig.theme,
    leadTitle: articleData.config?.leadTitle || defaultConfig.leadTitle
  };

  // 获取主题样式
  const theme = getTheme(config.theme);
  const styles = generateStyles(theme);

  const content = articleData.content;

  // 生成各部分
  const headerHTML = generateHeader(config, styles);
  const navHTML = generateNav(config, styles);
  const bodyContent = generateHTMLFromSections(content.sections, content, config.leadTitle, styles);
  const footerHTML = generateFooter(config, styles);

  // 组合完整 HTML
  return `<div style="max-width:750px;margin:0 auto;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;line-height:1.6;color:${styles.colors.text};">
${headerHTML}
${navHTML}
${bodyContent}
${footerHTML}
</div>`;
}

// ============ 旧格式兼容 ============

/**
 * 旧版默认配置
 */
const oldDefaultConfig = {
  title: '',
  subtitle: '',
  author: '',
  date: '',
  brandColor: '#c41e3a',
  accentColor: '#1e5aa8',
  leadColor: '#c9a227',
  textColor: '#333333',
  secondaryColor: '#666666',
  navBgColor: '#f5f5f5',
  headerImage: '',
  logo: '',
  slogan: '',
  navLinks: [],
  leadTitle: '导语'
};

/**
 * 解析 Markdown 为 HTML（旧格式兼容）
 */
function parseMarkdown(md, config) {
  // 使用 legal 主题作为旧格式默认
  const theme = getTheme('legal');
  const styles = generateStyles(theme);
  
  // 覆盖颜色
  styles.colors.brand = config.brandColor;
  styles.colors.accent = config.accentColor;
  styles.colors.lead = config.leadColor;
  styles.colors.text = config.textColor;
  styles.colors.secondary = config.secondaryColor;

  const lines = md.split('\n');
  let html = '';
  let inList = false;
  let inLead = false;
  let listType = '';
  let leadContents = [];
  let skipUntilNextEmpty = false;
  let hasMainTitle = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (line.startsWith('```')) {
      if (!skipUntilNextEmpty) {
        skipUntilNextEmpty = true;
        html += `<p style="font-size:14px;color:#999;margin:10px 0;padding:10px;background:#f9f9f9;border-left:3px solid #ddd;">[代码块]</p>`;
      } else {
        skipUntilNextEmpty = false;
      }
      continue;
    }

    if (skipUntilNextEmpty) continue;

    if (line.trim() === '') {
      if (inList) {
        html += listType === 'ol' ? '</ol>' : '</ul>';
        inList = false;
        listType = '';
      }
      continue;
    }

    if (line.startsWith('# ') && !line.startsWith('## ')) {
      if (inLead && leadContents.length > 0) {
        html += generateLeadSection(leadContents, { leadTitle: config.leadTitle }, styles);
        leadContents = [];
        inLead = false;
      }
      if (hasMainTitle) continue;
      const title = line.substring(2).trim();
      html += generateHeading(title, 1, styles, config.subtitle);
      hasMainTitle = true;
      continue;
    }

    if (line.startsWith('## ')) {
      if (inLead && leadContents.length > 0) {
        html += generateLeadSection(leadContents, { leadTitle: config.leadTitle }, styles);
        leadContents = [];
        inLead = false;
      }
      const subtitle = line.substring(3).trim();
      html += generateHeading(subtitle, 2, styles);
      continue;
    }

    if (line.startsWith('### ')) {
      if (inLead && leadContents.length > 0) {
        html += generateLeadSection(leadContents, { leadTitle: config.leadTitle }, styles);
        leadContents = [];
        inLead = false;
      }
      const heading = line.substring(4).trim();
      html += generateHeading(heading, 3, styles);
      continue;
    }

    if (line.startsWith('> ')) {
      inLead = true;
      leadContents.push(line.substring(2));
      continue;
    }

    if (line.match(/^[-*+]\s/)) {
      if (inLead && leadContents.length > 0) {
        html += generateLeadSection(leadContents, { leadTitle: config.leadTitle }, styles);
        leadContents = [];
        inLead = false;
      }
      if (!inList || listType !== 'ul') {
        if (inList) html += listType === 'ol' ? '</ol>' : '</ul>';
        html += `<ul style="margin:15px 16px;padding-left:20px;">`;
        inList = true;
        listType = 'ul';
      }
      const content = line.substring(2).trim();
      html += `<li style="font-size:15px;color:${styles.colors.text};line-height:1.8;margin-bottom:8px;">${parseInline(content, styles)}</li>`;
      continue;
    }

    if (line.match(/^\d+\.\s/)) {
      if (inLead && leadContents.length > 0) {
        html += generateLeadSection(leadContents, { leadTitle: config.leadTitle }, styles);
        leadContents = [];
        inLead = false;
      }
      if (!inList || listType !== 'ol') {
        if (inList) html += listType === 'ol' ? '</ol>' : '</ul>';
        html += `<ol style="margin:15px 16px;padding-left:20px;">`;
        inList = true;
        listType = 'ol';
      }
      const content = line.replace(/^\d+\.\s/, '').trim();
      html += `<li style="font-size:15px;color:${styles.colors.text};line-height:1.8;margin-bottom:8px;">${parseInline(content, styles)}</li>`;
      continue;
    }

    if (line.match(/^---+$/)) {
      if (inLead && leadContents.length > 0) {
        html += generateLeadSection(leadContents, { leadTitle: config.leadTitle }, styles);
        leadContents = [];
        inLead = false;
      }
      html += generateDivider(styles);
      continue;
    }

    if (inLead && leadContents.length > 0) {
      html += generateLeadSection(leadContents, { leadTitle: config.leadTitle }, styles);
      leadContents = [];
      inLead = false;
    }
    html += generateParagraph(line, styles);
  }

  if (inList) html += listType === 'ol' ? '</ol>' : '</ul>';
  if (inLead && leadContents.length > 0) {
    html += generateLeadSection(leadContents, { leadTitle: config.leadTitle }, styles);
  }

  return html;
}

/**
 * 生成旧格式 HTML
 */
function generateOldHTML(content, config) {
  const theme = getTheme('legal');
  const styles = generateStyles(theme);
  
  styles.colors.brand = config.brandColor;
  styles.colors.accent = config.accentColor;
  styles.colors.lead = config.leadColor;
  styles.colors.text = config.textColor;
  styles.colors.secondary = config.secondaryColor;

  const bodyContent = parseMarkdown(content, config);

  // 导航栏
  let navHTML = '';
  if (config.navLinks && config.navLinks.length > 0) {
    navHTML = `<nav style="text-align:center;padding:12px 0;background:${config.navBgColor};margin-bottom:20px;">`;
    config.navLinks.forEach((link, index) => {
      navHTML += `<span style="font-size:14px;color:${config.secondaryColor};">${link}</span>`;
      if (index < config.navLinks.length - 1) {
        navHTML += `<span style="color:#ccc;margin:0 8px;">|</span>`;
      }
    });
    navHTML += '</nav>';
  }

  // 头部
  let headerHTML = '';
  if (config.headerImage) {
    headerHTML = `<div style="margin-bottom:20px;"><img src="${config.headerImage}" style="width:100%;display:block;" alt="header"></div>`;
  } else if (config.logo || config.slogan) {
    headerHTML = `<div style="background:#1a1a2e;padding:30px 20px;text-align:center;margin-bottom:20px;">`;
    if (config.logo) {
      headerHTML += `<div style="font-size:24px;color:#fff;font-weight:bold;margin-bottom:8px;letter-spacing:2px;">${config.logo}</div>`;
    }
    if (config.slogan) {
      headerHTML += `<div style="font-size:13px;color:rgba(255,255,255,0.8);letter-spacing:1px;">${config.slogan}</div>`;
    }
    headerHTML += '</div>';
  }

  // 页脚
  let footerHTML = '';
  if (config.author || config.date) {
    footerHTML = `<footer style="text-align:center;padding:20px;margin-top:30px;border-top:1px solid #eee;">`;
    if (config.author) {
      footerHTML += `<p style="font-size:14px;color:${config.textColor};margin:0 0 5px 0;">${config.author}</p>`;
    }
    if (config.date) {
      footerHTML += `<p style="font-size:12px;color:#999;margin:0;">${config.date}</p>`;
    }
    footerHTML += '</footer>';
  }

  return `<div style="max-width:750px;margin:0 auto;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;line-height:1.6;color:${config.textColor};">
${headerHTML}
${navHTML}
${bodyContent}
${footerHTML}
</div>`;
}

// ============ 工具函数 ============

function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) return {};
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    console.warn('配置文件解析失败，使用默认配置');
    return {};
  }
}

function loadArticleJSON(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`找不到文件: ${filePath}`);
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`JSON 解析失败: ${e.message}`);
  }
}

function isNewFormatJSON(filePath) {
  if (!filePath.endsWith('.json')) return false;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    // v2.0 特征: version >= 2.0 或包含新的分组结构
    return (data.version && parseFloat(data.version) >= 2.0) || 
           (data.config && (data.config.header !== undefined || data.config.nav !== undefined || data.config.footer !== undefined));
  } catch (e) {
    return false;
  }
}

function isOldFormatJSON(filePath) {
  if (!filePath.endsWith('.json')) return false;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    // 旧格式特征: 包含 version 1.x 或 content.sections 但没有新的分组结构
    return (data.version && parseFloat(data.version) < 2.0) ||
           (data.content && Array.isArray(data.content.sections) && !data.config?.header && !data.config?.nav);
  } catch (e) {
    return false;
  }
}

// ============ 主函数 ============

function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log(`
使用方法:
  # v2.0 新格式（推荐）: JSON 文章文件
  node convert.js <article.json> [output.html]

  # v1.0 旧格式（兼容）: Markdown + 配置文件
  node convert.js <input.md> [output.html] [--config config.json]

示例:
  node convert.js article.json
  node convert.js article.md --config config.json

v2.0 JSON 文章格式:
{
  "version": "2.0",
  "config": {
    "header": { "type": "logo", "logo": "品牌", "slogan": "标语" },
    "nav": { "enabled": true, "links": ["文章", "产品"] },
    "footer": { "enabled": true, "author": "作者", "date": "2026-01-01" },
    "theme": "legal",
    "leadTitle": "导语"
  },
  "content": {
    "title": "标题",
    "subtitle": "副标题",
    "sections": [
      { "type": "lead", "paragraphs": [...] },
      { "type": "heading", "level": 3, "text": "..." },
      { "type": "paragraph", "text": "..." },
      { "type": "list", "ordered": false, "items": [...] },
      { "type": "image", "src": "...", "alt": "...", "caption": "..." },
      { "type": "blockquote", "text": "..." },
      { "type": "divider" },
      { "type": "contact", "title": "...", "text": "..." }
    ]
  }
}

主题 (theme):
  - legal: 法律/商务风格（默认）
  - minimal: 简约现代风格
  - academic: 学术严谨风格
  - warm: 温暖亲和风格
  - neumorphism: 新拟态风格
  - glass: 玻璃拟态风格
  - retro: 复古报纸风格

配置说明:
  - header.type: "logo" | "image" | null (null 表示不显示头部)
  - nav.enabled: true | false (控制导航栏显示)
  - footer.enabled: true | false (控制页脚显示)

输出: 所有 HTML 文件默认输出到 output/ 文件夹
`);
    process.exit(1);
  }

  const inputFile = args[0];
  
  // 确保 output 文件夹存在
  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // 检测格式
  if (isNewFormatJSON(inputFile)) {
    // v2.0 新格式
    const baseName = path.basename(inputFile, path.extname(inputFile));
    const outputFile = args[1] || path.join('output', `${baseName}.html`);
    
    try {
      const articleData = loadArticleJSON(inputFile);
      const html = generateHTMLFromJSON(articleData);
      fs.writeFileSync(outputFile, html, 'utf-8');
      
      const theme = articleData.config?.theme || 'legal';
      console.log(`✅ 转换成功! (v2.0 ${theme} 主题)`);
      console.log(`📄 输入: ${inputFile}`);
      console.log(`📝 输出: ${outputFile}`);
      console.log(`\n提示: 打开 ${outputFile}，复制内容到微信公众号编辑器`);
    } catch (e) {
      console.error(`❌ 错误: ${e.message}`);
      process.exit(1);
    }
  } else if (isOldFormatJSON(inputFile)) {
    // v1.0 旧格式 JSON
    const baseName = path.basename(inputFile, path.extname(inputFile));
    const outputFile = args[1] || path.join('output', `${baseName}.html`);
    
    try {
      const articleData = loadArticleJSON(inputFile);
      // 转换为新格式处理
      const convertedConfig = {
        header: articleData.config?.logo || articleData.config?.slogan ? {
          type: 'logo',
          logo: articleData.config?.logo || '',
          slogan: articleData.config?.slogan || ''
        } : null,
        nav: {
          enabled: !!(articleData.config?.navLinks && articleData.config.navLinks.length > 0),
          links: articleData.config?.navLinks || []
        },
        footer: {
          enabled: !!(articleData.config?.author || articleData.config?.date),
          author: articleData.config?.author || '',
          date: articleData.config?.date || ''
        },
        theme: 'legal',
        leadTitle: articleData.config?.leadTitle || '导语'
      };
      
      const newFormatData = {
        version: '2.0',
        config: convertedConfig,
        content: articleData.content
      };
      
      const html = generateHTMLFromJSON(newFormatData);
      fs.writeFileSync(outputFile, html, 'utf-8');
      
      console.log(`✅ 转换成功! (v1.0 → v2.0 兼容模式)`);
      console.log(`📄 输入: ${inputFile}`);
      console.log(`📝 输出: ${outputFile}`);
    } catch (e) {
      console.error(`❌ 错误: ${e.message}`);
      process.exit(1);
    }
  } else {
    // Markdown 旧格式
    const baseName = path.basename(inputFile, path.extname(inputFile));
    const outputFile = args[1] || path.join('output', `${baseName}.html`);
    const configIndex = args.indexOf('--config');
    const configPath = configIndex !== -1 ? args[configIndex + 1] : null;
    const userConfig = configPath ? loadConfig(configPath) : {};
    const config = { ...oldDefaultConfig, ...userConfig };

    if (!fs.existsSync(inputFile)) {
      console.error(`错误: 找不到文件 ${inputFile}`);
      process.exit(1);
    }

    const markdown = fs.readFileSync(inputFile, 'utf-8');
    if (!config.title) {
      const titleMatch = markdown.match(/^#\s+(.+)$/m);
      if (titleMatch) config.title = titleMatch[1].trim();
    }

    const html = generateOldHTML(markdown, config);
    fs.writeFileSync(outputFile, html, 'utf-8');

    console.log(`✅ 转换成功! (Markdown 格式)`);
    console.log(`📄 输入: ${inputFile}`);
    console.log(`📝 输出: ${outputFile}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  generateHTMLFromJSON,
  generateOldHTML,
  parseMarkdown,
  defaultConfig,
  oldDefaultConfig
};
