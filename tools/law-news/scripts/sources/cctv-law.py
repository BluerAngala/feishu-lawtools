# scripts/sources/cctv-law.py
"""
央视网法治新闻 — 信息源脚本
"""
import re
import json
import datetime
import urllib.request

ID = 'cctv-law'
NAME = '央视网'

API_URL = "https://news.cctv.com/2019/07/gaiban/cmsdatainterface/page/law_1.jsonp?cb=law"


def article_id_from_url(url):
    """从央视网 URL 提取文章 ID（如 ARTIxxx）"""
    m = re.search(r'/(ARTI[a-zA-Z0-9_-]+)\.', url)
    return m.group(1) if m else None


def fetch_list(days=3, max_items=10):
    """获取资讯列表。返回 list of dict，每项含 title/date/url/brief/image/image2/image3/keywords"""
    req = urllib.request.Request(API_URL, headers={'X-Requested-With': 'XMLHttpRequest'})
    try:
        resp = urllib.request.urlopen(req).read().decode('utf-8')
    except Exception as e:
        raise RuntimeError(f"fetch failed: {e}")

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
            'keywords': i['keywords'].split(),
            'source': ID,
        })
        if len(out) >= max_items:
            break
    return out


def fetch_article(url):
    """获取单篇文章全文。返回 dict，含 title/url/date/content/images"""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        html = urllib.request.urlopen(req).read().decode('utf-8', errors='replace')
    except Exception as e:
        raise RuntimeError(f"fetch-article failed: {e}")

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

    # Extract content from embedded JS (var contentdate = '...')
    idx = html.find('var contentdate')
    content = ''
    content_html = ''

    if idx >= 0:
        start_char = None
        start_idx = -1
        for c in ("'", '"'):
            qi = html.find(c, idx + 16)
            if qi > 0:
                start_char = c
                start_idx = qi + 1
                break

        if start_char:
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
            raw_html = raw_html.replace('\\n', '\n').replace('\\/', '/').replace('\\"', '"').replace("\\'", "'")
            content_html = raw_html

            text = re.sub(r'<script[^>]*>.*?</script>', '', raw_html, flags=re.DOTALL)
            text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
            text = re.sub(r'<[^>]+>', '', text)
            text = text.replace('&ldquo;', '\u201c').replace('&rdquo;', '\u201d')
            text = text.replace('&nbsp;', ' ').replace('&mdash;', '\u2014').replace('&hellip;', '\u2026')
            text = text.replace('&quot;', '"').replace('&lt;', '<').replace('&gt;', '>')
            text = re.sub(r'&[a-z]+;', '', text)
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
        'images': imgs,
    }
