#!/usr/bin/env python3
"""从简报 md 拆分文章，组装 newspic 所需的 JSON

用法：
  python3 prepare-newspic.py --brief "简报.md" --comments "/tmp/comments.json" --output /tmp/newspic-articles.json

输出格式：
  [{
    "id": "ARTIxxx",
    "original_title": "原文标题",
    "title": "AI 生成的新标题",
    "url": "原文URL",
    "img_url": "原文配图URL",
    "content": "纯文本正文+评论",
    "image_paths": []  // 留空，由后续步骤填充
  }, ...]
"""
import argparse
import json
import os
import re
import sys


def load_profile():
    """从 lawyer-profile.json 读取 label 和 signature"""
    # 尝试多个路径
    candidates = [
        os.path.join(os.path.dirname(__file__), '..', 'law-news', 'lawyer-profile.json'),
        os.path.join(os.path.dirname(__file__), 'lawyer-profile.json'),
    ]
    for p in candidates:
        if os.path.exists(p):
            with open(p, 'r', encoding='utf-8') as f:
                return json.load(f)
    # 默认值
    return {"label": "律师说", "signature": "陈恒 · 广东岭南律师事务所"}


def parse_brief(md_path, profile):
    """从简报 md 拆分文章"""
    label = profile.get('label', '律师说')
    signature = profile.get('signature', '陈恒 · 广东岭南律师事务所')

    with open(md_path, 'r', encoding='utf-8') as f:
        md = f.read()

    parts = re.split(r'^## \[', md, flags=re.MULTILINE)
    articles = []

    for chunk in parts[1:]:
        lines = chunk.split('\n')
        title_line = lines[0]
        # 格式: N. 标题](url)
        title_match = re.match(r'\d+\.\s*(.+?)\]\((.+?)\)', title_line)
        if not title_match:
            continue
        title = title_match.group(1)
        url = title_match.group(2)

        # 找图片URL
        img_match = re.search(r'!\[.*?\]\((.+?)\)', chunk)
        img_url = img_match.group(1) if img_match else ''

        # 找文章ID
        art_id_match = re.search(r'(ARTI\w+)', url)
        art_id = art_id_match.group(1) if art_id_match else ''

        # 提取正文摘要（到评论标签之前）
        # 兼容旧标签"陈律师说"和新标签
        label_pattern = re.escape(label) + '|' + '陈律师说'
        body_match = re.search(
            r'\n\n(?:!\[.*?\]\(.*?\)\n\n)?(.+?)(?=\n\n\*\*(?:' + label_pattern + r'))',
            chunk, re.DOTALL
        )
        body = body_match.group(1).strip() if body_match else ''

        # 提取评论（兼容新旧标签）
        comment_match = re.search(
            r'\*\*(?:' + label_pattern + r')\*\*[：:]\s*(.+?)(?=\n\n——)',
            chunk, re.DOTALL
        )
        comment = comment_match.group(1).strip() if comment_match else ''

        # 评论分点换行：在①②③编号前加换行
        comment_formatted = re.sub(r'([①②③④⑤⑥⑦⑧⑨⑩])', r'\n\1', comment).strip()

        # 组装 content
        full_content = body
        if comment_formatted:
            full_content += f'\n\n{label}：\n{comment_formatted}\n\n—— {signature}'

        articles.append({
            'id': art_id,
            'original_title': title,
            'title': title,  # 默认用原文标题，由外部替换为 AI 生成标题
            'url': url,
            'img_url': img_url,
            'content': full_content.strip(),
            'image_paths': [],
            'content_source_url': url,
        })

    return articles


def load_comments(comments_path):
    """加载评论 JSON"""
    with open(comments_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(description='从简报 md 拆分文章并组装 newspic JSON')
    parser.add_argument('--brief', required=True, help='简报 md 文件路径')
    parser.add_argument('--comments', required=True, help='评论 JSON 文件路径')
    parser.add_argument('--output', required=True, help='输出 JSON 文件路径')
    parser.add_argument('--titles', help='AI 生成标题 JSON 文件路径（可选，格式 {"ARTIxxx": "新标题", ...}）')
    args = parser.parse_args()

    articles = parse_brief(args.brief, load_profile())
    comments = load_comments(args.comments)

    # 加载 AI 生成标题（如有）
    ai_titles = {}
    if args.titles:
        with open(args.titles, 'r', encoding='utf-8') as f:
            ai_titles = json.load(f)

    # 替换标题
    for art in articles:
        if art['id'] in ai_titles:
            art['title'] = ai_titles[art['id']]

    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)

    print(f"✅ 拆分完成: {len(articles)} 篇文章 → {args.output}")
    for i, art in enumerate(articles):
        title_display = art['title'][:30]
        orig = art['original_title'][:20]
        print(f"  [{i+1}] {art['id']}: {orig}... → {title_display}...")


if __name__ == '__main__':
    main()
