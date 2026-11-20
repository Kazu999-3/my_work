#!/usr/bin/env python3
"""SPEC 08: 解析不可動画の自動プレイリスト退避＆クローズ

技術的に解析できない動画（終端エラー: error_generation, error_no_transcript, failed）を、
人の操作なしで「手動確認用プレイリスト」へ退避し、追加成功したものだけ manually_closed に更新する。

安全設計:
1. 対象ステータスは error_generation / error_no_transcript / failed の3種のみ。
2. 追加に失敗した動画はステータスを変えず次回サイクルで再試行（取りこぼして消さない）。
3. ON/OFF スイッチ: AUTO_CLOSE_UNANALYZABLE（既定は OFF）。
4. ドライランモード: --dry-run または AUTO_CLOSE_DRY_RUN=1 で件数・一覧を出力するのみ。
"""

import os
import sys
import json
import urllib.request
import urllib.error
from typing import List, Dict, Any, Tuple

# 終端エラーステータスの厳格な定義
TERMINAL_ERROR_STATUSES = ("error_generation", "error_no_transcript", "failed")

def get_supabase_client():
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    return url, key

def fetch_terminal_error_videos(limit: int = 100) -> List[Dict[str, Any]]:
    """DBから終端エラーの動画一覧を取得（対象ステータス3種のみ）"""
    sb_url, sb_key = get_supabase_client()
    if not sb_url or not sb_key:
        print("⚠️ [auto_close] Supabase設定が見つかりません。", file=sys.stderr)
        return []

    statuses_param = ",".join(TERMINAL_ERROR_STATUSES)
    endpoint = (
        f"{sb_url}/rest/v1/youtube_queue"
        f"?status=in.({statuses_param})"
        f"&order=date_added.asc"
        f"&limit={limit}"
        f"&select=id,title,status,url,retry_count,channel_name,date_added"
    )

    req = urllib.request.Request(
        endpoint,
        headers={
            "apikey": sb_key,
            "Authorization": f"Bearer {sb_key}",
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return json.loads(res.read().decode("utf-8"))
    except Exception as e:
        print(f"⚠️ [auto_close] 終端エラー動画の取得失敗: {e}", file=sys.stderr)
        return []

def get_youtube_access_token() -> str | None:
    """OAuth リフレッシュトークンから動的にアクセストークンを発行（既存互換）"""
    client_id = os.environ.get("YOUTUBE_OAUTH_CLIENT_ID")
    client_secret = os.environ.get("YOUTUBE_OAUTH_CLIENT_SECRET")
    refresh_token = os.environ.get("YOUTUBE_OAUTH_REFRESH_TOKEN")

    if not client_id or not client_secret or not refresh_token:
        return None

    try:
        data = urllib.parse.urlencode({
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }).encode("utf-8")

        req = urllib.request.Request("https://oauth2.googleapis.com/token", data=data)
        with urllib.request.urlopen(req, timeout=15) as res:
            body = json.loads(res.read().decode("utf-8"))
            return body.get("access_token")
    except Exception as e:
        print(f"⚠️ [auto_close] YouTube OAuth トークン更新エラー: {e}", file=sys.stderr)
        return None

def add_video_to_playlist(video_id: str, playlist_id: str, access_token: str) -> Tuple[bool, str]:
    """YouTube Data API v3 playlistItems.insert を実行。重複時は成功扱い"""
    url = "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet"
    payload = json.dumps({
        "snippet": {
            "playlistId": playlist_id,
            "resourceId": {
                "kind": "youtube#video",
                "videoId": video_id,
            }
        }
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return True, "追加成功"
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        # 重複追加（videoAlreadyInPlaylist / 409）は追加済みとして成功扱い
        if "videoAlreadyInPlaylist" in err_body or "already exists" in err_body or e.code == 409:
            return True, "既にプレイリストに存在（成功扱い）"
        return False, f"HTTP {e.code}: {err_body[:120]}"
    except Exception as e:
        return False, str(e)

def add_via_portal_api(video_id: str, playlist_id: str) -> Tuple[bool, str]:
    """ポータルの既存 API (/api/youtube/playlist/add) を経由して追加を試みる"""
    portal_url = os.environ.get("PORTAL_URL", "https://ktm-portal.pages.dev").rstrip("/")
    api_url = f"{portal_url}/api/youtube/playlist/add"

    payload = json.dumps({
        "videoId": video_id,
        "playlistId": playlist_id,
    }).encode("utf-8")

    req = urllib.request.Request(
        api_url,
        data=payload,
        headers={"Content-Type": "application/json"}
    )

    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            data = json.loads(res.read().decode("utf-8"))
            if data.get("success") or data.get("alreadyInPlaylist"):
                return True, "ポータルAPI経由で追加成功"
            return False, data.get("error") or "不明なエラー"
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        if "videoAlreadyInPlaylist" in err_body or e.code == 409:
            return True, "既にプレイリストに存在（成功扱い）"
        return False, f"Portal API HTTP {e.code}: {err_body[:100]}"
    except Exception as e:
        return False, f"Portal API通信エラー: {e}"

def update_video_status_to_closed(video_ids: List[str]) -> int:
    """追加成功した動画のみ manually_closed に更新"""
    if not video_ids:
        return 0

    sb_url, sb_key = get_supabase_client()
    if not sb_url or not sb_key:
        return 0

    ids_param = ",".join(video_ids)
    endpoint = f"{sb_url}/rest/v1/youtube_queue?id=in.({ids_param})"

    req = urllib.request.Request(
        endpoint,
        data=json.dumps({"status": "manually_closed"}).encode("utf-8"),
        headers={
            "apikey": sb_key,
            "Authorization": f"Bearer {sb_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        method="PATCH"
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return len(video_ids)
    except Exception as e:
        print(f"⚠️ [auto_close] ステータス更新エラー: {e}", file=sys.stderr)
        return 0

def run_auto_close_cycle(dry_run: bool = False) -> Dict[str, Any]:
    """自動退避処理のメイン実行サイクル"""
    # ON/OFF スイッチ（環境変数 AUTO_CLOSE_UNANALYZABLE、既定 OFF）
    is_enabled = os.environ.get("AUTO_CLOSE_UNANALYZABLE", "0").lower() in ("1", "true", "yes")
    env_dry_run = os.environ.get("AUTO_CLOSE_DRY_RUN", "0").lower() in ("1", "true", "yes")
    effective_dry_run = dry_run or env_dry_run

    # 1. 終端エラー動画を取得
    items = fetch_terminal_error_videos(limit=100)
    total_count = len(items)

    counts_by_status = {}
    for it in items:
        st = it.get("status", "unknown")
        counts_by_status[st] = counts_by_status.get(st, 0) + 1

    report = {
        "enabled": is_enabled,
        "dry_run": effective_dry_run,
        "total_terminal_errors": total_count,
        "breakdown": counts_by_status,
        "items": items,
        "closed_count": 0,
        "failed_count": 0,
        "skipped_reason": None,
    }

    if total_count == 0:
        return report

    # スイッチが OFF かつ ドライランでない場合は安全にスキップ
    if not is_enabled and not effective_dry_run:
        report["skipped_reason"] = "AUTO_CLOSE_UNANALYZABLE is OFF"
        return report

    # 2. ドライランモード（出力のみ、副作用なし）
    if effective_dry_run:
        print("=" * 60)
        print("🔍 [SPEC 08 ドライラン] 解析不可動画（終端エラー）の自動退避対象一覧")
        print("=" * 60)
        print(f"対象件数: {total_count}件 (内訳: {counts_by_status})")
        for i, it in enumerate(items, 1):
            vid = it.get("id")
            title = it.get("title", "(無題)")
            status = it.get("status")
            print(f"  {i}. [{status}] {vid}: {title}")
        print("=" * 60)
        print("※ ドライランのため、プレイリスト追加およびクローズ処理は実行されませんでした。")
        return report

    # 3. 本番実行モード（追加成功したものだけ manually_closed に更新）
    playlist_id = (
        os.environ.get("YOUTUBE_MANUAL_REVIEW_PLAYLIST_ID")
        or os.environ.get("YOUTUBE_TARGET_PLAYLIST_ID")
        or "PLPiEXmmDzgcs"
    )

    access_token = get_youtube_access_token()
    successful_ids = []
    failed_items = []

    for it in items:
        vid = it.get("id")
        title = it.get("title", vid)
        ok = False
        reason = ""

        # 直接 OAuth 経由
        if access_token:
            ok, reason = add_video_to_playlist(vid, playlist_id, access_token)
        else:
            # ポータル API 経由
            ok, reason = add_via_portal_api(vid, playlist_id)

        if ok:
            successful_ids.append(vid)
            print(f"  ✅ プレイリスト退避成功: {title} ({vid}) - {reason}")
        else:
            failed_items.append((vid, title, reason))
            print(f"  ❌ プレイリスト退避失敗: {title} ({vid}) - {reason}", file=sys.stderr)

    # 成功したものだけをクローズ
    closed_count = 0
    if successful_ids:
        closed_count = update_video_status_to_closed(successful_ids)
        print(f"🔒 {closed_count}件の動画を manually_closed にクローズしました。")

    report["closed_count"] = closed_count
    report["failed_count"] = len(failed_items)
    report["failed_details"] = failed_items

    return report

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv("05_PILOT/.env.local")
    load_dotenv(".env")

    is_dry = "--dry-run" in sys.argv or "-n" in sys.argv
    res = run_auto_close_cycle(dry_run=is_dry)
    if not is_dry and not res["enabled"]:
        print(f"ℹ️ AUTO_CLOSE_UNANALYZABLE is OFF. ドライランを実行するには --dry-run を付けてください。")
