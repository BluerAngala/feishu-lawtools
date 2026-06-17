#!/usr/bin/env python3
"""批量生成小红书笔记卡片（playwright 只启动一次）

用法：
  python3 batch-gen-cards.py --articles /tmp/newspic-articles.json --outdir /path/to/output

输出：
  outdir/art1-card.png, art2-card.png, ...
"""
import argparse
import json
import os
import re
import sys
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
  content: "\\25CE";
  color: #DC2626;
  font-size: 22px;
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
<div class="title">TITLE_PLACEHOLDER</div>
<div class="divider"></div>
<div class="content">CONTENT_PLACEHOLDER</div>
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

    # 正文摘要
    if body_lines:
        summary = body_lines[0]
        if len(summary) > 150:
            summary = summary[:150] + '…'
        html_parts.append(f'<p style="margin-bottom:20px;color:#555;">{escape(summary)}</p>')

    # 评论分点
    if comment_lines:
        html_parts.append('<div class="section-label">律师点评</div>')
        full_comment = ' '.join(comment_lines)

        # 按①②③拆分
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
    content_html = text_to_html(content)
    html = TEMPLATE.replace('TITLE_PLACEHOLDER', escape(title)).replace('CONTENT_PLACEHOLDER', content_html)

    # 写入 HTML
    html_path = output_path.rsplit('.', 1)[0] + '.html'
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html)

    # 用 playwright 截图
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={'width': 1080, 'height': 1440})
            page.goto(f'file://{html_path}')
            page.wait_for_timeout(500)
            page.screenshot(path=output_path, full_page=True)
            browser.close()
        return True
    except Exception as e:
        print(f"  ❌ playwright 截图失败: {e}", file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(description='批量生成小红书笔记卡片')
    parser.add_argument('--articles', required=True, help='newspic articles JSON 文件路径')
    parser.add_argument('--outdir', required=True, help='输出目录')
    parser.add_argument('--start', type=int, default=1, help='起始序号（默认1）')
    args = parser.parse_args()

    os.makedirs(args.outdir, exist_ok=True)

    with open(args.articles, 'r', encoding='utf-8') as f:
        articles = json.load(f)

    success = 0
    failed = 0

    # 只启动一次 playwright
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 1080, 'height': 1440})

        for i, art in enumerate(articles):
            n = args.start + i
            title = art.get('title', art.get('original_title', ''))
            content = art.get('content', '')

            # 清理 content
            content = re.sub(r'\n*>\s*日期：.*', '', content, flags=re.DOTALL)
            content = re.sub(r'\*\*(.+?)\*\*', r'\1', content)
            content = re.sub(r'^>\s*', '', content, flags=re.MULTILINE)

            content_html = text_to_html(content.strip())
            html = TEMPLATE.replace('TITLE_PLACEHOLDER', escape(title)).replace('CONTENT_PLACEHOLDER', content_html)

            output_path = os.path.join(args.outdir, f'art{n}-card.png')
            html_path = os.path.join(args.outdir, f'art{n}-card.html')

            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(html)

            try:
                page.goto(f'file://{html_path}')
                page.wait_for_timeout(300)
                page.screenshot(path=output_path, full_page=True)
                success += 1
                print(f"  ✅ [{n}] {title[:20]}...")
            except Exception as e:
                failed += 1
                print(f"  ❌ [{n}] {title[:20]}... {e}")

        browser.close()

    print(f"\n✅ 批量卡片生成完成: 成功 {success} / 失败 {failed}")


if __name__ == '__main__':
    main()
