import os
import requests
from dotenv import load_dotenv

# プロジェクトルートの.envを読み込む
load_dotenv(dotenv_path="d:/my_work/.env")

def register_command():
    token = os.getenv("DISCORD_BOT_TOKEN")
    guild_id = os.getenv("KTM_GUILD_ID")

    if not token or not guild_id:
        print("[ERROR] .env に必要な DISCORD_BOT_TOKEN または KTM_GUILD_ID が設定されていません。")
        return

    headers = {
        "Authorization": f"Bot {token}",
        "Content-Type": "application/json"
    }

    # 1. @me エンドポイントから Application ID (Client ID) を自動取得
    print("[INFO] Discord API から Bot 情報を取得中...")
    me_res = requests.get("https://discord.com/api/v10/users/@me", headers=headers)
    if me_res.status_code != 200:
        print(f"[ERROR] Bot情報の取得に失敗しました (ステータス: {me_res.status_code})")
        print(me_res.text)
        return

    bot_info = me_res.json()
    app_id = bot_info.get("id")
    print(f"[INFO] Application ID を自動検出しました: {app_id}")

    # 2. スラッシュコマンド /memo をギルドに追加登録
    url = f"https://discord.com/api/v10/applications/{app_id}/guilds/{guild_id}/commands"

    command_data = {
        "name": "memo",
        "description": "テキストやURLをパーソナル・ナレッジベースに保存します",
        "options": [
            {
                "name": "content",
                "description": "保存したいメモテキスト、またはWebサイトのURL",
                "type": 3,  # STRING
                "required": True
            }
        ]
    }

    print(f"[INFO] Discord Bot に /memo コマンドを登録中 (Guild: {guild_id})...")
    r = requests.post(url, headers=headers, json=command_data)

    if r.status_code in [200, 201]:
        print("[SUCCESS] コマンド登録に成功しました！")
        print(r.json())
    else:
        print(f"[ERROR] コマンド登録に失敗しました (ステータスコード: {r.status_code})")
        print(r.text)

if __name__ == "__main__":
    register_command()
