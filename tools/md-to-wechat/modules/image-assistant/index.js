/**
 * Image Assistant Module - 图片处理模块
 *
 * 职责：AI 图片生成、压缩、上传
 * 依赖：需要配置图片生成 Provider API Key（可选）
 */

const MODULE_NAME = 'image-assistant';
const MODULE_DESC = '图片处理：AI 生成、压缩、上传';

let moduleConfig = null;

/**
 * 检查模块是否可用
 * 基础功能（压缩）始终可用，生成功能需要配置
 */
function isAvailable() {
  return true; // 基础功能始终可用
}

/**
 * 检查 AI 生成功能是否可用
 */
function isGenerationAvailable() {
  return moduleConfig && moduleConfig.provider && moduleConfig.apiKey;
}

/**
 * 模块命令定义
 */
const commands = {
  'generate': {
    description: 'AI 生成图片（封面、信息图等）',
    usage: 'generate <prompt> [options]',
    options: [
      { flag: '-t, --type <type>', desc: '图片类型: cover/infographic/general (默认: general)' },
      { flag: '-s, --style <style>', desc: '风格: minimal/bold/elegant/tech (默认: minimal)' },
      { flag: '-o, --output <file>', desc: '输出文件路径' },
      { flag: '--size <size>', desc: '尺寸: 16:9/1:1/9:16 (默认: 16:9)' }
    ],
    run: async (args) => {
      if (!isGenerationAvailable()) {
        console.error('错误：图片生成功能未配置');
        console.error('请运行: md2wechat config set image.provider <provider>');
        console.error('请运行: md2wechat config set image.apiKey <apiKey>');
        return;
      }
      // TODO: 实现生成逻辑
      console.log('图片生成功能开发中...');
      console.log('提示词:', args._[0]);
      console.log('类型:', args.type || 'general');
    }
  },

  'compress': {
    description: '压缩图片到微信友好尺寸',
    usage: 'compress <input> [options]',
    options: [
      { flag: '-m, --max-size <mb>', desc: '最大文件大小 MB (默认: 2)' },
      { flag: '-o, --output <file>', desc: '输出文件路径' },
      { flag: '--quality <n>', desc: '压缩质量 1-100 (默认: 85)' }
    ],
    run: async (args) => {
      // TODO: 实现压缩逻辑
      console.log('图片压缩功能开发中...');
      console.log('输入:', args._[0]);
    }
  },

  'upload': {
    description: '上传图片到微信素材库（需要微信配置）',
    usage: 'upload <file> [options]',
    options: [
      { flag: '--wechat', desc: '上传到微信素材库' }
    ],
    run: async (args) => {
      // TODO: 实现上传逻辑
      console.log('图片上传功能开发中...');
    }
  }
};

/**
 * 模块初始化
 */
function init(config) {
  moduleConfig = config.image || {};

  if (!isGenerationAvailable()) {
    console.log(`[${MODULE_NAME}] AI 生成功能未配置（可选）`);
    console.log(`[${MODULE_NAME}] 基础功能（压缩）可用`);
  } else {
    console.log(`[${MODULE_NAME}] 模块已初始化 (provider: ${moduleConfig.provider})`);
  }
}

module.exports = {
  name: MODULE_NAME,
  description: MODULE_DESC,
  isAvailable,
  isGenerationAvailable,
  commands,
  init
};
