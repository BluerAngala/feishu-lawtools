#!/usr/bin/env python3
"""批量生成小红书笔记卡片（v11：极简+❶❷❸列表+固定高度）

用法：
  python3 batch-gen-cards.py --articles /tmp/newspic-articles.json --outdir /path/to/output

输入 JSON 格式（每篇）：
  {
    "title": "...",
    "content": "摘要正文\n\n律师说：\n点评第一句。点评第二句。点评第三句。\n\n—— 陈恒 · 广东岭南律师事务所"
  }

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
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: #e8e4dc;
  font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif;
}

.card {
  width: 1080px;
  height: 1440px;
  background: #fcfaf7;
  position: relative;
  overflow: hidden;
  padding: 0 64px;
}

.top-line {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 4px;
  background: #1e3a8a;
}

.head { margin-top: 50px; }
.tag {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  font-size: 26px;
  color: #1e3a8a;
  font-weight: 600;
  letter-spacing: 2px;
}
.tag::before {
  content: '';
  width: 30px;
  height: 2px;
  background: #1e3a8a;
}

h1 {
  font-size: 60px;
  font-weight: 800;
  line-height: 1.4;
  color: #1a1a2e;
  letter-spacing: 1px;
  margin-top: 24px;
}

.title-rule {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 22px;
}
.title-rule span {
  width: 64px; height: 3px;
  background: #dc2626; border-radius: 2px;
}
.title-rule i {
  width: 8px; height: 3px;
  background: #dc2626; opacity: 0.5; border-radius: 2px;
}

.body {
  margin-top: 44px;
  height: 460px;
  position: relative;
  overflow: hidden;
}
.body p {
  font-size: 32px;
  line-height: 1.95;
  color: #2d2d3a;
  letter-spacing: 0.4px;
}
.body p + p { margin-top: 24px; }
.body .source {
  font-size: 20px;
  color: #a8a8b4;
  margin-top: 28px;
  text-align: right;
  letter-spacing: 1px;
}
.body-mask {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 60px;
  background: linear-gradient(180deg, transparent, #fcfaf7);
  pointer-events: none;
}

.comment {
  margin-top: 32px;
  height: 460px;
  border-top: 2px solid #1e3a8a;
  padding-top: 24px;
  position: relative;
  overflow: hidden;
}
.comment-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 22px;
}
.comment-head .dot {
  width: 12px; height: 12px;
  background: #dc2626;
  border-radius: 50%;
  flex-shrink: 0;
}
.comment-head .label {
  font-size: 34px;
  font-weight: 700;
  color: #1e3a8a;
  letter-spacing: 2px;
}

.point {
  display: flex;
  gap: 18px;
  margin-bottom: 18px;
}
.point:last-child { margin-bottom: 0; }

.point-num {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #1e3a8a;
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 4px;
}
.point-text {
  flex: 1;
  font-size: 28px;
  line-height: 1.7;
  color: #2d2d3a;
  letter-spacing: 0.3px;
}
.point-text b { color: #1e3a8a; font-weight: 700; }

.comment-mask {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 60px;
  background: linear-gradient(180deg, transparent, #fcfaf7);
  pointer-events: none;
}

.footer {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  padding: 24px 64px 30px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid rgba(0,0,0,0.08);
  background: #fcfaf7;
}
.footer-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.footer-stripe {
  width: 20px; height: 2px;
  background: #1e3a8a; border-radius: 1px;
}
.footer-name {
  font-size: 19px;
  color: #8a8a96;
  letter-spacing: 1px;
}
.footer-tag {
  font-size: 17px;
  color: #b8b8c4;
  letter-spacing: 3px;
  font-weight: 300;
}
</style>
</head>
<body>
<div class="card">
  <div class="top-line"></div>
  <div class="head">
    <div class="tag">法律资讯</div>
    <h1>TITLE_PLACEHOLDER</h1>
    <div class="title-rule"><span></span><i></i></div>
  </div>
  <div class="body">BODY_PLACEHOLDER<div class="body-mask"></div></div>
  <div class="comment">COMMENT_PLACEHOLDER<div class="comment-mask"></div></div>
  <div class="footer">
    <div class="footer-left">
      <div class="footer-stripe"></div>
      <span class="footer-name">陈恒 · 广东岭南律师事务所</span>
    </div>
    <div class="footer-tag">法 律 · 洞 见</div>
  </div>
</div>
</body>
</html>"""


def split_summary_and_comment(content):
    """从 content 中分离摘要和律师点评

    content 格式示例：
      摘要第一段。摘要第二段。

      律师说：
      点评第一句。点评第二句。点评第三句。

      —— 陈恒 · 广东岭南律师事务所
    """
    # 去除 markdown 强调与 markdown 引用行
    content = re.sub(r'\*\*(.+?)\*\*', r'\1', content)
    content = re.sub(r'^>\s*', '', content, flags=re.MULTILINE)

    # 找 "律师说：" / "陈律师说：" 分隔
    m = re.search(r'(陈律师说|律师说)[：:]\s*', content)
    if m:
        summary_text = content[:m.start()].strip()
        comment_text = content[m.end():].strip()
    else:
        summary_text = content.strip()
        comment_text = ''

    # 仅去除 comment 末尾的签名行（独立成行的 "—— xxx"）
    # 注意：不能动 summary，里面可能含段内破折号（如"轰轰轰——"）
    comment_text = re.sub(r'\n+\s*[—\-]{2}\s*.*$', '', comment_text, flags=re.DOTALL).strip()

    return summary_text, comment_text


def summary_to_html(summary_text, source=''):
    """摘要转 HTML（按段落）"""
    paragraphs = [p.strip() for p in re.split(r'\n+', summary_text) if p.strip()]
    if not paragraphs:
        return ''
    parts = [f'<p>{escape(p)}</p>' for p in paragraphs]
    if source:
        parts.append(f'<p class="source">{escape(source)}</p>')
    return '\n'.join(parts)


def comment_to_html(comment_text):
    """律师点评转 HTML：按"。"拆分成最多3个要点，渲染为 ❶❷❸ 列表"""
    if not comment_text:
        return ''

    # 按"。"拆分（保留内容中其他标点）
    sentences = re.split(r'(?<=。)', comment_text)
    sentences = [s.strip() for s in sentences if s.strip()]

    # 最多3个要点
    points = sentences[:3]

    if not points:
        return ''

    html_parts = ['''<div class="comment-head">
  <div class="dot"></div>
  <div class="label">律师点评</div>
</div>''']

    for i, point in enumerate(points):
        # 去掉末尾"。"避免重复
        text = point.rstrip('。').strip()
        html_parts.append(
            f'<div class="point">'
            f'<div class="point-num">{i+1}</div>'
            f'<div class="point-text">{escape(text)}</div>'
            f'</div>'
        )
    return '\n'.join(html_parts)


def generate_card(title, content, output_path):
    """生成单张卡片图片"""
    summary_text, comment_text = split_summary_and_comment(content)
    # 摘要末尾的 source（一般用"—— 来源媒体"）
    # 尝试从摘要末尾提取"—— xxx"作为 source
    source = ''
    sm = re.search(r'\n\n\s*[—\-]{2}\s*([^\n]+?)\s*$', summary_text)
    if sm:
        source = sm.group(1).strip()
        summary_text = summary_text[:sm.start()].rstrip()

    body_html = summary_to_html(summary_text, source=source)
    comment_html = comment_to_html(comment_text)

    html = TEMPLATE
    html = html.replace('TITLE_PLACEHOLDER', escape(title))
    html = html.replace('BODY_PLACEHOLDER', body_html)
    html = html.replace('COMMENT_PLACEHOLDER', comment_html)

    # 写入 HTML（便于调试）
    html_path = output_path.rsplit('.', 1)[0] + '.html'
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html)

    # playwright 截图
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(args=['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'])
            page = browser.new_page(viewport={'width': 1080, 'height': 1440}, device_scale_factor=1)
            page.goto(f'file://{html_path}', wait_until='networkidle')
            page.wait_for_timeout(800)
            page.screenshot(path=output_path, full_page=False)
            browser.close()
        return True
    except Exception as e:
        print(f"  ❌ playwright 截图失败: {e}", file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(description='批量生成小红书笔记卡片 (v11)')
    parser.add_argument('--articles', required=True, help='newspic articles JSON 文件路径')
    parser.add_argument('--outdir', required=True, help='输出目录')
    parser.add_argument('--start', type=int, default=1, help='起始序号（默认1）')
    args = parser.parse_args()

    os.makedirs(args.outdir, exist_ok=True)

    with open(args.articles, 'r', encoding='utf-8') as f:
        articles = json.load(f)

    success = 0
    failed = 0

    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'])
        page = browser.new_page(viewport={'width': 1080, 'height': 1440}, device_scale_factor=1)

        for i, art in enumerate(articles):
            n = args.start + i
            title = art.get('title', art.get('original_title', ''))
            content = art.get('content', '')

            summary_text, comment_text = split_summary_and_comment(content)
            source = ''
            sm = re.search(r'\n\n\s*[—\-]{2}\s*([^\n]+?)\s*$', summary_text)
            if sm:
                source = sm.group(1).strip()
                summary_text = summary_text[:sm.start()].rstrip()

            body_html = summary_to_html(summary_text, source=source)
            comment_html = comment_to_html(comment_text)

            html = TEMPLATE
            html = html.replace('TITLE_PLACEHOLDER', escape(title))
            html = html.replace('BODY_PLACEHOLDER', body_html)
            html = html.replace('COMMENT_PLACEHOLDER', comment_html)

            output_path = os.path.join(args.outdir, f'art{n}-card.png')
            html_path = os.path.join(args.outdir, f'art{n}-card.html')

            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(html)

            try:
                page.goto(f'file://{html_path}', wait_until='networkidle')
                page.wait_for_timeout(600)
                page.screenshot(path=output_path, full_page=False)
                success += 1
                print(f"  ✅ [{n}] {title[:30]}...")
            except Exception as e:
                failed += 1
                print(f"  ❌ [{n}] {title[:30]}... {e}")

        browser.close()

    print(f"\n✅ 批量卡片生成完成: 成功 {success} / 失败 {failed}")


if __name__ == '__main__':
    main()
