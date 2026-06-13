/**
 * WeChat Publisher Module - 微信发布模块
 *
 * 职责：创建图文草稿、图片帖子
 * 依赖：需要配置微信 AppID 和 Secret
 */

const MODULE_NAME = 'wechat-publisher';
const MODULE_DESC = '微信发布：创建图文草稿、图片帖子';

let moduleConfig = null;

/**
 * 检查模块是否可用
 * 需要配置微信 AppID 和 Secret
 */
function isAvailable() {
  return moduleConfig &&
         moduleConfig.appId &&
         moduleConfig.secret;
}

/**
 * 模块命令定义
 */
const commands = {
  'draft': {
    description: '创建微信图文草稿',
    usage: 'draft <article.md> [options]',
    options: [
      { flag: '-c, --cover <file>', desc: '封面图片路径' },
      { flag: '-t, --title <title>', desc: '文章标题（覆盖 frontmatter）' },
      { flag: '-a, --author <author>', desc: '作者（覆盖 frontmatter）' },
      { flag: '--digest <text>', desc: '摘要（覆盖 frontmatter）' },
      { flag: '--content-source-url <url>', desc: '原文链接' }
    ],
    run: async (args) => {
      if (!isAvailable()) {
        console.error('错误：微信发布模块未配置');
        console.error('请运行: md2wechat config set wechat.appId <appId>');
        console.error('请运行: md2wechat config set wechat.secret <secret>');
        return;
      }
      // TODO: 实现草稿创建逻辑
      console.log('草稿创建功能开发中...');
      console.log('文章:', args._[0]);
    }
  },

  'image-post': {
    description: '创建图片帖子（newspic）',
    usage: 'image-post <title> [options]',
    options: [
      { flag: '-i, --images <files...>', desc: '图片文件列表（至少1张）' },
      { flag: '-c, --content <text>', desc: '正文内容（可选）' },
      { flag: '--digest <text>', desc: '摘要' }
    ],
    run: async (args) => {
      if (!isAvailable()) {
        console.error('错误：微信发布模块未配置');
        return;
      }
      // TODO: 实现图片帖子创建逻辑
      console.log('图片帖子功能开发中...');
      console.log('标题:', args._[0]);
    }
  },

  'status': {
    description: '检查微信 API 连接状态',
    usage: 'status',
    run: async () => {
      if (!isAvailable()) {
        console.log('微信发布模块状态: 未配置');
        return;
      }
      // TODO: 测试微信 API 连接
      console.log('微信发布模块状态: 已配置');
      console.log('AppID:', moduleConfig.appId.substring(0, 8) + '...');
    }
  }
};

/**
 * 模块初始化
 */
function init(config) {
  moduleConfig = config.wechat || {};

  if (!isAvailable()) {
    console.log(`[${MODULE_NAME}] 模块未配置（可选）`);
    console.log(`[${MODULE_NAME}] 配置方式: md2wechat config set wechat.appId <appId>`);
  } else {
    console.log(`[${MODULE_NAME}] 模块已初始化 (AppID: ${moduleConfig.appId.substring(0, 8)}...)`);
  }
}

module.exports = {
  name: MODULE_NAME,
  description: MODULE_DESC,
  isAvailable,
  commands,
  init
};
