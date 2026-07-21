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
# ポータル側(lib/geminiClient.ts)と同じモデルに揃える。
# gemini-2.5-flash はこのキーで日次上限を超過した実績があるため使わない。
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite")
MAX_ITEMS = int(os.environ.get("MAX_ITEMS", "3"))
MAX_RETRY = 3

class NoTranscript(RuntimeError):
    """字幕が取得できなかった。再試行しても回復しないので区別する。"""

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

【出力言語の絶対条件】字幕が英語でも、出力は必ず日本語にすること。
チャンピオン名・アイテム名・ルーン名などの固有名詞のみ英語表記のまま残すこと。

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
    # 優先度の高いものから、次に登録が古いものから処理する。
    # priority は文字列なのでDB側のソートだと high→low→medium になってしまう。
    # 候補を多めに取ってから、Python側で正しい優先順に並べ替える。
    candidates = sb("GET",
                    "youtube_queue?status=eq.pending"
                    f"&order=date_added.asc&limit={MAX_ITEMS * 10}") or []
    rank = {"high": 0, "medium": 1, "low": 2}
    candidates.sort(key=lambda x: rank.get(x.get("priority") or "medium", 1))
    items = candidates[:MAX_ITEMS]
    if not items:
        print("キューは空です。"); return
    for it in items:
        vid, url = it["id"], it["url"]
        print(f"▶ 処理開始: {it.get('title')} ({vid})")
        # 注意: status は CHECK 制約付きで、許可値は
        #   pending / completed / error_generation / error_no_transcript / failed / on_hold
        # 'processing' は許可されていないため、着手中フラグは立てない。
        # （立てようとすると 400 で落ち、しかも try の外だったため全体が停止していた）
        try:
            transcript = fetch_subtitles(url, vid)
            if not transcript:
                raise NoTranscript("字幕を取得できませんでした（字幕なし or IP制限の可能性）")
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
            if retry < MAX_RETRY:
                status = "pending"                      # まだ再試行の余地がある
            elif isinstance(e, NoTranscript):
                status = "error_no_transcript"          # 字幕が無い動画は再試行しても無駄
            else:
                status = "error_generation"
            # error_message カラムは存在しないため、失敗理由はタイトル末尾に載せる
            # （画面側の parseTitleAndError が「[エラー: ...]」を拾って表示する）
            base = re.sub(r"\s*\[エラー:.*?\]\s*$", "", it.get("title") or "")
            payload = {"status": status, "retry_count": retry}
            if status != "pending":
                payload["title"] = f"{base} [エラー: {str(e)[:120]}]"
            sb("PATCH", f"youtube_queue?id=eq.{vid}", payload)
            print(f"❌ 失敗({retry}/{MAX_RETRY}→{status}): {e}", file=sys.stderr)

if __name__ == "__main__":
    main()
