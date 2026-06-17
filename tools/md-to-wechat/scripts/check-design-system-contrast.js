#!/usr/bin/env node

/**
 * 检查设计系统中的颜色对比度
 */

const { getDesignSystem } = require('../modules/converter/themes/design-system');

// 计算对比度
function calculateContrast(color1, color2) {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

function getLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const [r, g, b] = rgb.map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : null;
}

// 要检查的主题
const themes = [
  'spring-fresh',
  'autumn-warm',
  'ocean-calm',
  'cyber'
];

console.log('🔍 检查设计系统颜色对比度\n');
console.log('=' .repeat(70));

for (const themeName of themes) {
  const ds = getDesignSystem(themeName, {});

  console.log(`\n📋 ${themeName}`);
  console.log('-'.repeat(70));

  // 检查卡片背景 vs 段落文字
  const cardBg = ds.card?.backgroundColor;
  const textColor = ds.paragraph?.color;

  if (cardBg && textColor) {
    const contrast = calculateContrast(cardBg, textColor);
    const status = contrast >= 4.5 ? '✅' : contrast >= 3 ? '⚠️' : '❌';
    console.log(`   ${status} 卡片背景 vs 段落文字: ${contrast.toFixed(2)} (${cardBg} vs ${textColor})`);
  }

  // 检查引用块背景 vs 引用块文字（如果有）
  const quoteBg = ds.blockquote?.backgroundColor;
  if (quoteBg && textColor) {
    const contrast = calculateContrast(quoteBg, textColor);
    const status = contrast >= 4.5 ? '✅' : contrast >= 3 ? '⚠️' : '❌';
    console.log(`   ${status} 引用背景 vs 段落文字: ${contrast.toFixed(2)} (${quoteBg} vs ${textColor})`);
  }

  // 检查 h2 颜色 vs 卡片背景
  const h2Color = ds.h2?.color;
  if (h2Color && cardBg) {
    const contrast = calculateContrast(cardBg, h2Color);
    const status = contrast >= 4.5 ? '✅' : contrast >= 3 ? '⚠️' : '❌';
    console.log(`   ${status} 卡片背景 vs H2标题: ${contrast.toFixed(2)} (${cardBg} vs ${h2Color})`);
  }

  // 检查 h3 颜色 vs 卡片背景
  const h3Color = ds.h3?.color;
  if (h3Color && cardBg) {
    const contrast = calculateContrast(cardBg, h3Color);
    const status = contrast >= 4.5 ? '✅' : contrast >= 3 ? '⚠️' : '❌';
    console.log(`   ${status} 卡片背景 vs H3标题: ${contrast.toFixed(2)} (${cardBg} vs ${h3Color})`);
  }

  // 检查强调色 vs 卡片背景
  const strongColor = ds.strong?.color;
  if (strongColor && cardBg) {
    const contrast = calculateContrast(cardBg, strongColor);
    const status = contrast >= 4.5 ? '✅' : contrast >= 3 ? '⚠️' : '❌';
    console.log(`   ${status} 卡片背景 vs 强调文字: ${contrast.toFixed(2)} (${cardBg} vs ${strongColor})`);
  }

  // 检查链接颜色 vs 卡片背景
  const linkColor = ds.link?.color;
  if (linkColor && cardBg) {
    const contrast = calculateContrast(cardBg, linkColor);
    const status = contrast >= 4.5 ? '✅' : contrast >= 3 ? '⚠️' : '❌';
    console.log(`   ${status} 卡片背景 vs 链接: ${contrast.toFixed(2)} (${cardBg} vs ${linkColor})`);
  }
}

console.log('\n' + '='.repeat(70));
console.log('\n📊 对比度标准:');
console.log('   ✅ > 4.5 - 良好 (WCAG AA)');
console.log('   ⚠️ 3-4.5 - 可接受');
console.log('   ❌ < 3 - 对比度太低\n');
