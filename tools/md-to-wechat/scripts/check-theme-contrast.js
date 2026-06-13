#!/usr/bin/env node

/**
 * 检查主题颜色对比度问题
 * 检测背景色和文字颜色是否太接近
 */

const fs = require('fs');
const path = require('path');

const EXAMPLE_DIR = path.join(__dirname, '..', 'example');

// 获取所有 theme-*.html 文件
const files = fs.readdirSync(EXAMPLE_DIR)
  .filter(f => f.startsWith('theme-') && f.endsWith('.html'))
  .sort();

console.log('🔍 检查主题颜色对比度\n');
console.log('=' .repeat(70));

for (const file of files) {
  const content = fs.readFileSync(path.join(EXAMPLE_DIR, file), 'utf-8');
  const themeName = file.replace('theme-', '').replace('.html', '');

  // 提取颜色
  const bgMatch = content.match(/background:\s*(#[0-9A-Fa-f]{6})/);
  const textMatch = content.match(/color:\s*(#[0-9A-Fa-f]{6})/);
  const headerBgMatch = content.match(/\.article-header\s*\{[^}]*background:\s*(#[0-9A-Fa-f]{6})/);
  const headerTextMatch = content.match(/\.article-header\s*\{[^}]*color:\s*(#[0-9A-Fa-f]{6})/);
  const titleColorMatch = content.match(/\.article-title\s*\{[^}]*color:\s*(#[0-9A-Fa-f]{6})/);

  const bg = bgMatch?.[1] || 'N/A';
  const text = textMatch?.[1] || 'N/A';
  const headerBg = headerBgMatch?.[1] || 'N/A';
  const headerText = headerTextMatch?.[1] || 'N/A';
  const titleColor = titleColorMatch?.[1] || 'N/A';

  // 检查对比度问题
  const issues = [];

  // 检查标题颜色是否与头部背景太接近
  if (headerBg !== 'N/A' && titleColor !== 'N/A') {
    const contrast = calculateContrast(headerBg, titleColor);
    if (contrast < 2) {
      issues.push(`⚠️ 标题与头部背景对比度太低 (${contrast.toFixed(2)})`);
    }
  }

  // 检查头部文字颜色是否与头部背景太接近
  if (headerBg !== 'N/A' && headerText !== 'N/A') {
    const contrast = calculateContrast(headerBg, headerText);
    if (contrast < 2) {
      issues.push(`⚠️ 头部文字与背景对比度太低 (${contrast.toFixed(2)})`);
    }
  }

  // 检查正文颜色是否与背景太接近
  if (bg !== 'N/A' && text !== 'N/A') {
    const contrast = calculateContrast(bg, text);
    if (contrast < 3) {
      issues.push(`⚠️ 正文对比度低 (${contrast.toFixed(2)})`);
    }
  }

  // 输出结果
  const status = issues.length > 0 ? '❌' : '✅';
  console.log(`\n${status} ${themeName}`);
  console.log(`   背景: ${bg} | 文字: ${text}`);
  console.log(`   头部背景: ${headerBg} | 头部文字: ${headerText} | 标题: ${titleColor}`);

  if (issues.length > 0) {
    issues.forEach(issue => console.log(`   ${issue}`));
  }
}

console.log('\n' + '='.repeat(70));
console.log('\n📊 对比度标准:');
  console.log('   ✅ > 4.5 - 良好 (WCAG AA)');
  console.log('   ⚠️ 2-4.5 - 可接受');
  console.log('   ❌ < 2 - 对比度太低，难以阅读');

/**
 * 计算两个颜色的对比度
 */
function calculateContrast(color1, color2) {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * 计算颜色亮度
 */
function getLuminance(hex) {
  const rgb = hexToRgb(hex);
  const [r, g, b] = rgb.map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Hex 转 RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [0, 0, 0];
}
