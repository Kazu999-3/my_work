import os
from googleapiclient.discovery import build
from auth import get_authenticated_service
from youtube_transcript_api import YouTubeTranscriptApi

class YouTubeManager:
    def __init__(self):
        self.creds = get_authenticated_service()
        self.youtube = build('youtube', 'v3', credentials=self.creds)

    def get_playlist_items(self, playlist_id):
        """指定したプレイリストの全アイテムを取得（最大50件ずつループ）"""
        items = []
        next_page_token = None
        
        while True:
            request = self.youtube.playlistItems().list(
                part="snippet,status,contentDetails",
                playlistId=playlist_id,
                maxResults=50,
                pageToken=next_page_token
            )
            response = request.execute()
            items.extend(response.get('items', []))
            
            next_page_token = response.get('nextPageToken')
            if not next_page_token:
                break
        return items

    def is_unavailable(self, item):
        """動画が見れなくなっているかチェック（削除、非公開など）"""
        privacy_status = item.get('status', {}).get('privacyStatus')
        video_id = item.get('contentDetails', {}).get('videoId')
        title = item.get('snippet', {}).get('title')
        
        # タイトルが「削除された動画」や「非公開動画」の場合も不適切と判断
        if privacy_status in ['deleted', 'private']:
            return True
        if "削除された動画" in title or "非公開動画" in title:
            return True
        return False

    def move_video(self, item_id, target_playlist_id):
        """動画を指定のプレイリストに移動（追加して、元のリストから消す）"""
        video_id = item_id['contentDetails']['videoId']
        
        # 1. ターゲットに追加
        self.youtube.playlistItems().insert(
            part="snippet",
            body={
                "snippet": {
                    "playlistId": target_playlist_id,
                    "resourceId": {
                        "kind": "youtube#video",
                        "videoId": video_id
                    }
                }
            }
        ).execute()
        
        # 2. 元のアイテム（playlistItem）を削除
        self.youtube.playlistItems().delete(id=item_id['id']).execute()

    def remove_item(self, item_id):
        """アイテムを削除"""
        self.youtube.playlistItems().delete(id=item_id).execute()

    def find_or_create_playlist(self, title):
        """タイトルでプレイリストを探し、なければ作成する"""
        request = self.youtube.playlists().list(
            part="snippet",
            mine=True,
            maxResults=50
        )
        response = request.execute()
        for item in response.get('items', []):
            if item['snippet']['title'] == title:
                return item['id']
        
        # 作成
        new_playlist = self.youtube.playlists().insert(
            part="snippet",
            body={
                "snippet": {
                    "title": title
                }
            }
        ).execute()
        return new_playlist['id']

    def get_video_transcript(self, video_id):
        """動画の文字起こしテキストを取得。失敗した場合は空文字を返す。"""
        try:
            # 1.2.4系ではインスタンス化してlistを使用
            api = YouTubeTranscriptApi()
            transcript_list = api.list(video_id)
            
            # 日本語、または英語の生成済み字幕を探す
            try:
                transcript = transcript_list.find_transcript(['ja', 'en'])
            except:
                # 見つからない場合は生成済みから探す
                transcript = transcript_list.find_generated_transcript(['ja', 'en'])
            
            # text = " ".join([t['text'] for t in transcript.fetch()])
            # 1.2.4系ではオブジェクトの属性(text)にアクセス
            text = " ".join([t.text for t in transcript.fetch()])
            return text
        except Exception as e:
            print(f"Warning: Could not get transcript for {video_id}: {e}")
            return ""

    def list_all_playlists(self):
        """ユーザーが所有する全てのプレイリストをリストアップ"""
        request = self.youtube.playlists().list(
            part="snippet,contentDetails",
            mine=True,
            maxResults=50
        )
        response = request.execute()
        playlists = response.get('items', [])
        for p in playlists:
            print(f"Title: {p['snippet']['title']}, ID: {p['id']}, Items: {p['contentDetails']['itemCount']}")
        return playlists

if __name__ == '__main__':
    manager = YouTubeManager()
    print("Available Playlists:")
    manager.list_all_playlists()
