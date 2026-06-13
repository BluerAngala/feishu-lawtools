#!/usr/bin/env python3
"""
law-news — 法律资讯获取脚本

设计理念：脚本做实事（抓取→处理→存盘→交付路径），AI 只做判断和编排
每条记录自动缓存，数据来源可追溯，交付物为 .md 文件路径

用法:
  python3 law-news.py fetch <source> [--days 3] [--max 10]
  python3 law-news.py fetch-article <url>
  python3 law-news.py compile --articles <id,id,...> --style 简报|深度|专题 [--title "标题"]
  python3 law-news.py publish <markdown_path> [--title "标题"] [--wiki <space_id>]
  python3 law-news.py list-cache [<source>]

环境变量:
  LAW_NEWS_DIR   数据根目录（默认 tools/law-news/cache/）

输出约定:
  stdout: 只输出交付物（文件路径 / ✅ URL），一行搞定
  stderr: 错误信息
  exit 0 — 成功 | exit 1 — 失败
"""
import os
import sys
import json
import re
import datetime
import html as htmlmod
import urllib.request
import subprocess

CCTVP_API = "https://news.cctv.com/2019/07/gaiban/cmsdatainterface/page/law_1.jsonp?cb=law"


# ===== helpers =====

def get_tool_dir():
    """获取工具根目录（scripts/..）"""
    return os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

def get_cache_dir():
    default = os.path.join(get_tool_dir(), 'cache')
    return os.environ.get('LAW_NEWS_DIR', default)

def ensure_dirs(*paths):
    for p in paths:
        os.makedirs(p, exist_ok=True)

def article_id_from_url(url):
    m = re.search(r'/(ARTI[a-zA-Z0-9_-]+)\.', url)
    return m.group(1) if m else None

def today():
    return datetime.date.today().isoformat()

def now_ts():
    return datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).strftime('%Y-%m-%dT%H:%M:%S%z')

def die(msg):
    print(msg, file=sys.stderr)
    sys.exit(1)

def is_image_url(text):
    text = text.strip()
    return (text.startswith('http://') or text.startswith('https://')) and \
           any(text.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp'])


# ===== image dimension reader (standard library only) =====
# Read first ~16KB of an image URL and parse width/height from header
# Supports: JPEG, PNG, GIF, WebP

def get_image_dimensions(url):
    """Return (width, height) from image URL. Returns None on failure."""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        # Read enough to cover all header formats
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read(65536)

        # PNG: 8-byte signature, then IHDR chunk
        if data[:8] == b'\x89PNG\r\n\x1a\n':
            # IHDR starts at byte 8: 4 bytes length, 4 bytes type, then 4 bytes width, 4 bytes height
            width = int.from_bytes(data[16:20], 'big')
            height = int.from_bytes(data[20:24], 'big')
            return width, height

        # GIF: starts with "GIF87a" or "GIF89a", then 7-byte screen descriptor with dimensions
        if data[:6] in (b'GIF87a', b'GIF89a'):
            width = int.from_bytes(data[6:8], 'little')
            height = int.from_bytes(data[8:10], 'little')
            return width, height

        # WebP: "RIFF" + size + "WEBP"
        if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
            # VP8 chunk (lossy): after "VP8 " (4 bytes), 4 bytes size, then 10 bytes of header
            # 0x9D 0x01 0x2A marker, then 2 bytes width, 2 bytes height
            if data[12:16] == b'VP8 ':
                w = int.from_bytes(data[26:28], 'little') & 0x3FFF
                h = int.from_bytes(data[28:30], 'little') & 0x3FFF
                return w, h
            # VP8L chunk (lossless): "VP8L" + 4 bytes size, then 1 byte 0x2F
            # Then 4 bytes with width-1 (14 bits) and height-1 (14 bits)
            if data[12:16] == b'VP8L':
                bits = int.from_bytes(data[21:25], 'little')
                w = (bits & 0x3FFF) + 1
                h = ((bits >> 14) & 0x3FFF) + 1
                return w, h
            # VP8X (extended): another 10 bytes then 24-bit dimensions
            if data[12:16] == b'VP8X':
                w = int.from_bytes(data[24:27], 'little') + 1
                h = int.from_bytes(data[27:30], 'little') + 1
                return w, h

        # JPEG: scan markers for SOF0/SOF2/SOF5/SOF6/SOF7/SOF9/SOF10/SOF11
        if data[:2] == b'\xFF\xD8':
            i = 2
            while i < len(data) - 9:
                if data[i] == 0xFF:
                    marker = data[i + 1]
                    # SOF markers (excluding DHT, DNL, etc.)
                    if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                        height = int.from_bytes(data[i + 5:i + 7], 'big')
                        width = int.from_bytes(data[i + 7:i + 9], 'big')
                        return width, height
                    # Skip segment
                    seg_len = int.from_bytes(data[i + 2:i + 4], 'big')
                    i += 2 + seg_len
                else:
                    i += 1

        return None
    except Exception:
        return None


def fit_image_dimensions(orig_w, orig_h, max_w=600, max_h=400):
    """Scale image to fit within (max_w, max_h) preserving aspect ratio."""
    if not orig_w or not orig_h:
        return max_w, max_h
    scale_w = max_w / orig_w
    scale_h = max_h / orig_h
    scale = min(scale_w, scale_h, 1.0)  # don't upscale small images
    return int(orig_w * scale), int(orig_h * scale)


def calculate_scale(url, target_w=600):
    """Calculate scale value so image displays at approximately target_w pixels wide.
    Feishu's `scale` attribute multiplies the image's natural display size.
    Supports scale > 1.0 (Feishu accepts it) for upscaling small images.
    """
    dims = get_image_dimensions(url)
    if not dims:
        return 1.0
    orig_w, orig_h = dims
    if orig_w <= 0:
        return 1.0
    return target_w / orig_w

# ===== fetch: 资讯列表 → 索引文档 .md =====

def fetch_cctv(days=3, max_items=10):
    url = CCTVP_API
    req = urllib.request.Request(url, headers={'X-Requested-With': 'XMLHttpRequest'})

    try:
        resp = urllib.request.urlopen(req).read().decode('utf-8')
    except Exception as e:
        die(f"fetch failed: {e}")

    # Strip JSONP wrapper: law(...)
    resp = resp.strip()
    if resp.startswith('law('):
        resp = resp[4:]
    if resp.endswith(')'):
        resp = resp[:-1]

    data = json.loads(resp)
    items = data['data']['list']

    cutoff = datetime.datetime.now() - datetime.timedelta(days=days)
    out = []
    for i in items:
        d = datetime.datetime.strptime(i['focus_date'][:10], '%Y-%m-%d')
        if d < cutoff:
            continue
        out.append({
            'title': i['title'],
            'date': i['focus_date'],
            'url': i['url'],
            'brief': i['brief'],
            'image': i.get('image', '') or '',
            'image2': i.get('image2', '') or '',
            'image3': i.get('image3', '') or '',
            'keywords': i['keywords'].split()
        })
        if len(out) >= max_items:
            break

    result = {'source': 'cctv-law', 'count': len(out), 'items': out}
    cache_dir = get_cache_dir()

    # Save raw JSON
    raw_dir = os.path.join(cache_dir, 'raw', 'cctv-law')
    ensure_dirs(raw_dir)
    raw_file = os.path.join(raw_dir, f"{today()}.json")
    with open(raw_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False)

    # Generate markdown index
    exports_dir = os.path.join(cache_dir, 'exports')
    ensure_dirs(exports_dir)
    md_file = os.path.join(exports_dir, f"{today()}_cctv-law_索引.md")

    ts = now_ts()
    lines = [
        '# 央视网法治新闻 · 资讯列表',
        '',
        f'获取时间: {ts}',
        f'> 共 {len(out)} 条 | 原始数据: {raw_file}',
        '',
    ]
    for idx, i in enumerate(out, 1):
        brief = (i['brief'][:200] + '…') if len(i['brief']) > 200 else i['brief']
        lines.extend([
            f'## {idx}. {i["title"]}',
            '',
            f'- **日期**: {i["date"]}',
            f'- **摘要**: {brief}',
            f'- **关键词**: {"、".join(i["keywords"])}',
            f'- **原文**: {i["url"]}',
            '',
        ])

    with open(md_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    return md_file


# ===== fetch-article: 单篇全文 → 文章 .md =====

def fetch_article_content(url):
    """从央视网文章页提取全文"""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        html = urllib.request.urlopen(req).read().decode('utf-8', errors='replace')
    except Exception as e:
        die(f"fetch-article failed: {e}")

    # Extract title
    title_m = re.search(r'<title>(.*?)</title>', html)
    title = title_m.group(1) if title_m else ''
    title = re.sub(r'\s*[_-]\s*(央视网|新闻频道).*$', '', title).strip()

    # Extract date: try page, fallback to URL
    date = ''
    date_m = re.search(r'(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})', html)
    if date_m:
        date = date_m.group(1)
    if not date:
        date_m = re.search(r'/(\d{4})/(\d{2})/(\d{2})/', url)
        if date_m:
            date = f'{date_m.group(1)}-{date_m.group(2)}-{date_m.group(3)}'

    # Extract contentdate from embedded JS
    idx = html.find('var contentdate')
    content = ''
    content_html = ''

    if idx >= 0:
        # Find the string literal (single or double quoted)
        start_char = None
        start_idx = -1
        for c in ("'", '"'):
            qi = html.find(c, idx + 16)
            if qi > 0:
                start_char = c
                start_idx = qi + 1
                break

        if start_char:
            # Find matching end (handling escape sequences)
            end = start_idx
            escaped = False
            while end < len(html):
                ch = html[end]
                if escaped:
                    escaped = False
                elif ch == '\\':
                    escaped = True
                elif ch == start_char:
                    break
                end += 1

            raw_html = html[start_idx:end]
            # Unescape JS string
            raw_html = raw_html.replace('\\n', '\n').replace('\\/', '/').replace('\\"', '"').replace("\\'", "'")
            content_html = raw_html

            # Strip HTML tags
            text = re.sub(r'<script[^>]*>.*?</script>', '', raw_html, flags=re.DOTALL)
            text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
            text = re.sub(r'<[^>]+>', '', text)
            # HTML entities
            text = text.replace('&ldquo;', '\u201c').replace('&rdquo;', '\u201d')
            text = text.replace('&nbsp;', ' ').replace('&mdash;', '\u2014').replace('&hellip;', '\u2026')
            text = text.replace('&quot;', '"').replace('&lt;', '<').replace('&gt;', '>')
            text = re.sub(r'&[a-z]+;', '', text)
            # Normalize lines
            lines = [l.strip() for l in text.split('\n') if l.strip()]
            content = '\n\n'.join(lines)

    # Extract images
    source_html = content_html if content_html else html
    imgs = re.findall(r'<img[^>]+src="([^"]+)"', source_html)
    imgs = [img for img in imgs if img.startswith('http')]

    return {
        'title': title,
        'url': url,
        'date': date,
        'content': content,
        'content_html': content_html,
        'images': imgs,
        'keywords': [],
        'cached_at': now_ts()
    }


def fetch_article_cmd(url):
    article_id = article_id_from_url(url)
    if not article_id:
        article_id = str(hash(url))[:16]

    cache_dir = get_cache_dir()
    articles_dir = os.path.join(cache_dir, 'articles')
    ensure_dirs(articles_dir)

    json_file = os.path.join(articles_dir, f'{article_id}.json')
    md_file = os.path.join(articles_dir, f'{article_id}.md')

    # Cache hit
    if os.path.isfile(md_file) and os.path.isfile(json_file):
        return md_file

    data = fetch_article_content(url)

    # Look up main image from cached raw data
    raw_dir = os.path.join(get_cache_dir(), 'raw', 'cctv-law')
    if os.path.isdir(raw_dir):
        for fn in sorted(os.listdir(raw_dir), reverse=True):
            if fn.endswith('.json'):
                with open(os.path.join(raw_dir, fn), 'r') as f:
                    raw_data = json.load(f)
                for item in raw_data.get('items', []):
                    if item.get('url', '').rstrip('/') == url.rstrip('/'):
                        data['image'] = item.get('image', '') or ''
                        break
            if data.get('image'):
                break
    data.setdefault('image', '')

    # Save JSON
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)

    # Generate .md
    md_lines = [
        f'# {data["title"]}',
        '',
        f'**来源**: 央视网 | {data["date"]} | [原文链接]({data["url"]})',
        '',
    ]
    if data.get('image'):
        md_lines.append(data['image'])
        md_lines.append('')
    md_lines.append(data['content'])
    md_lines.append('')
    md_lines.append('---')

    with open(md_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(md_lines))

    return md_file


# ===== compile: 多篇文章汇编 → 最终稿件 .md =====

def compile_newsletter(articles_csv, style='简报', title=None, lawyer_comments=None, lawyer_profile=None):
    if not articles_csv:
        die("ERROR: --articles is required")
    if not title:
        title = f'法律资讯{style} {today()}'

    # Parse optional lawyer comments JSON: {"article_id": "comment", ...}
    # Accepts either inline JSON string or @file path
    comments = {}
    if lawyer_comments:
        if lawyer_comments.startswith('@'):
            file_path = lawyer_comments[1:]
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    comments = json.load(f)
            except (OSError, json.JSONDecodeError) as e:
                die(f"ERROR: failed to load --lawyer-comments from {file_path}: {e}")
        else:
            try:
                comments = json.loads(lawyer_comments)
            except json.JSONDecodeError as e:
                die(f"ERROR: --lawyer-comments must be valid JSON: {e}")

    # Parse optional lawyer profile (label, signature, style_prompt)
    profile = {'label': '律师说', 'signature': '', 'style_prompt': ''}
    if lawyer_profile:
        if lawyer_profile.startswith('@'):
            file_path = lawyer_profile[1:]
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    profile.update(json.load(f))
            except (OSError, json.JSONDecodeError) as e:
                die(f"ERROR: failed to load --lawyer-profile from {file_path}: {e}")
        else:
            try:
                profile.update(json.loads(lawyer_profile))
            except json.JSONDecodeError as e:
                die(f"ERROR: --lawyer-profile must be valid JSON: {e}")

    lawyer_label = profile.get('label') or '律师说'
    lawyer_sig_line = f"—— {profile['signature']}" if profile.get('signature') else ''

    cache_dir = get_cache_dir()
    exports_dir = os.path.join(cache_dir, 'exports')
    ensure_dirs(exports_dir)
    safe_title = re.sub(r'[\\/:*?"<>| ]', '_', title)
    md_file = os.path.join(exports_dir, f'{today()}_{safe_title}.md')

    article_ids = [a.strip() for a in articles_csv.split(',') if a.strip()]
    articles_dir = os.path.join(cache_dir, 'articles')

    lines = [
        f'# {title}',
        '',
    ]

    idx = 0
    for aid in article_ids:
        json_path = os.path.join(articles_dir, f'{aid}.json')
        md_path = os.path.join(articles_dir, f'{aid}.md')

        if not os.path.isfile(json_path):
            lines.extend(['', f'> ⚠️ 未找到文章: {aid}（请先运行 fetch-article）', ''])
            continue

        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        idx += 1

        if style == '简报':
            title_text = data.get('title', '')
            article_url = data.get('url', '')
            raw_date = data.get('date', '')
            date_text = raw_date[:10] if raw_date else ''
            content = data.get('content', '')
            source_name = '央视网'

            # First 2 sentences as summary
            sentences = re.split(r'[。！？]', content)
            summary = '。'.join(sentences[:2]) + '。' if len(sentences) > 1 else (sentences[0] + '。' if sentences else '')
            summary = summary[:300]

            # Look up main image from raw cache
            image_url = data.get('image', '') or ''
            if not image_url:
                raw_dir = os.path.join(cache_dir, 'raw', 'cctv-law')
                if os.path.isdir(raw_dir):
                    for fn in sorted(os.listdir(raw_dir), reverse=True):
                        if fn.endswith('.json'):
                            with open(os.path.join(raw_dir, fn), 'r') as f:
                                raw_data = json.load(f)
                            for item in raw_data.get('items', []):
                                if article_id_from_url(item.get('url', '')) == aid:
                                    image_url = item.get('image', '') or ''
                                    break
                        if image_url:
                            break

            lines.extend([
                f'## [{idx}. {title_text}]({article_url})',
                '',
            ])
            if image_url:
                lines.extend([f'![]({image_url})', ''])
            lines.extend([
                summary,
                '',
            ])
            # Optional lawyer insight (1-2 sentences from a legal professional's view)
            if aid in comments and comments[aid].strip():
                comment_text = comments[aid].strip()
                lawyer_block = [f'**{lawyer_label}**：{comment_text}']
                if lawyer_sig_line:
                    lawyer_block.append(lawyer_sig_line)
                lines.extend(lawyer_block + [''])
            lines.extend([
                f'> 日期：{date_text}',
                f'> 来源：{source_name}',
                f'> 原文链接：[{article_url}]({article_url})',
                '',
            ])

        elif style in ('深度', '专题'):
            with open(md_path, 'r', encoding='utf-8') as f:
                lines.extend(['---', '', f.read(), ''])

    with open(md_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    return md_file


# ===== publish: .md → 飞书文档 =====

def publish_doc(filepath, title='法律资讯', wiki=None):
    if not os.path.isfile(filepath):
        die(f"ERROR: file not found: {filepath}")

    with open(filepath, 'r', encoding='utf-8') as f:
        md_content = f.read()

    # Convert markdown to simplified XML (supports <img href="url"/>)
    xml_parts = [f'<title>{htmlmod.escape(title)}</title>']
    prev_blank = False
    in_blockquote = False

    for line in md_content.split('\n'):
        stripped = line.rstrip()

        # Skip h1 title line (passed via --title)
        if stripped.startswith('# ') and not stripped.startswith('## '):
            continue

        # Handle blockquote: consecutive > lines grouped into one <blockquote>
        if stripped.startswith('> '):
            content = stripped[2:]
            converted = htmlmod.escape(content)
            converted = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', converted)
            converted = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', converted)
            converted = converted.replace('*', '')
            if not in_blockquote:
                xml_parts.append('<blockquote>')
                in_blockquote = True
            xml_parts.append(f'<p>{converted}</p>')
            prev_blank = False
            continue
        else:
            if in_blockquote:
                xml_parts.append('</blockquote>')
                in_blockquote = False

        # Horizontal rule → blank line
        if re.match(r'^-{3,}$', stripped):
            if not prev_blank:
                xml_parts.append('<p></p>')
                prev_blank = True
            continue

        # Collapse consecutive blank lines
        if not stripped:
            if not prev_blank:
                xml_parts.append('<p></p>')
                prev_blank = True
            continue

        prev_blank = False

        if stripped.startswith('## '):
            content = stripped[3:]
            m = re.match(r'^\[(.+?)\]\(([^)]+)\)$', content)
            if m:
                link_text = m.group(1)
                link_url = m.group(2)
                xml_parts.append(f'<h1><a href="{htmlmod.escape(link_url)}">{htmlmod.escape(link_text)}</a></h1>')
            else:
                xml_parts.append(f'<h1>{htmlmod.escape(content)}</h1>')
        elif stripped.startswith('### '):
            xml_parts.append(f'<h2>{htmlmod.escape(stripped[4:])}</h2>')
        elif is_image_url(stripped):
            scale = calculate_scale(stripped, target_w=600)
            xml_parts.append(f'<img scale="{scale:.4f}" href="{stripped}" />')
        elif re.match(r'^!\[.*\]\((.+)\)$', stripped):
            img_url = re.match(r'^!\[.*\]\((.+)\)$', stripped).group(1)
            scale = calculate_scale(img_url, target_w=600)
            xml_parts.append(f'<img scale="{scale:.4f}" href="{img_url}" />')
        else:
            converted = htmlmod.escape(stripped)
            converted = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', converted)
            converted = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', converted)
            converted = converted.replace('*', '')
            xml_parts.append(f'<p>{converted}</p>')

    if in_blockquote:
        xml_parts.append('</blockquote>')

    xml = '\n'.join(xml_parts)

    try:
        proc = subprocess.run(
            ['lark-cli', 'docs', '+create', '--api-version', 'v2',
             '--content', xml, '--as', 'user', '--format', 'json'],
            capture_output=True, text=True, check=True
        )
        result = json.loads(proc.stdout)
    except subprocess.CalledProcessError as e:
        die(f"lark-cli create failed: {e.stderr or e.stdout}")
    except json.JSONDecodeError as e:
        die(f"lark-cli output parse error: {e}")

    doc = result.get('data', {}).get('document', {})
    doc_id = doc.get('document_id', '')
    url = doc.get('url', '')

    if doc_id and not url:
        url = f"https://lawyerch.feishu.cn/docx/{doc_id}"

    if url:
        print(f"✅ {url}")
    else:
        die(f"create doc failed: {result}")

    if wiki and doc_id:
        subprocess.run(
            ['lark-cli', 'wiki', '+move', '--doc', doc_id, '--space', wiki, '--as', 'user'],
            capture_output=True
        )


# ===== list-cache =====

def list_cache(source=None):
    cache_dir = get_cache_dir()

    if source:
        print(f"=== 缓存: {source} ===")
        raw_dir = os.path.join(cache_dir, 'raw', source)
        if os.path.isdir(raw_dir):
            for fname in sorted(os.listdir(raw_dir)):
                fpath = os.path.join(raw_dir, fname)
                if os.path.isfile(fpath):
                    size = os.path.getsize(fpath)
                    print(f"  {os.path.splitext(fname)[0]}  ({size}B)")
        else:
            print("  (无缓存)")
        return

    print("=== 原始数据缓存 (raw) ===")
    raw_parent = os.path.join(cache_dir, 'raw')
    if os.path.isdir(raw_parent):
        for entry in sorted(os.listdir(raw_parent)):
            src_dir = os.path.join(raw_parent, entry)
            if os.path.isdir(src_dir):
                count = len([f for f in os.listdir(src_dir) if f.endswith('.json')])
                print(f"  {entry}: {count} 条缓存")
    else:
        print("  (无缓存)")

    print()
    print("=== 文章缓存 (articles) ===")
    articles_dir = os.path.join(cache_dir, 'articles')
    if os.path.isdir(articles_dir):
        md_count = len([f for f in os.listdir(articles_dir) if f.endswith('.md')])
        print(f"  {md_count} 篇（.md）")
    else:
        print("  (无缓存)")

    print()
    print("=== 已导出稿件 (exports) ===")
    exports_dir = os.path.join(cache_dir, 'exports')
    if os.path.isdir(exports_dir):
        for fname in sorted(os.listdir(exports_dir)):
            fpath = os.path.join(exports_dir, fname)
            if os.path.isfile(fpath):
                size = os.path.getsize(fpath)
                print(f"  {fname}  ({size}B)")
    else:
        print("  (无缓存)")


# ===== main =====

def main():
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == 'fetch':
        source = sys.argv[2] if len(sys.argv) > 2 else 'cctv-law'
        days = 3
        max_items = 10
        i = 3
        while i < len(sys.argv):
            if sys.argv[i] == '--days' and i + 1 < len(sys.argv):
                days = int(sys.argv[i + 1])
                i += 2
            elif sys.argv[i] == '--max' and i + 1 < len(sys.argv):
                max_items = int(sys.argv[i + 1])
                i += 2
            else:
                i += 1
        if source == 'cctv-law':
            print(fetch_cctv(days, max_items))
        else:
            die(f"ERROR: unknown source: {source}")

    elif cmd == 'fetch-article':
        if len(sys.argv) < 3:
            die("usage: python3 law-news.py fetch-article <url>")
        url = sys.argv[2]
        print(fetch_article_cmd(url))

    elif cmd == 'compile':
        articles_csv = None
        style = '简报'
        title = None
        lawyer_comments = None
        lawyer_profile = None
        i = 2
        while i < len(sys.argv):
            if sys.argv[i] == '--articles' and i + 1 < len(sys.argv):
                articles_csv = sys.argv[i + 1]
                i += 2
            elif sys.argv[i] == '--style' and i + 1 < len(sys.argv):
                style = sys.argv[i + 1]
                i += 2
            elif sys.argv[i] == '--title' and i + 1 < len(sys.argv):
                title = sys.argv[i + 1]
                i += 2
            elif sys.argv[i] == '--lawyer-comments' and i + 1 < len(sys.argv):
                lawyer_comments = sys.argv[i + 1]
                i += 2
            elif sys.argv[i] == '--lawyer-profile' and i + 1 < len(sys.argv):
                lawyer_profile = sys.argv[i + 1]
                i += 2
            else:
                i += 1
        print(compile_newsletter(articles_csv, style, title, lawyer_comments, lawyer_profile))

    elif cmd == 'publish':
        if len(sys.argv) < 3:
            die("usage: python3 law-news.py publish <file> [--title ...] [--wiki ...]")
        filepath = sys.argv[2]
        title = '法律资讯'
        wiki = None
        i = 3
        while i < len(sys.argv):
            if sys.argv[i] == '--title' and i + 1 < len(sys.argv):
                title = sys.argv[i + 1]
                i += 2
            elif sys.argv[i] == '--wiki' and i + 1 < len(sys.argv):
                wiki = sys.argv[i + 1]
                i += 2
            else:
                i += 1
        publish_doc(filepath, title, wiki)

    elif cmd == 'list-cache':
        source = sys.argv[2] if len(sys.argv) > 2 else None
        list_cache(source)

    else:
        print(__doc__, file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
