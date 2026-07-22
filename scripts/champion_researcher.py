# ============================================================
# 特定チャンピオン ディープリサーチ CLI スクリプト (champion_researcher.py)
#
# コマンドラインから特定のチャンピオンを指定し、
# 1. YouTube から最新攻略・OTP動画を検索して優先キュー投入
# 2. Web / 統計データのリサーチ
# 3. Gemini による日本語攻略バイブル生成 & Supabase (bible_articles / matchup_sentinel) 保存
#
# 使用法: python scripts/champion_researcher.py --champion Ahri --role MID
# ============================================================
import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from notify import notify, COLOR_INFO, COLOR_OK

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = (
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("SUPABASE_SERVICE_KEY")
    or os.environ.get("SUPABASE_KEY")
    or ""
).strip()
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite")


def sb_request(method, path, body=None, prefer=None):
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("SUPABASE_URL または SUPABASE_KEY が未設定です。")
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", headers=headers, method=method)
    with urllib.request.urlopen(req, data=data, timeout=60) as r:
        t = r.read().decode()
        return json.loads(t) if t else None


def call_gemini(prompt):
    if not GEMINI_KEY:
        raise RuntimeError("GEMINI_API_KEY が未設定です。")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_KEY}"
    jp_guard = "\n\n【出力形式】完全なMarkdown形式。解説文章は必ず日本語とし、チャンピオン名・アイテム名・スキル名などの固有名詞は英語表記のまま残すこと。"
    body = {
        "contents": [{"parts": [{"text": prompt + jp_guard}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 3500}
    }
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        res = json.loads(r.read().decode())
    return res["candidates"][0]["content"]["parts"][0]["text"].strip()


def enqueue_videos(champion):
    print(f"🔎 「{champion}」の解説動画をYouTubeから検索中...")
    query = f"LoL+{champion}+guide"
    url = f"https://www.youtube.com/results?search_query={query}"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as res:
            html = res.read().decode("utf-8", errors="ignore")
        
        vids = list(dict.fromkeys(re.findall(r'"videoId":"([a-zA-Z0-9_-]{11})"', html)))[:3]
        added = 0
        for vid in vids:
            # 重複チェック
            existing = sb_request("GET", f"youtube_queue?id=eq.{vid}&select=id")
            if not existing:
                sb_request("POST", "youtube_queue", [{
                    "id": vid,
                    "url": f"https://www.youtube.com/watch?v={vid}",
                    "title": f"[ディープリサーチ] {champion} 解説動画 ({vid})",
                    "champion": champion,
                    "status": "pending",
                    "priority": "high",
                    "date_added": datetime.now(timezone.utc).isoformat()
                }])
                added += 1
                print(f"  ✅ キュー登録(高優先度): https://www.youtube.com/watch?v={vid}")
        return added
    except Exception as e:
        print(f"  ⚠️ YouTube動画検索エラー: {e}")
        return 0


def research_champion(champion, role="JG"):
    print(f"🎯 「{champion}」 (Role: {role}) のディープリサーチを開始します...")

    # 1. AI 攻略バイブル生成
    prompt = f"""あなたはLoLのプロコーチです。
対象チャンピオン: **{champion}** (想定レーン: {role})

このチャンピオンの最新メタにおける深掘り攻略バイブル(Markdown)を作成してください。

【構成要素】
1. **概要と強み・弱み**
2. **コアビルド & ルーン構成**
3. **序盤のレーン戦 / ファームルート**
4. **中盤〜終盤の集団戦・マクロの動き**
5. **主要マッチアップ相性と注意点**
"""
    print("🤖 Gemini による攻略アナリティクス生成中...")
    markdown_content = call_gemini(prompt)

    # 2. personal_knowledge (攻略ライブラリ/ナレッジ) に保存
    title = f"[深掘りリサーチ] {champion} 総合攻略バイブル"
    existing = sb_request("GET", f"personal_knowledge?champion=eq.{champion}&select=id,title")
    target_id = None
    if existing:
        for item in existing:
            if "ディープリサーチ" in item.get("title", "") or "深掘りリサーチ" in item.get("title", ""):
                target_id = item["id"]
                break

    article_data = {
        "title": title,
        "content": markdown_content,
        "champion": champion,
        "genre": "ディープリサーチ",
        "tags": [champion, "ディープリサーチ", "総合バイブル", role]
    }
    if target_id:
        sb_request("PATCH", f"personal_knowledge?id=eq.{target_id}", article_data)
        print("  📚 攻略ライブラリ (personal_knowledge) を更新しました。")
    else:
        sb_request("POST", "personal_knowledge", [article_data])
        print("  📚 攻略ライブラリ (personal_knowledge) に新規追加しました。")

    # 3. matchup_sentinel (チャンピオン辞典) に保存
    matchup_id = f"{champion.upper()}_GLOBAL"
    sentinel_data = {
        "matchup_id": matchup_id,
        "title": f"{champion} 戦術ガイド",
        "champion": champion,
        "enemy": "GLOBAL",
        "strategy": markdown_content[:3000],
        "raw_data": {
            "deep_researched_at": datetime.now(timezone.utc).isoformat(),
            "role": role
        }
    }
    sb_request("POST", "matchup_sentinel?on_conflict=matchup_id", sentinel_data, prefer="resolution=merge-duplicates")
    print("  🛡️ チャンピオン辞典 (matchup_sentinel) に反映しました。")

    # 4. 優先動画発掘
    vids_added = enqueue_videos(champion)

    # 5. 通知
    notify(
        f"🎯 【ディープリサーチ】{champion} の攻略ナレッジを追加",
        [
            f"**対象チャンピオン**: {champion} ({role})",
            f"・攻略バイブル: `{title}` 追加完了",
            f"・優先解説動画: **{vids_added}本** キュー投入完了"
        ],
        color=COLOR_OK,
        worker_name="champion_researcher",
        status="ok"
    )
    print(f"\n🎉 「{champion}」のディープリサーチが完了しました！")
    return 0


def main():
    parser = argparse.ArgumentParser(description="特定チャンピオン ディープリサーチ CLI")
    parser.add_argument("--champion", "-c", required=True, help="対象チャンピオン英語名 (例: Ahri, Riven, Aatrox)")
    parser.add_argument("--role", "-r", default="JG", help="想定レーン (TOP, JG, MID, ADC, SUP)")
    args = parser.parse_args()

    return research_champion(args.champion.strip(), args.role.strip().upper())


if __name__ == "__main__":
    sys.exit(main())
