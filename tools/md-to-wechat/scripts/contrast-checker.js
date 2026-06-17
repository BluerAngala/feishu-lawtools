#!/usr/bin/env node
/**
 * 对比度检查工具
 * 检查所有主题的文字与背景对比度，确保可读性
 */

const fs = require('fs');
const path = require('path');

// 颜色转换函数
function hexToRgb(hex) {
  // 处理 6 位十六进制颜色 (#1F2937)
  let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    };
  }
  
  // 处理 3 位十六进制颜色 (#fff)
  result = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
  if (result) {
    return {
      r: parseInt(result[1] + result[1], 16),
      g: parseInt(result[2] + result[2], 16),
      b: parseInt(result[3] + result[3], 16)
    };
  }
  
  return null;
}

function rgbToRgb(rgbStr) {
  const match = rgbStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (match) {
    return {
      r: parseInt(match[1]),
      g: parseInt(match[2]),
      b: parseInt(match[3])
    };
  }
  return null;
}

function parseColor(colorStr) {
  if (!colorStr) return null;
  colorStr = colorStr.trim();
  
  if (colorStr.startsWith('#')) {
    return hexToRgb(colorStr);
  } else if (colorStr.startsWith('rgb')) {
    return rgbToRgb(colorStr);
  }
  return null;
}

// 计算相对亮度
function getLuminance(rgb) {
  const { r, g, b } = rgb;
  const [rs, gs, bs] = [r, g, b].map(val => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// 计算对比度
function getContrastRatio(color1, color2) {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

// 检查对比度等级
function getContrastLevel(ratio) {
  if (ratio >= 7) return { level: 'AAA', pass: true };
  if (ratio >= 4.5) return { level: 'AA', pass: true };
  if (ratio >= 3) return { level: 'AA Large', pass: true };
  return { level: 'FAIL', pass: false };
}

// 从 HTML 中提取颜色
function extractColorsFromHTML(html) {
  const colors = {
    bodyBg: null,
    containerBg: null,
    headerBg: null,
    h1Color: null,
    h2Color: null,
    h3Color: null,
    textColor: null,
    strongColor: null,
    linkColor: null,
    blockquoteBg: null,
    blockquoteBorder: null
  };

  // 提取 body 背景
  const bodyMatch = html.match(/<body[^>]*>\s*<div[^>]*style="([^"]*)"/);
  if (bodyMatch) {
    const bgMatch = bodyMatch[1].match(/background-color:\s*([^;]+)/);
    if (bgMatch) colors.bodyBg = parseColor(bgMatch[1]);
  }

  // 提取容器背景
  const containerMatch = html.match(/<section[^>]*style="([^"]*)"/);
  if (containerMatch) {
    const bgMatch = containerMatch[1].match(/background-color:\s*([^;]+)/);
    if (bgMatch) colors.containerBg = parseColor(bgMatch[1]);
  }

  // 提取 header 背景（支持渐变色，取第一个颜色）
  const headerMatch = html.match(/<header[^>]*style="([^"]*)"/);
  if (headerMatch) {
    const bgMatch = headerMatch[1].match(/background:\s*([^;]+)/);
    if (bgMatch) {
      const bgValue = bgMatch[1].trim();
      // 如果是渐变色，提取第一个颜色
      if (bgValue.startsWith('linear-gradient')) {
        const firstColorMatch = bgValue.match(/(#[a-fA-F0-9]{3,6}|rgb\([^)]+\))/);
        if (firstColorMatch) {
          colors.headerBg = parseColor(firstColorMatch[1]);
        }
      } else {
        colors.headerBg = parseColor(bgValue);
      }
    }
  }

  // 提取标题颜色
  const h1Match = html.match(/<h1[^>]*style="([^"]*)"/);
  if (h1Match) {
    const colorMatch = h1Match[1].match(/color:\s*([^;]+)/);
    if (colorMatch) colors.h1Color = parseColor(colorMatch[1]);
  }

  const h2Match = html.match(/<h2[^>]*style="([^"]*)"/);
  if (h2Match) {
    const colorMatch = h2Match[1].match(/color:\s*([^;]+)/);
    if (colorMatch) colors.h2Color = parseColor(colorMatch[1]);
  }

  const h3Match = html.match(/<h3[^>]*style="([^"]*)"/);
  if (h3Match) {
    const colorMatch = h3Match[1].match(/color:\s*([^;]+)/);
    if (colorMatch) colors.h3Color = parseColor(colorMatch[1]);
  }

  // 提取正文颜色（跳过 header 内的段落）
  // 先移除 header 部分，再匹配正文
  const htmlWithoutHeader = html.replace(/<header[\s\S]*?<\/header>/, '');
  const pMatch = htmlWithoutHeader.match(/<p[^>]*style="([^"]*)"/);
  if (pMatch) {
    const colorMatch = pMatch[1].match(/color:\s*([^;]+)/);
    if (colorMatch) colors.textColor = parseColor(colorMatch[1]);
  }

  // 提取强调颜色（跳过 header 内的）
  const strongMatch = htmlWithoutHeader.match(/<strong[^>]*style="([^"]*)"/);
  if (strongMatch) {
    const colorMatch = strongMatch[1].match(/color:\s*([^;]+)/);
    if (colorMatch) colors.strongColor = parseColor(colorMatch[1]);
  }

  // 提取链接颜色（跳过 header 内的）
  const linkMatch = htmlWithoutHeader.match(/<a[^>]*style="([^"]*)"/);
  if (linkMatch) {
    const colorMatch = linkMatch[1].match(/color:\s*([^;]+)/);
    if (colorMatch) colors.linkColor = parseColor(colorMatch[1]);
  }

  // 提取引用块背景
  const blockquoteMatch = html.match(/<blockquote[^>]*style="([^"]*)"/);
  if (blockquoteMatch) {
    const bgMatch = blockquoteMatch[1].match(/background-color:\s*([^;]+)/);
    if (bgMatch) colors.blockquoteBg = parseColor(bgMatch[1]);
    const borderMatch = blockquoteMatch[1].match(/border-left:\s*\d+px\s+solid\s+([^;]+)/);
    if (borderMatch) colors.blockquoteBorder = parseColor(borderMatch[1]);
  }

  return colors;
}

// 检查主题对比度
function checkThemeContrast(themeFile) {
  const html = fs.readFileSync(themeFile, 'utf-8');
  const colors = extractColorsFromHTML(html);
  const themeName = path.basename(themeFile, '.html');
  
  const results = {
    theme: themeName,
    checks: [],
    passed: true
  };

  const bg = colors.containerBg || colors.bodyBg || { r: 255, g: 255, b: 255 };
  const headerBg = colors.headerBg || bg;

  // 检查各元素对比度
  const checks = [
    { name: 'H1 标题', text: colors.h1Color, bg: headerBg },
    { name: 'H2 标题', text: colors.h2Color, bg },
    { name: 'H3 标题', text: colors.h3Color, bg },
    { name: '正文', text: colors.textColor, bg },
    { name: '强调文字', text: colors.strongColor, bg },
    { name: '链接', text: colors.linkColor, bg }
  ];

  for (const check of checks) {
    if (check.text && check.bg) {
      const ratio = getContrastRatio(check.text, check.bg);
      const level = getContrastLevel(ratio);
      results.checks.push({
        element: check.name,
        ratio: ratio.toFixed(2),
        level: level.level,
        pass: level.pass
      });
      if (!level.pass) results.passed = false;
    }
  }

  // 检查引用块内文字对比度
  if (colors.blockquoteBg && colors.textColor) {
    const ratio = getContrastRatio(colors.textColor, colors.blockquoteBg);
    const level = getContrastLevel(ratio);
    results.checks.push({
      element: '引用块文字',
      ratio: ratio.toFixed(2),
      level: level.level,
      pass: level.pass
    });
    if (!level.pass) results.passed = false;
  }

  return results;
}

// 主函数
function main() {
  const exampleDir = path.join(__dirname, '..', 'example');
  const themeFiles = fs.readdirSync(exampleDir)
    .filter(f => f.startsWith('theme-') && f.endsWith('.html'))
    .map(f => path.join(exampleDir, f));

  console.log('🔍 开始检查所有主题对比度...\n');
  console.log('=' .repeat(60));

  let allPassed = true;
  const failedThemes = [];

  for (const themeFile of themeFiles) {
    const result = checkThemeContrast(themeFile);
    const status = result.passed ? '✅' : '❌';
    console.log(`\n${status} ${result.theme}`);
    console.log('-'.repeat(40));
    
    for (const check of result.checks) {
      const checkStatus = check.pass ? '✓' : '✗';
      console.log(`  ${checkStatus} ${check.element}: 对比度 ${check.ratio} (${check.level})`);
    }

    if (!result.passed) {
      allPassed = false;
      failedThemes.push(result.theme);
    }
  }

  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('✅ 所有主题对比度检查通过！');
  } else {
    console.log(`❌ ${failedThemes.length} 个主题对比度未达标:`);
    failedThemes.forEach(t => console.log(`   - ${t}`));
    process.exit(1);
  }
}

main();
