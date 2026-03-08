import os
import base64
from dotenv import load_dotenv

def generate_user_install_url():
    # .env から TOKEN を読み込み
    load_dotenv(r"d:\my_work\apps\hybrid_bot\.env")
    token = os.getenv('DISCORD_BOT_TOKEN')
    
    if not token:
        print("エラー: DISCORD_BOT_TOKEN が見つかりません。")
        return

    try:
        # トークンの最初の部分（Client ID）をデコード
        client_id_b64 = token.split('.')[0]
        # パディングを調整してデコード
        client_id = base64.b64decode(client_id_b64 + '==' if len(client_id_b64) % 4 != 0 else client_id_b64).decode('utf-8')
        
        print("\n--- アンちゃん専用 ユーザーインストールURL ---")
        print(f"https://discord.com/api/oauth2/authorize?client_id={client_id}&scope=applications.commands&integration_type=1")
        print("-------------------------------------------\n")
        print("💡 手順:")
        print("1. 上記URLをブラウザで開きます。")
        print("2. 自分のアカウントに対して「アンちゃん」をインストール（認可）してください。")
        print("3. これで、プロフィールやDMのどこでもコマンドが出るようになります！\n")
    except Exception as e:
        print(f"エラーが発生しました: {e}")

if __name__ == "__main__":
    generate_user_install_url()
