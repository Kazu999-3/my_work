#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/setup_youtube_oauth.py - YouTube OAuth 2.0 リフレッシュトークン取得ヘルパー

【目的】
SPEC 08（解析不可動画の自動退避＆クローズ）に必要な YouTube Data API の
OAuth 認証情報（リフレッシュトークン）をローカルで安全に取得し、.env へ設定します。

【機密保護規則】
- 取得した refresh_token は Git、DAILY_LOG、チャット、公開ファイルに絶対に書き出さないこと。
- .env は .gitignore 済みであることを確認済み。
"""

import os
import sys
import json
import webbrowser
import urllib.parse
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from dotenv import load_dotenv

PORT = 8088
REDIRECT_URI = f"http://localhost:{PORT}/callback"
SCOPES = "https://www.googleapis.com/auth/youtube"

auth_code = None
auth_error = None

class OAuthCallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        global auth_code, auth_error
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/callback":
            params = urllib.parse.parse_qs(parsed.query)
            if "code" in params:
                auth_code = params["code"][0]
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                html = """
                <html>
                <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                    <h2 style="color: #10b981;">✅ 認証に成功しました！</h2>
                    <p>Google からの認可コードを正常に受け取りました。</p>
                    <p>このタブ・ブラウザは閉じて、ターミナル（コンソール）へお戻りください。</p>
                </body>
                </html>
                """
                self.wfile.write(html.encode("utf-8"))
            else:
                auth_error = params.get("error", ["不明なエラー"])[0]
                self.send_response(400)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                html = f"""
                <html>
                <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                    <h2 style="color: #ef4444;">❌ 認証が拒否または失敗しました</h2>
                    <p>エラー: {auth_error}</p>
                </body>
                </html>
                """
                self.wfile.write(html.encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # アクセスログを抑制

def get_oauth_tokens(client_id: str, client_secret: str, code: str) -> dict:
    url = "https://oauth2.googleapis.com/token"
    payload = urllib.parse.urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": REDIRECT_URI,
    }).encode("utf-8")

    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        print(f"❌ トークン交換失敗 (HTTP {e.code}): {err_body}", file=sys.stderr)
        return {}
    except Exception as e:
        print(f"❌ 通信エラー: {e}", file=sys.stderr)
        return {}

def update_env_file(client_id: str, client_secret: str, refresh_token: str):
    env_path = Path(".env")
    existing_lines = []
    if env_path.exists():
        existing_lines = env_path.read_text(encoding="utf-8", errors="ignore").splitlines()

    new_lines = []
    keys_to_set = {
        "YOUTUBE_OAUTH_CLIENT_ID": client_id,
        "YOUTUBE_OAUTH_CLIENT_SECRET": client_secret,
        "YOUTUBE_OAUTH_REFRESH_TOKEN": refresh_token,
    }
    handled_keys = set()

    for line in existing_lines:
        matched = False
        for k in keys_to_set:
            if line.startswith(f"{k}="):
                new_lines.append(f"{k}={keys_to_set[k]}")
                handled_keys.add(k)
                matched = True
                break
        if not matched:
            new_lines.append(line)

    for k, v in keys_to_set.items():
        if k not in handled_keys:
            new_lines.append(f"{k}={v}")

    env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    print("✅ .env に YouTube OAuth 認証情報を安全に書き込みました。")

def main():
    load_dotenv(".env")
    client_id = os.environ.get("YOUTUBE_OAUTH_CLIENT_ID") or ""
    client_secret = os.environ.get("YOUTUBE_OAUTH_CLIENT_SECRET") or ""

    if len(sys.argv) >= 3:
        client_id = sys.argv[1].strip()
        client_secret = sys.argv[2].strip()

    if not client_id or not client_secret:
        print("=" * 60)
        print("🔐 YouTube OAuth 2.0 セットアップヘルパー")
        print("=" * 60)
        print("Google Cloud Console で作成した OAuth クライアント情報が必要です。")
        print("使用法: py -3 scripts/setup_youtube_oauth.py <CLIENT_ID> <CLIENT_SECRET>")
        print("または、.env に YOUTUBE_OAUTH_CLIENT_ID と YOUTUBE_OAUTH_CLIENT_SECRET を入力してから実行してください。")
        sys.exit(1)

    auth_params = urllib.parse.urlencode({
        "client_id": client_id,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",
        "prompt": "consent",
    })
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{auth_params}"

    server = HTTPServer(("localhost", PORT), OAuthCallbackHandler)
    print("=" * 60)
    print("🚀 ブラウザを開いて Google アカウントの認可を開始します...")
    print("※ 対象プレイリスト (PLPiEXmmDzgcs) を管理している YouTube アカウントを選択してください。")
    print("=" * 60)
    print(f"\n自動で開かない場合は、以下の URL をブラウザで開いてください:\n{auth_url}\n")

    webbrowser.open(auth_url)

    print(f"ローカルサーバー待機中 (http://localhost:{PORT}/callback)...")
    while auth_code is None and auth_error is None:
        server.handle_request()

    if auth_error:
        print(f"❌ 認可エラー: {auth_error}", file=sys.stderr)
        sys.exit(1)

    print("🔑 認可コードを取得しました。リフレッシュトークンと交換中...")
    token_data = get_oauth_tokens(client_id, client_secret, auth_code)
    refresh_token = token_data.get("refresh_token")

    if not refresh_token:
        print("⚠️ refresh_token が返されませんでした。", file=sys.stderr)
        print("既に認可済みの可能性があります。Google アカウント設定の『サードパーティ製アプリとサービス』から一度アクセス権を削除し、再実行してください。", file=sys.stderr)
        sys.exit(1)

    update_env_file(client_id, client_secret, refresh_token)
    print("=" * 60)
    print("🎉 セットアップ完了！")
    print("次のステップ: Vercel の Settings -> Environment Variables に以下を設定してください:")
    print("  - YOUTUBE_OAUTH_CLIENT_ID")
    print("  - YOUTUBE_OAUTH_CLIENT_SECRET")
    print("  - YOUTUBE_OAUTH_REFRESH_TOKEN")
    print("=" * 60)

if __name__ == "__main__":
    main()
