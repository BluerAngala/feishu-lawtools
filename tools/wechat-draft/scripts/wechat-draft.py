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
    --token-url URL \
    [--author "作者"] \
    [--digest "摘要"] \
    [--cover-image URL] \
    [--config @path/to/config.json]

首次使用前必须：
  ① 拥有一个微信公众号（服务号或订阅号）
  ② 在公众号后台配置 IP 白名单（详见 tools/wechat-draft/联系我.jpg）
  ③ 部署一个 access_token 接口（返回 JSON: {"access_token": "..."}）
  ④ 通过 --token-url 传入该接口地址
"""

import sys
import os
import json
import re
import hashlib
import argparse

# Coze 运行环境：用 coze_workload_identity；本地环境用标准 requests
try:
    from coze_workload_identity import requests
except ModuleNotFoundError:
    import requests

# ============================================================
# 配置
# ============================================================

WECHAT_API_BASE = "https://api.weixin.qq.com/cgi-bin"

# uploadimg 限制：JPG/PNG，<1MB
MAX_IMAGE_SIZE = 1 * 1024 * 1024  # 1MB

# 缓存目录
CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "cache")

# 联系图片（首次配置指引）
SETUP_IMAGE = os.path.join(
    os.path.dirname(__file__), "..", "联系我.jpg"
)


# ============================================================
# 首次使用指引
# ============================================================

def print_setup_guide():
    """打印微信公众号配置指引"""
    guide = """
╔══════════════════════════════════════════════════════════╗
║         微信公众号草稿工具 · 首次使用配置                ║
╚══════════════════════════════════════════════════════════╝

本工具需要你自己的微信公众号（订阅号或服务号）才能使用。

━━━━ 配置步骤 ━━━━

① 登录微信公众号后台
   https://mp.weixin.qq.com

② 获取 AppID 和 AppSecret
   开发 → 基本配置 → AppID / AppSecret
   ⚠ 如果 AppSecret 忘记或泄露，请点击「重置」生成新的

③ 配置 IP 白名单
   开发 → 基本配置 → IP 白名单
   → 添加你部署 token 接口的服务器公网 IP
   → 如果使用云函数，添加云函数的出口 IP
   📸 详细指引见: 联系我.jpg

④ 部署 access_token 接口
   你需要自己部署一个 HTTP 接口，返回格式:
   { "access_token": "xxx..." }
   
   参考实现（云函数 / 你自己的服务器）:
   GET /getToken?appid=YOUR_APPID&secret=YOUR_SECRET
   → 返回 { "access_token": "xxx" }

⑤ 使用 --token-url 传入接口地址
   python3 wechat-draft.py publish-draft \\
     --title "文章标题" \\
     --html article.html \\
     --token-url "https://你的域名/getToken?appid=...&secret=..."
   
   或在配置文件中指定（推荐）:
   --config @tools/wechat-draft/config.json
"""
    print(guide, file=sys.stderr)
    if os.path.exists(SETUP_IMAGE):
        print(f"📸 详细配置截图见: {SETUP_IMAGE}", file=sys.stderr)
    print(file=sys.stderr)


def require_token_url(token_url):
    """检查 token_url 是否已配置，没有则打印指引并退出"""
    if token_url:
        return token_url
    print("❌ 未配置 --token-url", file=sys.stderr)
    print_setup_guide()
    sys.exit(1)


# ============================================================
# 请求包装（统一打印错误）
# ============================================================

def safe_get(url, **kwargs):
    """带错误处理的 requests.get"""
    try:
        r = requests.get(url, timeout=kwargs.pop('timeout', 15), **kwargs)
        r.encoding = 'utf-8'
        return r
    except requests.exceptions.Timeout:
        print(f"  ⚠ 请求超时: {url[:80]}", file=sys.stderr)
        return None
    except requests.exceptions.ConnectionError:
        print(f"  ⚠ 连接失败（可能是 IP 未加入微信白名单）: {url[:80]}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  ⚠ 请求异常: {e}", file=sys.stderr)
        return None


def safe_post(url, data=None, files=None, headers=None, **kwargs):
    """带错误处理的 requests.post"""
    try:
        r = requests.post(url, data=data, files=files, headers=headers, timeout=kwargs.pop('timeout', 30))
        r.encoding = 'utf-8'
        return r
    except requests.exceptions.Timeout:
        print(f"  ⚠ 请求超时: {url[:80]}", file=sys.stderr)
        return None
    except requests.exceptions.ConnectionError:
        print(f"  ⚠ 连接失败（可能是 IP 未加入微信白名单）: {url[:80]}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  ⚠ 请求异常: {e}", file=sys.stderr)
        return None


# ============================================================
# Token 管理
# ============================================================

def get_access_token(token_url):
    """从自定义接口获取 access_token"""
    r = safe_get(token_url, headers={"Content-Type": "application/json"}, json={})
    if r is None:
        print("❌ 获取 token 失败，请检查 --token-url 是否可用", file=sys.stderr)
        print("   提示：部分错误可能是因为微信 IP 白名单未配置", file=sys.stderr)
        print(f"   详细指引见: {SETUP_IMAGE}", file=sys.stderr)
        sys.exit(1)

    try:
        data = r.json()
    except Exception as e:
        print(f"❌ token 接口返回非 JSON: {e}", file=sys.stderr)
        print(f"   响应内容: {r.text[:200]}", file=sys.stderr)
        sys.exit(1)

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

    r = safe_get(url, timeout=30)
    if r is None:
        return None
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

    # 检测格式，非 JPG/PNG → 用 PIL 转 JPG
    header = content[:16]
    is_jpeg = header[:2] == b'\xff\xd8'
    is_png = header[:8] == b'\x89PNG\r\n\x1a\n'
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
            os.rename(raw_path, cache_path)
            return cache_path
        except Exception as e:
            print(f"  ⚠ 图片转换失败: {e}，使用原始文件", file=sys.stderr)
            os.rename(raw_path, cache_path)
            return cache_path
    else:
        os.rename(raw_path, cache_path)
        return cache_path


def upload_content_image(access_token, image_path):
    """上传正文图片（uploadimg），返回微信 URL"""
    url = f"{WECHAT_API_BASE}/media/uploadimg?access_token={access_token}"
    try:
        with open(image_path, 'rb') as f:
            files = {'media': ('image.jpg', f, 'image/jpeg')}
            r = safe_post(url, files=files)
            if r is None:
                return None
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
            r = safe_post(url, files=files)
            if r is None:
                return None, None
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
    urls = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', html)
    urls += re.findall(r'url\(["\']?([^)"\']+?)["\']?\)', html)
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


# ============================================================
# 草稿管理
# ============================================================

def create_draft(access_token, title, content_html, thumb_media_id,
                 author="", digest="", content_source_url="",
                 need_open_comment=0, only_fans_can_comment=0):
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
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        r = safe_post(url, data=body, headers={"Content-Type": "application/json; charset=utf-8"})
        if r is None:
            sys.exit(1)
        data = r.json()

        if data.get('errcode', 0) != 0:
            print(f"❌ 创建草稿失败: {json.dumps(data, ensure_ascii=False)}", file=sys.stderr)
            sys.exit(1)

        return data.get('media_id')
    except Exception as e:
        print(f"❌ 创建草稿异常: {e}", file=sys.stderr)
        sys.exit(1)


def get_draft_list(access_token, offset=0, count=5, no_content=1):
    """获取草稿列表"""
    url = f"{WECHAT_API_BASE}/draft/batchget?access_token={access_token}"
    payload = {"offset": offset, "count": count, "no_content": no_content}
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    r = safe_post(url, data=body, headers={"Content-Type": "application/json; charset=utf-8"})
    if r is None:
        return {"errcode": -1, "errmsg": "请求失败"}
    return r.json()


def delete_draft(access_token, media_id):
    """删除草稿"""
    url = f"{WECHAT_API_BASE}/draft/delete?access_token={access_token}"
    payload = {"media_id": media_id}
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    r = safe_post(url, data=body, headers={"Content-Type": "application/json; charset=utf-8"})
    if r is None:
        return {"errcode": -1, "errmsg": "请求失败"}
    return r.json()


# ============================================================
# 命令：show-setup
# ============================================================

def cmd_show_setup(args):
    """显示首次使用配置指引"""
    print_setup_guide()


# ============================================================
# 主流程：publish-draft
# ============================================================

def cmd_publish_draft(args):
    """一键发布草稿到微信公众号"""
    # 1. 读取配置
    config = {}
    if args.config:
        config_path = args.config.lstrip('@')
        if os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)

    token_url = require_token_url(args.token_url or config.get('token_url') or os.environ.get('WECHAT_TOKEN_URL'))

    # 2. 读取 HTML
    html_path = args.html
    if not os.path.exists(html_path):
        print(f"❌ HTML 文件不存在: {html_path}", file=sys.stderr)
        sys.exit(1)

    with open(html_path, 'r', encoding='utf-8') as f:
        html_content = f.read()

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

    url_map = {}
    thumb_media_id = None
    cover_url = args.cover_image or config.get('cover_image')

    for i, img_url in enumerate(image_urls):
        print(f"  [{i+1}/{len(image_urls)}] 处理: {img_url[:60]}...")
        local_path = download_image(img_url, image_cache_dir)
        if not local_path:
            continue

        wechat_url = upload_content_image(access_token, local_path)
        if wechat_url:
            url_map[img_url] = wechat_url
            print(f"    ✅ → {wechat_url[:50]}...")
            is_cover = (cover_url and img_url == cover_url) or (not cover_url and i == 0)
            if is_cover and not thumb_media_id:
                mid, _ = upload_permanent_material(access_token, local_path)
                if mid:
                    thumb_media_id = mid
                    print(f"    ✅ 封面素材 media_id: {mid}")

    if not thumb_media_id and cover_url:
        print(f"  📸 单独处理封面图: {cover_url[:60]}...")
        local_path = download_image(cover_url, image_cache_dir)
        if local_path:
            mid, _ = upload_permanent_material(access_token, local_path)
            if mid:
                thumb_media_id = mid

    if not thumb_media_id:
        print("❌ 没有封面图素材，无法创建草稿（微信要求必须有 thumb_media_id）", file=sys.stderr)
        sys.exit(1)

    # 6. 替换 HTML 中的图片 URL
    html_content = replace_image_urls(html_content, url_map)
    print(f"🔄 已替换 {len(url_map)} 张图片 URL")

    # 7. 摘要
    digest = args.digest or config.get('digest', '')
    if not digest:
        print("⚠️ 未提供摘要(--digest)，微信将自动抓取正文前54字，建议AI生成更吸引人的摘要", file=sys.stderr)
    if digest and len(digest) > 120:
        digest = digest[:117] + '...'

    # 8. 创建草稿
    title = args.title or config.get('title', '未命名文章')
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


# ============================================================
# 辅助命令
# ============================================================

def _resolve_token_url(args, config):
    """统一获取 token_url，未配置时打印指引"""
    return require_token_url(
        args.token_url
        or config.get('token_url')
        or os.environ.get('WECHAT_TOKEN_URL')
    )


def cmd_list_drafts(args):
    """查看草稿列表"""
    config = _load_config(args.config)
    token_url = _resolve_token_url(args, config)
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
    config = _load_config(args.config)
    token_url = _resolve_token_url(args, config)
    access_token = get_access_token(token_url)

    data = delete_draft(access_token, args.media_id)
    if data.get('errcode', 0) == 0:
        print(f"✅ 草稿 {args.media_id} 已删除")
    else:
        print(f"❌ 删除失败: {json.dumps(data, ensure_ascii=False)}", file=sys.stderr)


def cmd_test_token(args):
    """测试 token 获取"""
    config = _load_config(args.config)
    token_url = _resolve_token_url(args, config)
    print("🔑 测试获取 access_token...")
    token = get_access_token(token_url)
    print(f"✅ 成功！token: {token[:12]}...({len(token)} chars)")


def _load_config(config_arg):
    """读取配置文件"""
    if not config_arg:
        return {}
    config_path = config_arg.lstrip('@')
    if os.path.exists(config_path):
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


# ============================================================
# CLI 入口
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description='微信公众号草稿发布工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest='command', help='子命令')

    # show-setup
    subparsers.add_parser('show-setup', help='显示首次使用配置指引')

    # publish-draft
    p_pub = subparsers.add_parser('publish-draft', help='发布草稿到微信公众号')
    p_pub.add_argument('--title', help='文章标题（必填）')
    p_pub.add_argument('--html', required=True, help='HTML 文件路径（必填）')
    p_pub.add_argument('--author', default='', help='作者')
    p_pub.add_argument('--digest', default='', help='摘要（不填则自动提取）')
    p_pub.add_argument('--cover-image', default='', help='封面图 URL（不填则用第一张正文图）')
    p_pub.add_argument('--content-source-url', default='', help='阅读原文链接')
    p_pub.add_argument('--token-url', default='', help='token 接口 URL（必填，详见 show-setup）')
    p_pub.add_argument('--config', default='', help='配置文件路径（@path/to/config.json）')

    # list-drafts
    p_list = subparsers.add_parser('list-drafts', help='查看草稿列表')
    p_list.add_argument('--offset', type=int, default=0)
    p_list.add_argument('--count', type=int, default=5)
    p_list.add_argument('--token-url', default='')
    p_list.add_argument('--config', default='')

    # delete-draft
    p_del = subparsers.add_parser('delete-draft', help='删除草稿')
    p_del.add_argument('--media-id', required=True, help='草稿 media_id')
    p_del.add_argument('--token-url', default='')
    p_del.add_argument('--config', default='')

    # test-token
    p_test = subparsers.add_parser('test-token', help='测试 token 获取')
    p_test.add_argument('--token-url', default='')
    p_test.add_argument('--config', default='')

    args = parser.parse_args()

    cmds = {
        'show-setup': cmd_show_setup,
        'publish-draft': cmd_publish_draft,
        'list-drafts': cmd_list_drafts,
        'delete-draft': cmd_delete_draft,
        'test-token': cmd_test_token,
    }

    handler = cmds.get(args.command)
    if handler:
        handler(args)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
