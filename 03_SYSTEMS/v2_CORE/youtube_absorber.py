import os
import json
import time
import logging
import subprocess
import glob
import re
import platform
import urllib.request
import urllib.error
from google import genai
from v2_CORE.settings import settings
from v2_CORE.ai_helper import generate_content_safe
from v2_CORE.herald import herald

from v2_CORE.logger_config import setup_sovereign_logging
logger = setup_sovereign_logging("YouTubeAbsorber")

# ===================================================
# トークン予算の設定
# 1サイクルで使用する字幕テキストの最大文字数（概算トークン）
# 短い動画を複数処理するための上限
# ===================================================
CYCLE_CHAR_BUDGET = 150000  # 1サイクルで消費する字幕文字数の合計上限
MAX_VIDEOS_PER_CYCLE = 10   # 1サイクルで処理する動画の最大本数（安全弁）
DURATION_UNKNOWN = 99999    # 秒数不明の場合は後回し（大きな値にする）

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
        
    def _supabase_request(self, path, method='GET', payload=None, headers=None):
        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            logger.error("Supabase URL or Key is not configured.")
            return None, "Not configured", None
            
        url = f"{settings.SUPABASE_URL}/rest/v1/{path}"
        data = None
        if payload is not None:
            data = json.dumps(payload).encode('utf-8')
            
        req_headers = {
            'apikey': settings.SUPABASE_KEY,
            'Authorization': f'Bearer {settings.SUPABASE_KEY}',
            'Content-Type': 'application/json'
        }
        if headers:
            req_headers.update(headers)
            
        req = urllib.request.Request(
            url,
            data=data,
            headers=req_headers,
            method=method
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read().decode('utf-8')
                return r.status, body, r
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8')
            logger.error(f"Supabase HTTP Error {e.code}: {body}")
            return e.code, body, None
        except Exception as e:
            logger.error(f"Supabase request failed: {e}")
            return None, str(e), None

    def get_pending_videos(self):
        """status=pending の動画一覧を取得する"""
        status, body, _ = self._supabase_request("youtube_queue?status=eq.pending", method='GET')
        if status in (200, 201):
            return json.loads(body)
        return []

    def get_retry_candidates(self):
        """status=error_generation かつ retry_count < 5 の動画を取得する"""
        status, body, _ = self._supabase_request("youtube_queue?status=eq.error_generation&retry_count=lt.5", method='GET')
        if status in (200, 201):
            return json.loads(body)
        return []

    def update_video(self, video_id, updates):
        """動画の情報を更新する（status, retry_count, duration_secなど）"""
        status, body, _ = self._supabase_request(f"youtube_queue?id=eq.{video_id}", method='PATCH', payload=updates)
        return status in (200, 201, 204)

    def get_pending_count(self):
        """残りの pending 件数を取得する"""
        headers = {'Prefer': 'count=exact'}
        status, body, r = self._supabase_request("youtube_queue?status=eq.pending&select=id&limit=1", method='GET', headers=headers)
        if r:
            content_range = r.headers.get('Content-Range', '')
            if '/' in content_range:
                try:
                    return int(content_range.split('/')[-1])
                except:
                    pass
        return 0

    def fetch_duration(self, url: str) -> int:
        """
        yt-dlp --print duration で動画の長さ（秒）を取得する。
        APIを使わないため無料・高速。
        取得失敗時は DURATION_UNKNOWN を返す。
        """
        try:
            result = subprocess.run(
                [self.yt_dlp, "--print", "duration", "--no-warnings", url],
                capture_output=True, text=True, timeout=15
            )
            val = result.stdout.strip()
            if val and val.isdigit():
                return int(val)
        except Exception as e:
            logger.warning(f"動画長さ取得失敗: {url[:50]} — {e}")
        return DURATION_UNKNOWN

    def enrich_queue_with_duration(self, max_enrich: int = 30):
        """
        pending アイテムのうち duration_sec が未設定のものに対して
        yt-dlp で動画長さを取得してキューに保存する。
        max_enrich 件だけ処理して終了（呼び出しごとに少しずつ充填）。
        """
        pending = self.get_pending_videos()
        targets = [item for item in pending if item.get("duration_sec") is None]

        if not targets:
            logger.info("✅ [SmartQueue] 全pendingアイテムのduration_secが設定済みです。")
            return

        enriched = 0
        for item in targets[:max_enrich]:
            dur = self.fetch_duration(item["url"])
            self.update_video(item["id"], {"duration_sec": dur})
            mins = dur // 60 if dur != DURATION_UNKNOWN else "?"
            logger.info(f"📐 [SmartQueue] {item['title'][:40]} → {mins}分")
            enriched += 1
            time.sleep(1)  # yt-dlp への連続アクセスを少し間引く

        logger.info(f"✅ [SmartQueue] {enriched}件のduration_secを更新しました（残り未取得: {len(targets) - enriched}件）")
            
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
        - **重要**: この動画のメインとなるチャンピオンを判定し、Markdownの1行目（タイトルの上）に必ず `[Champion: チャンピオン名]` と出力すること。特定のチャンピオンがない汎用解説の場合は `[Champion: Unknown]` とすること。
        - 構成は以下の通りとする：
        [Champion: チャンピオン名]
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
        pending = self.get_pending_videos()
        
        if not pending:
            # error_generation のうち、リトライ回数が5回未満のものを pending に戻す
            retry_candidates = self.get_retry_candidates()
            if retry_candidates:
                reset_count = 0
                for item in retry_candidates:
                    self.update_video(item["id"], {"status": "pending"})
                    reset_count += 1
                logger.info(f"🔄 [Auto-Healer] {reset_count} 件のエラー動画を pending にリセットして再試行します。")
                pending = self.get_pending_videos()
        
        if not pending:
            logger.info("🎉 All KireiLoL videos have been processed!")
            return 0

        # ===================================================
        # 【スマートキュー】
        # Step 1: duration_sec が未設定の pending アイテムを先に最大10件充填
        # Step 2: 短い順にソート（duration_sec 昇順、不明は後回し）
        # Step 3: 字幕長ベース of トークン予算管理で複数本処理
        # ===================================================
        needs_duration = [item for item in pending if item.get("duration_sec") is None]
        if needs_duration:
            logger.info(f"📐 [SmartQueue] {len(needs_duration)}件のduration_sec未取得。先に最大10件取得します...")
            self.enrich_queue_with_duration(max_enrich=10)
            # キュー再読み込み
            pending = self.get_pending_videos()

        # 優先度（高>中>低）を第一キー、動画長さ（短い順、不明は後回し）を第二キーにしてソート
        priority_weight = {'high': 0, 'medium': 1, 'low': 2}
        pending_sorted = sorted(
            pending,
            key=lambda x: (
                priority_weight.get(x.get("priority", "medium"), 1),
                x.get("duration_sec") or DURATION_UNKNOWN
            )
        )

        # トークン予算内で処理対象を決定
        targets = []
        char_budget_used = 0
        for item in pending_sorted:
            if len(targets) >= MAX_VIDEOS_PER_CYCLE:
                break
            # duration_sec から字幕文字数を概算（秒数 × 15文字が目安）
            dur = item.get("duration_sec") or DURATION_UNKNOWN
            estimated_chars = min(dur * 15, 30000) if dur != DURATION_UNKNOWN else 20000
            if char_budget_used + estimated_chars <= CYCLE_CHAR_BUDGET:
                targets.append(item)
                char_budget_used += estimated_chars
            else:
                # 予算超過 — 短い動画でも詰め込めないならストップ
                break

        if not targets:
            logger.info("⚠️ [SmartQueue] トークン予算内で処理できる動画がありません。スキップします。")
            return 0

        dur_info = ", ".join([f"{(t.get('duration_sec') or 0)//60}分" for t in targets])
        logger.info(f"🎯 [SmartQueue] {len(targets)}本を処理予定（動画長さ: {dur_info}、推定字幕量: {char_budget_used:,}文字）")
        herald.notify_progress(f"📺 **【YouTube Absorber】** KireiLoL動画 {len(targets)}本を吸収開始（短い順: {dur_info}）...")
        
        success_count = 0
        processed_details = []
        
        for item in targets:
            logger.info(f"Processing: {item['title']}")
            transcript = self.download_subtitle(item["url"], item["id"])
            
            if not transcript or len(transcript) < 100:
                logger.warning(f"No valid transcript found for {item['id']}")
                self.update_video(item["id"], {"status": "error_no_transcript"})
                continue

            # 実際の字幕長をログに記録
            logger.info(f"📝 字幕取得完了: {len(transcript):,}文字 ({item['title'][:40]})")
                
            bible_text = self.generate_bible(item, transcript)
            if bible_text and not bible_text.startswith("⚠️") and not bible_text.startswith("❌"):
                # チャンピオン名の抽出
                extracted_champ = "Unknown"
                champ_match = re.search(r"\[Champion:\s*([^\]]+)\]", bible_text)
                if champ_match:
                    extracted_champ = champ_match.group(1).strip()
                    
                # Markdown保存
                file_path = os.path.join(self.bible_dir, f"{item['id']}.md")
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(bible_text)
                    
                self.update_video(item["id"], {"status": "completed"})
                success_count += 1
                dur_min = (item.get('duration_sec') or 0) // 60
                processed_details.append(f"- {item['title']} (Champion: **{extracted_champ}**, {dur_min}分)")
                
                # ログに保存先を明記
                logger.info(f"✅ Created bible for {item['id']} at {file_path} (Champion: {extracted_champ})")
            else:
                retry_count = item.get("retry_count", 0) + 1
                updates = {"retry_count": retry_count}
                if retry_count >= 5:
                    updates["status"] = "failed"
                    logger.warning(f"❌ Video {item['id']} has failed after 5 retries. Marked as failed.")
                else:
                    updates["status"] = "error_generation"
                self.update_video(item["id"], updates)
                
            # API制限（429）を回避するため、動画間にクールダウンを設ける
            if item != targets[-1]:  # 最後の動画の後はスリープ不要
                logger.info("⏳ 次の動画まで30秒クールダウン中...")
                time.sleep(30) 
            
        if success_count > 0:
            details_str = "\n".join(processed_details)
            pending_remaining = self.get_pending_count()
            herald.notify_progress(
                f"👑 **【YouTube Absorber完了】** {success_count}本のKireiLoL動画をバイブル化しました！\n\n"
                f"{details_str}\n\n"
                f"📁 `02_FACTORY/bible/kirei_bible/`\n"
                f"📊 残りキュー: **{pending_remaining}件**\n"
                f"*(※ この後、Dict Synthesizerによってチャンピオン辞典へ自動でマージされます)*"
            )
            
            # 自動同期（Sovereign Sync）を実行してクラウドへ同期し、Discordへ通知を送る
            try:
                logger.info("🔄 SovereignSync を呼び出して自動同期を実行します...")
                from v2_CORE.sovereign_sync import SovereignSync
                sync = SovereignSync()
                sync.run_sync()
            except Exception as e:
                logger.error(f"❌ 自動同期呼び出しエラー: {e}")
        elif len(targets) > 0:
            herald.notify_error(
                f"YouTube Absorberで {len(targets)} 本の動画の処理を試みましたが、API制限（上限到達）などにより全て失敗しました。\n"
                f"（動画はエラーキューに入り、次回以降に再試行されます）",
                source="YouTube Absorber"
            )
            
        return success_count

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    absorber = YouTubeAbsorber()
    # 429 Too Many Requests エラーを回避するため、1回の実行上限を 1 本に制限し、
    # sre_daemon.py 経由で定期的に少しずつ消化する方針に変更
    absorber.run_cycle(limit=1)
