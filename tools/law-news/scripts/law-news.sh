#!/usr/bin/env bash
set -euo pipefail

# /law-news — 法律资讯获取脚本
# 用法:
#   ./scripts/law-news.sh fetch <source> [--days 3] [--max 10]
#   ./scripts/law-news.sh publish <markdown_file> [--title "标题"] [--wiki <space_id>]
#
# 子命令:
#   fetch    — 获取资讯源列表，输出 JSON
#   publish  — 将 markdown 文件发布为飞书文档

CCTVP_API="https://news.cctv.com/2019/07/gaiban/cmsdatainterface/page/law_1.jsonp?cb=law"

fetch_cctv() {
  local days="${1:-3}" max="${2:-10}"

  curl -s --header 'X-Requested-With: XMLHttpRequest' "$CCTVP_API" \
    | sed 's/^law(//;s/)$//' \
    | python3 -c "
import sys, json, datetime

data = json.load(sys.stdin)
items = data['data']['list']
cutoff = datetime.datetime.now() - datetime.timedelta(days=$days)
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
        'keywords': i['keywords'].split()
    })
    if len(out) >= $max:
        break
print(json.dumps({'source': 'cctv-law', 'count': len(out), 'items': out}, ensure_ascii=False))
"
}

publish_doc() {
  local file="$1" title="${2:-法律资讯}" wiki="${3:-}"

  if [ ! -f "$file" ]; then
    echo "ERROR: file not found: $file" >&2
    exit 1
  fi

  local content
  content=$(cat "$file")

  local xml="<title>$title</title>"
  xml+=$(echo "$content" | python3 -c "
import sys, html
for line in sys.stdin:
    line = line.rstrip()
    if not line:
        print('<p></p>')
    elif line.startswith('## '):
        print(f'<h1>{html.escape(line[3:])}</h1>')
    elif line.startswith('### '):
        print(f'<h2>{html.escape(line[4:])}</h2>')
    elif line.startswith('**') and line.endswith('**'):
        print(f'<p><b>{html.escape(line[2:-2])}</b></p>')
    else:
        print(f'<p>{html.escape(line)}</p>')
")

  local result
  result=$(lark-cli docs +create --api-version v2 --content "$xml" --as user --format json 2>&1)
  local url doc_id
  doc_id=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('document',{}).get('document_id',''))")
  url=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('document',{}).get('url',''))")

  if [ -n "$doc_id" ] && [ -z "$url" ]; then
    url="https://lawyerch.feishu.cn/docx/$doc_id"
  fi

  if [ -n "$url" ]; then
    echo "✅ $url"
  else
    echo "ERROR: create doc failed: $result" >&2
    exit 1
  fi

  if [ -n "$wiki" ]; then
    local token
    token=$(echo "$url" | sed 's|.*/docx/||')
    lark-cli wiki +move --doc "$token" --space "$wiki" --as user > /dev/null 2>&1
    echo "   → 已同步到知识库"
  fi
}

case "${1:-}" in
  fetch)
    source="${2:-cctv-law}"
    shift 2
    days=3 max=10
    while [ $# -gt 0 ]; do
      case "$1" in
        --days) days="$2"; shift 2 ;;
        --max) max="$2"; shift 2 ;;
        *) echo "unknown: $1"; exit 1 ;;
      esac
    done
    case "$source" in
      cctv-law) fetch_cctv "$days" "$max" ;;
      *) echo "unknown source: $source"; exit 1 ;;
    esac
    ;;
  publish)
    file="${2:-}"
    [ -z "$file" ] && { echo "usage: $0 publish <file> [--title ...] [--wiki ...]"; exit 1; }
    shift 2
    title="法律资讯"
    wiki=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --title) title="$2"; shift 2 ;;
        --wiki) wiki="$2"; shift 2 ;;
        *) echo "unknown: $1"; exit 1 ;;
      esac
    done
    publish_doc "$file" "$title" "$wiki"
    ;;
  *)
    echo "usage: $0 fetch|publish ..."
    exit 1
    ;;
esac
