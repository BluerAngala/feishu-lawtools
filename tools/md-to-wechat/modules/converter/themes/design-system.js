/**
 * 设计系统 - 完全参考 md2wechat-skill 的 AI 主题 Prompt 规范
 * 提供与 AI 生成效果一致的排版
 */

/**
 * 获取主题的完整设计系统配置
 */
function getDesignSystem(themeName, colors) {
  const designSystems = {
    'spring-fresh': {
      // 主容器样式
      container: {
        backgroundColor: '#f5f8f5',
        padding: '40px 10px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        letterSpacing: '0.3px'
      },
      // 卡片样式 (section)
      card: {
        maxWidth: '800px',
        margin: '0 auto 40px auto',
        padding: '25px',
        backgroundColor: '#ffffff',
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(107, 155, 122, 0.08) 1px, transparent 0)',
        backgroundSize: '20px 20px',
        border: '1px solid rgba(107, 155, 122, 0.1)',
        borderRadius: '16px',
        boxShadow: '0 8px 24px rgba(74, 128, 88, 0.08), 0 0 12px rgba(107, 155, 122, 0.2)'
      },
      // 标题符号
      h2Symbol: '❀',
      h2SymbolColor: '#6b9b7a',
      h2SymbolShadow: '0 0 10px rgba(107, 155, 122, 0.4)',
      // h2 样式
      h2: {
        color: '#4a8058',
        borderBottom: '1px dashed rgba(74, 128, 88, 0.25)',
        paddingBottom: '12px',
        marginTop: '28px',
        marginBottom: '16px',
        fontSize: '22px',
        fontWeight: '600'
      },
      // h3 样式
      h3: {
        color: '#4a8058',
        borderBottom: '2px solid #6b9b7a',
        paddingBottom: '8px',
        marginTop: '22px',
        marginBottom: '12px',
        fontSize: '18px',
        fontWeight: '500'
      },
      // 段落样式
      paragraph: {
        color: '#3d4a3d',
        fontSize: '16px',
        lineHeight: '1.8',
        marginBottom: '16px'
      },
      // 强调样式
      strong: {
        color: '#4a8058'
      },
      // 引用样式
      blockquote: {
        backgroundColor: '#e8f0e8',
        borderLeft: '5px solid #6b9b7a',
        boxShadow: 'inset 0 0 12px rgba(107, 155, 122, 0.1)',
        padding: '20px 24px',
        borderRadius: '0 12px 12px 0',
        margin: '24px 0'
      },
      // 分割线样式
      hr: {
        border: 'none',
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(107, 155, 122, 0.3), transparent)',
        margin: '32px 0'
      },
      // 链接样式
      link: {
        color: '#6b9b7a',
        textDecoration: 'none'
      }
    },
    'autumn-warm': {
      container: {
        backgroundColor: '#faf9f5',
        padding: '40px 10px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        letterSpacing: '0.5px'
      },
      card: {
        maxWidth: '800px',
        margin: '0 auto 40px auto',
        padding: '25px',
        backgroundColor: '#ffffff',
        backgroundImage: 'linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
        border: '1px solid rgba(0, 0, 0, 0.05)',
        borderRadius: '18px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.04), 0 0 15px rgba(180, 83, 9, 0.3)'
      },
      h2Symbol: '▶',
      h2SymbolColor: '#b45309',
      h2SymbolShadow: '0 0 12px rgba(180, 83, 9, 0.4)',
      h2: {
        color: '#92400e',
        borderBottom: '1px dashed rgba(146, 64, 14, 0.3)',
        paddingBottom: '12px',
        marginTop: '28px',
        marginBottom: '16px',
        fontSize: '22px',
        fontWeight: '600'
      },
      h3: {
        color: '#b45309',
        borderBottom: '2px solid #b45309',
        paddingBottom: '8px',
        marginTop: '22px',
        marginBottom: '12px',
        fontSize: '18px',
        fontWeight: '500'
      },
      paragraph: {
        color: '#451a03',
        fontSize: '16px',
        lineHeight: '1.75',
        marginBottom: '16px'
      },
      strong: {
        color: '#92400e'
      },
      blockquote: {
        backgroundColor: '#fffbeb',
        borderLeft: '5px solid #b45309',
        boxShadow: 'inset 0 0 15px rgba(180, 83, 9, 0.08)',
        padding: '20px 24px',
        borderRadius: '0 12px 12px 0',
        margin: '24px 0'
      },
      hr: {
        border: 'none',
        height: '1px',
        backgroundColor: 'rgba(146, 64, 14, 0.15)',
        margin: '32px 0'
      },
      link: {
        color: '#b45309',
        textDecoration: 'none'
      }
    },
    'ocean-calm': {
      container: {
        backgroundColor: '#f0f4f8',
        padding: '40px 10px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        letterSpacing: '0.3px'
      },
      card: {
        maxWidth: '800px',
        margin: '0 auto 40px auto',
        padding: '25px',
        backgroundColor: '#ffffff',
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(66, 133, 180, 0.06) 1px, transparent 0)',
        backgroundSize: '20px 20px',
        border: '1px solid rgba(66, 133, 180, 0.1)',
        borderRadius: '16px',
        boxShadow: '0 8px 24px rgba(66, 133, 180, 0.08), 0 0 12px rgba(66, 133, 180, 0.15)'
      },
      h2Symbol: '◆',
      h2SymbolColor: '#4285b4',
      h2SymbolShadow: '0 0 10px rgba(66, 133, 180, 0.4)',
      h2: {
        color: '#2c5f7c',
        borderBottom: '1px dashed rgba(44, 95, 124, 0.25)',
        paddingBottom: '12px',
        marginTop: '28px',
        marginBottom: '16px',
        fontSize: '22px',
        fontWeight: '600'
      },
      h3: {
        color: '#2c5f7c',
        borderBottom: '2px solid #4285b4',
        paddingBottom: '8px',
        marginTop: '22px',
        marginBottom: '12px',
        fontSize: '18px',
        fontWeight: '500'
      },
      paragraph: {
        color: '#3d4a5d',
        fontSize: '16px',
        lineHeight: '1.8',
        marginBottom: '16px'
      },
      strong: {
        color: '#2c5f7c'
      },
      blockquote: {
        backgroundColor: '#e8f0f5',
        borderLeft: '5px solid #4285b4',
        boxShadow: 'inset 0 0 12px rgba(66, 133, 180, 0.1)',
        padding: '20px 24px',
        borderRadius: '0 12px 12px 0',
        margin: '24px 0'
      },
      hr: {
        border: 'none',
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(66, 133, 180, 0.3), transparent)',
        margin: '32px 0'
      },
      link: {
        color: '#4285b4',
        textDecoration: 'none'
      }
    },
    'cyber': {
      container: {
        backgroundColor: '#0a0a0a',
        padding: '40px 10px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        letterSpacing: '0.5px'
      },
      card: {
        maxWidth: '800px',
        margin: '0 auto 40px auto',
        padding: '25px',
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '8px',
        boxShadow: '0 0 20px rgba(255, 0, 255, 0.1), inset 0 0 20px rgba(0, 255, 255, 0.05)'
      },
      h2Symbol: '▸',
      h2SymbolColor: '#ff00ff',
      h2SymbolShadow: '0 0 10px rgba(255, 0, 255, 0.6)',
      h2: {
        color: '#ff00ff',
        textShadow: '0 0 10px rgba(255, 0, 255, 0.5)',
        borderBottom: '1px solid #ff00ff',
        paddingBottom: '12px',
        marginTop: '28px',
        marginBottom: '16px',
        fontSize: '24px',
        fontWeight: '700'
      },
      h3: {
        color: '#00ffff',
        borderLeft: '4px solid #00ffff',
        paddingLeft: '12px',
        marginTop: '22px',
        marginBottom: '12px',
        fontSize: '20px',
        fontWeight: '600'
      },
      paragraph: {
        color: '#e0e0e0',
        fontSize: '16px',
        lineHeight: '1.8',
        marginBottom: '16px'
      },
      strong: {
        color: '#ffff00',
        textShadow: '0 0 5px rgba(255, 255, 0, 0.5)'
      },
      blockquote: {
        backgroundColor: '#0a0a0a',
        border: '1px solid #00ffff',
        borderLeft: '4px solid #00ffff',
        boxShadow: '0 0 10px rgba(0, 255, 255, 0.2)',
        padding: '20px 24px',
        margin: '24px 0'
      },
      hr: {
        border: 'none',
        height: '1px',
        background: 'linear-gradient(90deg, transparent, #ff00ff, transparent)',
        margin: '32px 0'
      },
      link: {
        color: '#00ffff',
        textDecoration: 'none',
        textShadow: '0 0 5px rgba(0, 255, 255, 0.5)'
      }
    },
    'legal': {
      container: {
        padding: '0',
        fontFamily: "'PingFang SC', -apple-system-font, BlinkMacSystemFont, 'Helvetica Neue', 'Hirino Sans GB', 'Microsoft YaHei UI', 'Microsoft YaHei', Arial, sans-serif",
        lineHeight: '1.75',
        fontSize: '15px'
      },
      card: {
        maxWidth: '100%',
        margin: '0',
        padding: '0',
        backgroundColor: colors.surface || '#FFFFFF',
        borderRadius: '0'
      },
      h2Symbol: '⚖',
      h2SymbolColor: colors.brand || '#1E3A8A',
      h2SymbolShadow: '0 0 8px rgba(30, 58, 138, 0.3)',
      h1: {
        margin: '1.5em 0 0.75em 0',
        padding: '0',
        fontSize: '22px',
        fontWeight: 'bold',
        lineHeight: '1.4',
        color: colors.text || '#1F2937',
        textAlign: 'center'
      },
      h2: {
        color: colors.brand || '#1E3A8A',
        padding: '0',
        margin: '2em 0 0.75em 0',
        fontSize: '20px',
        fontWeight: 'bold',
        lineHeight: '1.4',
        textAlign: 'center'
      },
      h3: {
        color: colors.brand || '#1E3A8A',
        borderLeft: `4px solid ${colors.brand || '#1E3A8A'}`,
        padding: '0 0 0.4em 12px',
        margin: '2em 0 0.75em 0',
        fontSize: '18px',
        fontWeight: 'bold',
        lineHeight: '1.2'
      },
      paragraph: {
        color: colors.text || '#1F2937',
        fontSize: '15px',
        lineHeight: '2.1',
        margin: '1.2em 0',
        textAlign: 'justify',
        letterSpacing: '0.15em'
      },
      strong: {
        color: '#DC2626',
        fontWeight: 'bold'
      },
      blockquote: {
        margin: '0.8em 0',
        padding: '8px 12px',
        backgroundColor: '#F9FAFB',
        border: 'none',
        borderLeft: `3px solid #D1D5DB`,
        borderRadius: '3px',
        color: '#9CA3AF',
        fontSize: '13px',
        lineHeight: '1.7',
        letterSpacing: '0.05em'
      },
      hr: {
        border: 'none',
        height: '1px',
        background: `linear-gradient(to right, ${colors.brand || '#1E3A8A'}00, ${colors.brand || '#1E3A8A'}99, ${colors.brand || '#1E3A8A'}00)`,
        margin: '2em 0'
      },
      link: {
        color: colors.brand || '#1E3A8A',
        textDecoration: 'none'
      },
      list: {
        listStyle: 'none',
        margin: '0 0 1.5em',
        padding: '0',
        textAlign: 'left',
        color: colors.secondary || '#4B5563'
      },
      listItem: {
        margin: '0.5em 0',
        padding: '0',
        lineHeight: '1.75'
      }
    },
    'default': {
      container: {
        backgroundColor: colors.bg || '#f9f9f9',
        padding: '16px',
        fontFamily: "'PingFang SC', -apple-system-font, BlinkMacSystemFont, 'Helvetica Neue', 'Hirino Sans GB', 'Microsoft YaHei UI', 'Microsoft YaHei', Arial, sans-serif",
        lineHeight: '1.75',
        fontSize: '15px'
      },
      card: {
        maxWidth: '677px',
        margin: '0 auto',
        padding: '8px',
        backgroundColor: colors.surface || '#faf9f5',
        borderRadius: '12px',
        backgroundImage: `linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px)`,
        backgroundSize: '20px 20px'
      },
      h2Symbol: '',
      h1: {
        margin: '1.5em 8px 0.75em 8px',
        padding: '0',
        fontSize: '22px',
        fontWeight: 'bold',
        lineHeight: '1.4',
        color: colors.text || '#222222',
        textAlign: 'center'
      },
      h2: {
        color: colors.brand || '#C86442',
        padding: '0',
        margin: '2em 8px 0.75em 8px',
        fontSize: '20px',
        fontWeight: 'bold',
        lineHeight: '1.4',
        textAlign: 'center'
      },
      h3: {
        color: colors.secondary || '#3f3f3f',
        borderLeft: `4px solid ${colors.brand || '#C86442'}`,
        padding: '0 0 0.4em 12px',
        margin: '2em 8px 0.75em 0',
        fontSize: '18px',
        fontWeight: 'bold',
        lineHeight: '1.2'
      },
      paragraph: {
        color: colors.text || '#222222',
        fontSize: '15px',
        lineHeight: '2.1',
        margin: '1.2em 8px',
        textAlign: 'justify',
        letterSpacing: '0.15em'
      },
      strong: {
        color: colors.brand || '#C86442',
        fontWeight: 'bold'
      },
      blockquote: {
        margin: '1.5em 8px',
        padding: '16px 20px',
        backgroundColor: '#ffffff',
        border: `1px solid ${colors.border || '#e3c6b9'}`,
        borderRadius: '12px',
        boxShadow: '0 2px 6px rgba(85, 85, 85, 0.06)',
        color: colors.text || '#333333',
        fontSize: '15px',
        lineHeight: '2.1',
        letterSpacing: '0.15em'
      },
      hr: {
        border: 'none',
        height: '1px',
        background: `linear-gradient(to right, ${colors.brand || '#C86442'}00, ${colors.brand || '#C86442'}99, ${colors.brand || '#C86442'}00)`,
        margin: '2em 0'
      },
      link: {
        color: colors.brand || '#C86442',
        textDecoration: 'none'
      },
      list: {
        listStyle: 'none',
        margin: '0 8px 1.5em',
        padding: '0',
        textAlign: 'left',
        color: colors.secondary || '#3f3f3f'
      },
      listItem: {
        margin: '0.5em 0',
        padding: '0',
        lineHeight: '1.75'
      }
    }
  };

  return designSystems[themeName] || designSystems['default'];
}

/**
 * 将样式对象转换为内联样式字符串
 */
function generateInlineStyles(styles) {
  if (!styles || typeof styles !== 'object') {
    return '';
  }

  return Object.entries(styles)
    .map(([key, value]) => {
      // 将 camelCase 转换为 kebab-case
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${cssKey}: ${value}`;
    })
    .join('; ');
}

/**
 * 生成标题 HTML（双 span 结构）
 */
function generateHeadingHTML(level, text, ds) {
  const tag = `h${level}`;

  if (level === 2 && ds.h2Symbol) {
    // h2 使用双 span 结构
    const h2Styles = generateInlineStyles(ds.h2);
    const symbolStyles = `color: ${ds.h2SymbolColor}; text-shadow: ${ds.h2SymbolShadow}`;
    return `<${tag} style="${h2Styles}"><span style="${symbolStyles}">${ds.h2Symbol}</span><span>${text}</span></${tag}>`;
  }

  // 其他标题使用普通样式
  const styles = ds[tag] || {};
  const styleStr = generateInlineStyles(styles);
  return `<${tag} style="${styleStr}">${text}</${tag}>`;
}

/**
 * 生成段落 HTML（带内联颜色）
 */
function generateParagraphHTML(text, ds) {
  const styles = generateInlineStyles(ds.paragraph);
  return `<p style="${styles}">${text}</p>`;
}

/**
 * 生成引用块 HTML
 */
function generateBlockquoteHTML(content, ds) {
  const styles = generateInlineStyles(ds.blockquote);
  // Ensure long URLs wrap within blockquotes
  const wrapStyles = 'word-break: break-all; overflow-wrap: break-word;';
  return `<blockquote style="${styles}; ${wrapStyles}">${content}</blockquote>`;
}

/**
 * 生成强调文本 HTML
 */
function generateStrongHTML(text, ds) {
  const styles = generateInlineStyles(ds.strong);
  return `<strong style="${styles}">${text}</strong>`;
}

/**
 * 生成分割线 HTML
 */
function generateHrHTML(ds) {
  const styles = generateInlineStyles(ds.hr);
  return `<hr style="${styles}">`;
}

/**
 * 生成链接 HTML
 */
function generateLinkHTML(text, href, ds) {
  const styles = generateInlineStyles(ds.link);
  // Ensure long URLs wrap properly (WeChat mobile view)
  const wrapStyles = 'word-break: break-all; overflow-wrap: break-word;';
  return `<a href="${href}" style="${styles}; ${wrapStyles}">${text}</a>`;
}

module.exports = {
  getDesignSystem,
  generateInlineStyles,
  generateHeadingHTML,
  generateParagraphHTML,
  generateBlockquoteHTML,
  generateStrongHTML,
  generateHrHTML,
  generateLinkHTML
};
