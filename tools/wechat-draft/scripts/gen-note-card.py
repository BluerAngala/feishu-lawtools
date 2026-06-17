#!/usr/bin/env python3
"""生成小红书风格的图文笔记卡片

输入：标题 + 正文内容
输出：PNG 图片（9:16 竖版）
"""
import sys
import os
import re
import json
import subprocess
from html import escape

TEMPLATE = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { 
  width: 1080px; 
  min-height: 800px;
  background: linear-gradient(160deg, #FAFAFA 0%, #F5F0EB 50%, #FAF8F5 100%);
  font-family: -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif;
  display: flex;
  flex-direction: column;
  padding: 0;
}
.header {
  padding: 48px 52px 20px;
}
.header .tag {
  display: inline-block;
  background: #1E3A8A;
  color: #fff;
  font-size: 24px;
  padding: 8px 20px;
  border-radius: 4px;
  font-weight: 600;
  letter-spacing: 2px;
}
.title {
  padding: 0 52px 20px;
  font-size: 50px;
  font-weight: 800;
  color: #1A1A1A;
  line-height: 1.3;
  letter-spacing: -0.5px;
}
.divider {
  margin: 0 52px 24px;
  height: 3px;
  background: linear-gradient(90deg, #1E3A8A 0%, #DC2626 60%, transparent 100%);
  border-radius: 2px;
}
.content {
  padding: 0 52px;
  font-size: 34px;
  color: #333;
  line-height: 1.7;
}
.content .section-label {
  font-size: 30px;
  font-weight: 700;
  color: #1E3A8A;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.content .section-label::before {
  content: "▎";
  color: #DC2626;
  font-size: 34px;
}
.content .point {
  margin-bottom: 18px;
  padding-left: 4px;
}
.content .point-num {
  font-weight: 700;
  color: #DC2626;
  margin-right: 6px;
}
.content .keyword {
  font-weight: 700;
  color: #DC2626;
}
.footer {
  padding: 16px 52px 32px;
  text-align: right;
}
.footer .signature {
  font-size: 26px;
  color: #888;
  font-weight: 500;
}
.footer .brand {
  font-size: 22px;
  color: #aaa;
  margin-top: 4px;
}
</style>
</head>
<body>
<div class="header"><span class="tag">法律资讯</span></div>
<div class="title">{title}</div>
<div class="divider"></div>
<div class="content">{content_html}</div>
<div class="footer">
  <div class="signature">陈恒 · 广东岭南律师事务所</div>
  <div class="brand">法律资讯简报</div>
</div>
</body>
</html>"""


def text_to_html(content_text):
    """将纯文本转为 HTML，支持分点编号和关键词标记"""
    lines = content_text.strip().split('\n')
    html_parts = []
    
    # 找到"陈律师说"部分，单独标注
    in_comment = False
    body_lines = []
    comment_lines = []
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith('陈律师说') or stripped.startswith('律师说'):
            in_comment = True
            # 把冒号后的内容也加入评论
            after = stripped.split('：', 1)
            if len(after) > 1 and after[1].strip():
                comment_lines.append(after[1].strip())
            continue
        if stripped.startswith('——'):
            continue
        if in_comment:
            comment_lines.append(stripped)
        else:
            body_lines.append(stripped)
    
    # 正文摘要（取前2-3句）
    if body_lines:
        summary = body_lines[0]
        if len(summary) > 120:
            summary = summary[:120] + '…'
        html_parts.append(f'<p style="margin-bottom:20px;color:#555;">{escape(summary)}</p>')
    
    # 评论分点
    if comment_lines:
        html_parts.append('<div class="section-label">律师点评</div>')
        # 合并所有评论文本
        full_comment = ' '.join(comment_lines)
        
        # 按①②③拆分（兼容旧风格）
        points = re.split(r'[①②③④⑤⑥⑦⑧⑨⑩]', full_comment)
        points = [p.strip() for p in points if p.strip()]
        
        if len(points) >= 2:
            nums = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩']
            for i, point in enumerate(points[:5]):
                point_html = escape(point)
                html_parts.append(f'<div class="point"><span class="point-num">{nums[i]}</span>{point_html}</div>')
        else:
            # 无编号风格（新 style：80字以内，像聊天一样说）→ 整段输出，不强制编号
            comment_html = escape(full_comment)
            html_parts.append(f'<div class="point">{comment_html}</div>')
    
    return '\n'.join(html_parts)


def generate_card(title, content, output_path):
    """生成小红书风格卡片图片"""
    # 1. 生成 HTML
    content_html = text_to_html(content)
    html = TEMPLATE.replace('{title}', escape(title)).replace('{content_html}', content_html)
    
    # 2. 写入临时 HTML
    html_path = output_path.rsplit('.', 1)[0] + '.html'
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html)
    
    # 3. 用 agent-browser 截图
    # 但在脚本模式下，用 wkhtmltoimage 或 playwright
    # 扣子环境有 chromium，试试直接用
    try:
        # 优先用 agent-browser CLI
        result = subprocess.run(
            ['agent-browser', '--allow-file-access', 'open', f'file://{html_path}', '&&', 
             'agent-browser', '--allow-file-access', 'tab', '0', '&&',
             'agent-browser', 'set', 'viewport', '1080', '1440', '&&',
             'agent-browser', 'screenshot', output_path, '&&',
             'agent-browser', 'close'],
            capture_output=True, text=True, timeout=30
        )
        if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
            return output_path
    except Exception:
        pass
    
    # Fallback: 用 playwright 直接截图
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={'width': 1080, 'height': 1440})
            page.goto(f'file://{html_path}')
            page.wait_for_timeout(500)
            page.screenshot(path=output_path, full_page=True)
            browser.close()
        if os.path.exists(output_path):
            return output_path
    except Exception as e:
        print(f"⚠ playwright 截图失败: {e}", file=sys.stderr)
    
    # Fallback 2: 用 PIL 直接渲染（简陋但可靠）
    try:
        from PIL import Image, ImageDraw, ImageFont
        img = Image.new('RGB', (1080, 1440), '#FAFAFA')
        draw = ImageDraw.Draw(img)
        
        # 标题
        y = 60
        draw.text((56, y), "法律资讯", fill='#1E3A8A', font=ImageFont.load_default())
        y += 80
        # 简单换行
        title_lines = [title[i:i+20] for i in range(0, len(title), 20)]
        for tl in title_lines:
            draw.text((56, y), tl, fill='#1A1A1A', font=ImageFont.load_default())
            y += 50
        
        img.save(output_path)
        return output_path
    except Exception as e:
        print(f"⚠ PIL 渲染失败: {e}", file=sys.stderr)
    
    return None


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='生成小红书风格图文卡片')
    parser.add_argument('--title', required=True, help='卡片标题')
    parser.add_argument('--content', required=True, help='正文内容')
    parser.add_argument('--output', required=True, help='输出 PNG 路径')
    parser.add_argument('--articles', help='文章 JSON 文件路径（替代 --title/--content）')
    parser.add_argument('--index', type=int, default=0, help='文章索引（配合 --articles）')
    args = parser.parse_args()
    
    if args.articles:
        with open(args.articles, 'r', encoding='utf-8') as f:
            articles = json.load(f)
        art = articles[args.index]
        title = art.get('title', '')
        content = art.get('content', '')
    else:
        title = args.title
        content = args.content
    
    result = generate_card(title, content, args.output)
    if result:
        print(f"✅ 卡片生成成功: {result}")
    else:
        print("❌ 卡片生成失败", file=sys.stderr)
        sys.exit(1)
