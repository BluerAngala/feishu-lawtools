#!/usr/bin/env node

/**
 * 对比当前生成结果与 md2wechat-skill 参考文件
 */

const fs = require('fs');
const path = require('path');

const referenceDir = 'c:\\Users\\11071\\Documents\\trae_projects\\260523-公众号排版\\更多样式待研究';
const exampleDir = 'c:\\Users\\11071\\Documents\\trae_projects\\260523-公众号排版\\.trae\\skills\\md-to-wechat\\example';

// 读取参考文件
const referenceFiles = {
  '无背景': path.join(referenceDir, '默认主题-无背景.html'),
  '方格白色背景': path.join(referenceDir, '默认主题-方格白色背景.html'),
  '温暖米色背景': path.join(referenceDir, '默认主题-温暖米色背景.html')
};

console.log('🔍 分析 md2wechat-skill 默认主题样式特点\n');
console.log('=' .repeat(70));

for (const [name, filePath] of Object.entries(referenceFiles)) {
  if (!fs.existsSync(filePath)) {
    console.log(`\n❌ 文件不存在: ${filePath}`);
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  console.log(`\n📄 ${name}`);
  console.log('-'.repeat(70));

  // 提取关键样式
  const bodyBg = content.match(/background-color:\s*([^;]+)/)?.[1];
  const containerBg = content.match(/<div[^>]*background-color:\s*rgb\(([^)]+)\)/)?.[1];
  const brandColor = content.match(/background:\s*rgb\((200,\s*100,\s*66)\)/)?.[1];
  const textColor = content.match(/color:\s*rgb\((34,\s*34,\s*34)\)/)?.[1];
  const secondaryColor = content.match(/color:\s*rgb\((63,\s*63,\s*63)\)/)?.[1];

  console.log(`   Body 背景: ${bodyBg || '未找到'}`);
  console.log(`   容器背景: rgb(${containerBg || '未找到'})`);
  console.log(`   品牌色: rgb(${brandColor || '未找到'})`);
  console.log(`   主文字: rgb(${textColor || '未找到'})`);
  console.log(`   次要文字: rgb(${secondaryColor || '未找到'})`);

  // 提取标题样式
  const h1Match = content.match(/<h1[^>]*style="([^"]*)"/);
  const h2Match = content.match(/<h2[^>]*style="([^"]*)"/);

  if (h1Match) {
    console.log(`   H1 样式: ${h1Match[1].substring(0, 80)}...`);
  }
  if (h2Match) {
    console.log(`   H2 样式: ${h2Match[1].substring(0, 80)}...`);
  }

  // 检查是否有高级模块
  const hasHero = content.includes('data-mpa-action-id="hero"');
  const hasCards = content.includes('data-mpa-action-id="cards"');
  const hasMetrics = content.includes('data-mpa-action-id="metrics"');

  console.log(`   高级模块:`);
  console.log(`     - Hero: ${hasHero ? '✅' : '❌'}`);
  console.log(`     - Cards: ${hasCards ? '✅' : '❌'}`);
  console.log(`     - Metrics: ${hasMetrics ? '✅' : '❌'}`);
}

console.log('\n' + '='.repeat(70));

// 对比当前生成的主题
console.log('\n📊 对比当前生成的主题\n');

const currentThemes = ['legal', 'spring-fresh', 'autumn-warm'];

for (const themeName of currentThemes) {
  const filePath = path.join(exampleDir, `theme-${themeName}.html`);

  if (!fs.existsSync(filePath)) {
    console.log(`\n❌ 文件不存在: ${filePath}`);
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  console.log(`\n📄 ${themeName}`);
  console.log('-'.repeat(70));

  // 提取关键样式
  const containerBg = content.match(/<div[^>]*background-color:\s*([^;]+)/)?.[1];
  const cardBg = content.match(/<section[^>]*background-color:\s*([^;]+)/)?.[1];
  const h2Color = content.match(/<h2[^>]*color:\s*([^;]+)/)?.[1];

  console.log(`   容器背景: ${containerBg || '未找到'}`);
  console.log(`   卡片背景: ${cardBg || '未找到'}`);
  console.log(`   H2 颜色: ${h2Color || '未找到'}`);

  // 检查结构差异
  const hasCardStructure = content.includes('<section');
  const hasDualSpanH2 = content.includes('<span') && content.includes('</span></h2>');

  console.log(`   结构特点:`);
  console.log(`     - 卡片结构: ${hasCardStructure ? '✅' : '❌'}`);
  console.log(`     - 双span标题: ${hasDualSpanH2 ? '✅' : '❌'}`);
}

console.log('\n' + '='.repeat(70));
console.log('\n💡 差异总结:\n');
console.log('1. md2wechat-skill 默认主题使用:');
console.log('   - 品牌色: rgb(200, 100, 66) - 温暖橙棕色');
console.log('   - 背景: rgb(250, 249, 245) - 温暖米色');
console.log('   - 标题: 左边框 + 底部虚线边框');
console.log('   - 高级模块: Hero, Cards, Metrics');
console.log('');
console.log('2. 当前实现差异:');
console.log('   - 使用不同的配色系统');
console.log('   - 标题使用符号+文本的双span结构');
console.log('   - 缺少高级模块（Hero, Cards等）');
console.log('   - 使用卡片式布局（section包裹）');
