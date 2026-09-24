# ============================================================
# YouTube解析クラウドワーカー (#88)
# PC常駐デーモンの代替として GitHub Actions 上で動く。
#   youtube_queue(pending) → yt-dlpで字幕取得 → Geminiで攻略バイブル生成
#   → personal_knowledge へ保存 → queueをcompletedに更新
# 必要な環境変数: SUPABASE_URL, SUPABASE_SERVICE_KEY, GEMINI_API_KEY
# ============================================================
import os, re, json, glob, subprocess, sys, time
import urllib.request, urllib.error
from pathlib import Path

# Windowsのコンソール(cp932)では絵文字や記号で UnicodeEncodeError になるため。
# 元々GitHub Actions(Linux/UTF-8)専用だったのでこの手当てが無かった。
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

# ローカル実行時は .env から環境変数を読む（2026-09-23 追加）。
# このワーカーは元々 GitHub Actions 専用で、環境変数がプロセスに注入されている
# 前提だった。そのため TODO に載っていたローカル実行コマンドが
#   KeyError: SUPABASE_URL
# で即落ちしていた。load_dotenv は既存の環境変数を上書きしないので、
# GitHub Actions 側の挙動は変わらない。
try:
    from dotenv import load_dotenv
    _root = Path(__file__).resolve().parent.parent
    for _env in [_root / "04_PORTAL" / ".env.local", _root / "04_PORTAL" / ".env", _root / ".env"]:
        if _env.exists():
            load_dotenv(_env)
    # SUPABASE_URL は名前が揺れるので、ポータル側の名前からも補う
    if not os.environ.get("SUPABASE_URL"):
        _url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        if _url:
            os.environ["SUPABASE_URL"] = _url
except ImportError:
    pass  # GitHub Actions では python-dotenv が無くても環境変数が直接入っている

from notify import notify, COLOR_OK, COLOR_WARN
from video_filter import is_shorts_video

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
# 字幕が無い動画をWhisperで文字起こしするか。CPUで走るため1本あたり数分かかる。
ENABLE_WHISPER = os.environ.get("ENABLE_WHISPER", "1") not in ("0", "false", "False")
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "base")
# 字幕が取れない動画を Gemini の映像解析で処理するか。
# Gemini が YouTube URL を直接読むため yt-dlp を使わず、cookie も bot判定も無関係。
# 2026-09-23 実測: 12分の動画・低解像度で 約88,000トークン / 79秒。
# 字幕がある動画にも使うと質は上がるがトークンが2桁増えるので、既定では
# 「字幕が取れなかったときだけ」にしている（ENABLE_VIDEO_ANALYSIS_ALWAYS=1 で全件）。
ENABLE_VIDEO_ANALYSIS = os.environ.get("ENABLE_VIDEO_ANALYSIS", "1") not in ("0", "false", "False")
ENABLE_VIDEO_ANALYSIS_ALWAYS = os.environ.get("ENABLE_VIDEO_ANALYSIS_ALWAYS", "0") in ("1", "true", "True")
# 映像解析に使うモデル。gemini-model-health-check で実クォータを確認したものだけを書くこと。
VIDEO_MODEL = os.environ.get("VIDEO_MODEL", "gemini-2.5-flash")
# これ未満の文字数なら「実況なし」とみなしてGeminiへ渡さない
WHISPER_MIN_CHARS = int(os.environ.get("WHISPER_MIN_CHARS", "500"))

MAX_RETRY = 3

class NoTranscript(RuntimeError):
    """字幕が取得できなかった。再試行しても回復しないので区別する。"""

class RateLimited(RuntimeError):
    """YouTube側のレート制限(429)やbot判定によるエラー。「字幕が存在しない」動画とは異なり、
    時間を置けば成功する可能性が高いため、NoTranscriptとは区別してリトライ対象(pending)に戻す。
    (2026-08-10: この区別が無く、429もNoTranscript扱いでerror_no_transcript(リトライなし)に
    即確定していたため、一時的な制限のはずの動画が永久に処理されない状態になっていた)"""

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
        # エラー本文を必ず拾う（2026-09-23）。従来は e をそのまま投げており
        # 「HTTP Error 409: Conflict」としか残らず、どのテーブルのどの制約に
        # ぶつかったのか分からなかった。実際それで原因特定に時間を要した。
        detail = ""
        try:
            detail = e.read().decode()[:300]
        except Exception:
            pass
        if e.code == 401:
            # キーが空・別プロジェクトのキー・失効のいずれか。原因を明示して即終了する。
            sys.exit(
                "❌ Supabaseに認証拒否されました (401)。GitHubのSecretのキーが正しいか、"
                "対象プロジェクトのものか確認してください。"
            )
        raise RuntimeError(
            "HTTP %s %s %s -> %s" % (e.code, method, path.split("?")[0], detail or "(本文なし)")
        ) from e

import tempfile, shutil

def fetch_subtitles(url, vid):
    tmp_dir = tempfile.gettempdir()
    out = os.path.join(tmp_dir, f"yt_{vid}")

    yt_bin = shutil.which("yt-dlp") or shutil.which("yt-dlp.exe")
    cmd = [yt_bin] if yt_bin else [sys.executable, "-m", "yt_dlp"]

    cmd.extend([
        "--skip-download", "--write-subs", "--write-auto-subs",
        "--sub-langs", "ja,ja-orig,en", "--sub-format", "vtt",
        # android_vr は署名済み直リンクを返すためcookie併用時にも弾かれにくい。
        # android/webは非cookie時の保険として残す（2026-07-31実測でandroid_vrが最も安定）。
        "--extractor-args", "youtube:player_client=android_vr,android,web",
        "-o", out, url
    ])
    # クライアント偽装だけでは防ぎきれないため cookie を併用する。
    # 2026-07実測: これが無いとGitHub Actions上の字幕取得は実質100%失敗する。
    # 2026-09-21: ここはシークレット(YOUTUBE_COOKIES_TXT)しか見ておらず、ローカルの
    # `.env`に設定された YT_DLP_COOKIES_FROM が効かなかったため、共通モジュールへ集約した。
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from yt_dlp_cookies import get_cookie_cli_args
    cmd.extend(get_cookie_cli_args())
    # ⚠️ 2026-09-23: 429（Too Many Requests）はその場で待って再試行する。
    # 従来は1回叩いて429なら即RateLimitedにしていたため、次のワーカー起動まで
    # 何分も空いたうえに retry_count だけが減っていった。実測では59件のエラーのうち
    # 23件がこの429で、いずれも retry_count を3まで使い切って error_generation に
    # 固定されていた（2026-09-22 16:53〜2026-09-23 08:54 に発生）。
    BACKOFF_SEC = [10, 30]
    for attempt in range(len(BACKOFF_SEC) + 1):
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        files = sorted(glob.glob(f"{out}*.vtt"), key=lambda f: (0 if ".ja" in f else 1))
        if files:
            break
        err = (res.stderr or "").strip()
        tail = err.splitlines()[-1] if err else "(yt-dlpの出力なし)"
        is_limited = "Sign in to confirm" in err or "bot" in err.lower() or "429" in err
        if not is_limited:
            # yt-dlpのstderr末尾は ffmpeg の警告など無関係な行であることが多く、
            # 実際の失敗理由が埋もれる。ERROR行があればそちらを優先して出す。
            reason = next((l for l in reversed(err.splitlines()) if "ERROR" in l), tail)
            print(f"  [字幕なし] {vid}: {reason}", file=sys.stderr)
            return None
        if attempt < len(BACKOFF_SEC):
            wait = BACKOFF_SEC[attempt]
            print(f"  ⏳ 429/bot判定。{wait}秒待って再試行 ({attempt + 1}/{len(BACKOFF_SEC)}): {vid}", file=sys.stderr)
            time.sleep(wait)
            continue
        print(f"  ⚠️ IP制限が解消しません（YouTubeがbot判定）: {vid}", file=sys.stderr)
        raise RateLimited(tail)
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

VIDEO_PROMPT = """あなたはLoLのコーチです。この動画から、**視聴者が自分の試合で再現できる判断ルール**を抜き出してください。

【絶対に書かないこと】
- 動画で何が起きたかの実況・あらすじ
- 「〜と解説しています」という伝聞
- その試合でしか使えない固有の展開

【まず動画の種類を判定し、理由の説明軸をそれに合わせること】
- マクロ（試合運び）… リソース / テンポ / 視界 / 経験値 / オブジェクト のいずれかで説明する
- メカニクス（操作）… 射程 / クールダウン / 硬直 / 判定 / 反応時間 のいずれかで説明する
- ビルド（構成）……… パワースパイク / ステータス効率 / 対面の脅威 のいずれかで説明する
どの軸でも説明できないルールは**書かないこと**。「強いから」「プロがやっているから」は理由ではない。

【実演タイムスタンプの記録】
各判断ルールやコンボ、重要なテクニックが動画内の「何分何秒」で実演・解説されているかを必ず記録してください（例: "02:15"）。

【優先順位】
「何を差し置いても先にやること」だけを**最大5件**。話題の羅列にしないこと。

【出力】純粋なJSONのみ（コードブロック不要）:
{"title":"<日本語の記事タイトル>",
 "summary":"<下記のMarkdown構成で本文>",
 "genre":"<LoL攻略/ビルド/マクロ/その他 から1つ>",
 "tags":["<最大5つ>"],
 "champion":"<主題のチャンピオン英語ID。無ければUnknown>",
 "key_clips":[{"timestamp":"<MM:SS形式。例: 02:15>", "label":"<実演内容の簡潔な説明>"}]}

summary は次の構成にすること:
## 🎬 この動画の種類
（マクロ / メカニクス / ビルド のどれか。理由の説明軸もここに明記）

## 🧭 判断ルール
### ルール1: <短い見出し> [実演: MM:SS]
- **状況**: いつ・何が成立しているとき
- **行動**: 何をするか
- **理由**: 上の軸のどれかで説明
- **反例**: その条件が崩れたらどうするか
（ルール2以降も同じ形式で続ける。実演時間があれば見出し末尾に [実演: MM:SS] を付与）

## 🥇 優先順位（最大5件）

## ⚠️ よくあるミス
- **ミス** / **なぜ悪い** / **直し方** の3点セットで

## 📌 前提
（対象レート帯・パッチ・前提知識。動画から読み取れなければ「明示なし」と書く）

## 🤔 実戦への問いかけ（思考トリガー）
（この解説を実戦で活かすための、プレイヤー自身への具体的な問いかけを1行で提示。「何を学んだか？」のような汎用的な問いは【絶対厳禁】。例：「相手JGがLv3でBotガンクに見えたとき、自分のトップ側ヘラルド判断とリコールタイミングはどう動かすか？」のように具体的状況に基づく問い）

## 🌾 拾い上げ（Harvest）
- **要検証**: 実戦・カスタムで試す仮説や未検証事項
- **継続ウォッチ**: パッチ推移やメタ変化における注意点

日本語で書くこと。チャンピオン名・アイテム名・ルーン名などの固有名詞のみ英語可。"""

SHORTS_PROMPT = """あなたはLoL(League of Legends)の最高峰戦術アナリスト・プロコーチAIです。
このショート動画（Shorts）の映像または字幕・音声から、**1分間で凝縮された核心テクニック・ワンポイントTips**を漏れなく抽出してください。

【厳格ルール】
- 存在しない長文の試合展開や架空のルーン・アイテムビルドを捏造（ハルシネーション）することは【絶対厳禁】です。
- 動画内で実際に解説・実演されている「小技」「コンボ手順」「隠れた仕様」「特定の対面対策」だけに集中して、高密度かつ端的に言語化してください。

【出力】純粋なJSONのみ（コードブロック不要）:
{"title":"【1分Tips】<具体的で分かりやすい日本語タイトル>",
 "summary":"<下記のMarkdown構成で本文（500〜1,200文字程度）>",
 "genre":"LoL攻略",
 "tags":["Shorts", "Tips", "<チャンピオン名英語>", "<関連タグ最大2つ>"],
 "champion":"<主題のチャンピオン英語ID。無ければUnknown>"}

summary は次の構成にすること:
# 💡 【1分Tips】<タイトル>

## 🎯 核心ポイント（何ができるテクニックか）
- このショート動画が教えているテクニック・小技の要点
- なぜこれが実戦で強いのか（ダメージ最大化、相手の反応不能、視界外からの強襲など）

## ⌨️ スキル操作・コンボ手順（キー入力順）
- **キー入力順**: 例: `E ➔ Flash ➔ Q ➔ AA`
- **操作のコツ・タイミング**: アニメーションキャンセル、入力受付時間、ブッシュ・壁の利用など

## ⚠️ 注意点・知っておくべき仕様
- 失敗しやすいポイント、仕様上の注意（敵がフラッシュを持っている時の挙動など）
- 反対にこの技を使わない方がいい状況（敵のCCが残っている時など）

## 🏆 実戦での活用シーン
- レーン戦でのキルライン、集団戦でのエンゲージ、ローム時など、どこで狙うべきか

## 🤔 実戦への問いかけ（思考トリガー）
- このTipsを実戦で発動するための、具体的状況に関する1行の問いかけ（汎用的な問いは禁止）

日本語で書くこと。チャンピオン名・アイテム名・スキルキーなどの固有名詞のみ英語可。"""


def parse_timestamp_to_seconds(ts_str):
    """'02:15' や '1:23:45' を秒数に変換"""
    try:
        parts = [int(p) for p in ts_str.strip().split(":")]
        if len(parts) == 2:
            return parts[0] * 60 + parts[1]
        elif len(parts) == 3:
            return parts[0] * 3600 + parts[1] * 60 + parts[2]
    except Exception:
        pass
    return None


def build_youtube_timestamp_url(video_url, ts_str):
    """動画URLとタイムスタンプ文字列から秒数リンクを生成"""
    sec = parse_timestamp_to_seconds(ts_str)
    if sec is None:
        return video_url
    # 短縮URL(youtu.be/VID) または 通常URL(watch?v=VID)
    vid_match = re.search(r"(?:v=|youtu\.be/)([a-zA-Z0-9_-]{11})", video_url)
    if vid_match:
        return f"https://youtu.be/{vid_match.group(1)}?t={sec}"
    sep = "&" if "?" in video_url else "?"
    return f"{video_url}{sep}t={sec}s"


def enrich_summary_with_timestamps(summary, key_clips, video_url):
    """本文中の [実演: MM:SS] や key_clips をクリッカブルな動画リンクへ変換"""
    if not summary:
        return summary

    # 1. 本文中の [実演: MM:SS] をリンクに変換
    def replace_inline_ts(match):
        ts = match.group(1)
        url = build_youtube_timestamp_url(video_url, ts)
        return f"[▶ {ts} 実演シーン]({url})"

    enriched = re.sub(r"\[(?:実演:\s*)?(\d{1,2}:\d{2}(?::\d{2})?)\]", replace_inline_ts, summary)

    # 2. key_clips があれば先頭にタイムスタンプ目次を追加
    if key_clips and isinstance(key_clips, list):
        clip_lines = []
        for c in key_clips:
            if not isinstance(c, dict): continue
            ts = c.get("timestamp") or ""
            label = c.get("label") or ""
            if ts and label:
                ts_url = build_youtube_timestamp_url(video_url, ts)
                clip_lines.append(f"> - [▶ {ts}]({ts_url}) **{label}**")
        if clip_lines:
            clip_header = "> ⏱️ **実演チャプター・キーシーン**\n" + "\n".join(clip_lines) + "\n\n"
            enriched = clip_header + enriched

    return enriched


def gemini_analyze_video(url, title, channel, is_short=False):
    """YouTube URL を Gemini に直接渡して解析する。

    字幕も音声も無い動画（テロップのみ・実況なし）でも中身を読み取れる。
    yt-dlp を経由しないので cookie も bot判定も関係しない。
    ⚠️ トークン消費は動画の長さにほぼ比例する（低解像度で1秒あたり約103トークン）。
    Shorts(60秒未満)の場合は格安（数千トークン）で解析可能。
    """
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=GEMINI_KEY)
    head = f"動画タイトル: {title}\nチャンネル: {channel}\n\n"
    prompt_text = SHORTS_PROMPT if is_short else VIDEO_PROMPT
    res = client.models.generate_content(
        model=VIDEO_MODEL,
        contents=types.Content(parts=[
            types.Part(file_data=types.FileData(file_uri=url)),
            types.Part(text=head + prompt_text),
        ]),
        config=types.GenerateContentConfig(
            # 低解像度でも画面内テキストは読める。既定のままだとトークンが約3倍になる
            # （2026-09-23実測: 12分の動画で 212,419 → 74,179）。
            media_resolution="MEDIA_RESOLUTION_LOW",
            temperature=0.2,
        ),
    )
    txt = (res.text or "").strip()
    for pre in ("```json", "```"):
        if txt.startswith(pre):
            txt = txt[len(pre):]
    if txt.endswith("```"):
        txt = txt[:-3]
    data = json.loads(txt.strip())
    um = getattr(res, "usage_metadata", None)
    if um:
        print(f"  📊 映像解析 ({'Shorts' if is_short else '通常'}): 入力{um.prompt_token_count} 出力{um.candidates_token_count} トークン")

    # 実演タイムスタンプを本文にリンクとして埋め込む
    key_clips = data.get("key_clips") or []
    if data.get("summary"):
        data["summary"] = enrich_summary_with_timestamps(data["summary"], key_clips, url)

    return data


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
    prompt = f"""あなたはLoL(League of Legends)最高峰の戦術アナリスト・プロコーチAIです。
以下のYouTube動画の全文字起こし（字幕）から、一切の要約・省略を排除し、3,000文字〜5,000文字以上の【超長文・完全網羅の究極攻略バイブル(Markdown)】を作成してください。

動画タイトル: {title}
チャンネル: {channel}

【極重要命令（超長文・完全書き起こし指示）】:
短くまとめることは【絶対厳禁】です。
プロやチャレンジャーが話している思考プロセス、些細な判断理由、アイテム選びの細かい比較、ウェーブやキャンプの1秒単位の判断、失敗時のリカバリー策、発言のニュアンスまで、すべてを逃さず圧倒的な文字数と深さで徹底的に解説してください。

【必須の全7章構成（各章とも超詳細・長文で記述すること）】:
# 🏆 {title} 究極完全攻略バイブル

## 1. 📌 本質テーマ＆戦術コンセプト（なぜこの立ち回り/ビルドが強いのか）
- 動画の核心的テーマ、根本的な勝率ロジック、現パッチでの立ち位置
- なぜ従来の一般的な立ち回りではなく、この戦術を選択するのかの論理的根拠

## 2. 🛡️ ルーン・アイテムビルドの完全解剖（理由・分岐・パワースパイク）
- メインルーン・サブルーン・シャードの選定理由（対面や構成による派生ルーンも詳述）
- スタートアイテム、ファーストリコール、1コア・2コア・3コア以降のアイテム選択ロジック
- 状況別（敵の脅威度、AD/AP偏り、回復阻害等）のビルド派生と完成タイミングのパワースパイク

## 3. ⚔️ スキルオーダー＆コンボ・微細操作テクニック
- レベル1〜3および最大化のスキルオーダーとその理由
- 基本コンボ、バーストコンボ、逃げ/追撃時のスキル活用、アニメーションキャンセルや距離管理のコツ

## 4. ⏱️ 序盤・中盤・終盤の完全タイムライン攻略
- **【序盤（0〜10分）】**: スタート位置、ジャングルルート/ウェーブ管理、レベル先行の仕掛け、最初のリコール判断
- **【中盤（10〜20分）】**: ドラゴン/ヘラルド/ヴォイドグラブのオブジェクト優先順位、サイドレーン管理、ロームの判断基準
- **【終盤（20分以降）】**: バロン戦のポジショニング、視界管理、キャッチからのエンドゲームへの詰め方

## 5. 🎯 対面マッチアップ＆構成別対策
- 有利なマッチアップ（どうやってスノーボールするか）
- 不利・要注意なマッチアップ（どう耐えて逆転するか、ガンクの合わせ方）
- 敵味方の構成に応じた役割の変化（エンゲージ役、ピール役、アサシン役など）

## 6. 💥 集団戦・スプリットプッシュの立ち回りとターゲット優先順位
- 集団戦前のポジショニング（フランク、フロントライン、ブッシュ待機）
- 誰から倒すべきか（ターゲットプライオリティ）と、スキルを吐くタイミング
- スプリットプッシュ時の押し引きの引き際とTP/寄りの判断

## 7. 🧠 プロ/チャレンジャーのリアルタイム思考プロセス＆実践Tips（全書き出し）
- 動画内でプレイヤーが口にしていた細かな判断・気付き・アドバイスの全書き起こし
- 一般プレイヤーがやりがちな「NG行動・典型的なミス」と、その回避方法
- 不利・事故った時の具体的なメンタルとリカバリー戦略

【出力言語の絶対条件】: 字幕が英語でも出力は必ず日本語にすること。チャンピオン名・アイテム名・ルーン名などの固有名詞のみ英語表記（または一般的な日本語併記）にすること。

必ず以下のJSONフォーマットのみを出力してください（Markdownコードブロック不要、純粋なJSONのみ）:
{{"title":"<具体的で分かりやすい日本語記事タイトル>","summary":"<3,000〜5,000文字超の圧倒的ボリュームを持つMarkdownコンテンツ全文>","genre":"<LoL攻略/ビルド/マクロ/その他 から1つ>","tags":["<関連タグ最大5つ>"],"champion":"<主題のチャンピオン英語ID。無ければUnknown>"}}

字幕:
{transcript}"""
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 8192}}

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
        except urllib.error.HTTPError as err:
            last_err = err
            if err.code == 429:
                wait_sec = 20 * (attempt + 1)
                print(f"[gemini_summarize] 429 (レート制限)。{wait_sec}秒待機して再試行 ({attempt+1}/3)")
                time.sleep(wait_sec)
            else:
                print(f"[gemini_summarize] HTTPエラー: {err} ({attempt+1}/3)")
                time.sleep(2)
        except Exception as err:
            last_err = err
            print(f"[gemini_summarize] JSONパース失敗/エラー: {err} ({attempt+1}/3)")
            time.sleep(2)

    raise RuntimeError(f"Gemini出力の構造化バリデーションに失敗しました: {last_err}")


def gemini_summarize_short(title, channel, transcript):
    """Shorts動画（60秒未満）の文字起こしから、ワンポイントTipsを抽出する。"""
    prompt = f"""あなたはLoL(League of Legends)の最高峰戦術アナリスト・プロコーチAIです。
以下のショート動画（Shorts）の文字起こしから、1分間で凝縮された核心テクニック・ワンポイントTipsを漏れなく抽出してください。

動画タイトル: {title}
チャンネル: {channel}

【厳格ルール】
- 存在しない長文の試合展開や架空のルーン・アイテムビルドを捏造（ハルシネーション）することは【絶対厳禁】です。
- 動画内で実際に解説・実演されている「小技」「コンボ手順」「隠れた仕様」「特定の対面対策」だけに集中して、高密度かつ端的に言語化してください。

【出力】純粋なJSONのみ（コードブロック不要）:
{{"title":"【1分Tips】<具体的で分かりやすい日本語タイトル>",
 "summary":"<下記のMarkdown構成で本文（500〜1,200文字程度）>",
 "genre":"LoL攻略",
 "tags":["Shorts", "Tips", "<チャンピオン名英語>", "<関連タグ最大2つ>"],
 "champion":"<主題のチャンピオン英語ID。無ければUnknown>"}}

summary は次の構成にすること:
# 💡 【1分Tips】<タイトル>

## 🎯 核心ポイント（何ができるテクニックか）
- このショート動画が教えているテクニック・小技の要点
- なぜこれが実戦で強いのか（ダメージ最大化、相手の反応不能、視界外からの強襲など）

## ⌨️ スキル操作・コンボ手順（キー入力順）
- **キー入力順**: 例: `E ➔ Flash ➔ Q ➔ AA`
- **操作のコツ・タイミング**: アニメーションキャンセル、入力受付時間、ブッシュ・壁の利用など

## ⚠️ 注意点・知っておくべき仕様
- 失敗しやすいポイント、仕様上の注意（敵がフラッシュを持っている時の挙動など）
- 反対にこの技を使わない方がいい状況（敵のCCが残っている時など）

## 🏆 実戦での活用シーン
- レーン戦でのキルライン、集団戦でのエンゲージ、ローム時など、どこで狙うべきか

## 🤔 実戦への問いかけ（思考トリガー）
- このTipsを実戦で発動するための、具体的状況に関する1行の問いかけ（汎用的な問いは禁止）

日本語で書くこと。チャンピオン名・アイテム名・スキルキーなどの固有名詞のみ英語可。

文字起こし:
{transcript}"""
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 4096}}

    last_err = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(
                f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_KEY}",
                data=json.dumps(body).encode(), method="POST")
            req.add_header("Content-Type", "application/json")
            with urllib.request.urlopen(req, timeout=60) as r:
                res = json.loads(r.read().decode())
            text = res["candidates"][0]["content"]["parts"][0]["text"].strip()
            text = re.sub(r"^```[a-z]*\n?|```$", "", text).strip()
            s, e = text.find("{"), text.rfind("}")
            parsed = json.loads(text[s:e+1])
            if validate_article_json(parsed):
                return parsed
            else:
                print(f"[gemini_summarize_short] キー欠落または形式不整合。再試行 ({attempt+1}/3)")
        except urllib.error.HTTPError as err:
            last_err = err
            if err.code == 429:
                wait_sec = 20 * (attempt + 1)
                print(f"[gemini_summarize_short] 429 (レート制限)。{wait_sec}秒待機して再試行 ({attempt+1}/3)")
                time.sleep(wait_sec)
            else:
                print(f"[gemini_summarize_short] HTTPエラー: {err} ({attempt+1}/3)")
                time.sleep(2)
        except Exception as err:
            last_err = err
            print(f"[gemini_summarize_short] JSONパース失敗/エラー: {err} ({attempt+1}/3)")
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
    processed = 0
    for it in items:
        vid, url = it["id"], it["url"]
        # ⚠️ 2026-09-23: 連続アクセスでYouTubeの字幕APIが429を返すため間隔を空ける。
        # extract_video_tactics.py では 2026-09-21 の実測（間隔なしで28本中6本が429）を
        # 受けて既に5秒待っていたが、このワーカーには入っていなかった。
        if processed > 0:
            time.sleep(5)
        processed += 1
        print(f"▶ 処理開始: {it.get('title')} ({vid})")
        # 注意: status は CHECK 制約付きで、許可値は
        #   pending / completed / error_generation / error_no_transcript / failed / on_hold
        # 'processing' は許可されていないため、着手中フラグは立てない。
        # （立てようとすると 400 で落ち、しかも try の外だったため全体が停止していた）
        try:
            # 前回の実行で要約の保存(POST)自体は成功したが、直後の
            # youtube_queue へのPATCH(completed)だけがネットワーク障害等で失敗していた
            # 場合の救済。無条件に再生成すると Gemini呼び出しの二重コストと
            # personal_knowledge の重複行を生むため、既存の有無を先に確認する。
            existing = sb("GET", f"personal_knowledge?source_url=eq.{url}&select=id,title")
            if existing:
                sb("PATCH", f"youtube_queue?id=eq.{vid}", {"status": "completed"})
                title = existing[0].get("title") or it.get("title") or "(無題)"
                done.append(title)
                print(f"✅ 完了（既存の要約を検出、再生成をスキップ）: {title}")
                continue

            a = None
            is_short = is_shorts_video(it.get("title") or "", it.get("duration_sec"))
            if is_short:
                print(f"  📱 Shorts動画として解析します: {it.get('title')}")

            # ① 映像解析を常用する設定、またはShorts動画なら最初から映像で読む
            # （Shortsはテロップや実演がメインで実況なしが多いため映像解析が最も確実・トークンも極小）
            if (ENABLE_VIDEO_ANALYSIS_ALWAYS or is_short) and ENABLE_VIDEO_ANALYSIS:
                print(f"  🎬 映像解析で読み取ります ({'Shorts特化' if is_short else '常用設定'}): {vid}")
                try:
                    a = gemini_analyze_video(url, it.get("title") or "", it.get("channel_name") or "", is_short=is_short)
                except Exception as ve:
                    print(f"  ⚠️ 映像解析に失敗: {ve}。字幕取得へフォールバックします。", file=sys.stderr)
                    a = None

            # ② 通常は字幕を優先する（安く速いため）
            transcript = None
            if a is None:
                transcript = fetch_subtitles(url, vid)

            # ③ 字幕が無ければWhisper文字起こし
            if a is None and not transcript and ENABLE_WHISPER:
                try:
                    from whisper_transcriber import transcribe_youtube_video_fallback
                    print(f"  🎙️ 字幕が無いのでWhisperで文字起こしします: {vid}")
                    text, _ = transcribe_youtube_video_fallback(vid, model_size=WHISPER_MODEL)
                    text = (text or "").strip()
                    min_chars = 50 if is_short else WHISPER_MIN_CHARS
                    if len(text) < min_chars:
                        print(f"  ⚠️ 文字起こしが短すぎます({len(text)}文字 < {min_chars})。実況なしの動画と判断します。",
                              file=sys.stderr)
                    else:
                        print(f"  ✅ Whisperで {len(text)} 文字を取得しました")
                        transcript = text[:30000]
                except Exception as we:
                    print(f"  ⚠️ Whisperに失敗: {we}", file=sys.stderr)

            # ④ 通常動画で字幕・Whisperが取れなかった場合は映像解析
            if a is None and not transcript and ENABLE_VIDEO_ANALYSIS:
                print(f"  🎬 字幕が無いので映像解析で読み取ります: {vid}")
                a = gemini_analyze_video(url, it.get("title") or "", it.get("channel_name") or "", is_short=is_short)

            if a is None:
                if not transcript:
                    raise NoTranscript("字幕を取得できませんでした（字幕なし or IP制限の可能性）")
                if is_short:
                    a = gemini_summarize_short(it.get("title") or "YouTube Shorts", it.get("channel_name") or "", transcript)
                else:
                    a = gemini_summarize(it.get("title") or "YouTube Video", it.get("channel_name") or "", transcript)
            # 元動画情報を記事の先頭に必ず明記する（2026-08-17、ユーザー指示）
            video_title = a.get("title") or it.get("title") or "YouTube攻略メモ"
            channel_name = it.get("channel_name") or "YouTube Channel"
            summary_content = a.get("summary") or ""
            video_meta_header = (
                f"> 📺 **元動画情報**\n"
                f"> - **動画タイトル**: {video_title}\n"
                f"> - **チャンネル**: {channel_name}\n"
                f"> - **動画リンク**: [{url}]({url})\n\n"
                f"---\n\n"
            )
            if "元動画情報" not in summary_content and url not in summary_content:
                final_content = f"{video_meta_header}{summary_content}"
            else:
                final_content = summary_content

            tags = a.get("tags") or []
            if is_short and "Shorts" not in tags:
                tags.append("Shorts")

            # 完全自動(人間の確認なし)でチャンピオン辞典生成にそのまま使われていたため、
            # 手動登録(knowledge/add→confirm)と同じくreview_status='pending'で保存し、
            # /admin/knowledgeの「未承認」パネルで人間が承認するまではfetch_personal_knowledge
            # (champion_trend_worker.py)の対象から外れるようにする(2026-08-16、ユーザー要望)。
            # 既存の承認済み記事はそのまま維持し、今後の新規分だけが対象。
            # personal_knowledge へ保存 (review_status='pending')
            created_row = sb("POST", "personal_knowledge", [{
                "title": video_title,
                "content": final_content,
                "raw_content": transcript[:8000] if transcript else f"映像直接解析による自動抽出 (ID: {vid})",
                "source_url": url,
                "genre": a.get("genre") or "LoL攻略",
                "tags": tags,
                "champion": a.get("champion") or "Unknown",
                "review_status": "pending",
            }], prefer="return=representation")
            created_id = created_row[0].get("id") if (created_row and isinstance(created_row, list)) else None
            sb("PATCH", f"youtube_queue?id=eq.{vid}", {"status": "completed"})
            title = video_title
            done.append({"title": title, "id": created_id})
            print(f"✅ 完了 (ID: {created_id}): {title}")
        except RateLimited as e:
            # ⚠️ 2026-09-23: レート制限は「この動画の問題」ではなく「今このIPが
            # 叩きすぎている」という環境要因なので、retry_count を消費させない。
            # さらに、以降の動画も確実に同じ429を食らって retry_count だけを
            # 削っていくため、この回の実行はここで打ち切る。
            # （実際それで23件が retry_count を使い切り error_generation に固定された）
            sb("PATCH", f"youtube_queue?id=eq.{vid}", {"status": "pending"})
            failed.append((it.get("title") or vid, "rate_limited", str(e)[:80]))
            print(f"⏸ レート制限のため中断（pendingのまま据え置き）: {e}", file=sys.stderr)
            break
        except Exception as e:
            # ⚠️ 2026-09-23: 要約の保存(POST)が成功した後の工程で落ちると、
            # 成果物は既にあるのに pending へ戻り、次の実行でGeminiを再課金して
            # しまう（実際 405u21rOh2M で発生。personal_knowledge には保存済みなのに
            # 409で失敗扱いになっていた）。保存済みかを確認して完了扱いにする。
            try:
                saved = sb("GET", "personal_knowledge?source_url=eq.%s&select=id,title" % url)
                if saved:
                    sb("PATCH", "youtube_queue?id=eq.%s" % vid, {"status": "completed"})
                    recovered_id = saved[0].get("id")
                    recovered_title = saved[0].get("title") or it.get("title") or vid
                    done.append({"title": recovered_title, "id": recovered_id})
                    print("✅ 完了（保存済みを検出し復旧 ID: %s）: %s" % (recovered_id, recovered_title))
                    continue
            except Exception:
                pass  # 復旧の確認自体に失敗したら通常の失敗処理へ進む

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
        components = []
        if done:
            lines.append(f"**✅ 解析完了: {len(done)}本**")
            lines += [f"・{item['title'] if isinstance(item, dict) else item}" for item in done]

            # 承認ボタンの組み立て（最大4件までボタン化、5行目はポータルリンク）
            btn_rows = []
            valid_done = [d for d in done if isinstance(d, dict) and d.get("id")]
            for item in valid_done[:4]:
                btn_rows.append({
                    "type": 1,
                    "components": [{
                        "type": 2,
                        "label": f"✅ 承認: {item['title'][:25]}",
                        "style": 3, # 緑
                        "custom_id": f"approve_knowledge:{item['id']}"
                    }]
                })
            portal_url = os.environ.get("PORTAL_URL", "https://ktm-portal.pages.dev").rstrip("/")
            portal_link_btn = {
                "type": 1,
                "components": [{
                    "type": 2,
                    "label": "🌐 未承認ナレッジ一覧 (ポータル)",
                    "style": 5, # リンク
                    "url": f"{portal_url}/admin/knowledge"
                }]
            }
            if btn_rows:
                components = btn_rows + [portal_link_btn]
            elif portal_url:
                components = [portal_link_btn]

        if failed:
            lines.append(f"\n**❌ 失敗: {len(failed)}本**")
            for t, st, reason in failed:
                label = ("字幕なし" if st == "error_no_transcript"
                         else "生成失敗" if st == "error_generation"
                         else "レート制限で中断" if st == "rate_limited"
                         else "再試行待ち")
                lines.append(f"・{t}（{label}）")
        color = COLOR_WARN if failed else COLOR_OK
        status = "warn" if failed else "ok"
        notify("🎬 YouTube解析ワーカー", lines, color=color, worker_name="youtube_worker", status=status, components=components)

    # 全滅かつ全て字幕なし＝データセンターIPがブロックされている疑いが濃い
    if failed and not done and all(st == "error_no_transcript" for _, st, _ in failed):
        print("⚠️ 全件が字幕取得に失敗。yt-dlpのIP制限の可能性があります。", file=sys.stderr)


if __name__ == "__main__":
    main()
