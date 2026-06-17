#!/usr/bin/env node

/**
 * 生成所有主题的测试文件
 * 用于验证主题配色是否正确
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 主题列表
const themes = [
  // 原有主题
  { name: 'legal', desc: '法律商务' },
  { name: 'minimal', desc: '简约现代' },
  { name: 'academic', desc: '学术严谨' },
  { name: 'tech', desc: '科技现代' },
  { name: 'warm', desc: '温暖人文' },
  // md2wechat-skill 主题
  { name: 'default', desc: '微信默认' },
  { name: 'apple', desc: 'Apple极简' },
  { name: 'elegant-gold', desc: '优雅金色' },
  { name: 'minimal-blue', desc: '清新蓝' },
  { name: 'focus-green', desc: '专注绿' },
  { name: 'bold-red', desc: '醒目红' },
  { name: 'chinese', desc: '中式传统' },
  { name: 'cyber', desc: '赛博朋克' },
  { name: 'bytedance', desc: '字节跳动' },
  { name: 'sports', desc: '运动活力' },
  { name: 'spring-fresh', desc: '春日清新' },
  { name: 'ocean-calm', desc: '海洋宁静' },
  { name: 'autumn-warm', desc: '秋日温暖' },
];

const EXAMPLE_DIR = path.join(__dirname, '..', 'example');
const SAMPLE_FILE = path.join(EXAMPLE_DIR, 'sample.md');
const CLI_PATH = path.join(__dirname, 'cli.js');

console.log('🎨 生成所有主题测试文件\n');
console.log('=' .repeat(50));

// 检查 sample.md 是否存在
if (!fs.existsSync(SAMPLE_FILE)) {
  console.error('❌ 错误: sample.md 不存在');
  process.exit(1);
}

let successCount = 0;
let failCount = 0;

for (const theme of themes) {
  const outputFile = path.join(EXAMPLE_DIR, `theme-${theme.name}.html`);
  const cmd = `node "${CLI_PATH}" converter convert "${SAMPLE_FILE}" --theme ${theme.name} -o "${outputFile}"`;

  try {
    execSync(cmd, { stdio: 'pipe', cwd: process.cwd() });
    console.log(`✅ ${theme.name.padEnd(15)} - ${theme.desc}`);
    successCount++;
  } catch (err) {
    console.log(`❌ ${theme.name.padEnd(15)} - ${theme.desc} (失败)`);
    failCount++;
  }
}

console.log('=' .repeat(50));
console.log(`\n📊 生成结果: ${successCount} 成功, ${failCount} 失败`);
console.log(`📁 文件位置: ${EXAMPLE_DIR}`);
console.log('\n💡 提示: 在浏览器中打开 theme-*.html 文件查看效果');
