# ============================================================
# プリフライト環境変数・サービス接続チェック (check_env.py)
#
# クラウドワーカー (GitHub Actions) やローカル実行時の事前チェック。
# 必須環境変数と Supabase 認証の疎通を検証し、401 / 未設定エラーを事前検知。
# ============================================================
import json
import os
import sys
import urllib.request


def check_env():
    print("🔍 [check_env] プリフライト環境変数・接続診断を開始します...")
    has_error = False

    # 1. 必須環境変数チェック
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if not supabase_url:
        print("❌ [ERROR] SUPABASE_URL が未設定です。")
        has_error = True
    else:
        print(f"  ✅ SUPABASE_URL: {supabase_url[:25]}...")

    supabase_key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_SERVICE_KEY")
        or os.environ.get("SUPABASE_KEY")
    )
    if not supabase_key:
        print("❌ [ERROR] SUPABASE_SERVICE_ROLE_KEY (または SUPABASE_SERVICE_KEY / SUPABASE_KEY) が未設定です。")
        has_error = True
    else:
        print(f"  ✅ Supabase Key 解決成功 ({supabase_key[:10]}...)")

    # 2. 任意/警告レベル環境変数チェック
    discord_webhook = os.environ.get("DISCORD_WEBHOOK", "").strip()
    if not discord_webhook:
        print("  ⚠️ [WARN] DISCORD_WEBHOOK が未設定です（Discord通知はスキップされます）。")
    else:
        print("  ✅ DISCORD_WEBHOOK: 設定済み")

    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not gemini_key:
        print("  ⚠️ [WARN] GEMINI_API_KEY が未設定です（AI機能はスキップされます）。")
    else:
        print("  ✅ GEMINI_API_KEY: 設定済み")

    if has_error:
        print("\n❌ 必須環境変数が不足しています。処理を中止します。")
        sys.exit(1)

    # 3. Supabase REST API 疎通・認証チェック
    print("\n🌐 Supabase API 疎通テストを実行中...")
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
    }
    test_endpoint = f"{supabase_url}/rest/v1/matchup_sentinel?select=matchup_id&limit=1"

    try:
        req = urllib.request.Request(test_endpoint, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as res:
            if res.status == 200:
                print("  ✅ Supabase 認証・疎通成功 (Status 200 OK)")
            else:
                print(f"❌ [ERROR] Supabase 返答ステータス異常: {res.status}")
                sys.exit(1)
    except urllib.error.HTTPError as e:
        print(f"❌ [ERROR] Supabase 認証失敗 (HTTP {e.code}): {e.reason}")
        if e.code == 401:
            print("   👉 原因: Supabase サービスロールキーが無効または間違っています。")
            print("   👉 対策: GitHub Secrets / .env の SUPABASE_SERVICE_ROLE_KEY を確認してください。")
        sys.exit(1)
    except Exception as e:
        print(f"❌ [ERROR] Supabase 接続エラー: {e}")
        sys.exit(1)

    print("\n🎉 プリフライト診断が正常にクリアされました！\n")
    return 0


if __name__ == "__main__":
    sys.exit(check_env())
