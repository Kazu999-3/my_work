import os
import json
import time
import logging
import subprocess
import glob
import re
import platform
from google import genai
from v2_CORE.settings import settings
from v2_CORE.ai_helper import generate_content_safe
from v2_CORE.herald import herald

logger = logging.getLogger("YouTubeAbsorber")

class YouTubeAbsorber:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY_FREE or settings.GEMINI_API_KEY
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None
        self.queue_file = os.path.join(settings.ROOT_DIR, "02_FACTORY", "kirei_queue.json")
        self.bible_dir = os.path.join(settings.ROOT_DIR, "02_FACTORY", "bible", "kirei_bible")
        if platform.system() == "Windows":
            self.yt_dlp = str(settings.ROOT_DIR / ".venv" / "Scripts" / "yt-dlp.exe")
        else:
            self.yt_dlp = "yt-dlp"
        
    def _load_queue(self):
        if not os.path.exists(self.queue_file):
            return []
        with open(self.queue_file, "r", encoding="utf-8") as f:
            return json.load(f)
            
    def _save_queue(self, q):
        with open(self.queue_file, "w", encoding="utf-8") as f:
            json.dump(q, f, ensure_ascii=False, indent=4)
            
    def extract_text_from_vtt(self, file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            content = re.sub(r'<[^>]+>', '', content)
            lines = []
            for line in content.split('\n'):
                line = line.strip()
                if not line or line == 'WEBVTT' or '-->' in line or line.startswith('Kind:') or line.startswith('Language:') or line.startswith('Style:'):
                    continue
                if lines and lines[-1] == line:
                    continue
                lines.append(line)
            return ' '.join(lines)
        except Exception as e:
            logger.error(f"VTT extraction error: {e}")
            return ""

    def download_subtitle(self, url, video_id):
        # 先に temp フォルダを作成
        temp_dir = os.path.join(settings.ROOT_DIR, "scratch", "subs")
        os.makedirs(temp_dir, exist_ok=True)
        # 古いVTTを削除
        for f in glob.glob(f"{temp_dir}/*.vtt"):
            try: os.remove(f)
            except: pass
            
        cmd = [
            self.yt_dlp,
            "--write-auto-subs",
            "--write-subs",
            "--sub-lang", "en",
            "--skip-download",
            "-o", f"{temp_dir}/{video_id}.%(ext)s",
            url
        ]
        subprocess.run(cmd, capture_output=True)
        
        # vttファイルを探す
        vtt_files = glob.glob(f"{temp_dir}/{video_id}.*.vtt")
        if not vtt_files:
            return ""
        return self.extract_text_from_vtt(vtt_files[0])

    def generate_bible(self, video_data, transcript):
        if not self.client:
            return None
            
        prompt = f"""
        あなたはLoLの最上位プレイヤー（チャレンジャー／プロコーチ）です。
        以下のYouTube動画（タイトル: {video_data['title']}）の英語字幕テキストを読み込み、高度な戦略バイブル（Markdown形式）を作成してください。

        【対象動画の情報】
        URL: {video_data['url']}
        
        【作成要件】
        - 徹底して「LoLのジャングル/マクロ/ミクロの戦略」にフォーカスすること。無駄な雑談や挨拶は省く。
        - 全て**日本語**で出力すること。
        - 構成は以下の通りとする：
          # {video_data['title']}
          ## 📌 動画の結論（1行サマリー）
          ## 🧠 マクロ戦略・ルート・判断基準
          （具体的なジャングルルート、なぜその選択をしたかの理由付け）
          ## 🗡️ ミクロ・戦闘のコツ
          （ガンクのタイミング、スキルコンボ、ポジション等）
          ## 💡 重要な金言（名言・Tips）

        【字幕テキスト】
        {transcript[:30000]} # 最大文字数制限
        """
        
        try:
            # video_forge のクォータを消費（重い処理のため）
            response_text = generate_content_safe(
                self.client,
                prompt,
                settings.DEFAULT_MODEL,
                feature_name="video_forge"
            )
            return response_text
        except Exception as e:
            logger.error(f"Generation failed: {e}")
            return None

    def run_cycle(self, limit=10):
        queue = self._load_queue()
        pending = [item for item in queue if item.get("status") == "pending"]
        
        if not pending:
            logger.info("🎉 All KireiLoL videos have been processed!")
            return 0
            
        targets = pending[:limit]
        success_count = 0
        
        herald.notify_progress(f"📺 **【YouTube Absorber】** KireiLoL動画のテキスト吸収を開始します（対象: {len(targets)}件）...")
        
        for item in targets:
            logger.info(f"Processing: {item['title']}")
            transcript = self.download_subtitle(item["url"], item["id"])
            
            if not transcript or len(transcript) < 100:
                logger.warning(f"No valid transcript found for {item['id']}")
                # 失敗としてマークして次へ（またはスキップ）
                item["status"] = "error_no_transcript"
                self._save_queue(queue)
                continue
                
            bible_text = self.generate_bible(item, transcript)
            if bible_text and not bible_text.startswith("⚠️") and not bible_text.startswith("❌"):
                # Markdown保存
                file_path = os.path.join(self.bible_dir, f"{item['id']}.md")
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(bible_text)
                    
                item["status"] = "completed"
                self._save_queue(queue)
                success_count += 1
                # ログに保存先を明記
                logger.info(f"✅ Created bible for {item['id']} at {file_path}")
            else:
                item["status"] = "error_generation"
                self._save_queue(queue)
                
            # API制限（429）を回避するため、長めのクールダウン（60秒）を設ける
            time.sleep(60) 
            
        if success_count > 0:
            herald.notify_progress(
                f"👑 **【YouTube Absorber完了】** {success_count}本のKireiLoL動画をバイブル化し、以下の場所に保存しました！\n"
                f"📁 `02_FACTORY/bible/kirei_bible/`\n"
                f"*(※ この後、Dict Synthesizerによってチャンピオン辞典へ自動でマージされます)*"
            )
            
        return success_count

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    absorber = YouTubeAbsorber()
    # 429 Too Many Requests エラーを回避するため、1回の実行上限を 3 本に制限し、
    # sre_daemon.py 経由で定期的に少しずつ消化する方針に変更
    absorber.run_cycle(limit=3)
