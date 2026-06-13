#!/usr/bin/env python3
"""
skill-audit — 项目内工具审计

按 AGENTS.md 规范检查 tools/ 下每个 skill 是否符合开发标准。
输出报告：✅ 通过 / ⚠️ 警告 / ❌ 错误。

设计理念：脚本做实事，AI 看完报告后决策修复。
"""
import os
import sys
import re
import argparse

# === 路径常量 ===

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, '..', '..', '..'))
TOOLS_DIR = os.path.join(PROJECT_ROOT, 'tools')
AGENTS_MD = os.path.join(PROJECT_ROOT, 'AGENTS.md')
GITIGNORE = os.path.join(PROJECT_ROOT, '.gitignore')
SKILL_MD = os.path.join(PROJECT_ROOT, 'SKILL.md')
README_MD = os.path.join(PROJECT_ROOT, 'README.md')


# === helpers ===

def die(msg):
    print(f"❌ ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def ok(msg):
    return ('ok', msg)


def warn(msg):
    return ('warn', msg)


def err(msg):
    return ('err', msg)


# === frontmatter 解析（无 pyyaml 依赖）===

def parse_frontmatter(md_text):
    """简易 YAML frontmatter 解析。返回 dict 或 None。"""
    if not md_text.startswith('---'):
        return None
    # 找到第二个 ---
    end = md_text.find('\n---', 3)
    if end < 0:
        return None
    fm_text = md_text[3:end].strip()
    result = {}
    current_key = None
    current_list = None
    for line in fm_text.split('\n'):
        if line.startswith('  - '):
            # 列表项
            if current_list is not None:
                current_list.append(line[4:].strip())
            continue
        m = re.match(r'^(\w+):\s*(.*)', line)
        if m:
            key, value = m.group(1), m.group(2).strip()
            if value == '':
                # 可能是嵌套字段或多行列表，先占位
                current_key = key
                current_list = []
                result[key] = current_list
            elif value.startswith('[') and value.endswith(']'):
                # 内联列表
                result[key] = [s.strip().strip('"').strip("'") for s in value[1:-1].split(',') if s.strip()]
                current_list = None
                current_key = None
            else:
                # 简单标量
                result[key] = value.strip('"').strip("'")
                current_list = None
                current_key = None
    return result


# === 审计项 ===

REQUIRED_FRONTMATTER = ['name', 'description', 'tags', 'requires', 'scripts']
RECOMMENDED_DOC_SECTIONS = ['首次使用', '使用方式', '字段', '数据']


def audit_tool(tool_name):
    """审计单个 tool，返回 (issues, summary)"""
    issues = []
    tool_dir = os.path.join(TOOLS_DIR, tool_name)
    md_file = os.path.join(tool_dir, f'{tool_name}.md')

    if not os.path.isdir(tool_dir):
        return [err(f'工具目录不存在: tools/{tool_name}')], None
    if not os.path.isfile(md_file):
        issues.append(err(f'缺少文档: tools/{tool_name}/{tool_name}.md'))
        return issues, None

    # === 1. frontmatter 检查 ===
    with open(md_file, 'r', encoding='utf-8') as f:
        content = f.read()
    fm = parse_frontmatter(content)
    if fm is None:
        issues.append(err('frontmatter 缺失或格式错误（需以 --- 开头/结尾）'))
    else:
        for key in REQUIRED_FRONTMATTER:
            if key not in fm:
                issues.append(err(f'frontmatter 缺少字段: {key}'))
        # name 必须等于工具目录名
        if fm.get('name') != tool_name:
            issues.append(err(f'frontmatter name ({fm.get("name")}) 与目录名 ({tool_name}) 不一致'))
        # scripts 应是数组
        scripts = fm.get('scripts', [])
        if not isinstance(scripts, list):
            issues.append(warn(f'frontmatter scripts 应为数组: {scripts}'))

    # === 2. 首次使用章节检查 ===
    has_first_use = '首次使用' in content or '首次运行' in content
    if not has_first_use:
        issues.append(warn('缺少「首次使用」章节（如果有用户配置则必须有）'))

    # === 3. 数据结构/字段表检查 ===
    has_field_table = '字段' in content and '|' in content
    if not has_field_table:
        issues.append(warn('缺少「数据字段」表'))

    # === 4. 脚本存在性 ===
    if fm and isinstance(fm.get('scripts'), list) and fm.get('scripts'):
        for script_path in fm['scripts']:
            full = os.path.join(tool_dir, script_path)
            if not os.path.isfile(full):
                issues.append(err(f'脚本不存在: {script_path}'))
            else:
                # 脚本必须是 .py 或 .sh
                if not (script_path.endswith('.py') or script_path.endswith('.sh')):
                    issues.append(warn(f'脚本扩展名非 .py/.sh: {script_path}'))

    # === 5. cache 目录 ===
    cache_dir = os.path.join(tool_dir, 'cache')
    # cache 不一定存在（首次未运行），但 .gitignore 应排除
    if os.path.isfile(GITIGNORE):
        with open(GITIGNORE, 'r') as f:
            gi = f.read()
        if 'tools/*/cache/' not in gi:
            issues.append(warn('.gitignore 未排除 tools/*/cache/'))

    # === 6. 用户配置文件配对 ===
    example_files = [f for f in os.listdir(tool_dir) if f.endswith('-profile.example.json')]
    for ex in example_files:
        actual = ex.replace('.example.json', '.json')
        if not os.path.isfile(os.path.join(tool_dir, actual)):
            issues.append(warn(f'有示例 {ex} 但缺少 {actual}'))

    # === 7. 在 SKILL.md 注册 ===
    if os.path.isfile(SKILL_MD):
        with open(SKILL_MD, 'r') as f:
            skill_content = f.read()
        # 接受 /law-xxx 或 tools/law-xxx 形式
        if (f'/law-{tool_name}' not in skill_content and
            f'tools/{tool_name}' not in skill_content):
            issues.append(warn(f'SKILL.md 工具索引未注册 {tool_name}'))

    # === 8. README.md 注册 ===
    if os.path.isfile(README_MD):
        with open(README_MD, 'r') as f:
            readme_content = f.read()
        if (f'/law-{tool_name}' not in readme_content and
            f'tools/{tool_name}' not in readme_content):
            issues.append(warn(f'README.md 工具索引未注册 {tool_name}'))

    return issues, fm


def audit_gitignore():
    """审计 .gitignore 完整性"""
    issues = []
    if not os.path.isfile(GITIGNORE):
        return [err('.gitignore 缺失')]
    with open(GITIGNORE, 'r') as f:
        gi = f.read()
    required = [
        ('cache 目录', 'tools/*/cache/'),
        ('个人 profile 配置', 'tools/*/lawyer-profile.json'),
    ]
    for name, pattern in required:
        if pattern not in gi:
            issues.append(warn(f'.gitignore 缺排除项: {pattern}（{name}）'))
    return issues


def list_tools():
    """列出所有工具"""
    if not os.path.isdir(TOOLS_DIR):
        die(f'tools/ 目录不存在: {TOOLS_DIR}')
    tools = []
    for entry in sorted(os.listdir(TOOLS_DIR)):
        if entry.startswith('.'):
            continue
        tool_dir = os.path.join(TOOLS_DIR, entry)
        if os.path.isdir(tool_dir):
            tools.append(entry)
    return tools


# === 报告输出 ===

def render_report(name, issues, fm):
    """渲染单个工具的审计报告"""
    print(f'\n=== {name} ===')
    if fm:
        # 显示关键 frontmatter 字段
        print(f'  name: {fm.get("name", "?")}')
        print(f'  description: {fm.get("description", "?")}')
        print(f'  tags: {fm.get("tags", "?")}')
        print(f'  requires: {fm.get("requires", "?")}')
        print(f'  scripts: {fm.get("scripts", "?")}')

    if not issues:
        print(f'  ✅ 全部通过')
        return

    errs = [i for i in issues if i[0] == 'err']
    warns = [i for i in issues if i[0] == 'warn']
    if errs:
        print(f'  ❌ 错误 ({len(errs)}):')
        for _, msg in errs:
            print(f'    - {msg}')
    if warns:
        print(f'  ⚠️  警告 ({len(warns)}):')
        for _, msg in warns:
            print(f'    - {msg}')


def render_summary(all_results):
    """汇总报告"""
    print(f'\n{"=" * 50}')
    print(f'审计汇总')
    print(f'{"=" * 50}')

    total_err = sum(sum(1 for i in issues if i[0] == 'err') for _, issues, _ in all_results)
    total_warn = sum(sum(1 for i in issues if i[0] == 'warn') for _, issues, _ in all_results)
    total_tools = len(all_results)

    print(f'工具数: {total_tools}')
    print(f'错误: {total_err}')
    print(f'警告: {total_warn}')

    if total_err == 0 and total_warn == 0:
        print(f'\n✅ 全部工具通过审计')
        return 0
    elif total_err == 0:
        print(f'\n⚠️  有警告但无错误')
        return 0
    else:
        print(f'\n❌ 有错误需要修复')
        return 1


# === main ===

def main():
    parser = argparse.ArgumentParser(description='feishu-lawtools 项目内工具审计')
    sub = parser.add_subparsers(dest='cmd', required=True)

    p_check = sub.add_parser('check', help='审计单个工具')
    p_check.add_argument('name', help='工具名（如 law-news）')

    p_check_all = sub.add_parser('check-all', help='审计所有工具')

    p_list = sub.add_parser('list-tools', help='列出所有工具')

    p_git = sub.add_parser('check-gitignore', help='仅审计 .gitignore')

    args = parser.parse_args()

    if args.cmd == 'list-tools':
        tools = list_tools()
        print('tools/ 下工具：')
        for t in tools:
            print(f'  - {t}')
        return 0

    if args.cmd == 'check-gitignore':
        issues = audit_gitignore()
        print('=== .gitignore ===')
        for sev, msg in issues:
            print(f'  [{sev}] {msg}')
        return 0 if all(sev == 'warn' for sev, _ in issues) else 1

    if args.cmd == 'check':
        all_results = [(args.name, *audit_tool(args.name))]
        render_report(all_results[0][0], all_results[0][1], all_results[0][2])
        # 同时审计 .gitignore
        gi_issues = audit_gitignore()
        if gi_issues:
            print('\n=== .gitignore ===')
            for sev, msg in gi_issues:
                print(f'  [{sev}] {msg}')
        return render_summary(all_results)

    if args.cmd == 'check-all':
        # 先 gitignore
        gi_issues = audit_gitignore()
        if gi_issues:
            print('=== .gitignore ===')
            for sev, msg in gi_issues:
                print(f'  [{sev}] {msg}')

        # 工具列表
        tools = list_tools()
        all_results = []
        for t in tools:
            issues, fm = audit_tool(t)
            render_report(t, issues, fm)
            all_results.append((t, issues, fm))

        return render_summary(all_results)


if __name__ == '__main__':
    sys.exit(main() or 0)
