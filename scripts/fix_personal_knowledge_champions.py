import os, json, sys, re, urllib.request, urllib.error
from pathlib import Path
from dotenv import load_dotenv

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

_root = Path("d:/my_work")
for env_file in [_root / "05_PILOT" / ".env.local", _root / "04_PORTAL" / ".env.local", _root / ".env"]:
    if env_file.exists():
        load_dotenv(env_file)

sys.path.insert(0, str(_root / "03_SYSTEMS" / "v2_CORE" / "_LOL"))
from champ_id_normalizer import determine_champion, load_ddragon_mapping, resolve_roster_champion

dd_map = load_ddragon_mapping()
canonical_ids = set(dd_map.values())

SUPABASE_URL = (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")).rstrip("/")
SUPABASE_KEY = (os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY") or "").strip()

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Supabase認証情報がありません")
    sys.exit(1)

def sb(method, path, body=None):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as resp:
        res_data = resp.read()
        return json.loads(res_data.decode("utf-8")) if res_data else None

# 全件取得
print("🔍 personal_knowledge から全記事を取得中...")
articles = sb("GET", "personal_knowledge?select=id,title,champion,genre,source_url&limit=2000") or []
print(f"取得件数: {len(articles)} 件")

updates = []
for a in articles:
    aid = a["id"]
    curr = a.get("champion") or "None"
    title = a.get("title") or ""
    genre = a.get("genre") or ""
    source_url = a.get("source_url") or ""

    # 非LoL記事（noteのAI記事など）はスキップ
    if genre in ["note", "note記事", "ビジネス", "AI副業", "プログラミング"]:
        continue
    # タロット動画（誤要約記事）はスキップ
    if "tarot" in title.lower() or "tarot" in source_url.lower():
        continue

    new_champ = determine_champion(title, curr)

    # 変更が必要な場合
    if curr != new_champ:
        # 特別防衛: もし新チャンプがUnknownで旧チャンプが有効な正規チャンプならそのまま維持
        if new_champ == "Unknown" and curr in canonical_ids:
            continue
        updates.append({
            "id": aid,
            "old_champion": curr,
            "new_champion": new_champ,
            "title": title
        })

print(f"\n⚡ 更新対象: {len(updates)} 件")
for u in updates:
    print(f"  ID:{u['id']:5d} | '{u['old_champion']}' -> '{u['new_champion']}' | {u['title'][:55]}")

# 実行フラグチェック
if "--dry-run" in sys.argv or "-n" in sys.argv:
    print("\n[Dry Run] データベースの更新はスキップしました。")
    sys.exit(0)

print(f"\n🚀 {len(updates)} 件のレコードを Supabase へ一括更新します...")
success = 0
for u in updates:
    try:
        sb("PATCH", f"personal_knowledge?id=eq.{u['id']}", {"champion": u["new_champion"]})
        success += 1
    except Exception as e:
        print(f"❌ ID:{u['id']} 更新失敗: {e}")

print(f"✅ 更新完了: {success}/{len(updates)} 件成功")
