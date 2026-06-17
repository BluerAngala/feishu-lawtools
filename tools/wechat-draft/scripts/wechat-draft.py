#!/usr/bin/env python3
"""
微信公众号草稿发布工具

将 HTML 内容发布为微信公众号草稿，自动处理图片上传和 URL 替换。

流程：
1. 获取 access_token
2. 提取 HTML 中的所有图片 URL
3. 下载图片 → 上传到微信（正文图用 uploadimg，封面图用 add_material）
4. 替换 HTML 中的图片 URL 为微信 URL
5. 创建草稿

用法：
  python3 wechat-draft.py publish-draft \
    --title "标题" \
    --html path/to/article.html \
    [--author "作者"] \
    [--digest "摘要"] \
    [--cover-image URL] \
    [--token-url URL] \
    [--config @path/to/config.json]
"""

import sys
import os
import json
import re
import tempfile
import hashlib
import argparse
import traceback

# Coze 运行环境：必须用 coze_workload_identity 替代标准库
from coze_workload_identity import requests

# ============================================================
# 配置
# ============================================================

DEFAULT_TOKEN_URL = (
    "https://env-00jxtnydr3fv.dev-hz.cloudbasefunction.cn/"
    "api-weixin_offiaccount/getStableToken"
    "?appid=wx0d095c2b279d0ba2"
    "&secret=d03e0f62e0e3218828771ab42b80072e"
)

WECHAT_API_BASE = "https://api.weixin.qq.com/cgi-bin"

# uploadimg 限制：JPG/PNG，<1MB
MAX_IMAGE_SIZE = 1 * 1024 * 1024  # 1MB

# 缓存目录
CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "cache")


# ============================================================
# Token 管理
# ============================================================

def get_access_token(token_url=None):
    """从自定义接口获取 access_token"""
    url = token_url or DEFAULT_TOKEN_URL
    try:
        r = requests.get(url, headers={"Content-Type": "application/json"}, json={})
        r.encoding = 'utf-8'
        data = r.json()
    except Exception as e:
        print(f"❌ 获取 token 失败: {e}", file=sys.stderr)
        sys.exit(1)

    # 兼容不同返回格式
    token = data.get("access_token") or data.get("token")
    if not token:
        print(f"❌ token 返回异常: {json.dumps(data, ensure_ascii=False)}", file=sys.stderr)
        sys.exit(1)

    return token


# ============================================================
# 图片处理
# ============================================================

def download_image(url, cache_dir):
    """下载图片到本地缓存，返回文件路径（统一转为 JPEG）"""
    os.makedirs(cache_dir, exist_ok=True)
    url_hash = hashlib.md5(url.encode()).hexdigest()[:12]
    cache_path = os.path.join(cache_dir, f"{url_hash}.jpg")

    if os.path.exists(cache_path):
        return cache_path

    try:
        r = requests.get(url, timeout=30)
        if r.status_code != 200:
            print(f"  ⚠ 下载图片失败 ({r.status_code}): {url[:80]}", file=sys.stderr)
            return None

        content = r.content
        if len(content) > MAX_IMAGE_SIZE:
            print(f"  ⚠ 图片超过1MB ({len(content)} bytes)，跳过: {url[:80]}", file=sys.stderr)
            return None

        # 直接保存原始文件
        raw_path = os.path.join(cache_dir, f"{url_hash}_raw")
        with open(raw_path, 'wb') as f:
            f.write(content)

        # 检测格式，非 JPG/PNG 或微信不支持的格式（如 JFIF）→ 用 PIL 转 JPG
        header = content[:16]
        is_jpeg = header[:2] == b'\xff\xd8'
        is_png = header[:8] == b'\x89PNG\r\n\x1a\n'
        # JFIF 其实就是 JPEG 的一种，但微信可能对 .jfif 扩展名挑剔
        # 检测 URL 是否以非标准扩展名结尾
        needs_convert = not is_jpeg and not is_png

        if needs_convert:
            try:
                from PIL import Image
                img = Image.open(raw_path)
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')
                img.save(cache_path, 'JPEG', quality=90)
                os.remove(raw_path)
                return cache_path
            except ImportError:
                # 没有 PIL，尝试直接保存为 jpg
                os.rename(raw_path, cache_path)
                return cache_path
            except Exception as e:
                print(f"  ⚠ 图片转换失败: {e}，使用原始文件", file=sys.stderr)
                os.rename(raw_path, cache_path)
                return cache_path
        else:
            os.rename(raw_path, cache_path)
            return cache_path

    except Exception as e:
        print(f"  ⚠ 下载图片异常: {e}", file=sys.stderr)
        return None


def upload_content_image(access_token, image_path):
    """上传正文图片（uploadimg），返回微信 URL"""
    url = f"{WECHAT_API_BASE}/media/uploadimg?access_token={access_token}"
    try:
        with open(image_path, 'rb') as f:
            files = {'media': ('image.jpg', f, 'image/jpeg')}
            r = requests.post(url, files=files)
            r.encoding = 'utf-8'
            data = r.json()

        if data.get('errcode', 0) != 0:
            print(f"  ⚠ 上传正文图失败: {data}", file=sys.stderr)
            return None

        return data.get('url')
    except Exception as e:
        print(f"  ⚠ 上传正文图异常: {e}", file=sys.stderr)
        return None


def upload_permanent_material(access_token, image_path):
    """上传永久素材（封面图），返回 media_id 和 url"""
    url = f"{WECHAT_API_BASE}/material/add_material?access_token={access_token}&type=image"
    try:
        with open(image_path, 'rb') as f:
            files = {'media': ('cover.jpg', f, 'image/jpeg')}
            r = requests.post(url, files=files)
            r.encoding = 'utf-8'
            data = r.json()

        if data.get('errcode', 0) != 0:
            print(f"  ⚠ 上传永久素材失败: {data}", file=sys.stderr)
            return None, None

        return data.get('media_id'), data.get('url')
    except Exception as e:
        print(f"  ⚠ 上传永久素材异常: {e}", file=sys.stderr)
        return None, None


# ============================================================
# HTML 处理
# ============================================================

def extract_image_urls(html):
    """提取 HTML 中所有图片 URL（去重，保持顺序）"""
    # 匹配 <img src="..."> 和 <img ...src="...">
    urls = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', html)
    # 也匹配 background-image: url(...)
    urls += re.findall(r'url\(["\']?([^)"\']+?)["\']?\)', html)
    # 过滤掉 data: URI 和微信已有域名
    filtered = []
    seen = set()
    for u in urls:
        if u.startswith('data:') or 'mmbiz.qpic.cn' in u:
            continue
        if u not in seen:
            seen.add(u)
            filtered.append(u)
    return filtered


def replace_image_urls(html, url_map):
    """替换 HTML 中的图片 URL"""
    for old_url, new_url in url_map.items():
        if new_url:
            html = html.replace(old_url, new_url)
    return html


def strip_html_for_digest(html, max_len=120):
    """从 HTML 提取纯文本摘要"""
    text = re.sub(r'<[^>]+>', '', html)
    text = re.sub(r'\s+', ' ', text).strip()
    if len(text) > max_len:
        text = text[:max_len] + '…'
    return text


# ============================================================
# 草稿管理
# ============================================================

def create_draft(access_token, title, content_html, thumb_media_id,
                 author="", digest="", content_source_url="",
                 need_open_comment=1, only_fans_can_comment=0):
    """创建微信公众号草稿"""
    url = f"{WECHAT_API_BASE}/draft/add?access_token={access_token}"

    article = {
        "article_type": "news",
        "title": title,
        "content": content_html,
        "thumb_media_id": thumb_media_id,
        "need_open_comment": need_open_comment,
        "only_fans_can_comment": only_fans_can_comment,
    }
    if author:
        article["author"] = author
    if digest:
        article["digest"] = digest
    if content_source_url:
        article["content_source_url"] = content_source_url

    payload = {"articles": [article]}

    try:
        # ⚠️ 必须用 ensure_ascii=False，否则中文会变成 \uXXXX 转义
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        r = requests.post(url, data=body, headers={"Content-Type": "application/json; charset=utf-8"})
        r.encoding = 'utf-8'
        data = r.json()

        if data.get('errcode', 0) != 0:
            print(f"❌ 创建草稿失败: {json.dumps(data, ensure_ascii=False)}", file=sys.stderr)
            sys.exit(1)

        return data.get('media_id')
    except Exception as e:
        print(f"❌ 创建草稿异常: {e}", file=sys.stderr)
        sys.exit(1)


def md_to_newspic_content(text):
    """将 markdown 文本转为 newspic 纯文本格式
    
    newspic content 只支持纯文本，不支持 HTML 和 markdown
    """
    import re
    
    # 去掉底部引用块（日期/来源/原文链接）
    text = re.sub(r'\n*>\s*日期：.*', '', text, flags=re.DOTALL)
    
    # **加粗** → 去掉星号保留文字
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    # *斜体* → 去掉星号保留文字
    text = re.sub(r'\*(.+?)\*', r'\1', text)
    # [文字](url) → 保留文字
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'\1', text)
    # > 引用行 → 去掉 > 前缀
    text = re.sub(r'^>\s*', '', text, flags=re.MULTILINE)
    # 去掉 HTML 标签（如有）
    text = re.sub(r'<[^>]+>', '', text)
    # 连续空行压缩为双换行
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    return text.strip()


def create_newspic_draft(access_token, title, content, image_media_ids, author="", content_source_url="",
                         need_open_comment=1, only_fans_can_comment=0):
    """创建单篇 newspic 草稿
    
    title: 文章标题（必填，≤32字）
    content: 纯文本内容（必填）
    image_media_ids: list of str, 永久素材 media_id（必填，首张为封面）
    content_source_url: 原文链接（可选）
    need_open_comment: 是否打开评论，1打开(默认)，0不打开
    only_fans_can_comment: 是否粉丝才可评论，0所有人可评论(默认)，1粉丝才可评论
    """
    url = f"{WECHAT_API_BASE}/draft/add?access_token={access_token}"

    article = {
        "article_type": "newspic",
        "title": title[:32],
        "content": content,
        "need_open_comment": need_open_comment,
        "only_fans_can_comment": only_fans_can_comment,
        "image_info": {
            "image_list": [{"image_media_id": mid} for mid in image_media_ids]
        },
    }
    if author:
        article["author"] = author[:8]
    if content_source_url:
        article["content_source_url"] = content_source_url

    payload = {"articles": [article]}

    try:
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        r = requests.post(url, data=body, headers={"Content-Type": "application/json; charset=utf-8"})
        r.encoding = 'utf-8'
        data = r.json()

        if data.get('errcode', 0) != 0:
            print(f"❌ 创建 newspic 草稿失败: {json.dumps(data, ensure_ascii=False)}", file=sys.stderr)
            return None

        return data.get('media_id')
    except Exception as e:
        print(f"❌ 创建 newspic 草稿异常: {e}", file=sys.stderr)
        return None


def get_draft_list(access_token, offset=0, count=5, no_content=1):
    """获取草稿列表"""
    url = f"{WECHAT_API_BASE}/draft/batchget?access_token={access_token}"
    payload = {"offset": offset, "count": count, "no_content": no_content}
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    r = requests.post(url, data=body, headers={"Content-Type": "application/json; charset=utf-8"})
    r.encoding = 'utf-8'
    return r.json()


def delete_draft(access_token, media_id):
    """删除草稿"""
    url = f"{WECHAT_API_BASE}/draft/delete?access_token={access_token}"
    payload = {"media_id": media_id}
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    r = requests.post(url, data=body, headers={"Content-Type": "application/json; charset=utf-8"})
    r.encoding = 'utf-8'
    return r.json()


# ============================================================
# 主流程：publish-draft
# ============================================================

def cmd_publish_draft(args):
    """一键发布草稿到微信公众号"""
    # 1. 读取 HTML
    html_path = args.html
    if not os.path.exists(html_path):
        print(f"❌ HTML 文件不存在: {html_path}", file=sys.stderr)
        sys.exit(1)

    with open(html_path, 'r', encoding='utf-8') as f:
        html_content = f.read()

    # 2. 读取配置
    config = {}
    if args.config:
        config_path = args.config.lstrip('@')
        if os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)

    token_url = args.token_url or config.get('token_url') or DEFAULT_TOKEN_URL

    # 3. 获取 access_token
    print("🔑 获取 access_token...")
    access_token = get_access_token(token_url)
    print(f"✅ token 获取成功 ({access_token[:8]}...)")

    # 4. 提取图片 URL
    image_urls = extract_image_urls(html_content)
    print(f"🖼 发现 {len(image_urls)} 张图片需要上传")

    # 5. 下载并上传图片
    image_cache_dir = os.path.join(CACHE_DIR, "images")
    os.makedirs(image_cache_dir, exist_ok=True)

    url_map = {}  # old_url -> new_wechat_url
    thumb_media_id = None
    cover_image_path = None

    # 确定封面图 URL
    cover_url = args.cover_image or config.get('cover_image')

    for i, img_url in enumerate(image_urls):
        print(f"  [{i+1}/{len(image_urls)}] 处理: {img_url[:60]}...")

        # 下载
        local_path = download_image(img_url, image_cache_dir)
        if not local_path:
            continue

        # 上传正文图
        wechat_url = upload_content_image(access_token, local_path)
        if wechat_url:
            url_map[img_url] = wechat_url
            print(f"    ✅ → {wechat_url[:50]}...")

            # 如果是封面图或第一张图，上传永久素材
            is_cover = (cover_url and img_url == cover_url) or (not cover_url and i == 0)
            if is_cover and not thumb_media_id:
                mid, _ = upload_permanent_material(access_token, local_path)
                if mid:
                    thumb_media_id = mid
                    cover_image_path = local_path
                    print(f"    ✅ 封面素材 media_id: {mid}")

    # 如果没有从文章图片中获得封面，尝试单独下载封面
    if not thumb_media_id and cover_url:
        print(f"  📸 单独处理封面图: {cover_url[:60]}...")
        local_path = download_image(cover_url, image_cache_dir)
        if local_path:
            mid, _ = upload_permanent_material(access_token, local_path)
            if mid:
                thumb_media_id = mid
                print(f"    ✅ 封面素材 media_id: {mid}")

    if not thumb_media_id:
        print("❌ 没有封面图素材，无法创建草稿（微信要求必须有 thumb_media_id）", file=sys.stderr)
        sys.exit(1)

    # 6. 替换 HTML 中的图片 URL
    html_content = replace_image_urls(html_content, url_map)
    print(f"🔄 已替换 {len(url_map)} 张图片 URL")

    # 7. 摘要（微信限制 120 个汉字/字符）
    # ⚠️ 重要：digest 应由 AI 根据文章内容生成，要简练、有吸引力
    # 如果不传 digest，微信会自动抓取正文前54字，效果通常不好
    digest = args.digest or config.get('digest', '')
    if not digest:
        print("⚠️ 未提供摘要(--digest)，微信将自动抓取正文前54字，建议AI生成更吸引人的摘要", file=sys.stderr)
    # 微信 digest 限制 120 个字符
    if digest and len(digest) > 120:
        digest = digest[:117] + '...'

    # 8. 创建草稿
    title = args.title or config.get('title', '未命名文章')
    # 微信作者限制 8 个字
    author = args.author or config.get('author', '')
    if len(author) > 8:
        author = author[:8]
    content_source_url = args.content_source_url or config.get('content_source_url', '')

    print(f"📝 创建草稿: {title}")
    media_id = create_draft(
        access_token=access_token,
        title=title,
        content_html=html_content,
        thumb_media_id=thumb_media_id,
        author=author,
        digest=digest,
        content_source_url=content_source_url,
    )

    print(f"\n✅ 草稿创建成功！")
    print(f"   media_id: {media_id}")
    print(f"   请到微信公众号后台 → 草稿箱 查看和发布")


def cmd_publish_draft_newspic(args):
    """发布 newspic 多文章草稿到微信公众号
    
    --articles: JSON 文件路径，格式:
    [
      {
        "title": "文章标题",
        "content": "纯文本内容",
        "image_url": "https://...",   // 文章配图URL
        "content_source_url": "https://..."  // 原文链接（可选）
      },
      ...
    ]
    """
    # 1. 读取文章列表
    articles_path = args.articles
    if not os.path.exists(articles_path):
        print(f"❌ 文章列表文件不存在: {articles_path}", file=sys.stderr)
        sys.exit(1)

    with open(articles_path, 'r', encoding='utf-8') as f:
        articles_data = json.load(f)

    if not articles_data:
        print("❌ 文章列表为空", file=sys.stderr)
        sys.exit(1)

    print(f"📰 共 {len(articles_data)} 篇文章")

    # 2. 读取配置
    config = {}
    if args.config:
        config_path = args.config.lstrip('@')
        if os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)

    token_url = args.token_url or config.get('token_url') or DEFAULT_TOKEN_URL

    # 3. 获取 access_token
    print("🔑 获取 access_token...")
    access_token = get_access_token(token_url)
    print(f"✅ token 获取成功 ({access_token[:8]}...)")

    # 4. 处理每篇文章的图片
    image_cache_dir = os.path.join(CACHE_DIR, "images")
    os.makedirs(image_cache_dir, exist_ok=True)

    processed_articles = []
    for i, art in enumerate(articles_data):
        title = art.get("title", f"文章{i+1}")[:32]
        content = art.get("content", "")
        image_url = art.get("image_url", "")
        content_source_url = art.get("content_source_url", "")

        print(f"\n  [{i+1}/{len(articles_data)}] {title}")

        image_media_ids = []
        
        # 优先使用 image_paths（本地文件列表，如截图、生成图等）
        image_paths = art.get("image_paths", [])
        for pi, img_path in enumerate(image_paths):
            if not img_path:
                # 空字符串占位，用 image_url 兜底
                if image_url:
                    local_path = download_image(image_url, image_cache_dir)
                    if local_path:
                        mid, _ = upload_permanent_material(access_token, local_path)
                        if mid:
                            image_media_ids.append(mid)
                            print(f"    ✅ 原图素材 media_id: {mid}")
                continue
            if os.path.isfile(img_path):
                mid, _ = upload_permanent_material(access_token, img_path)
                if mid:
                    image_media_ids.append(mid)
                    print(f"    ✅ 本地图片[{pi+1}] media_id: {mid}")
                else:
                    print(f"    ⚠ 上传本地图片[{pi+1}]失败", file=sys.stderr)
            else:
                print(f"    ⚠ 本地图片不存在: {img_path}", file=sys.stderr)
        
        # 如果没有 image_paths，用原来的 image_url 单图逻辑
        if not image_paths and image_url:
            local_path = download_image(image_url, image_cache_dir)
            if local_path:
                mid, _ = upload_permanent_material(access_token, local_path)
                if mid:
                    image_media_ids.append(mid)
                    print(f"    ✅ 图片素材 media_id: {mid}")
                else:
                    print(f"    ⚠ 上传永久素材失败，跳过此图", file=sys.stderr)
            else:
                print(f"    ⚠ 下载图片失败，跳过", file=sys.stderr)

        if not image_media_ids:
            print(f"    ⚠ 无可用图片，newspic 必须有图片，跳过此文章", file=sys.stderr)
            continue

        processed_articles.append({
            "title": title,
            "content": md_to_newspic_content(content),
            "image_media_ids": image_media_ids,
            "content_source_url": content_source_url,
        })

    if not processed_articles:
        print("❌ 没有可发布的文章（所有文章都缺少图片）", file=sys.stderr)
        sys.exit(1)

    # 5. 逐篇创建 newspic 草稿（每篇单独一个草稿）
    author = args.author or config.get('author', '')
    if len(author) > 8:
        author = author[:8]

    media_ids = []
    print(f"\n📝 逐篇创建 newspic 草稿（{len(processed_articles)} 篇）...")
    for i, art in enumerate(processed_articles):
        print(f"\n  [{i+1}/{len(processed_articles)}] {art['title']}")
        mid = create_newspic_draft(
            access_token=access_token,
            title=art["title"],
            content=art["content"],
            image_media_ids=art["image_media_ids"],
            author=author,
            content_source_url=art.get("content_source_url", ""),
        )
        if mid:
            media_ids.append(mid)
            print(f"    ✅ media_id: {mid}")
        else:
            print(f"    ⚠ 创建失败，跳过")

    print(f"\n✅ newspic 草稿创建完成！")
    print(f"   成功 {len(media_ids)} / {len(processed_articles)} 篇")
    for i, mid in enumerate(media_ids):
        print(f"   [{i+1}] media_id: {mid}")
    print(f"   请到微信公众号后台 → 草稿箱 查看和发布")


# ============================================================
# 辅助命令
# ============================================================

def cmd_list_drafts(args):
    """查看草稿列表"""
    token_url = args.token_url or DEFAULT_TOKEN_URL
    access_token = get_access_token(token_url)

    data = get_draft_list(access_token, offset=args.offset, count=args.count, no_content=1)

    if data.get('errcode', 0) != 0:
        print(f"❌ 获取草稿列表失败: {json.dumps(data, ensure_ascii=False)}", file=sys.stderr)
        sys.exit(1)

    total = data.get('total_count', 0)
    items = data.get('item', [])
    print(f"📋 草稿箱共 {total} 条，本次返回 {len(items)} 条:\n")

    for item in items:
        mid = item.get('media_id', '?')
        news = item.get('content', {}).get('news_item', [])
        update_time = item.get('update_time', 0)
        for n in news:
            title = n.get('title', '无标题')
            author = n.get('author', '')
            print(f"  📄 {title}")
            if author:
                print(f"     作者: {author}")
            print(f"     media_id: {mid}")
            print(f"     更新时间: {update_time}")
            print()


def cmd_delete_draft(args):
    """删除草稿"""
    token_url = args.token_url or DEFAULT_TOKEN_URL
    access_token = get_access_token(token_url)

    data = delete_draft(access_token, args.media_id)
    if data.get('errcode', 0) == 0:
        print(f"✅ 草稿 {args.media_id} 已删除")
    else:
        print(f"❌ 删除失败: {json.dumps(data, ensure_ascii=False)}", file=sys.stderr)


def cmd_test_token(args):
    """测试 token 获取"""
    token_url = args.token_url or DEFAULT_TOKEN_URL
    print("🔑 测试获取 access_token...")
    token = get_access_token(token_url)
    print(f"✅ 成功！token: {token[:12]}...({len(token)} chars)")


# ============================================================
# CLI 入口
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description='微信公众号草稿发布工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest='command', help='子命令')

    # publish-draft
    p_pub = subparsers.add_parser('publish-draft', help='发布草稿到微信公众号')
    p_pub.add_argument('--title', help='文章标题（必填）')
    p_pub.add_argument('--html', required=True, help='HTML 文件路径（必填）')
    p_pub.add_argument('--author', default='', help='作者')
    p_pub.add_argument('--digest', default='', help='摘要（不填则自动提取）')
    p_pub.add_argument('--cover-image', default='', help='封面图 URL（不填则用第一张正文图）')
    p_pub.add_argument('--content-source-url', default='', help='阅读原文链接')
    p_pub.add_argument('--token-url', default='', help='自定义 token 接口 URL')
    p_pub.add_argument('--config', default='', help='配置文件路径（@path/to/config.json）')

    # publish-draft-newspic
    p_newspic = subparsers.add_parser('publish-draft-newspic', help='发布 newspic 多文章草稿')
    p_newspic.add_argument('--articles', required=True, help='文章列表 JSON 文件路径（必填）')
    p_newspic.add_argument('--author', default='', help='作者（≤8字）')
    p_newspic.add_argument('--token-url', default='', help='自定义 token 接口 URL')
    p_newspic.add_argument('--config', default='', help='配置文件路径（@path/to/config.json）')

    # list-drafts
    p_list = subparsers.add_parser('list-drafts', help='查看草稿列表')
    p_list.add_argument('--offset', type=int, default=0)
    p_list.add_argument('--count', type=int, default=5)
    p_list.add_argument('--token-url', default='')

    # delete-draft
    p_del = subparsers.add_parser('delete-draft', help='删除草稿')
    p_del.add_argument('--media-id', required=True, help='草稿 media_id')
    p_del.add_argument('--token-url', default='')

    # test-token
    p_test = subparsers.add_parser('test-token', help='测试 token 获取')
    p_test.add_argument('--token-url', default='')

    args = parser.parse_args()

    if args.command == 'publish-draft':
        cmd_publish_draft(args)
    elif args.command == 'publish-draft-newspic':
        cmd_publish_draft_newspic(args)
    elif args.command == 'list-drafts':
        cmd_list_drafts(args)
    elif args.command == 'delete-draft':
        cmd_delete_draft(args)
    elif args.command == 'test-token':
        cmd_test_token(args)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
