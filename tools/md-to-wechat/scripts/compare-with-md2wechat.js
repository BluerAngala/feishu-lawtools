#!/usr/bin/env node

/**
 * 对比本地转换和 md2wechat API 转换的效果
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const EXAMPLE_DIR = path.join(__dirname, '..', 'example');
const SAMPLE_FILE = path.join(EXAMPLE_DIR, 'sample.md');

// 读取示例文件
const markdown = fs.readFileSync(SAMPLE_FILE, 'utf-8');

console.log('🔍 对比本地转换和 md2wechat API 转换\n');
console.log('=' .repeat(60));

// 调用 md2wechat API
async function callMD2WechatAPI(markdown, theme) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      markdown: markdown,
      theme: theme,
      fontSize: 'medium'
    });

    const options = {
      hostname: 'www.md2wechat.cn',
      path: '/api/convert',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          if (result.code === 0) {
            resolve(result.data.html);
          } else {
            reject(new Error(result.msg || 'API 错误'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// 测试几个主题
const themes = ['default', 'apple', 'elegant-gold', 'cyber'];

async function runComparison() {
  for (const theme of themes) {
    console.log(`\n📝 主题: ${theme}`);
    console.log('-'.repeat(40));
    
    try {
      // 调用 API
      const apiHTML = await callMD2WechatAPI(markdown, theme);
      const apiFile = path.join(EXAMPLE_DIR, `compare-api-${theme}.html`);
      fs.writeFileSync(apiFile, apiHTML, 'utf-8');
      console.log(`  ✅ API 版本: compare-api-${theme}.html`);
      
      // 显示 API 生成的前 500 字符
      console.log(`  📄 API HTML 预览:`);
      console.log(apiHTML.substring(0, 300).replace(/\n/g, ' '));
      console.log('  ...');
    } catch (err) {
      console.log(`  ❌ API 调用失败: ${err.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n💡 对比文件已生成:');
  console.log('   - 本地版本: theme-*.html');
  console.log('   - API 版本: compare-api-*.html');
  console.log('\n请在浏览器中打开对比查看差异');
}

runComparison().catch(console.error);
