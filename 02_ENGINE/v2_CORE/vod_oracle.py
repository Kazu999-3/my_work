import os
import logging
import time
from pathlib import Path
import subprocess
from google import genai
from google.genai import types

logger = logging.getLogger("VODOracle")

class VODOracle:
    """
    【視覚メタ学習】VOD Oracle モジュール
    YouTube等にあるプロプレイヤーのVOD（リプレイ動画）をダウンロードし、
    Gemini 1.5 Pro のネイティブ動画理解能力を用いてマクロ戦略（ワード位置、クリア時間）を抽出する。
    """
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None
            
        self.download_dir = Path("D:/my_work/03_FACTORY/vods")
        self.download_dir.mkdir(parents=True, exist_ok=True)

    def download_vod(self, url: str) -> Path:
        """yt-dlpを使って低解像度で動画をダウンロードする（解析用なので画質は最低限でOK）"""
        logger.info(f"📥 VODをダウンロード中: {url}")
        # 動画IDをファイル名にするため、URLからIDを推測するか一意の名前をつける
        output_path = self.download_dir / "target_vod.mp4"
        
        if output_path.exists():
            output_path.unlink() # 既存のファイルを削除
            
        # 最も解像度が低く、容量が軽いフォーマットを選択
        cmd = [
            "yt-dlp",
            url,
            "-f", "worstvideo[ext=mp4]+worstaudio[ext=m4a]/worst[ext=mp4]/worst",
            "-o", str(output_path)
        ]
        
        try:
            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            logger.info("VODのダウンロードが完了しました。")
            return output_path
        except Exception as e:
            logger.error(f"VODのダウンロードに失敗しました: {e}")
            return None

    def analyze_vod(self, video_path: Path):
        """Gemini 1.5 Pro に動画をアップロードし、メタ情報を視覚的に解析させる"""
        if not self.client:
            logger.error("Gemini API Key missing.")
            return None

        logger.info(f"👁️ Gemini File API へ動画をアップロード中... ({video_path.stat().st_size / 1024 / 1024:.1f} MB)")
        try:
            # 動画ファイルをアップロード
            uploaded_file = self.client.files.upload(file=str(video_path))
            logger.info(f"アップロード完了。File URI: {uploaded_file.uri}")

            # 動画の処理完了（ACTIVE状態）を待つ
            logger.info("動画のプロセッシング完了を待機しています...")
            while uploaded_file.state.name == "PROCESSING":
                time.sleep(10)
                uploaded_file = self.client.files.get(name=uploaded_file.name)
            
            if uploaded_file.state.name == "FAILED":
                logger.error("動画のプロセッシングに失敗しました。")
                return None

            logger.info("🧠 動画解析を開始します...")
            
            prompt = """
            このLeague of Legendsのリプレイ動画を解析し、以下の3つのマクロ戦略データを抽出してください。
            1. **最初のジャングルフルクリア時間**: ゲーム内時間の何分何秒に最初のクリアが終わったか。
            2. **キーとなるワード位置**: ゲーム序盤（5分以内）に、プレイヤーがどこにワードを置いたか（例: 敵のラプター前、トップ川のブッシュ）。
            3. **最初のガンク先**: 最初にガンクしたレーン（Top/Mid/Bot）と、その成否。
            
            具体的な事実のみを簡潔な箇条書きで答えてください。
            """
            
            # 視覚と推論能力の高い 1.5 Pro を使用
            response = self.client.models.generate_content(
                model='gemini-1.5-pro',
                contents=[
                    uploaded_file,
                    prompt
                ],
                config=types.GenerateContentConfig(
                    temperature=0.2
                )
            )
            
            logger.info("✅ VOD視覚解析が完了しました！")
            logger.info(f"抽出結果:\n{response.text}")
            
            # API容量節約のため、解析後はクラウド上の動画ファイルを削除
            self.client.files.delete(name=uploaded_file.name)
            if video_path.exists():
                video_path.unlink() # ローカルファイルも削除
                
            return response.text
            
        except Exception as e:
            logger.error(f"動画解析中にエラーが発生しました: {e}")
            return None

    def auto_hunt_and_analyze(self):
        """自動で『Challenger Replay』の最新動画を検索・取得し、解析を行う"""
        logger.info("🔍 自動検索: 最新の Challenger Replay を探しています...")
        cmd = [
            "yt-dlp",
            "ytsearch1:Challenger Replay League of Legends 最新パッチ",
            "--get-id"
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            video_id = result.stdout.strip()
            if not video_id:
                logger.warning("対象の動画が見つかりませんでした。")
                return None
                
            url = f"https://www.youtube.com/watch?v={video_id}"
            logger.info(f"🎯 最新のChallenger Replayを発見: {url}")
            
            video_path = self.download_vod(url)
            if video_path:
                analysis = self.analyze_vod(video_path)
                return analysis
        except Exception as e:
            logger.error(f"自動VOD検索・解析中にエラー: {e}")
            return None

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    # テスト用（短い動画でテスト推奨）
    # oracle = VODOracle()
    # path = oracle.download_vod("https://www.youtube.com/watch?v=XXXXXXX")
    # if path:
    #     oracle.analyze_vod(path)
