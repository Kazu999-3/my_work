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
            print(f"  [字幕なし] {vid}: {tail}", file=sys.stderr)
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

            transcript = fetch_subtitles(url, vid)
            if not transcript:
                raise NoTranscript("字幕を取得できませんでした（字幕なし or IP制限の可能性）")
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

            # 完全自動(人間の確認なし)でチャンピオン辞典生成にそのまま使われていたため、
            # 手動登録(knowledge/add→confirm)と同じくreview_status='pending'で保存し、
            # /admin/knowledgeの「未承認」パネルで人間が承認するまではfetch_personal_knowledge
            # (champion_trend_worker.py)の対象から外れるようにする(2026-08-16、ユーザー要望)。
            # 既存の承認済み記事はそのまま維持し、今後の新規分だけが対象。
            sb("POST", "personal_knowledge", [{
                "title": video_title,
                "content": final_content,
                "raw_content": transcript[:8000],
                "source_url": url,
                "genre": a.get("genre") or "LoL攻略",
                "tags": a.get("tags") or [],
                "champion": a.get("champion") or "Unknown",
                "review_status": "pending",
            }], prefer="return=minimal")
            sb("PATCH", f"youtube_queue?id=eq.{vid}", {"status": "completed"})
            title = video_title
            done.append(title)
            print(f"✅ 完了: {title}")
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
                saved = sb("GET", "personal_knowledge?source_url=eq.%s&select=id" % url)
                if saved:
                    sb("PATCH", "youtube_queue?id=eq.%s" % vid, {"status": "completed"})
                    done.append(it.get("title") or vid)
                    print("✅ 完了（保存済みを検出し復旧）: %s" % (it.get("title") or vid))
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
        if done:
            lines.append(f"**✅ 解析完了: {len(done)}本**")
            lines += [f"・{t}" for t in done]
        if failed:
            lines.append(f"\n**❌ 失敗: {len(failed)}本**")
            # 字幕なしが多い＝IP制限の可能性があるので、理由も添える
            for t, st, reason in failed:
                label = ("字幕なし" if st == "error_no_transcript"
                         else "生成失敗" if st == "error_generation"
                         else "レート制限で中断" if st == "rate_limited"
                         else "再試行待ち")
                lines.append(f"・{t}（{label}）")
        color = COLOR_WARN if failed else COLOR_OK
        status = "warn" if failed else "ok"
        notify("🎬 YouTube解析ワーカー", lines, color=color, worker_name="youtube_worker", status=status)

    # 全滅かつ全て字幕なし＝データセンターIPがブロックされている疑いが濃い
    if failed and not done and all(st == "error_no_transcript" for _, st, _ in failed):
        print("⚠️ 全件が字幕取得に失敗。yt-dlpのIP制限の可能性があります。", file=sys.stderr)


if __name__ == "__main__":
    main()
