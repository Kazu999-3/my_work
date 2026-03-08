import os
import pickle
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

# 必要な権限（スコープ）の設定
SCOPES = [
    'https://www.googleapis.com/auth/youtube.force-ssl', # YouTube操作
    'https://www.googleapis.com/auth/spreadsheets',      # スプレッドシート操作
    'https://www.googleapis.com/auth/drive.file'          # ドライブ内のファイル作成
]

def get_authenticated_service():
    creds = None
    # auth.pyのあるディレクトリ（src）を取得
    base_dir = os.path.dirname(os.path.abspath(__file__))
    # configディレクトリへのパス (srcの親ディレクトリのconfig)
    config_dir = os.path.join(base_dir, '..', 'config')
    
    token_path = os.path.join(config_dir, 'token.pickle')
    secrets_path = os.path.join(config_dir, 'client_secrets.json')

    if os.path.exists(token_path):
        with open(token_path, 'rb') as token:
            creds = pickle.load(token)
    
    # 認証情報がない、または無効な場合は再認証
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(secrets_path, SCOPES)
            # ローカルサーバーを起動して認証
            creds = flow.run_local_server(port=0)
        
        # 次回のために認証情報を保存
        with open(token_path, 'wb') as token:
            pickle.dump(creds, token)

    return creds

if __name__ == '__main__':
    # 動作確認：認証情報の取得をテスト
    try:
        credentials = get_authenticated_service()
        print("Successfully authenticated!")
    except Exception as e:
        print(f"Authentication failed: {e}")
