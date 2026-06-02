import requests
import logging
from .settings import settings

logger = logging.getLogger("GASGateway")

class GASGateway:
    """
    Antigravity Sovereign OS: GAS Gateway
    Google Apps Script (KTM Bot) の API エンドポイントと通信するためのゲートウェイ。
    """
    def __init__(self):
        self.url = settings.GAS_DEPLOYMENT_URL
        # 必要に応じて認証用のシークレットを settings に追加する設計
        self.secret = settings.ANTIGRAVITY_API_KEY

    def call(self, payload: dict):
        """GAS API を呼び出す共通メソッド"""
        if not self.url:
            logger.error("[GAS] GAS_DEPLOYMENT_URL が設定されていないため、通信できません。")
            return None
        
        try:
            # タイムアウトは解析待ちなどを考慮して少し長めに設定
            response = requests.post(self.url, json=payload, timeout=60)
            response.raise_for_status()
            try:
                return response.json()
            except Exception as json_err:
                logger.error(f"[GAS] JSON パースエラー: {json_err} | Response: {response.text[:200]}")
                return None
        except Exception as e:
            logger.error(f"[GAS] API 呼び出しエラー: {e}")
            return None

    def get_youtube_tasks(self):
        """プレイリスト内の未処理動画リストを取得"""
        res = self.call({"type": "YOUTUBE_GET_TASKS"})
        if res and res.get("status") == "SUCCESS":
            return res.get("tasks", [])
        return []

    def remove_youtube_item(self, playlist_item_id: str):
        """処理完了した動画をプレイリストから削除"""
        res = self.call({
            "type": "YOUTUBE_REMOVE_ITEM",
            "playlistItemId": playlist_item_id
        })
        return res and res.get("status") == "SUCCESS"

# インスタンス提供
gas_gateway = GASGateway()
