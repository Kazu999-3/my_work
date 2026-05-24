import os
import json
import logging
import asyncio
from pathlib import Path
from moviepy import VideoFileClip, AudioFileClip, TextClip, CompositeVideoClip
import edge_tts
import subprocess

logger = logging.getLogger("ShortsAlchemist")

class ShortsAlchemist:
    """
    【集客爆発】ショート動画自動錬成モジュール
    バイブルやテキスト台本から、背景動画付きの縦型ショート動画（TikTok/YouTube Shorts用）を自動合成する。
    """
    def __init__(self):
        self.output_dir = Path("D:/my_work/03_FACTORY/shorts")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.assets_dir = Path("D:/my_work/01_INTEL/assets")
        self.assets_dir.mkdir(parents=True, exist_ok=True)

    def download_champion_spotlight(self, champion_name: str) -> Path:
        """yt-dlpを使用して公式のChampion Spotlight動画をダウンロードする"""
        logger.info(f"🎥 {champion_name} の背景動画(Spotlight)を検索・ダウンロードします...")
        output_path = self.assets_dir / f"bg_{champion_name}.mp4"
        
        if output_path.exists():
            logger.info("背景動画は既に存在します。キャッシュを使用します。")
            return output_path

        # yt-dlpのコマンド（解像度を抑えてダウンロード）
        # 'ytsearch1: League of Legends Champion Spotlight [champion_name]'
        search_query = f"League of Legends {champion_name} Champion Spotlight"
        cmd = [
            "yt-dlp",
            f"ytsearch1:{search_query}",
            "-f", "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "--merge-output-format", "mp4",
            "-o", str(output_path)
        ]
        
        try:
            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            logger.info("背景動画のダウンロードに成功しました。")
            return output_path
        except Exception as e:
            logger.error(f"背景動画のダウンロードに失敗しました: {e}")
            # フォールバック: ダミー動画や既存のbg.mp4を探す
            fallback = self.assets_dir / "bg.mp4"
            if fallback.exists():
                return fallback
            return None

    async def generate_narration(self, text: str, output_audio: Path):
        """edge-ttsを使用してテキストから音声を生成する"""
        logger.info("🎤 ナレーション音声を生成中...")
        # TikTok等で聞き馴染みのある日本語音声（Nanami等）
        communicate = edge_tts.Communicate(text, "ja-JP-NanamiNeural")
        await communicate.save(str(output_audio))

    def create_short_video(self, champion_name: str, script_text: str):
        """動画合成のメイン処理"""
        bg_video_path = self.download_champion_spotlight(champion_name)
        if not bg_video_path:
            logger.error("背景動画が取得できないため、動画生成を中止します。")
            return False

        audio_path = self.output_dir / f"temp_audio_{champion_name}.mp3"
        out_path = self.output_dir / f"shorts_{champion_name}.mp4"

        # 音声の生成 (非同期実行)
        asyncio.run(self.generate_narration(script_text, audio_path))

        logger.info("🎬 動画と音声を合成中...")
        try:
            # 1. 音声クリップの読み込み
            audio_clip = AudioFileClip(str(audio_path))
            duration = audio_clip.duration
            
            # 2. 動画クリップの読み込みとクロップ（縦型 9:16 にする）
            video_clip = VideoFileClip(str(bg_video_path))
            
            # 尺を音声に合わせる（ループさせるか、途中で切るか。ここでは単純に途中で切る）
            # 動画が短い場合はループさせるのが理想だが、Spotlightは数分あるのでカット
            if video_clip.duration < duration:
                # 簡易化のためそのまま
                pass
            video_clip = video_clip.subclipped(10, 10 + duration) # 最初からだとタイトルなので10秒スキップ
            
            # アスペクト比をスマホ(1080x1920)にするための中央クロップ
            w, h = video_clip.size
            target_w = h * 9 / 16
            x_center = w / 2
            video_clip = video_clip.cropped(x1=x_center - target_w/2, y1=0, x2=x_center + target_w/2, y2=h)
            video_clip = video_clip.resized(height=1920, width=1080)
            
            # 音声をセット
            video_clip = video_clip.with_audio(audio_clip)
            
            # 字幕の追加（簡易版：画面中央に固定テキストを置くか、文字を流すか）
            # ここでは全体のテロップとしてシンプルに配置（MoviePy V2 の TextClip API）
            txt_clip = TextClip(
                font="C:/Windows/Fonts/meiryo.ttc",
                text=f"【最新メタ】\n{champion_name}の\n圧倒的OP戦略", 
                font_size=80, 
                color='white', 
                stroke_color='black', 
                stroke_width=3,
                method='label'
            ).with_position('center').with_duration(duration)

            final_clip = CompositeVideoClip([video_clip, txt_clip])
            
            # 出力（書き出し速度重視の設定）
            logger.info(f"💾 動画を書き出しています: {out_path}")
            final_clip.write_videofile(
                str(out_path), 
                fps=30, 
                codec="libx264", 
                audio_codec="aac",
                threads=4,
                preset="ultrafast",
                logger=None # ログが大量に出るのを防ぐ
            )
            
            logger.info("✅ ショート動画の錬成が完了しました！")
            
            # クリーンアップ
            video_clip.close()
            audio_clip.close()
            final_clip.close()
            if audio_path.exists():
                audio_path.unlink()
                
            return True
            
        except Exception as e:
            logger.error(f"動画合成中にエラーが発生しました: {e}")
            return False

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    alchemist = ShortsAlchemist()
    test_script = "今パッチで最も勝率が上がっているチャンプを知っていますか？そう、彼の圧倒的なジャングルクリア速度は現状のメタを完全に破壊しています。続きはプロフィールのリンクから。"
    alchemist.create_short_video("Lillia", test_script)
