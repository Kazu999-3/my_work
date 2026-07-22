# ============================================================
# 攻略動画の自動発掘（Prospector）
#
# 辞典の情報が古いチャンピオンについて YouTube を検索し、良さそうな解説動画を
# youtube_queue へ pending で登録する。登録された動画は ktm-cloud-worker の
# youtube ジョブ（30分おき）が字幕取得→要約→ライブラリ保存まで自動で進める。
#
# v2_CORE/prospector.py の後継。旧版は YouTube の検索結果HTMLを正規表現で
# 解析していたが、HTML構造の変化に弱く、既に登録済みの動画を弾く仕組みも
# 無かった。ここでは yt-dlp の検索機能を使い、重複登録も防ぐ。
#
# 必要な環境変数: SUPABASE_URL, SUPABASE_SERVICE_KEY
# 任意: PROSPECT_CHAMPIONS(カンマ区切りで対象を直接指定), PROSPECT_LIMIT,
#       PROSPECT_PER_CHAMP, PROSPECT_MIN_SEC, PROSPECT_MAX_SEC
# ============================================================
import json
import os
import re
import subprocess
import sys
import time
import urllib.request, urllib.error

from notify import notify, COLOR_INFO

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
# シークレット名は環境によって揺れるため、候補を順に拾う
SUPABASE_KEY = (
    os.environ.get("SUPABASE_SERVICE_KEY")
    or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("SUPABASE_KEY")
    or ""
).strip()
if not SUPABASE_KEY:
    sys.exit("❌ Supabaseのキーが未設定です。GitHubのSecretsを確認してください。")

# 1回の実行で扱うチャンピオン数と、1体あたりに登録する動画数
LIMIT = int(os.environ.get("PROSPECT_LIMIT", "3"))
PER_CHAMP = int(os.environ.get("PROSPECT_PER_CHAMP", "1"))

# 解析待ちがこの本数を超えていたら、今回の発掘は見送る。
# youtube ジョブは30分おきに最大3本（=1日最大144本）しか処理できないため、
# 積みすぎるとGeminiの日次上限に当たる。
MAX_BACKLOG = int(os.environ.get("PROSPECT_MAX_BACKLOG", "20"))

# 短すぎるクリップと長すぎる配信アーカイブを避ける（既定: 4分〜60分）
MIN_SEC = int(os.environ.get("PROSPECT_MIN_SEC", "240"))
MAX_SEC = int(os.environ.get("PROSPECT_MAX_SEC", "3600"))

# 解析に失敗し続ける等の理由で登録したくない動画
BLACKLIST = {"juYeqA61oPI"}


def sb(method, path, body=None, prefer=None):
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", method=method)
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("Content-Type", "application/json")
    if prefer:
        req.add_header("Prefer", prefer)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data=data, timeout=60) as r:
            t = r.read().decode()
            return json.loads(t) if t else None
    except urllib.error.HTTPError as e:
        if e.code == 401:
            sys.exit("❌ Supabaseに認証拒否されました (401)。GitHubのSecretのキーを確認してください。")
        raise


def fetch_champions():
    """DDragon から現行のチャンピオン一覧を取得する"""
    try:
        with urllib.request.urlopen(
            "https://ddragon.leagueoflegends.com/api/versions.json", timeout=20
        ) as r:
            latest = json.loads(r.read().decode())[0]
        with urllib.request.urlopen(
            f"https://ddragon.leagueoflegends.com/cdn/{latest}/data/ja_JP/champion.json",
            timeout=20,
        ) as r:
            data = json.loads(r.read().decode()).get("data", {})
        return list(data.keys()), latest
    except Exception as e:
        print(f"チャンピオン一覧の取得に失敗: {e}", file=sys.stderr)
        return [], ""


def pick_targets(champs):
    """辞典の更新が古いチャンピオンから選ぶ（未登録を最優先）"""
    manual = os.environ.get("PROSPECT_CHAMPIONS", "").strip()
    if manual:
        wanted = [c.strip() for c in manual.split(",") if c.strip()]
        return [c for c in champs if c in wanted] or wanted

    rows = sb("GET", "champion_facts?select=champion,updated_at") or []
    updated = {str(r.get("champion") or "").lower(): (r.get("updated_at") or "") for r in rows}
    # 未登録は空文字になるため、昇順で自然に先頭へ来る
    return sorted(champs, key=lambda c: updated.get(c.lower(), ""))[:LIMIT]


def known_video_ids():
    """既にキューにある動画IDは再登録しない"""
    rows = sb("GET", "youtube_queue?select=id") or []
    return {str(r["id"]) for r in rows}


def pending_count():
    """
    未解析のまま溜まっている本数。

    発掘そのものはGeminiを使わないが、積んだ動画は youtube ジョブが
    1本につきGemini 1回で解析する。解析が追いつかないまま積み続けると
    APIの日次上限を圧迫するため、滞留していたら発掘を見送る。
    """
    rows = sb("GET", "youtube_queue?select=id&status=eq.pending") or []
    return len(rows)


def search_videos(query, want):
    """
    yt-dlp の検索で動画を探す。
    旧版はYouTubeの検索結果HTMLを正規表現で拾っていたが、HTML構造が変わると
    無言で0件になるため、公式に検索を扱える yt-dlp に置き換えた。
    """
    # 尺で弾く分を見越して多めに取得する
    n = max(want * 5, 10)
    cmd = [
        "yt-dlp", f"ytsearch{n}:{query}",
        "--flat-playlist", "--skip-download",
        "--print", "%(id)s\t%(title)s\t%(channel)s\t%(duration)s",
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    except subprocess.TimeoutExpired:
        print(f"  検索がタイムアウトしました: {query}", file=sys.stderr)
        return []

    out = []
    for line in (res.stdout or "").splitlines():
        parts = line.split("\t")
        if len(parts) < 4:
            continue
        vid, title, channel, dur = parts[0], parts[1], parts[2], parts[3]
        if not re.fullmatch(r"[A-Za-z0-9_-]{11}", vid):
            continue
        try:
            duration = int(float(dur))
        except (TypeError, ValueError):
            duration = 0
        # 尺が取れない動画(配信中など)は避ける
        if duration <= 0 or not (MIN_SEC <= duration <= MAX_SEC):
            continue
        out.append({"id": vid, "title": title, "channel": channel, "duration": duration})
    return out


def main() -> int:
    champs, patch = fetch_champions()
    if not champs:
        print("チャンピオン一覧を取得できませんでした。")
        return 1

    # 解析待ちが溜まっていたら今回は積まない（APIの日次上限を守るため）
    backlog = pending_count()
    if backlog >= MAX_BACKLOG:
        print(f"解析待ちが{backlog}本あるため、今回の発掘は見送ります（上限 {MAX_BACKLOG}本）。")
        print("youtube ジョブが処理を進めれば、次回から自動的に再開します。")
        return 0
    print(f"解析待ち: {backlog}本 / 上限 {MAX_BACKLOG}本")

    targets = pick_targets(champs)
    if not targets:
        print("対象のチャンピオンがありません。")
        return 0

    print(f"対象 {len(targets)}体 (パッチ {patch}): {', '.join(targets)}")
    known = known_video_ids()
    added = 0
    registered = []  # 通知用

    for champ in targets:
        # パッチ番号は "15.14.1" のような形式なので、検索語には上2桁までを使う
        short_patch = ".".join(patch.split(".")[:2]) if patch else ""
        query = f"LoL {champ} guide {short_patch}".strip()
        print(f"▶ 検索: {query}")

        picked = 0
        for v in search_videos(query, PER_CHAMP):
            if picked >= PER_CHAMP:
                break
            if v["id"] in known or v["id"] in BLACKLIST:
                continue

            try:
                sb("POST", "youtube_queue", [{
                    "id": v["id"],
                    "title": v["title"][:300],
                    "channel_name": (v["channel"] or "Unknown")[:200],
                    "url": f"https://www.youtube.com/watch?v={v['id']}",
                    "status": "pending",
                    "retry_count": 0,
                    "duration_sec": v["duration"],
                    "date_added": int(time.time()),
                }], prefer="return=minimal")
            except Exception as e:
                print(f"  登録に失敗 ({v['id']}): {e}", file=sys.stderr)
                continue

            known.add(v["id"])
            picked += 1
            added += 1
            registered.append(f"{champ}: {v['title'][:50]}（{v['duration'] // 60}分）")
            print(f"  ✅ 登録: {v['title'][:60]} ({v['duration'] // 60}分)")

        if picked == 0:
            print("  条件に合う新しい動画は見つかりませんでした。")

    print(f"\n合計 {added}本をキューに追加しました。解析は youtube ジョブが順次進めます。")

    # 積んだ動画があればDiscordへ通知する
    if registered:
        notify(
            "🔭 動画の自動発掘",
            [f"**{added}本**をキューに追加しました。順次解析されます。", ""] + [f"・{r}" for r in registered],
            color=COLOR_INFO,
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
