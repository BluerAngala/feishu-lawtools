#!/usr/bin/env node

/**
 * md2wechat CLI - 统一命令入口
 *
 * 职责：
 * 1. 加载所有模块
 * 2. 解析命令行参数
 * 3. 路由到对应模块命令
 * 4. 提供全局命令（config, help, version）
 */

const fs = require('fs');
const path = require('path');

// 模块目录
const MODULES_DIR = path.join(__dirname, '..', 'modules');

// 全局配置路径
const CONFIG_DIR = path.join(require('os').homedir(), '.config', 'md-to-wechat');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/**
 * 加载所有模块
 */
function loadModules() {
  const modules = {};
  const moduleDirs = fs.readdirSync(MODULES_DIR);

  for (const dir of moduleDirs) {
    const modulePath = path.join(MODULES_DIR, dir, 'index.js');
    if (fs.existsSync(modulePath)) {
      try {
        const mod = require(modulePath);
        modules[mod.name] = mod;
      } catch (err) {
        console.error(`加载模块 ${dir} 失败:`, err.message);
      }
    }
  }

  return modules;
}

/**
 * 加载配置
 */
function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch (err) {
    console.error('加载配置失败:', err.message);
    return {};
  }
}

/**
 * 保存配置
 */
function saveConfig(config) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * 显示帮助信息
 */
function showHelp(modules) {
  console.log('\nmd2wechat - Markdown 转微信公众号排版工具\n');
  console.log('用法: md2wechat <command> [subcommand] [options]\n');
  console.log('全局命令:');
  console.log('  config <action> [args]  配置管理');
  console.log('  help                    显示帮助');
  console.log('  version                 显示版本\n');
  console.log('模块命令:');

  for (const [name, mod] of Object.entries(modules)) {
    const status = mod.isAvailable() ? '✓' : '○';
    console.log(`\n[${status}] ${name} - ${mod.description}`);

    if (mod.commands) {
      for (const [cmdName, cmd] of Object.entries(mod.commands)) {
        console.log(`    ${cmdName.padEnd(12)} ${cmd.description}`);
      }
    }
  }

  console.log('\n○ = 需要配置  ✓ = 可用\n');
}

/**
 * 配置管理
 */
function handleConfig(args) {
  const config = loadConfig();
  const action = args._[1];

  switch (action) {
    case 'get': {
      const key = args._[2];
      if (!key) {
        console.log(JSON.stringify(config, null, 2));
      } else {
        const value = key.split('.').reduce((obj, k) => obj?.[k], config);
        console.log(value !== undefined ? value : '未设置');
      }
      break;
    }

    case 'set': {
      const key = args._[2];
      const value = args._[3];
      if (!key || value === undefined) {
        console.error('用法: md2wechat config set <key> <value>');
        process.exit(1);
      }

      const keys = key.split('.');
      let current = config;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;

      saveConfig(config);
      console.log(`已设置: ${key} = ${value}`);
      break;
    }

    case 'init': {
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }
      const defaultConfig = {
        converter: {
          defaultTheme: 'legal',
          fontSize: 'medium'
        }
      };
      saveConfig(defaultConfig);
      console.log('配置已初始化:', CONFIG_FILE);
      break;
    }

    default:
      console.log('配置管理命令:');
      console.log('  config init           初始化配置');
      console.log('  config get [key]      获取配置');
      console.log('  config set <key> <value>  设置配置');
  }
}

/**
 * 解析命令行参数
 */
function parseArgs(argv) {
  const args = { _: [] };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = argv[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        args[key] = nextArg;
        i++;
      } else {
        args[key] = true;
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      const nextArg = argv[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        args[key] = nextArg;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(arg);
    }
  }

  return args;
}

/**
 * 主函数
 */
async function main() {
  const args = parseArgs(process.argv);
  const modules = loadModules();
  const config = loadConfig();

  // 初始化所有模块
  for (const mod of Object.values(modules)) {
    if (mod.init) {
      mod.init(config);
    }
  }

  const command = args._[0];

  // 全局命令
  switch (command) {
    case 'help':
    case undefined:
      showHelp(modules);
      return;

    case 'version':
      console.log('md2wechat v2.0.0 (modular)');
      return;

    case 'config':
      handleConfig(args);
      return;
  }

  // 模块命令路由
  // 格式: md2wechat <module> <subcommand> [options]
  const moduleName = command;
  const subcommand = args._[1];

  if (modules[moduleName]) {
    const mod = modules[moduleName];

    if (!subcommand) {
      console.log(`\n${mod.name} - ${mod.description}\n`);
      console.log('可用命令:');
      for (const [cmdName, cmd] of Object.entries(mod.commands || {})) {
        console.log(`  ${cmdName.padEnd(12)} ${cmd.description}`);
        if (cmd.usage) {
          console.log(`              用法: ${cmd.usage}`);
        }
      }
      console.log();
      return;
    }

    const cmd = mod.commands?.[subcommand];
    if (cmd) {
      try {
        await cmd.run(args);
      } catch (err) {
        console.error('命令执行失败:', err.message);
        process.exit(1);
      }
    } else {
      console.error(`未知命令: ${moduleName} ${subcommand}`);
      console.log(`运行 'md2wechat ${moduleName}' 查看可用命令`);
      process.exit(1);
    }
  } else {
    console.error(`未知模块: ${moduleName}`);
    console.log('运行 "md2wechat help" 查看所有可用命令');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('错误:', err);
  process.exit(1);
});
