import os
import json
import urllib.request
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

env_file = 'd:/my_work/05_PILOT/.env.local'
url = ''
key = ''
if os.path.exists(env_file):
    with open(env_file, 'r', encoding='utf-8') as f:
        content = f.read()
        m_url = re.search(r'NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)', content)
        m_key = re.search(r'SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)', content) or re.search(r'NEXT_PUBLIC_SUPABASE_ANON_KEY=([^\r\n]+)', content)
        if m_url: url = m_url.group(1).strip()
        if m_key: key = m_key.group(1).strip()

req = urllib.request.Request(f"{url}/rest/v1/personal_knowledge?review_status=eq.pending&select=id,title,champion,content,tags,analysis_meta,created_at,reanalysis_of&order=created_at.desc&limit=100")
req.add_header("apikey", key)
req.add_header("Authorization", f"Bearer {key}")

with urllib.request.urlopen(req, timeout=15) as res:
    data = json.loads(res.read().decode('utf-8'))

print(f"未承認記事（pending）合計: {len(data)} 件\n")

good = []
defective = []

for d in data:
    tags = d.get("tags") or []
    if "__DELETED__" in tags or "__SUPERSEDED__" in tags:
        continue
    chars = len(d.get("content") or "")
    meta = d.get("analysis_meta") or {}
    facts = meta.get("fact_count")
    unact = meta.get("unactionable") or ("字幕から使える事実" in str(meta.get("error") or ""))
    tags = d.get("tags") or []
    is_short = "shorts" in [t.lower() for t in tags] or "shorts" in (d.get("title") or "").lower()
    
    body = d.get("content") or ""
    last_char = body.strip()[-1:] if body.strip() else ""
    is_truncated = chars >= 200 and not re.search(r'[。！？!?）)」』\]】*`\-|.:：…ー〜~>0-9a-zA-Z]', last_char)
    
    # 不良品判定
    is_def = unact or (facts is not None and facts < 4 and not is_short) or (not is_short and chars < 700) or is_truncated
    if is_def:
        reasons = []
        if unact: reasons.append("再解析不可(実況なし)")
        if facts is not None and facts < 4 and not is_short: reasons.append(f"事実わずか{facts}件")
        if not is_short and chars < 700: reasons.append(f"極端な短文({chars}字)")
        if is_truncated: reasons.append("文末途切れ")
        defective.append((d, reasons))
    else:
        good.append(d)

print(f"【不良品・要除外】 {len(defective)} 件:")
for d, reasons in defective:
    print(f"  ❌ ID:{d['id']} [{d.get('champion') or 'Unknown'}] {d['title'][:32]}... ({', '.join(reasons)})")

print(f"\n【合格・ちゃんとした記事】 {len(good)} 件:")
for d in good:
    meta = d.get("analysis_meta") or {}
    print(f"  ✅ ID:{d['id']} [{d.get('champion') or 'Unknown'}] {d['title'][:32]}... ({len(d.get('content') or '')}字, facts:{meta.get('fact_count')})")
