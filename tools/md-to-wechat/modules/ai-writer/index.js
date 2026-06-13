/**
 * AI Writer Module - AI 写作辅助模块
 * 
 * 职责：风格写作、去痕润色
 * 依赖：需要配置 LLM API Key
 */

const MODULE_NAME = 'ai-writer';
const MODULE_DESC = 'AI 写作辅助：风格写作、去痕润色';

let moduleConfig = null;

/**
 * 检查模块是否可用
 * 需要配置 provider 和 apiKey
 */
function isAvailable() {
  return moduleConfig && 
         moduleConfig.provider && 
         moduleConfig.apiKey;
}

/**
 * 模块命令定义
 */
const commands = {
  'write': {
    description: '根据主题风格生成文章',
    usage: 'write <topic> [options]',
    options: [
      { flag: '-s, --style <name>', desc: '写作风格 (dan-koe, gentle, aggressive)' },
      { flag: '-l, --length <n>', desc: '目标字数 (默认: 2000)' },
      { flag: '-o, --output <file>', desc: '输出文件路径' }
    ],
    run: async (args) => {
      if (!isAvailable()) {
        console.error('错误：AI Writer 模块未配置');
        console.error('请运行: md2wechat config set aiWriter.provider <provider>');
        console.error('请运行: md2wechat config set aiWriter.apiKey <apiKey>');
        return;
      }
      // TODO: 实现写作逻辑
      console.log('写作功能开发中...');
      console.log('主题:', args._[0]);
      console.log('风格:', args.style || 'default');
    }
  },
  
  'humanize': {
    description: '去除 AI 痕迹，让文章更像真人写作',
    usage: 'humanize <input.md> [options]',
    options: [
      { flag: '-l, --level <level>', desc: '去痕强度: gentle/medium/aggressive/authentic (默认: medium)' },
      { flag: '-o, --output <file>', desc: '输出文件路径' }
    ],
    run: async (args) => {
      if (!isAvailable()) {
        console.error('错误：AI Writer 模块未配置');
        return;
      }
      // TODO: 实现去痕逻辑
      console.log('去痕功能开发中...');
      console.log('强度:', args.level || 'medium');
    }
  }
};

/**
 * 模块初始化
 */
function init(config) {
  moduleConfig = config.aiWriter || {};
  
  if (!isAvailable()) {
    console.log(`[${MODULE_NAME}] 模块未配置（可选）`);
    console.log(`[${MODULE_NAME}] 配置方式: md2wechat config set aiWriter.provider openai`);
  } else {
    console.log(`[${MODULE_NAME}] 模块已初始化 (provider: ${moduleConfig.provider})`);
  }
}

module.exports = {
  name: MODULE_NAME,
  description: MODULE_DESC,
  isAvailable,
  commands,
  init
};
