# ============================================================
# YouTube解析クラウドワーカー (#88)
# PC常駐デーモンの代替として GitHub Actions 上で動く。
#   youtube_queue(pending) → yt-dlpで字幕取得 → Geminiで攻略バイブル生成
#   → personal_knowledge へ保存 → queueをcompletedに更新
# 必要な環境変数: SUPABASE_URL, SUPABASE_SERVICE_KEY, GEMINI_API_KEY
# ============================================================
import os, re, json, glob, subprocess, sys
import urllib.request

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
GEMINI_KEY = os.environ["GEMINI_API_KEY"]
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
MAX_ITEMS = int(os.environ.get("MAX_ITEMS", "3"))
MAX_RETRY = 3

def sb(method, path, body=None, prefer=None):
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", method=method)
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("Content-Type", "application/json")
    if prefer: req.add_header("Prefer", prefer)
    data = json.dumps(body).encode() if body is not None else None
    with urllib.request.urlopen(req, data=data, timeout=60) as r:
        t = r.read().decode()
        return json.loads(t) if t else None

def fetch_subtitles(url, vid):
    # ja優先→en。自動生成字幕も許可。--skip-download で映像は落とさない。
    out = f"/tmp/{vid}"
    cmd = ["yt-dlp", "--skip-download", "--write-subs", "--write-auto-subs",
           "--sub-langs", "ja,ja-orig,en", "--sub-format", "vtt",
           "-o", out, url]
    subprocess.run(cmd, capture_output=True, timeout=180)
    files = sorted(glob.glob(f"{out}*.vtt"), key=lambda f: (0 if ".ja" in f else 1))
    if not files:
        return None
    text_lines, seen = [], set()
    for line in open(files[0], encoding="utf-8", errors="ignore"):
        line = line.strip()
        if not line or "-->" in line or line.startswith(("WEBVTT", "Kind:", "Language:", "NOTE")): continue
        line = re.sub(r"<[^>]+>", "", line)
        if line and line not in seen:
            seen.add(line); text_lines.append(line)
    return "\n".join(text_lines)[:30000] or None

def gemini_summarize(title, channel, transcript):
    prompt = f"""あなたはLoLの攻略ライターです。以下のYouTube動画の字幕から、日本語の攻略バイブル(Markdown)を作成してください。
動画タイトル: {title} / チャンネル: {channel}

必ず以下のJSONのみ出力（コードブロック禁止）:
{{"title":"<記事タイトル(動画名ベース)>","summary":"<Markdown形式の攻略まとめ。見出し・箇条書きで戦術/ルート/マッチアップを整理。1500字以内>","genre":"<LoL攻略/ビルド/マクロ/その他 から1つ>","tags":["<タグ最大3つ>"],"champion":"<主題のチャンピオン英語ID。無ければUnknown>"}}

字幕:
{transcript}"""
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 4096}}
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_KEY}",
        data=json.dumps(body).encode(), method="POST")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=120) as r:
        res = json.loads(r.read().decode())
    text = res["candidates"][0]["content"]["parts"][0]["text"].strip()
    text = re.sub(r"^```[a-z]*\n?|```$", "", text).strip()
    s, e = text.find("{"), text.rfind("}")
    return json.loads(text[s:e+1])

def main():
    items = sb("GET", f"youtube_queue?status=eq.pending&order=date_added.asc&limit={MAX_ITEMS}") or []
    if not items:
        print("キューは空です。"); return
    for it in items:
        vid, url = it["id"], it["url"]
        print(f"▶ 処理開始: {it.get('title')} ({vid})")
        sb("PATCH", f"youtube_queue?id=eq.{vid}", {"status": "processing"})
        try:
            transcript = fetch_subtitles(url, vid)
            if not transcript:
                raise RuntimeError("字幕を取得できませんでした（字幕なし or IP制限の可能性）")
            a = gemini_summarize(it.get("title") or "YouTube Video", it.get("channel_name") or "", transcript)
            sb("POST", "personal_knowledge", [{
                "title": a.get("title") or it.get("title") or "YouTube攻略メモ",
                "content": a.get("summary") or "",
                "raw_content": transcript[:8000],
                "source_url": url,
                "genre": a.get("genre") or "LoL攻略",
                "tags": a.get("tags") or [],
                "champion": a.get("champion") or "Unknown",
            }], prefer="return=minimal")
            sb("PATCH", f"youtube_queue?id=eq.{vid}", {"status": "completed"})
            print(f"✅ 完了: {a.get('title')}")
        except Exception as e:
            retry = (it.get("retry_count") or 0) + 1
            status = "pending" if retry < MAX_RETRY else "failed"
            sb("PATCH", f"youtube_queue?id=eq.{vid}",
               {"status": status, "retry_count": retry, "error_message": str(e)[:500]})
            print(f"❌ 失敗({retry}/{MAX_RETRY}→{status}): {e}", file=sys.stderr)

if __name__ == "__main__":
    main()
