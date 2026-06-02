import os
import sys
import time
import argparse
import logging
import concurrent.futures
import json
from pathlib import Path
from google import genai
from google.genai import types
import dotenv
from v2_CORE.database import db
from v2_CORE.herald import herald

dotenv.load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# ディレクトリ設定
INPUT_DIR = Path("d:/my_work/02_FACTORY/vods")
OUTPUT_DIR = Path("d:/my_work/02_FACTORY/vod_reports")
CACHE_DIR = Path("d:/my_work/02_FACTORY/cache")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

class SovereignCoachV1_4:
    """
    Tool H: AI VOD Narrator v1.4 (Resumable Sentinel)
    中間結果を保存し、503エラー等による中断からの復旧を可能にした不屈のコーチ。
    """
    def __init__(self, model_id="gemini-2.5-flash"):
        self.api_key = os.environ.get("GEMINI_API_KEY") 
        self.client = genai.Client(api_key=self.api_key)
        self.model_id = model_id

    def notify(self, message, herald_notify=False):
        logging.info(f"[Notify] {message}")
        if herald_notify:
            try: herald.notify_progress(message)
            except: pass

    def notify_error(self, message):
        logging.error(f"[Error] {message}")
        try: herald.notify_error(f"【VOD解析アラート】\n{message}")
        except: pass

    def analyze_vod(self, video_path: Path):
        self.notify(f"🚀 {video_path.name} の解析を開始/再開します。")
        
        cache_file = CACHE_DIR / f"segments_{video_path.stem}.json"
        segment_results = []
        if cache_file.exists():
            segment_results = json.loads(cache_file.read_text(encoding="utf-8"))
            self.notify(f"💾 中間キャッシュを発見。{len(segment_results)} セグメント分をロードしました。")

        try:
            # Files APIを使用してアップロード
            uploaded_file = self.client.files.upload(file=str(video_path))
            while uploaded_file.state == "PROCESSING":
                time.sleep(15)
                uploaded_file = self.client.files.get(name=uploaded_file.name)
            
            video_metadata = getattr(uploaded_file, "video_metadata", {})
            duration_sec = int(float(video_metadata.get("videoDuration", "0s").rstrip("s"))) if "videoDuration" in video_metadata else 900
            
            segment_length = 300 # 5分
            total_segments = (duration_sec + segment_length - 1) // segment_length

            for i, start_sec in enumerate(range(0, duration_sec, segment_length)):
                # 既に解析済みのセグメントはスキップ
                if i < len(segment_results): continue

                end_sec = min(start_sec + segment_length, duration_sec)
                segment_info = f"{start_sec//60}m - {end_sec//60}m"
                
                self.notify(f"🔍 解析中: {segment_info} ({i+1}/{total_segments})")

                prompt = f"{start_sec}秒から{end_sec}秒の間のプレイを添削して！"
                
                success = False
                for attempt in range(3):
                    try:
                        with concurrent.futures.ThreadPoolExecutor() as executor:
                            future = executor.submit(
                                self.client.models.generate_content,
                                model=self.model_id,
                                contents=[
                                    types.Content(parts=[
                                        types.Part(file_data=types.FileData(file_uri=uploaded_file.uri),
                                                   video_metadata=types.VideoMetadata(start_offset=f"{start_sec}s", end_offset=f"{end_sec}s")),
                                        types.Part(text=prompt)
                                    ])
                                ],
                                config=types.GenerateContentConfig(
                                    system_instruction="あなたは熱血LoLコーチ『アンちゃん』。5分間のプレイを深く分析し、王が改善すべき点と褒める点を1つずつ挙げて。",
                                    media_resolution=types.MediaResolution.MEDIA_RESOLUTION_LOW
                                )
                            )
                            response = future.result(timeout=600)
                        
                        segment_results.append(f"### Segment {segment_info}\n{response.text}")
                        # キャッシュ保存
                        cache_file.write_text(json.dumps(segment_results, ensure_ascii=False), encoding="utf-8")
                        success = True
                        break
                    except Exception as e:
                        self.notify_error(f"セグメント {segment_info} でエラー ({e})。30秒後に再試行します。")
                        time.sleep(30)
                
                if not success:
                    self.notify_error(f"⚠️ セグメント {segment_info} を断念。空の解析結果を挿入して続行します。")
                    segment_results.append(f"### Segment {segment_info}\n(解析エラーによりデータ欠落)")

            self.notify("📝 全区間の解析完了。最終レポートを統合・執筆中です（激戦の予感！）")
            
            final_prompt = f"以下の各区間の解析結果を統合して、LoLコーチとして熱い総評レポートを日本語で作成して！\n\n{' '.join(segment_results)}"
            
            # 統合フェーズのリトライ強化
            for attempt in range(3):
                try:
                    summary_response = self.client.models.generate_content(
                        model=self.model_id, contents=final_prompt
                    )
                    report_path = OUTPUT_DIR / f"report_{video_path.stem}.md"
                    report_path.write_text(summary_response.text, encoding="utf-8")
                    self.notify(f"✅ 納品完了！レポートを見に行ってね: {report_path.name}", herald_notify=True)
                    herald.announce_article("試合VOD(アンちゃん)", "2026.04", report_path, "VOD解析レポート完成。")
                    # 成功したらキャッシュ削除
                    if cache_file.exists(): cache_file.unlink()
                    break
                except Exception as e:
                    self.notify_error(f"統合フェーズでエラー ({e})。60秒後に再試行します。")
                    time.sleep(60)

        except Exception as e:
            self.notify_error(f"🔥 致命的なエラー: {e}")
        finally:
            try: self.client.files.delete(name=uploaded_file.name)
            except: pass

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("filename")
    parser.add_argument("--model", default="gemini-2.5-flash")
    args = parser.parse_args()
    
    video_path = INPUT_DIR / args.filename
    coach = SovereignCoachV1_4(model_id=args.model)
    coach.analyze_vod(video_path)

if __name__ == "__main__":
    main()
