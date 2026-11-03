# -*- coding: utf-8 -*-
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

if not url or not key:
    print("Supabase接続情報が見つかりません")
    sys.exit(1)

def sb(method, path, body=None):
    req = urllib.request.Request(f"{url}/rest/v1/{path}", method=method)
    req.add_header("apikey", key)
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", "application/json")
    data = json.dumps(body).encode('utf-8') if body else None
    with urllib.request.urlopen(req, data=data, timeout=20) as res:
        res_body = res.read().decode('utf-8')
        return json.loads(res_body) if res_body else None

# 全件の pending 記事を取得
data = sb("GET", "personal_knowledge?review_status=eq.pending&select=id,title,champion,content,tags,analysis_meta,created_at,reanalysis_of&order=created_at.desc&limit=300") or []

print(f"現在承認待ち（pending）の記事: {len(data)} 件")

def is_truncated(text):
    if not text:
        return True
    s = text.strip()
    if len(s) < 200:
        return False
    last_char = s[-1]
    valid_ends = ("。", "！", "？", "!", "?", "）", "」", "』", "]", "}", ")", "*", "`", "#", ">", "|", "〜", "~", "…")
    return last_char not in valid_ends

defective_ids = []

for d in data:
    chars = len(d.get("content") or "")
    meta = d.get("analysis_meta") or {}
    facts = meta.get("fact_count")
    unact = meta.get("unactionable") or ("字幕から使える事実" in str(meta.get("error") or ""))
    tags = d.get("tags") or []
    is_short = "shorts" in [t.lower() for t in tags] or "shorts" in (d.get("title") or "").lower()
    truncated = is_truncated(d.get("content") or "")

    reasons = []
    if unact:
        reasons.append("実況なし判定")
    if facts is not None and facts < 4 and not is_short:
        reasons.append(f"事実{facts}件(不足)")
    if not is_short and chars < 700:
        reasons.append(f"極端短文({chars}字)")
    if truncated:
        reasons.append("文末途切れ")

    if reasons:
        defective_ids.append((d["id"], d["title"][:28], tags, reasons))

print(f"\n除外対象（不良品・未完了記事）: {len(defective_ids)} 件")
for art_id, title, old_tags, reasons in defective_ids:
    print(f"  ❌ #{art_id}: {title}... [{', '.join(reasons)}]")
    # __DELETED__ へ更新して承認画面から除外
    new_tags = list(dict.fromkeys(old_tags + ["__DELETED__", "品質基準未達アーカイブ"]))
    try:
        sb("PATCH", f"personal_knowledge?id=eq.{art_id}", {
            "tags": new_tags
        })
    except urllib.error.HTTPError as e:
        body = ""
        try: body = e.read().decode('utf-8')
        except: pass
        print(f"    更新失敗 #{art_id}: {e} - {body}")
    except Exception as e:
        print(f"    更新失敗 #{art_id}: {e}")

print(f"\nクリーンアップ完了: {len(defective_ids)} 件を __DELETED__ へ退避しました。")
