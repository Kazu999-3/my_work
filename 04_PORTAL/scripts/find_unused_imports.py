"""default import されているのに一度も使われていないコンポーネントを探す。
MatchRecordPanel(22.2KB)が balancer/page.tsx でこの状態だった（2026-09-23発見）。
バンドルには含まれてしまうため、実質の無駄になる。"""
import re, pathlib

DEFAULT_IMPORT = re.compile(r'^import\s+([A-Z][A-Za-z0-9_]*)\s+from\s+["\']([^"\']+)["\'];?\s*$', re.M)
findings = []
for p in pathlib.Path('src').rglob('*.tsx'):
    if '__tests__' in str(p):
        continue
    t = p.read_text(encoding='utf-8', errors='ignore')
    for m in DEFAULT_IMPORT.finditer(t):
        name, src = m.group(1), m.group(2)
        if not src.startswith('.'):
            continue  # 自作ファイルのみ対象
        body = t[:m.start()] + t[m.end():]
        # JSXタグ / 関数呼び出し / 型注釈 のいずれでも使われていないか
        if not re.search(r'[<{(\s,:]' + re.escape(name) + r'\b', body):
            target = (p.parent / (src + '.tsx')).resolve()
            size = target.stat().st_size if target.exists() else 0
            findings.append((size, p.as_posix(), name, src))

findings.sort(reverse=True)
print('未使用の default import: %d件' % len(findings))
for size, f, name, src in findings:
    print('  %7.1fKB  %s  ←  %s' % (size / 1024, name, f))
