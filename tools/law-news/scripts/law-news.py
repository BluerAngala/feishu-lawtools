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
import importlib
import importlib.util


# ===== 信息源自动发现 =====
# 每个信息源是一个独立的 .py 文件放在 scripts/sources/ 下
# 只需暴露 ID / NAME / fetch_list() / fetch_article() 四个接口即可自动注册

_SOURCES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sources')
_SOURCES_CACHE = None


def discover_sources():
    """扫描 sources/ 目录，发现所有信息源模块"""
    global _SOURCES_CACHE
    if _SOURCES_CACHE is not None:
        return _SOURCES_CACHE

    result = {}
    if not os.path.isdir(_SOURCES_DIR):
        _SOURCES_CACHE = result
        return result

    for fname in sorted(os.listdir(_SOURCES_DIR)):
        if not fname.endswith('.py') or fname == '__init__.py':
            continue
        mod_name = fname[:-3]
        try:
            spec = importlib.util.spec_from_file_location(
                f'law_news.sources.{mod_name}',
                os.path.join(_SOURCES_DIR, fname)
            )
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)

            src_id = getattr(mod, 'ID', mod_name)
            result[src_id] = {
                'name': getattr(mod, 'NAME', src_id),
                'module': mod,
            }
        except Exception as e:
            print(f"⚠️  加载信息源 {fname} 失败: {e}", file=sys.stderr)

    _SOURCES_CACHE = result
    return result


SOURCES = discover_sources()



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
           any(text.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.jfif'])


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



# ===== fetch-article: 单篇全文 → 文章 .md =====


def fetch_article_cmd(url):
    """Fetch single article, detect source from raw cache, cache JSON+MD"""
    # Try to get article ID from each source module, fallback to hash
    article_id = None
    for src_info in SOURCES.values():
        mod = src_info.get('module')
        if mod and hasattr(mod, 'article_id_from_url'):
            try:
                aid = mod.article_id_from_url(url)
                if aid:
                    article_id = aid
                    break
            except Exception:
                continue
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

    # Try each source's fetch_article, use the first one that works
    data = None
    used_source = ''
    for src_id, src_info in SOURCES.items():
        mod = src_info.get('module')
        if not mod or not hasattr(mod, 'fetch_article'):
            continue
        try:
            data = mod.fetch_article(url)
            if data and data.get('content', '').strip():
                data['source'] = src_id
                used_source = src_id
                break
        except Exception:
            continue

    if data is None:
        die(f"fetch-article failed: no source could parse {url}")

    # Look up metadata (image, keywords, brief) from raw cache
    raw_dir = os.path.join(get_cache_dir(), 'raw', used_source)
    if os.path.isdir(raw_dir):
        for fn in sorted(os.listdir(raw_dir), reverse=True):
            if not fn.endswith('.json'):
                continue
            with open(os.path.join(raw_dir, fn), 'r') as f:
                raw_data = json.load(f)
            for item in raw_data.get('items', []):
                if item.get('url', '').rstrip('/') == url.rstrip('/'):
                    if not data.get('image'):
                        data['image'] = item.get('image', '') or ''
                    if not data.get('keywords'):
                        data['keywords'] = item.get('keywords', [])
                    if not data.get('brief'):
                        data['brief'] = item.get('brief', '')
                    break
            if data.get('image'):
                break

    data.setdefault('image', '')
    data.setdefault('keywords', [])
    data.setdefault('brief', '')
    data.setdefault('source', used_source)

    # Save JSON
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)

    # Generate .md
    src_name = SOURCES.get(used_source, {}).get('name', used_source)
    md_lines = [
        f'# {data["title"]}',
        '',
        f'**来源**: {src_name} | {data["date"]} | [原文链接]({data["url"]})',
        '',
    ]
    if data.get('image'):
        md_lines.append(f'![]({data["image"]})')
        md_lines.append('')
    md_lines.append(data['content'])
    md_lines.append('')
    md_lines.append('---')

    with open(md_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(md_lines))

    return md_file



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
            src_id = data.get('source', '')
            src_info = SOURCES.get(src_id, {})
            source_name = src_info.get('name', src_id or '未知来源')

            # Use original brief from fetch data (no truncation)
            summary = data.get('brief', '') or ''

            # Look up main image from raw cache
            image_url = data.get('image', '') or ''
            if not image_url:
                src_id = data.get('source', '')
                if src_id and src_id in SOURCES:
                    raw_dir = os.path.join(cache_dir, 'raw', src_id)
                    if os.path.isdir(raw_dir):
                        target_url = data.get('url', '').rstrip('/')
                        for fn in sorted(os.listdir(raw_dir), reverse=True):
                            if not fn.endswith('.json'):
                                continue
                            with open(os.path.join(raw_dir, fn), 'r') as f:
                                raw_data = json.load(f)
                            for item in raw_data.get('items', []):
                                if item.get('url', '').rstrip('/') == target_url:
                                    image_url = item.get('image', '') or ''
                                    if image_url:
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
        proc = subprocess.run(
            ['lark-cli', 'wiki', '+move', '--doc', doc_id, '--space', wiki, '--as', 'user'],
            capture_output=True, text=True
        )
        if proc.returncode != 0:
            print(f"⚠️  文档已创建但移入知识库失败: {proc.stderr.strip() or proc.stdout.strip()}", file=sys.stderr)


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
        src_info = SOURCES.get(source)
        if src_info is None:
            available = ', '.join(SOURCES.keys())
            die(f"ERROR: unknown source '{source}'. 可用信息源: {available}")

        mod = src_info.get('module')
        if not mod or not hasattr(mod, 'fetch_list'):
            die(f"ERROR: source '{source}' 未实现 fetch_list()")

        # Fetch items from source module
        items = mod.fetch_list(days=days, max_items=max_items)
        name = src_info.get('name', source)

        # Wrap result
        result = {'source': source, 'count': len(items), 'items': items}
        cache_dir = get_cache_dir()

        # Save raw JSON
        raw_dir = os.path.join(cache_dir, 'raw', source)
        ensure_dirs(raw_dir)
        raw_file = os.path.join(raw_dir, f"{today()}.json")
        with open(raw_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False)

        # Generate markdown index
        exports_dir = os.path.join(cache_dir, 'exports')
        ensure_dirs(exports_dir)
        md_file = os.path.join(exports_dir, f"{today()}_{source}_索引.md")

        ts = now_ts()
        lines = [
            f'# {name} · 资讯列表',
            '',
            f'获取时间: {ts}',
            f'> 共 {len(items)} 条 | 原始数据: {raw_file}',
            '',
        ]
        for idx, i in enumerate(items, 1):
            brief = (i['brief'][:200] + '…') if len(i.get('brief', '')) > 200 else i.get('brief', '')
            keywords = '、'.join(i.get('keywords', []))
            lines.extend([
                f'## {idx}. {i["title"]}',
                '',
                f'- **日期**: {i.get("date", "")}',
                f'- **摘要**: {brief}',
                f'- **关键词**: {keywords}',
                f'- **原文**: {i["url"]}',
                '',
            ])

        with open(md_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

        print(md_file)

    elif cmd == 'fetch-article':
        if len(sys.argv) < 3:
            die("usage: python3 law-news.py fetch-article <url>\n       python3 law-news.py fetch-article --batch \"url1,url2,url3\"")
        if sys.argv[2] == '--batch' and len(sys.argv) >= 4:
            urls = [u.strip() for u in sys.argv[3].split(',') if u.strip()]
            paths = []
            for url in urls:
                try:
                    p = fetch_article_cmd(url)
                    paths.append(p)
                except SystemExit as e:
                    print(f"⚠️  {url} 抓取失败", file=sys.stderr)
            if paths:
                print('\n'.join(paths))
            else:
                die("所有文章均抓取失败")
        else:
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
