import os
import requests
from pathlib import Path
import dotenv

dotenv.load_dotenv(Path("D:/my_work/.env"))

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

data = {
  "strengths": "圧倒的なファーム速度と、ドラゴン獲得時のパッシブによるスケーリング。R（龍族の血統）状態でのEのバーストダメージと範囲制圧力。",
  "weaknesses": "Rがない状態での影響力の低さ。CC（行動妨害）を持たないため序盤のガンクが難しく、味方のセットアップに依存する。",
  "powerSpikes": "Lv6（R取得時）と、コアアイテム（ショウジンの矛 / ライアンドリーの仮面）完成時。このタイミングで劇的にファイト能力が向上する。",
  "buildRunes": "メイン: プレスアタック / サブ: 天啓（魔法の靴、宇宙の英知）\nコアビルド: ショウジンの矛 → ライアンドリーの仮面 → リフトメーカー\n【採用理由】: ショウジンの矛によるスキルヘイストとスキルダメージ増加がShyvanaに極めて相性が良く、続くAP系ブルーザーアイテムでR状態のEの火力を最大化しつつ、前衛として立ち回る耐久力を確保するため。",
  "fullClearTime": "約 3:15 〜 3:20",
  "strategy": "序盤はひたすらファームに徹し、可能な限り最速でLv6を目指す。味方に負担をかける分、オブジェクト（特にパッシブスタックに直結するドラゴン）は徹底して管理する。集団戦ではRでのエンゲージで敵陣に飛び込み、複数の敵を巻き込むように強化Eを叩き込む。",
  "note_draft": ""
}

upsert_data = {
    "matchup_id": "champ_Shyvana_global",
    "champion": "Shyvana",
    "enemy": "GLOBAL",
    "title": "Shyvana 基本戦略・トレンド",
    "strategy": data["strategy"],
    "raw_data": {
        "source": "champ_db",
        "role": "GLOBAL",
        "strengths": data["strengths"],
        "weaknesses": data["weaknesses"],
        "powerSpikes": data["powerSpikes"],
        "buildRunes": data["buildRunes"],
        "fullClearTime": data["fullClearTime"],
        "note_draft": data["note_draft"]
    }
}

url = f"{SUPABASE_URL}/rest/v1/matchup_sentinel?on_conflict=matchup_id"
headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

r = requests.post(url, headers=headers, json=upsert_data)
if r.status_code in (200, 201):
    print("✅ Shyvana data successfully saved to Supabase!")
else:
    print(f"❌ Failed to save: {r.text}")
