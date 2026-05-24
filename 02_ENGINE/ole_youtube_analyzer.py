import os
import sys
import time
import argparse
import logging
import json
from pathlib import Path
from google import genai
from google.genai import types
import yt_dlp
import dotenv

# v2_CORE のパスを通す
sys.path.append(str(Path(__file__).resolve().parent))
from v2_CORE.settings import settings
from v2_CORE.database import db
from v2_CORE.herald import herald
import httpx
dotenv.load_dotenv()

# ロギング設定
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("OLE_V3")

# ディレクトリ設定
OUTPUT_BASE_DIR = settings.FORGE_DIR / "note_drafts/youtube_intel"
OUTPUT_BASE_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR = settings.FORGE_DIR / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
TEMP_DIR = Path("d:/my_work/scratch/temp_audio")
TEMP_DIR.mkdir(parents=True, exist_ok=True)

MODE_CONFIGS = {
    "TACTICAL": {
        "name": "LoL軍師モード",
        "system_instruction": "あなたはLoLの極限を理解する軍師。王（ユーザー）が勝利を掴むための、飾り気のない実利的な戦術データのみを出力せよ。",
        "segment_prompt": """
            提供された音声の {start_sec}秒から{end_sec}秒の区間を精密に解体せよ。
            目的：この区間で行われている「チャレンジャー級の意思決定」と「微細な操作」を抽出すること。
            項目：ウェーブ管理、スキルコンボ、視界管理、秘匿されたコツ。
            口調：冷徹な軍師として、事実と改善点のみを簡潔に記せ。
        """,
        "final_prompt_template": """
            以下の解析結果を統合し、一つの完璧な戦術レポート『勝利の方程式』を完成させよ。
            構成：1.核心的メタ解釈 2.序盤の盤面制圧 3.中盤の殺し切り 4.【秘匿】極限ミクロ 5.絶対回避事項。
            口調：断定的で自信に満ちた軍師の口調を貫け。「AI臭い」逃げの表現は一切禁止。
        """,
        "output_prefix": "TACTICAL"
    },
    "STUDY": {
        "name": "知能整理モード",
        "system_instruction": "あなたは卓越した知能を持つ知識整理のスペシャリスト。複雑な情報を構造化し、王（ユーザー）の脳に深く刻まれるエッセンスのみを抽出せよ。",
        "segment_prompt": """
            提供された音声の {start_sec}秒から{end_sec}秒の区間を精密に解体せよ。
            目的：核心的なアイデア、論理構造、重要なファクトを抽出すること。
            項目：核心テーマ、論理の展開、具体的アクション、驚きのインサイト。
            口調：知的で洗練された、無駄のない文体。
        """,
        "final_prompt_template": """
            以下の解析結果を統合し、王（ユーザー）のための『叡智の結晶（インテリジェンス・ノート）』を完成させよ。
            構成：1.要旨(TL;DR) 2.核心概念の図解的説明 3.実践的ワークフロー 4.深掘りすべき問い。
            口調：論理的かつ本質を突く表現を用いよ。「〜です/ます」が続く単調なリズムを避け、リズムのある知的な文体にせよ。
        """,
        "output_prefix": "STUDY"
    },
    "CONTENT": {
        "name": "note錬成モード",
        "system_instruction": "あなたは熱狂を生む超一流のコンテンツ・アーキテクト。提供された情報を「note記事」として爆発的な価値を持たせるための素材に変えよ。",
        "segment_prompt": """
            提供された音声の {start_sec}秒から{end_sec}秒の区間を精密に解体せよ。
            目的：読者の感情を動かし、「スキ」や「購入」に繋がるフックやパワーワードを抽出すること。
            項目：読者の痛みを突く言葉、常識を覆す主張、共感を生むストーリー要素。
            口調：情熱的かつ説得力のあるコピーライターの視点。
        """,
        "final_prompt_template": """
            以下の解析結果を統合し、note記事の骨組みとなる『究極のコンテンツ・ドラフト』を作成せよ。
            構成：1.読者を惹きつけるタイトル案（3案） 2.強烈な導入文のフック 3.価値を裏付ける本論（3〜5セクション） 4.行動を促す結び。
            口調：アンチAI臭を徹底せよ。読者の隣で語りかけるような、生きた言葉、時には挑発的な表現も交えて構成せよ。
        """,
        "output_prefix": "NOTE"
    }
}

class OLEAnalyzerV3:
    def __init__(self, mode="TACTICAL", model_id=None):
        self.api_key = settings.GEMINI_API_KEY
        if not self.api_key:
            logger.error("GEMINI_API_KEY is not set.")
            sys.exit(1)
        
        self.client = genai.Client(api_key=self.api_key)
        self.model_id = model_id or settings.DEFAULT_MODEL
        self.mode = mode if mode in MODE_CONFIGS else "TACTICAL"
        self.config = MODE_CONFIGS[self.mode]
        
        self.supabase_url = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
        self.supabase_key = os.environ.get("VITE_SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_KEY")

    def notify(self, message, herald_notify=False):
        logger.info(message)
        if herald_notify:
            try: herald.notify_progress(f"【OLE v3:{self.mode}】{message}", portal_link=True)
            except: pass

    def download_audio(self, url: str) -> dict:
        ydl_opts = {
            'format': '140', # m4a audio
            'outtmpl': str(TEMP_DIR / '%(id)s.%(ext)s'),
            'quiet': True,
            'no_warnings': True
        }
        
        self.notify(f"📥 動画音声を抽出中: {url}")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            video_id = info.get("id", "unknown")
            title = info.get("title", "Unknown Title")
            ext = info.get("ext", "m4a")
            duration = info.get("duration", 0)
            return {
                "video_id": video_id,
                "title": title,
                "audio_path": str(TEMP_DIR / f"{video_id}.{ext}"),
                "duration": duration,
                "description": info.get("description", "")
            }

    def analyze(self, video_info: dict, force: bool = False):
        video_id = video_info["video_id"]
        video_title = video_info["title"]
        audio_path = video_info["audio_path"]
        duration_sec = video_info["duration"]
        
        mode_dir = OUTPUT_BASE_DIR / self.mode
        mode_dir.mkdir(parents=True, exist_ok=True)
        
        output_path = mode_dir / f"{self.config['output_prefix']}_{video_id}.md"
        if output_path.exists() and not force:
            self.notify(f"⏩ 既存レポートあり。スキップ: {output_path.name}")
            return str(output_path)

        cache_file = CACHE_DIR / f"ole_cache_{video_id}_{self.mode}.json"
        segment_results = []
        if cache_file.exists():
            segment_results = json.loads(cache_file.read_text(encoding="utf-8"))
            self.notify(f"💾 中間キャッシュロード ({len(segment_results)} セグメント)")

        # Gemini Files API
        self.notify(f"🚀 Gemini へ音声をアップロード...")
        uploaded_file = self.client.files.upload(file=audio_path)
        while uploaded_file.state == "PROCESSING":
            time.sleep(5)
            uploaded_file = self.client.files.get(name=uploaded_file.name)
        
        if uploaded_file.state != "ACTIVE":
            raise Exception(f"Upload failed: {uploaded_file.state}")

        segment_length = 900
        total_segments = (duration_sec + segment_length - 1) // segment_length
        self.notify(f"🧐 解析開始 ({self.config['name']} / 全 {total_segments} セグメント)")

        for i, start_sec in enumerate(range(0, duration_sec, segment_length)):
            if i < len(segment_results): continue

            end_sec = min(start_sec + segment_length, duration_sec)
            segment_info = f"{start_sec//60}m{start_sec%60:02d}s - {end_sec//60}m{end_sec%60:02d}s"
            self.notify(f"🔍 解析中 [{i+1}/{total_segments}]: {segment_info}")

            success = False
            for attempt in range(3):
                try:
                    response = self.client.models.generate_content(
                        model=self.model_id,
                        contents=[
                            types.Content(parts=[
                                types.Part(file_data=types.FileData(file_uri=uploaded_file.uri),
                                           video_metadata=types.VideoMetadata(start_offset=f"{start_sec}s", end_offset=f"{end_sec}s")),
                                types.Part(text=self.config["segment_prompt"].format(start_sec=start_sec, end_sec=end_sec))
                            ])
                        ],
                        config=types.GenerateContentConfig(
                            system_instruction=self.config["system_instruction"],
                            media_resolution=types.MediaResolution.MEDIA_RESOLUTION_LOW
                        )
                    )
                    segment_results.append(f"### 区間分析: {segment_info}\n{response.text}")
                    cache_file.write_text(json.dumps(segment_results, ensure_ascii=False), encoding="utf-8")
                    success = True
                    break
                except Exception as e:
                    wait_time = (2 ** attempt) * 30
                    self.notify(f"⚠️ クォータ制限/エラー: {e}。{wait_time}s後に再試行...")
                    time.sleep(wait_time)
            
            if not success:
                segment_results.append(f"### 区間分析: {segment_info}\n(データ欠落)")

        # 最終統合
        self.notify("📝 最終レポート錬成中...")
        final_prompt = f"""
        タイトル: {video_title}
        
        {self.config['final_prompt_template']}
        
        解析データ：
        {' '.join(segment_results)}
        """

        for attempt in range(3):
            try:
                final_response = self.client.models.generate_content(
                    model=self.model_id,
                    contents=final_prompt,
                    config=types.GenerateContentConfig(temperature=0.7)
                )
                
                with open(output_path, "w", encoding="utf-8") as f:
                    f.write(f"# {video_title}\n\n")
                    f.write(f"URL: https://www.youtube.com/watch?v={video_id}\n")
                    f.write(f"MODE: {self.config['name']}\n\n")
                    f.write(final_response.text)
                
                self.notify(f"✅ 納品完了: {output_path.name}", herald_notify=True)
                
                # DB登録 (ChromaDB)
                db.add_intelligence(
                    id=f"ole_report_v3_{self.mode}_{video_id}",
                    content=final_response.text,
                    metadata={
                        "type": "youtube_report",
                        "mode": self.mode,
                        "title": video_title,
                        "url": f"https://www.youtube.com/watch?v={video_id}",
                        "source": "OLE_Pro_V3"
                    }
                )
                
                # Web Portal (Supabase) 登録
                if self.supabase_url and self.supabase_key:
                    try:
                        url = f"{self.supabase_url}/rest/v1/bible_articles"
                        headers = {
                            "apikey": self.supabase_key,
                            "Authorization": f"Bearer {self.supabase_key}",
                            "Content-Type": "application/json",
                            "Prefer": "return=minimal"
                        }
                        payload = {
                            'title': f"[YouTube] {video_title}",
                            'content': f"URL: https://www.youtube.com/watch?v={video_id}\n\n{final_response.text}",
                            'champion': 'YouTube 解析',
                            'keywords': ['YouTube', self.config['name']]
                        }
                        r = httpx.post(url, headers=headers, json=payload, timeout=10.0)
                        r.raise_for_status()
                        logger.info("✅ Supabaseへの保存が完了しました。")
                    except Exception as e:
                        logger.error(f"Supabaseへの保存に失敗しました: {e}")
                
                if cache_file.exists(): cache_file.unlink()
                break
            except Exception as e:
                self.notify(f"❌ 統合エラー: {e}")
                time.sleep(30)

        # Cleanup
        try:
            self.client.files.delete(name=uploaded_file.name)
            if os.path.exists(audio_path): os.remove(audio_path)
        except: pass
        
        return str(output_path)

def main():
    parser = argparse.ArgumentParser(description="OLE YouTube Analyzer v3.1")
    parser.add_argument("url", help="YouTube video URL")
    parser.add_argument("-m", "--mode", choices=["TACTICAL", "STUDY", "CONTENT"], default="TACTICAL", help="Analysis mode")
    parser.add_argument("-f", "--force", action="store_true", help="Overwrite existing")
    args = parser.parse_args()
    
    analyzer = OLEAnalyzerV3(mode=args.mode)
    try:
        video_info = analyzer.download_audio(args.url)
        analyzer.analyze(video_info, force=args.force)
    except Exception as e:
        logger.error(f"🔥 システムエラー: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
