/**
 * 预设主题配置 - 基于 ui-ux-pro-max 设计规范
 * 专业排版设计，符合公众号显示规范
 */

const themes = {
  // 岭南法律风格 - 默认主题
  // 参考 Legal Services 配色: #1E3A8A (权威蓝) + #B45309 (信任金)
  legal: {
    colors: {
      brand: '#1E3A8A',      // 权威深蓝
      accent: '#B45309',     // 琥珀金
      lead: '#92400E',       // 深棕色导语
      text: '#1F2937',       // 正文深灰
      secondary: '#4B5563',  // 次要文字
      muted: '#9CA3AF',      // 辅助文字
      border: '#E5E7EB',     // 边框
      bg: '#FAFAFA',         // 背景
      surface: '#FFFFFF'     // 卡片表面
    },
    typography: {
      title: { size: '22px', weight: '600', align: 'center', letterSpacing: '0.5px' },
      subtitle: { size: '15px', weight: '400', align: 'center', color: 'secondary' },
      h1: { size: '22px', weight: '600', align: 'center', color: 'brand' },
      h2: { size: '16px', weight: '400', align: 'center', color: 'secondary' },
      h3: { size: '16px', weight: '600', color: 'brand', marginTop: '28px', marginBottom: '12px' },
      paragraph: { size: '16px', lineHeight: '1.85', indent: '2em', align: 'justify' },
      lead: { size: '15px', lineHeight: '1.9', indent: '2em', color: 'lead' },
      caption: { size: '13px', color: 'muted', align: 'center' }
    },
    components: {
      header: { bg: '#1E3A8A', color: '#fff', padding: '28px 20px' },
      nav: { bg: '#F3F4F6', padding: '10px 0' },
      leadSection: { bg: '#FFFBEB', padding: '22px 20px', borderRadius: '6px', border: '1px solid #FDE68A' },
      // 移除左侧边框，改用优雅的引号装饰
      blockquote: { 
        bg: '#F9FAFB', 
        padding: '20px 24px', 
        borderRadius: '6px',
        border: 'none',
        quoteColor: '#B45309'
      },
      contact: { bg: '#F9FAFB', padding: '20px', borderRadius: '6px' },
      footer: { borderTop: '1px solid #E5E7EB', padding: '20px' },
      divider: { height: '1px', bg: '#E5E7EB' }
    }
  },

  // 简约现代风格 - 极致简约，大量留白，轻盈设计
  minimal: {
    colors: {
      brand: '#18181B',      // 锌黑
      accent: '#71717A',     // 锌灰
      lead: '#52525B',       // 中锌灰
      text: '#27272A',       // 正文
      secondary: '#71717A',  // 次要
      muted: '#A1A1AA',      // 辅助
      border: '#F4F4F5',     // 极浅边框
      bg: '#FFFFFF',         // 纯白背景
      surface: '#FFFFFF'
    },
    typography: {
      title: { size: '28px', weight: '200', align: 'center', letterSpacing: '2px' },
      subtitle: { size: '13px', weight: '400', align: 'center', color: 'secondary', letterSpacing: '1px' },
      h1: { size: '28px', weight: '200', align: 'center', color: 'brand', letterSpacing: '2px' },
      h2: { size: '15px', weight: '300', align: 'center', color: 'secondary', letterSpacing: '1px' },
      h3: { size: '14px', weight: '500', color: 'brand', marginTop: '40px', marginBottom: '16px', letterSpacing: '0.5px' },
      paragraph: { size: '15px', lineHeight: '2', indent: '0', align: 'left' },
      lead: { size: '14px', lineHeight: '2', indent: '0', color: 'secondary', letterSpacing: '0.3px' },
      caption: { size: '11px', color: 'muted', align: 'center', letterSpacing: '0.5px' }
    },
    components: {
      header: { bg: '#FFFFFF', color: '#18181B', padding: '48px 20px' },
      nav: { bg: '#FAFAFA', padding: '12px 0' },
      leadSection: { bg: '#FAFAFA', padding: '28px 24px', borderRadius: '0' },
      blockquote: { 
        bg: 'transparent', 
        padding: '20px 0', 
        borderRadius: '0',
        border: 'none',
        borderTop: '1px solid #E4E4E7',
        borderBottom: '1px solid #E4E4E7',
        quoteColor: '#D4D4D8'
      },
      contact: { bg: '#FAFAFA', padding: '24px', borderRadius: '0' },
      footer: { borderTop: '1px solid #F4F4F5', padding: '24px' },
      divider: { height: '1px', bg: '#F4F4F5' }
    }
  },

  // 学术严谨风格 - 传统学术感，编号系统，装饰边框
  academic: {
    colors: {
      brand: '#1E293B',      // 深蓝灰
      accent: '#475569',     // 石板灰
      lead: '#64748B',       // 中石板灰
      text: '#334155',       // 正文
      secondary: '#64748B',  // 次要
      muted: '#94A3B8',      // 辅助
      border: '#CBD5E1',     // 边框
      bg: '#F8FAFC',         // 背景
      surface: '#FFFFFF'
    },
    typography: {
      title: { size: '22px', weight: '700', align: 'left', letterSpacing: '0' },
      subtitle: { size: '13px', weight: '400', align: 'left', color: 'secondary', fontStyle: 'italic' },
      h1: { size: '22px', weight: '700', align: 'left', color: 'brand' },
      h2: { size: '14px', weight: '600', align: 'left', color: 'accent', textTransform: 'uppercase', letterSpacing: '0.5px' },
      h3: { size: '14px', weight: '700', color: 'brand', marginTop: '28px', marginBottom: '12px' },
      paragraph: { size: '14px', lineHeight: '1.85', indent: '2em', align: 'justify' },
      lead: { size: '13px', lineHeight: '1.85', indent: '2em', color: 'secondary', fontStyle: 'italic' },
      caption: { size: '11px', color: 'muted', align: 'left', fontStyle: 'italic' }
    },
    components: {
      header: { bg: '#1E293B', color: '#fff', padding: '28px 24px' },
      nav: { bg: '#F1F5F9', padding: '10px 0', borderBottom: '2px solid #CBD5E1' },
      leadSection: { bg: '#FFFFFF', padding: '20px 24px', border: '1px solid #CBD5E1', borderRadius: '0' },
      blockquote: { 
        bg: '#F8FAFC', 
        padding: '20px 24px', 
        borderRadius: '0',
        border: 'none',
        quoteColor: '#64748B',
        fontStyle: 'italic'
      },
      contact: { bg: '#FFFFFF', padding: '20px 24px', border: '1px solid #CBD5E1', borderTop: '3px solid #475569' },
      footer: { borderTop: '2px solid #CBD5E1', padding: '20px' },
      divider: { height: '1px', bg: '#CBD5E1' }
    }
  },

  // 温暖亲和风格 - 参考 Wellness Calm
  warm: {
    colors: {
      brand: '#92400E',      // 深棕色
      accent: '#B45309',     // 琥珀
      lead: '#A16207',       // 橄榄金
      text: '#3F3F46',       // 深灰
      secondary: '#52525B',  // 中灰
      muted: '#A1A1AA',      // 辅助
      border: '#E4E4E7',     // 边框
      bg: '#FAFAF9',         // 暖白背景
      surface: '#FFFFFF'
    },
    typography: {
      title: { size: '24px', weight: '600', align: 'center', letterSpacing: '0.5px' },
      subtitle: { size: '15px', weight: '400', align: 'center', color: 'secondary' },
      h1: { size: '24px', weight: '600', align: 'center', color: 'brand' },
      h2: { size: '17px', weight: '400', align: 'center', color: 'secondary' },
      h3: { size: '17px', weight: '600', color: 'brand', marginTop: '28px', marginBottom: '14px' },
      paragraph: { size: '16px', lineHeight: '1.9', indent: '0', align: 'left' },
      lead: { size: '15px', lineHeight: '1.9', indent: '0', color: 'lead' },
      caption: { size: '13px', color: 'muted', align: 'center' }
    },
    components: {
      header: { bg: '#92400E', color: '#fff', padding: '32px 20px' },
      nav: { bg: '#F5F5F4', padding: '12px 0' },
      leadSection: { bg: '#FFFBEB', padding: '24px 20px', borderRadius: '8px', border: '1px solid #FDE68A' },
      blockquote: { 
        bg: '#F5F5F4', 
        padding: '20px 24px', 
        borderRadius: '8px',
        border: 'none',
        quoteColor: '#B45309'
      },
      contact: { bg: '#F5F5F4', padding: '20px', borderRadius: '8px' },
      footer: { borderTop: '1px solid #E4E4E7', padding: '20px' },
      divider: { height: '1px', bg: '#E4E4E7' }
    }
  },

  // 新拟态风格 - Neumorphism，柔和3D效果，明亮蓝色系
  neumorphism: {
    colors: {
      brand: '#2563EB',      // 明亮蓝
      accent: '#3B82F6',     // 浅蓝
      lead: '#1E40AF',       // 深蓝
      text: '#1E3A5F',       // 正文
      secondary: '#64748B',  // 次要
      muted: '#94A3B8',      // 辅助
      border: '#DBEAFE',     // 边框
      bg: '#EFF6FF',         // 极浅蓝背景
      surface: '#FFFFFF'     // 表面白
    },
    typography: {
      title: { size: '26px', weight: '300', align: 'center', letterSpacing: '1px' },
      subtitle: { size: '14px', weight: '400', align: 'center', color: 'secondary' },
      h1: { size: '26px', weight: '300', align: 'center', color: 'brand' },
      h2: { size: '16px', weight: '300', align: 'center', color: 'secondary' },
      h3: { size: '16px', weight: '600', color: 'brand', marginTop: '32px', marginBottom: '14px' },
      paragraph: { size: '15px', lineHeight: '1.9', indent: '0', align: 'left' },
      lead: { size: '14px', lineHeight: '1.9', indent: '0', color: 'secondary' },
      caption: { size: '12px', color: 'muted', align: 'center' }
    },
    components: {
      header: { bg: '#2563EB', color: '#fff', padding: '40px 20px' },
      nav: { bg: '#EFF6FF', padding: '12px 0' },
      leadSection: { bg: '#FFFFFF', padding: '24px 20px', borderRadius: '16px', border: '1px solid #DBEAFE' },
      blockquote: {
        bg: '#FFFFFF',
        padding: '20px 24px',
        borderRadius: '16px',
        border: '1px solid #DBEAFE',
        quoteColor: '#3B82F6'
      },
      contact: { bg: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #DBEAFE' },
      footer: { bg: '#EFF6FF', padding: '20px' },
      divider: { height: '1px', bg: '#DBEAFE' }
    }
  },

  // 玻璃拟态风格 - Glassmorphism，半透明效果
  glass: {
    colors: {
      brand: '#1A365D',      // 深海蓝
      accent: '#2B6CB0',     // 明亮蓝
      lead: '#4A5568',       // 灰蓝
      text: '#1A202C',       // 正文
      secondary: '#4A5568',  // 次要
      muted: '#718096',      // 辅助
      border: 'rgba(255,255,255,0.3)', // 半透明边框
      bg: '#EBF8FF',         // 浅蓝背景
      surface: 'rgba(255,255,255,0.7)' // 玻璃表面
    },
    typography: {
      title: { size: '28px', weight: '600', align: 'center', letterSpacing: '0.5px' },
      subtitle: { size: '15px', weight: '400', align: 'center', color: 'secondary' },
      h1: { size: '28px', weight: '600', align: 'center', color: 'brand' },
      h2: { size: '17px', weight: '400', align: 'center', color: 'secondary' },
      h3: { size: '17px', weight: '600', color: 'brand', marginTop: '30px', marginBottom: '14px' },
      paragraph: { size: '16px', lineHeight: '1.85', indent: '0', align: 'left' },
      lead: { size: '15px', lineHeight: '1.85', indent: '0', color: 'secondary' },
      caption: { size: '13px', color: 'muted', align: 'center' }
    },
    components: {
      header: { bg: 'linear-gradient(135deg, #1A365D 0%, #2B6CB0 100%)', color: '#fff', padding: '36px 20px' },
      nav: { bg: 'rgba(255,255,255,0.5)', padding: '12px 0' },
      leadSection: { bg: 'rgba(255,255,255,0.6)', padding: '24px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.4)' },
      blockquote: { 
        bg: 'rgba(255,255,255,0.5)', 
        padding: '20px 24px', 
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.3)',
        quoteColor: '#2B6CB0'
      },
      contact: { bg: 'rgba(255,255,255,0.6)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.4)' },
      footer: { bg: 'rgba(255,255,255,0.4)', padding: '20px' },
      divider: { height: '1px', bg: 'rgba(255,255,255,0.5)' }
    }
  },

  // 复古风格 - Retro，经典印刷/报纸风格
  retro: {
    colors: {
      brand: '#2C2419',      // 深墨褐（报纸油墨色）
      accent: '#8B0000',     // 深红（报纸标题红）
      lead: '#4A4035',       // 深褐
      text: '#2C2419',       // 正文
      secondary: '#5C5346',  // 次要
      muted: '#8B8378',      // 辅助
      border: '#C4BDB0',     // 边框
      bg: '#F5F0E6',         // 旧报纸黄
      surface: '#FAF7F0'     // 表面
    },
    typography: {
      // 报纸风格：衬线字体感觉，紧凑排版
      title: { size: '32px', weight: '700', align: 'center', letterSpacing: '2px' },
      subtitle: { size: '13px', weight: '400', align: 'center', color: 'secondary', letterSpacing: '3px', textTransform: 'uppercase' },
      h1: { size: '32px', weight: '700', align: 'center', color: 'brand', letterSpacing: '2px' },
      h2: { size: '14px', weight: '400', align: 'center', color: 'accent', letterSpacing: '2px', textTransform: 'uppercase' },
      h3: { size: '15px', weight: '700', color: 'brand', marginTop: '24px', marginBottom: '10px', letterSpacing: '0.5px' },
      paragraph: { size: '15px', lineHeight: '1.75', indent: '2em', align: 'justify' },
      lead: { size: '14px', lineHeight: '1.75', indent: '2em', color: 'lead' },
      caption: { size: '11px', color: 'muted', align: 'center', letterSpacing: '0.5px' }
    },
    components: {
      // 报纸风格：双线边框装饰
      header: { bg: '#F5F0E6', color: '#2C2419', padding: '24px 20px', borderBottom: '3px double #2C2419' },
      nav: { bg: '#F5F0E6', padding: '10px 0', borderBottom: '1px solid #C4BDB0' },
      leadSection: { bg: '#FAF7F0', padding: '20px', border: '1px solid #C4BDB0', borderTop: '2px solid #8B0000' },
      blockquote: { 
        bg: '#FAF7F0', 
        padding: '16px 20px', 
        borderRadius: '0',
        border: 'none',
        borderTop: '1px solid #C4BDB0',
        borderBottom: '1px solid #C4BDB0',
        quoteColor: '#8B0000'
      },
      contact: { bg: '#FAF7F0', padding: '16px 20px', border: '1px solid #C4BDB0' },
      footer: { bg: '#F5F0E6', padding: '16px 20px', borderTop: '1px solid #C4BDB0' },
      divider: { height: '1px', bg: '#C4BDB0' }
    }
  }
};

/**
 * 获取主题配置
 */
function getTheme(themeName) {
  return themes[themeName] || themes.legal;
}

/**
 * 解析颜色值（支持引用主题颜色）
 */
function resolveColor(value, colors) {
  if (value === 'brand') return colors.brand;
  if (value === 'accent') return colors.accent;
  if (value === 'lead') return colors.lead;
  if (value === 'text') return colors.text;
  if (value === 'secondary') return colors.secondary;
  if (value === 'muted') return colors.muted;
  if (value === 'border') return colors.border;
  if (value === 'bg') return colors.bg;
  if (value === 'surface') return colors.surface;
  return value;
}

/**
 * 生成样式字符串
 */
function generateStyles(theme) {
  const { colors, typography, components } = theme;
  
  return {
    colors,
    title: {
      fontSize: typography.title.size,
      fontWeight: typography.title.weight,
      textAlign: typography.title.align,
      letterSpacing: typography.title.letterSpacing || 'normal',
      color: resolveColor(typography.title.color, colors) || colors.brand
    },
    subtitle: {
      fontSize: typography.subtitle.size,
      fontWeight: typography.subtitle.weight,
      textAlign: typography.subtitle.align,
      color: resolveColor(typography.subtitle.color, colors) || colors.secondary
    },
    heading1: {
      fontSize: typography.h1.size,
      fontWeight: typography.h1.weight,
      textAlign: typography.h1.align,
      letterSpacing: typography.h1.letterSpacing || 'normal',
      color: resolveColor(typography.h1.color, colors) || colors.brand
    },
    heading2: {
      fontSize: typography.h2.size,
      fontWeight: typography.h2.weight,
      textAlign: typography.h2.align,
      color: resolveColor(typography.h2.color, colors) || colors.secondary
    },
    heading3: {
      fontSize: typography.h3.size,
      fontWeight: typography.h3.weight,
      color: resolveColor(typography.h3.color, colors) || colors.brand,
      marginTop: typography.h3.marginTop || '28px',
      marginBottom: typography.h3.marginBottom || '14px',
      paddingBottom: typography.h3.paddingBottom || '0',
      borderBottom: typography.h3.borderBottom || 'none'
    },
    paragraph: {
      fontSize: typography.paragraph.size,
      lineHeight: typography.paragraph.lineHeight,
      textAlign: typography.paragraph.align,
      textIndent: typography.paragraph.indent,
      color: colors.text
    },
    lead: {
      fontSize: typography.lead.size,
      lineHeight: typography.lead.lineHeight,
      textIndent: typography.lead.indent,
      color: resolveColor(typography.lead.color, colors) || colors.text,
      fontStyle: typography.lead.fontStyle || 'normal'
    },
    caption: {
      fontSize: typography.caption.size,
      color: resolveColor(typography.caption.color, colors) || colors.muted,
      textAlign: typography.caption.align,
      fontStyle: typography.caption.fontStyle || 'normal'
    },
    components: {
      header: components.header,
      nav: components.nav,
      leadSection: components.leadSection,
      blockquote: components.blockquote,
      contact: components.contact,
      footer: components.footer,
      divider: components.divider
    }
  };
}

module.exports = {
  themes,
  getTheme,
  generateStyles,
  resolveColor
};
