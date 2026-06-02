import os
import logging
from pathlib import Path
import asyncio
from google import genai
from google.genai import types
from v2_CORE.ai_helper import generate_content_safe
import edge_tts
from moviepy import AudioFileClip, ImageClip
import dotenv

dotenv.load_dotenv(Path("D:/my_work/.env"))
logging.basicConfig(level=logging.INFO, format="%(asctime)s [VideoForge] %(levelname)s: %(message)s")

class VideoForge:
    """
    Antigravity Sovereign OS: 動画自動生成エンジン (Video Forge)
    note原稿を読み込み、GeminiでShorts用台本に要約。
    その後、Edge TTSを用いて音声を生成し、静止画と合成してMP4を自動出力する。
    """
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY_FREE") or os.getenv("GEMINI_API_KEY")
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
            self.model_id = "gemini-2.5-flash"
        else:
            self.client = None

        self.voice = "ja-JP-NanamiNeural" # 高品質な日本語女性ボイス
        self.output_dir = Path("d:/my_work/02_FACTORY/PRODUCTS/VIDEOS")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.webhook_url = os.getenv("DISCORD_WEBHOOK")

    def notify_discord(self, message: str, color: int = 0x00ff00):
        """Discordへ進捗や完了報告を送信する"""
        if not self.webhook_url:
            return
        try:
            import requests
            payload = {
                "embeds": [{
                    "title": "🎬 Sovereign OS: Video Forge",
                    "description": message,
                    "color": color
                }]
            }
            requests.post(self.webhook_url, json=payload, timeout=5)
            logging.info("📢 Discordへ通知を送信しました。")
        except Exception as e:
            logging.error(f"❌ Discord通知エラー: {e}")

    def generate_script(self, markdown_content: str) -> str:
        """Markdown原稿から1分間のShorts用台本を生成する"""
        if not self.client:
            logging.error("APIキーがないため台本生成をスキップします。")
            return "これはテスト音声です。"

        logging.info("📜 原稿からYouTube Shorts用台本（約300文字）を生成中...")
        
        prompt = f"""
        あなたは超一流のYouTube Shortsクリエイターです。
        以下のnote記事（バイブル）の内容を要約し、1分以内（約300文字）で読み切れる
        「バズるShorts動画の台本」を作成してください。
        
        【条件】
        - 冒頭1秒で読者の興味を強烈に惹きつけるフックを入れる。
        - 途中はテンポよく解説する。
        - 最後は「詳細はプロフィールのリンク（またはnote）から！」というオチにする。
        - 読み上げるための「純粋なテキストのみ」を出力すること（記号やMarkdownは不要）。
        
        【元の記事】:
        {markdown_content[:2000]}...
        """
        
        try:
            response_text = generate_content_safe(
                self.client,
                prompt,
                self.model_id,
                config=types.GenerateContentConfig(temperature=0.7),
                feature_name="video_forge"
            )
            if not response_text or response_text.startswith("⚠️") or response_text.startswith("❌"):
                raise Exception("VideoForge AI generation failed")
            script = response_text.replace("*", "").replace("#", "")
            logging.info("✅ 台本の生成が完了しました。")
            return script
        except Exception as e:
            logging.error(f"❌ 台本生成中にエラー: {e}")
            return "エラーが発生したため、デフォルトの音声です。"

    async def generate_voice(self, text: str, output_path: Path):
        """Edge TTSで音声を生成する"""
        logging.info(f"🎙️ 音声データ（TTS）を生成中... ボイス: {self.voice}")
        communicate = edge_tts.Communicate(text, self.voice)
        await communicate.save(str(output_path))
        logging.info("✅ 音声生成が完了しました。")

    def assemble_video(self, audio_path: Path, output_mp4: Path):
        """音声とダミー画像を合成してMP4を生成する"""
        logging.info("🎬 動画データをレンダリング中（MoviePy）...")
        
        try:
            # 音声を読み込む
            audio_clip = AudioFileClip(str(audio_path))
            
            # 背景となるダミー画像（単色カラー）を作成
            # 1080x1920 (Shorts/TikTokサイズ)
            img_clip = ImageClip(import_numpy_array_for_color((30, 30, 40)), duration=audio_clip.duration)
            img_clip = img_clip.with_audio(audio_clip)
            
            # エンコードして出力
            img_clip.write_videofile(
                str(output_mp4),
                fps=24,
                codec="libx264",
                audio_codec="aac",
                logger=None # ログ出力で画面が埋まるのを防ぐ
            )
            
            logging.info(f"✅ 動画生成完了: {output_mp4}")
            self.notify_discord(f"**動画のレンダリングが完了しました！**\n📁 保存先: `{output_mp4}`", color=0x00ff00)
            
            # リソース解放
            audio_clip.close()
            img_clip.close()
            
        except Exception as e:
            logging.error(f"❌ 動画合成中にエラー: {e}")

# Moviepy用の単色画像生成ユーティリティ
def import_numpy_array_for_color(color):
    import numpy as np
    # 1920x1080 (Vertical: 1080x1920) RGB
    img = np.zeros((1920, 1080, 3), dtype=np.uint8)
    img[:] = color
    return img

async def main():
    forge = VideoForge()
    
    # 1. サンプル原稿（または実際のMarkdown）
    sample_draft = """
    LoLで勝つためにはマクロがすべてです。特にジャングラーはレーナーの状況を見て、
    常に最適解のルートを構築する必要があります。この記事ではその最強のルートを解説します。
    """
    
    # 2. 台本生成
    script = forge.generate_script(sample_draft)
    print(f"\n--- 生成された台本 ---\n{script}\n--------------------\n")
    
    # 3. ファイルパスの準備
    base_name = "shorts_sample"
    audio_path = forge.output_dir / f"{base_name}.mp3"
    video_path = forge.output_dir / f"{base_name}.mp4"
    
    # 4. 音声生成
    await forge.generate_voice(script, audio_path)
    
    # 5. 動画合成
    forge.assemble_video(audio_path, video_path)
    forge.notify_discord(f"テスト: 新規動画が正常に生成されました！\n台本: {script[:30]}...", color=0xf1c40f)

if __name__ == "__main__":
    asyncio.run(main())
