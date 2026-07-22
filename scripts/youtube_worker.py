# ============================================================
# YouTube解析クラウドワーカー (#88)
# PC常駐デーモンの代替として GitHub Actions 上で動く。
#   youtube_queue(pending) → yt-dlpで字幕取得 → Geminiで攻略バイブル生成
#   → personal_knowledge へ保存 → queueをcompletedに更新
# 必要な環境変数: SUPABASE_URL, SUPABASE_SERVICE_KEY, GEMINI_API_KEY
# ============================================================
import os, re, json, glob, subprocess, sys, time
import urllib.request, urllib.error

from notify import notify, COLOR_OK, COLOR_WARN

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
# シークレット名は環境によって揺れる（Vercelは SUPABASE_SERVICE_ROLE_KEY、
# 旧バッチは SUPABASE_KEY 等）。どれでも拾えるようにする。
SUPABASE_KEY = (
    os.environ.get("SUPABASE_SERVICE_KEY")
    or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("SUPABASE_KEY")
    or ""
).strip()
if not SUPABASE_KEY:
    sys.exit(
        "❌ Supabaseのキーが未設定です。GitHubのSecretsに "
        "SUPABASE_SERVICE_ROLE_KEY（推奨）または SUPABASE_KEY を登録してください。"
    )
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
    try:
        with urllib.request.urlopen(req, data=data, timeout=60) as r:
            t = r.read().decode()
            return json.loads(t) if t else None
    except urllib.error.HTTPError as e:
        if e.code == 401:
            # キーが空・別プロジェクトのキー・失効のいずれか。原因を明示して即終了する。
            sys.exit(
                "❌ Supabaseに認証拒否されました (401)。GitHubのSecretのキーが正しいか、"
                "対象プロジェクトのものか確認してください。"
            )
        raise

import tempfile, shutil

def fetch_subtitles(url, vid):
    tmp_dir = tempfile.gettempdir()
    out = os.path.join(tmp_dir, f"yt_{vid}")

    yt_bin = shutil.which("yt-dlp") or shutil.which("yt-dlp.exe")
    cmd = [yt_bin] if yt_bin else [sys.executable, "-m", "yt_dlp"]

    cmd.extend([
        "--skip-download", "--write-subs", "--write-auto-subs",
        "--sub-langs", "ja,ja-orig,en", "--sub-format", "vtt",
        "-o", out, url
    ])
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    files = sorted(glob.glob(f"{out}*.vtt"), key=lambda f: (0 if ".ja" in f else 1))
    if not files:
        err = (res.stderr or "").strip()
        tail = err.splitlines()[-1] if err else "(yt-dlpの出力なし)"
        print(f"  [字幕なし] {vid}: {tail}", file=sys.stderr)
        if "Sign in to confirm" in err or "bot" in err.lower() or "429" in err:
            print(f"  ⚠️ IP制限の疑い（YouTubeがbot判定）: {vid}", file=sys.stderr)
        return None
    text_lines, seen = [], set()
    for line in open(files[0], encoding="utf-8", errors="ignore"):
        line = line.strip()
        if not line or "-->" in line or line.startswith(("WEBVTT", "Kind:", "Language:", "NOTE")): continue
        line = re.sub(r"<[^>]+>", "", line)
        if line and line not in seen:
            seen.add(line); text_lines.append(line)
    for f in glob.glob(f"{out}*"):
        try: os.remove(f)
        except Exception: pass
    return "\n".join(text_lines)[:30000] or None

def validate_article_json(data):
    if not isinstance(data, dict):
        return False
    for k in ["title", "summary", "genre", "tags", "champion"]:
        if k not in data or not data[k]:
            return False
    if not isinstance(data.get("tags"), list):
        return False
    return True

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

    last_err = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(
                f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_KEY}",
                data=json.dumps(body).encode(), method="POST")
            req.add_header("Content-Type", "application/json")
            with urllib.request.urlopen(req, timeout=120) as r:
                res = json.loads(r.read().decode())
            text = res["candidates"][0]["content"]["parts"][0]["text"].strip()
            text = re.sub(r"^```[a-z]*\n?|```$", "", text).strip()
            s, e = text.find("{"), text.rfind("}")
            parsed = json.loads(text[s:e+1])
            if validate_article_json(parsed):
                return parsed
            else:
                print(f"[gemini_summarize] キー欠落または形式不整合。再試行 ({attempt+1}/3)")
        except Exception as err:
            last_err = err
            print(f"[gemini_summarize] JSONパース失敗/エラー: {err} ({attempt+1}/3)")
            time.sleep(2)

    raise RuntimeError(f"Gemini出力の構造化バリデーションに失敗しました: {last_err}")

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
        print("キューは空です。")
        return

    done, failed = [], []   # 通知用の結果集計
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
            title = a.get("title") or it.get("title") or "(無題)"
            done.append(title)
            print(f"✅ 完了: {title}")
        except Exception as e:
            retry = (it.get("retry_count") or 0) + 1
            if isinstance(e, NoTranscript):
                status = "error_no_transcript"          # 字幕が無い動画は再試行しても無駄なので即時決定
            elif retry < MAX_RETRY:
                status = "pending"                      # まだ再試行の余地がある
            else:
                status = "error_generation"

            base = re.sub(r"\s*\[エラー:.*\]", "", it.get("title") or "").strip()
            payload = {"status": status, "retry_count": retry}
            if status != "pending":
                payload["title"] = f"{base} [エラー: {str(e)[:120]}]"
            sb("PATCH", f"youtube_queue?id=eq.{vid}", payload)
            failed.append((it.get("title") or vid, status, str(e)[:80]))
            print(f"❌ 失敗({retry}/{MAX_RETRY}→{status}): {e}", file=sys.stderr)

    # 結果をDiscordへ通知する（完了か失敗があったときだけ）
    if done or failed:
        lines = []
        if done:
            lines.append(f"**✅ 解析完了: {len(done)}本**")
            lines += [f"・{t}" for t in done]
        if failed:
            lines.append(f"\n**❌ 失敗: {len(failed)}本**")
            # 字幕なしが多い＝IP制限の可能性があるので、理由も添える
            for t, st, reason in failed:
                label = "字幕なし" if st == "error_no_transcript" else "生成失敗" if st == "error_generation" else "再試行待ち"
                lines.append(f"・{t}（{label}）")
        color = COLOR_WARN if failed else COLOR_OK
        status = "warn" if failed else "ok"
        notify("🎬 YouTube解析ワーカー", lines, color=color, worker_name="youtube_worker", status=status)

    # 全滅かつ全て字幕なし＝データセンターIPがブロックされている疑いが濃い
    if failed and not done and all(st == "error_no_transcript" for _, st, _ in failed):
        print("⚠️ 全件が字幕取得に失敗。yt-dlpのIP制限の可能性があります。", file=sys.stderr)


if __name__ == "__main__":
    main()
