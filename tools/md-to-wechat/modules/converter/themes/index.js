/**
 * 统一主题系统
 * 
 * 支持两种配置方式：
 * 1. JSON 配置（你的现有方式）- 完整的 colors, typography, components 定义
 * 2. YAML 配置（md2wechat-skill 方式）- 简化的 api_theme 引用
 * 
 * 主题优先级：用户自定义 > 内置 JSON 主题 > YAML 主题映射
 */

const fs = require('fs');
const path = require('path');

// 内置 JSON 主题（完整定义）
const builtinThemes = {
  // 你的现有主题
  legal: require('./legal.json'),
  minimal: require('./minimal.json'),
  academic: require('./academic.json'),
  tech: require('./tech.json'),
  warm: require('./warm.json'),
  
  // md2wechat-skill 主题映射（YAML 风格的 JSON 版本）
  default: require('./md2wechat/default.json'),
  apple: require('./md2wechat/apple.json'),
  'elegant-gold': require('./md2wechat/elegant-gold.json'),
  'minimal-blue': require('./md2wechat/minimal-blue.json'),
  'focus-green': require('./md2wechat/focus-green.json'),
  'bold-red': require('./md2wechat/bold-red.json'),
  chinese: require('./md2wechat/chinese.json'),
  cyber: require('./md2wechat/cyber.json'),
  bytedance: require('./md2wechat/bytedance.json'),
  sports: require('./md2wechat/sports.json'),
  'spring-fresh': require('./md2wechat/spring-fresh.json'),
  'ocean-calm': require('./md2wechat/ocean-calm.json'),
  'autumn-warm': require('./md2wechat/autumn-warm.json'),
};

// YAML 主题到 JSON 主题的映射（用于兼容 md2wechat-skill 配置）
const yamlThemeMapping = {
  'default': 'default',
  'apple': 'apple',
  'elegant-gold': 'elegant-gold',
  'minimal-blue': 'minimal-blue',
  'focus-green': 'focus-green',
  'bold-red': 'bold-red',
  'chinese': 'chinese',
  'cyber': 'cyber',
  'bytedance': 'bytedance',
  'sports': 'sports',
  'spring-fresh': 'spring-fresh',
  'ocean-calm': 'ocean-calm',
  'autumn-warm': 'autumn-warm',
  'custom': 'default',  // custom 使用 default 作为基础
  'api': 'default',     // api 类型使用 default
};

/**
 * 获取主题
 * @param {string} themeName - 主题名称
 * @param {object} customThemes - 用户自定义主题
 * @returns {object} 主题配置
 */
function getTheme(themeName, customThemes = {}) {
  // 1. 检查用户自定义主题
  if (customThemes[themeName]) {
    return mergeWithBase(customThemes[themeName]);
  }
  
  // 2. 检查内置 JSON 主题
  if (builtinThemes[themeName]) {
    return builtinThemes[themeName];
  }
  
  // 3. 检查 YAML 映射
  const mappedName = yamlThemeMapping[themeName];
  if (mappedName && builtinThemes[mappedName]) {
    return builtinThemes[mappedName];
  }
  
  // 4. 默认返回 legal 主题
  console.warn(`主题 "${themeName}" 不存在，使用默认主题 "legal"`);
  return builtinThemes.legal;
}

/**
 * 合并自定义主题与基础主题
 */
function mergeWithBase(customTheme) {
  const baseTheme = builtinThemes.legal;
  return {
    colors: { ...baseTheme.colors, ...customTheme.colors },
    typography: { ...baseTheme.typography, ...customTheme.typography },
    components: { ...baseTheme.components, ...customTheme.components },
  };
}

/**
 * 列出所有可用主题
 */
function listThemes() {
  const themes = [];
  
  // 内置主题
  for (const [name, theme] of Object.entries(builtinThemes)) {
    themes.push({
      name,
      source: 'builtin',
      description: theme.description || getThemeDescription(name)
    });
  }
  
  return themes;
}

/**
 * 获取主题描述
 */
function getThemeDescription(name) {
  const descriptions = {
    legal: '法律/商务风格 - 权威蓝 + 琥珀金',
    minimal: '简约现代风格 - 极致留白',
    academic: '学术严谨风格 - 传统学术感',
    tech: '科技现代风格 - 深色主题',
    warm: '温暖人文风格 - 暖色调',
    default: '微信默认风格',
    apple: 'Apple 极简风格',
    'elegant-gold': 'Elegant 金色系 - 层次丰富',
    'minimal-blue': 'Minimal 蓝色系 - 清新专业',
    'focus-green': 'Focus 绿色系 - 专注高效',
    'bold-red': 'Bold 红色系 - 醒目有力',
    chinese: '中式传统风格 - 国风美学',
    cyber: '赛博朋克风格 - 未来科技',
    bytedance: '字节跳动风格 - 年轻活力',
    sports: '运动活力风格 - 动感十足',
    'spring-fresh': '春日清新风格 - 生机勃勃',
    'ocean-calm': '海洋宁静风格 - 平和舒缓',
    'autumn-warm': '秋日温暖风格 - 温馨舒适',
  };
  return descriptions[name] || name;
}

/**
 * 从 YAML 配置转换为 JSON 配置
 * 用于兼容 md2wechat-skill 的主题配置
 */
function convertYamlToJson(yamlConfig) {
  const { api_theme, style } = yamlConfig;
  
  // 获取映射的主题
  const themeName = yamlThemeMapping[api_theme] || 'default';
  const baseTheme = builtinThemes[themeName];
  
  // 如果有 style 配置，进行合并
  if (style) {
    return {
      ...baseTheme,
      metadata: {
        api_theme,
        style,
        converted: true
      }
    };
  }
  
  return baseTheme;
}

/**
 * 加载用户自定义主题目录
 */
function loadCustomThemes(themesDir) {
  const themes = {};
  
  if (!fs.existsSync(themesDir)) {
    return themes;
  }
  
  const files = fs.readdirSync(themesDir);
  
  for (const file of files) {
    const ext = path.extname(file);
    const name = path.basename(file, ext);
    const filePath = path.join(themesDir, file);
    
    try {
      if (ext === '.json') {
        themes[name] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } else if (ext === '.yaml' || ext === '.yml') {
        // 简单 YAML 解析（实际使用需要 yaml 包）
        const content = fs.readFileSync(filePath, 'utf-8');
        const yamlConfig = parseSimpleYaml(content);
        themes[name] = convertYamlToJson(yamlConfig);
      }
    } catch (err) {
      console.warn(`加载主题 ${file} 失败:`, err.message);
    }
  }
  
  return themes;
}

/**
 * 简单 YAML 解析（基础实现）
 */
function parseSimpleYaml(content) {
  const result = {};
  const lines = content.split('\n');
  let currentKey = null;
  let currentObj = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // 顶级键值对
    const match = trimmed.match(/^(\w+):\s*(.*)$/);
    if (match) {
      const [, key, value] = match;
      if (value) {
        result[key] = value.replace(/^["']|["']$/g, '');
      } else {
        currentKey = key;
        currentObj = result[key] = {};
      }
    } else if (currentObj && trimmed.includes(':')) {
      // 嵌套对象
      const [k, v] = trimmed.split(':').map(s => s.trim());
      currentObj[k] = v.replace(/^["']|["']$/g, '');
    }
  }
  
  return result;
}

module.exports = {
  getTheme,
  listThemes,
  convertYamlToJson,
  loadCustomThemes,
  builtinThemes,
  yamlThemeMapping
};
