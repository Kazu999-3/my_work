import os
import sys
import json
import time
import logging
import subprocess
import glob
import re
import platform
import shutil
import urllib.request
import urllib.error
import urllib
from google import genai
from v2_CORE.settings import settings
from v2_CORE.ai_helper import generate_content_safe, generate_with_routing
from v2_CORE._LOL.herald import herald

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

def setup_cuda_dll_path():
    """ctranslate2用のCUDA DLLパスをDLL検索パスに追加する"""
    import os
    import sys
    import platform
    if platform.system() != "Windows":
        return

    # site-packages内のnvidiaパッケージのbinディレクトリを探す
    venv_dir = os.path.dirname(os.path.dirname(sys.executable))
    site_packages = os.path.join(venv_dir, "Lib", "site-packages")
    
    # 探索対象のパッケージ名
    nvidia_dirs = [
        os.path.join(site_packages, "nvidia", "cublas", "bin"),
        os.path.join(site_packages, "nvidia", "cudnn", "bin"),
        os.path.join(site_packages, "nvidia", "cuda_nvrtc", "bin"),
    ]
    
    for d in nvidia_dirs:
        if os.path.isdir(d):
            try:
                os.add_dll_directory(d)
                logger.info(f"Added DLL directory: {d}")
            except Exception as e:
                logger.warning(f"Failed to add DLL directory {d}: {e}")


class YouTubeAbsorber:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY_FREE or settings.GEMINI_API_KEY
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None
        self.queue_file = os.path.join(settings.ROOT_DIR, "02_FACTORY", "kirei_queue.json")
        self.bible_dir = os.path.join(settings.ROOT_DIR, "02_FACTORY", "bible", "kirei_bible")
        os.makedirs(self.bible_dir, exist_ok=True)  # 出力先ディレクトリが存在しない場合は自動作成
        yt_bin = shutil.which("yt-dlp") or shutil.which("yt-dlp.exe") or str(settings.ROOT_DIR / ".venv" / "Scripts" / "yt-dlp.exe")
        if not os.path.exists(yt_bin) and not shutil.which(yt_bin):
            self.yt_dlp_cmd = [sys.executable, "-m", "yt_dlp"]
        else:
            self.yt_dlp_cmd = [yt_bin]
        self.yt_dlp_base = self.yt_dlp_cmd + ["--js-runtimes", "node,deno"]
        # ボット検知回避用のクッキー設定がある場合は追加
        cookies_from = os.getenv("YT_DLP_COOKIES_FROM")
        if cookies_from:
            logger.info(f"🍪 yt-dlp にブラウザ '{cookies_from}' からのクッキーを適用します")
            self.yt_dlp_base.extend(["--cookies-from-browser", cookies_from])
        self._whisper_model = None
        
    def _run_ytdlp(self, args, capture_output=True, text=True, timeout=None):
        """yt-dlpコマンドを実行し、DPAPIなどのクッキーエラーが起きた場合にクッキー引数を除外して自動リトライする"""
        import subprocess
        cmd = self.yt_dlp_base + args
        try:
            res = subprocess.run(cmd, capture_output=capture_output, text=text, timeout=timeout)
            stderr_str = ""
            if capture_output:
                stderr_str = res.stderr if text else res.stderr.decode('utf-8', errors='replace')
            
            # Chrome起動中でDBがロックされている場合、またはDPAPI復号化失敗の場合、
            # クッキーなしで自動リトライする
            COOKIE_ERROR_PATTERNS = [
                "Failed to decrypt with DPAPI",
                "Could not copy Chrome cookie database",
                "sqlite3.OperationalError",
                "database is locked",
            ]
            has_cookie_error = any(p in stderr_str for p in COOKIE_ERROR_PATTERNS)
            
            if res.returncode != 0 and has_cookie_error:
                logger.warning(f"⚠️ [yt-dlp] クッキー取得エラーを検知しました。クッキーなしで再試行します。")
                clean_base = []
                skip_next = False
                for token in self.yt_dlp_base:
                    if skip_next:
                        skip_next = False
                        continue
                    if token == "--cookies-from-browser":
                        skip_next = True
                        continue
                    clean_base.append(token)
                
                cmd_retry = clean_base + args
                res = subprocess.run(cmd_retry, capture_output=capture_output, text=text, timeout=timeout)
            return res
        except subprocess.TimeoutExpired as e:
            raise e
        
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
                self.yt_dlp_base + ["--print", "duration", "--no-warnings", url],
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
            
        self._run_ytdlp([
            "--write-auto-subs",
            "--write-subs",
            "--sub-lang", "en",
            "--skip-download",
            "-o", f"{temp_dir}/{video_id}.%(ext)s",
            url
        ], capture_output=True, text=False)
        
        # vttファイルを探す
        vtt_files = glob.glob(f"{temp_dir}/{video_id}.*.vtt")
        if not vtt_files:
            return ""
        return self.extract_text_from_vtt(vtt_files[0])

    def download_audio(self, url, video_id):
        # 先に temp フォルダを作成
        temp_dir = os.path.join(settings.ROOT_DIR, "scratch", "audio")
        os.makedirs(temp_dir, exist_ok=True)
        
        # すでにダウンロード済みの同一IDの音声ファイルがあるか確認（レジューム対応）
        # .part や .ytdl などの一時ファイルは除外する
        audio_files = glob.glob(f"{temp_dir}/{video_id}.*")
        valid_audio_files = [f for f in audio_files if not f.endswith(('.part', '.ytdl', '.temp'))]
        
        if valid_audio_files:
            existing_file = valid_audio_files[0]
            # 1MB以上であれば正常なオーディオファイルとみなして再利用
            if os.path.exists(existing_file) and os.path.getsize(existing_file) > 1024 * 1024:
                logger.info(f"♻️ [Resume] Download skipped. Found existing audio file: {existing_file} ({os.path.getsize(existing_file) // 1024} KB)")
                return existing_file
            else:
                try: os.remove(existing_file)
                except: pass
            
        logger.info(f"Downloading audio for Whisper: {url}")
        res = self._run_ytdlp([
            "-f", "ba",  # ffmpeg がない環境でもポストプロセスを走らせずにベストオーディオをそのままダウンロード
            "-o", f"{temp_dir}/{video_id}.%(ext)s",
            "--no-playlist",
            url
        ], capture_output=True, text=True)
        
        if res.returncode != 0:
            logger.error(f"Failed to download audio: {res.stderr}")
            # ダウンロードエラーが発生した場合、部分的にダウンロードされた一時ファイル (.part 等) を確実に削除する
            for f in glob.glob(f"{temp_dir}/{video_id}.*"):
                try:
                    os.remove(f)
                    logger.info(f"🗑️ [Cleanup] Removed partial download artifact: {f}")
                except:
                    pass
            return ""
            
        audio_files = glob.glob(f"{temp_dir}/{video_id}.*")
        valid_audio_files = [f for f in audio_files if not f.endswith(('.part', '.ytdl', '.temp'))]
        if not valid_audio_files:
            return ""
        return valid_audio_files[0]

    def get_whisper_model(self):
        if hasattr(self, "_whisper_model") and self._whisper_model is not None:
            return self._whisper_model
            
        setup_cuda_dll_path()
        try:
            from faster_whisper import WhisperModel
        except ImportError:
            logger.error("faster-whisper is not installed in the environment.")
            return None
            
        # VRAMの削減のため、デフォルトは "medium" にする (large-v3 はローカル環境で重すぎるため)
        model_size = os.getenv("WHISPER_MODEL_SIZE", "medium")
        logger.info(f"Initializing WhisperModel ({model_size}, device=cuda, compute_type=float16)...")
        try:
            self._whisper_model = WhisperModel(
                model_size_or_path=model_size,
                device="cuda",
                compute_type="float16"
            )
        except Exception as e:
            logger.warning(f"CUDA initialization failed ({e}). Falling back to CPU...")
            try:
                self._whisper_model = WhisperModel(
                    model_size_or_path=model_size,
                    device="cpu",
                    compute_type="int8"
                )
            except Exception as e2:
                logger.error(f"CPU initialization failed: {e2}")
                self._whisper_model = None
                
        return self._whisper_model

    def transcribe_audio_local(self, audio_path):
        if not audio_path or not os.path.exists(audio_path):
            return ""
            
        model = self.get_whisper_model()
        if not model:
            logger.error("WhisperModel could not be initialized.")
            return ""
            
        logger.info(f"Transcribing audio file: {audio_path}")
        start_time = time.time()
        
        segments, info = model.transcribe(audio_path, beam_size=5, language="en")
        logger.info(f"Detected language '{info.language}' with probability {info.language_probability:.2f}")
        
        lines = []
        for segment in segments:
            lines.append(segment.text)
            
        elapsed = time.time() - start_time
        logger.info(f"Transcription completed in {elapsed:.1f} seconds. Text length: {len(lines)} segments.")
        
        return " ".join(lines)

    def summarize_chunk(self, chunk_idx, total_chunks, chunk_text, title):
        """巨大な字幕の1チャンクをGeminiで攻略要点（日本語）に中間要約する (Mapフェーズ)"""
        if not self.client:
            logger.error("Gemini Client is not initialized for chunk summarization.")
            return ""

        prompt = f"""
        あなたはプロのLoL攻略コーチです。
        動画「{title}」の音声書き起こしテキスト（一部、セグメント {chunk_idx + 1}/{total_chunks}）から、
        ゲームの攻略に直接役立つ重要な知見（ルーン、アイテム、スキル回し、ウェーブ管理、対面ごとの立ち回り、マクロプランなど）を抽出し、
        詳細かつ簡潔な日本語の箇条書き（箇条書き1つにつき1文）で要約してください。
        
        【制約事項】
        - 挨拶、動画の導入部分、日常の雑談、高評価・チャンネル登録の促し、およびLoL以外の話題は完全に無視してください。
        - 攻略の核心となる知見のみを残すこと。
        - 余計な説明（「このパートでは〜」「以下は要約です」など）は一切含めず、純粋な要約の箇条書きのみを出力してください。
        
        【対象テキスト】
        {chunk_text}
        """

        try:
            # 429クォータ回避のためスリープは行わない（即時フォールバック優先）
            res = generate_content_safe(
                self.client,
                prompt,
                feature_name="youtube_absorber",
                sleep_on_rate_limit=False
            )
            return res
        except Exception as e:
            logger.error(f"❌ Failed to summarize chunk {chunk_idx + 1}: {e}")
            return f"❌ [セグメント {chunk_idx + 1} 要約エラー: {e}]"

    def generate_bible(self, video_data, transcript):
        # 3万文字制限チェック ➜ MapReduce（分割要約）にフォールバック
        if len(transcript) > 30000:
            logger.info(f"🔄 [YouTubeAbsorber] 字幕が {len(transcript):,}文字 と制限文字数（30,000文字）を超えているため、MapReduce（分割要約）を開始します: {video_data['title']}")
            
            # 1. 1.2万文字ごとにテキストを分割
            chunks = []
            chunk_size = 12000
            current_pos = 0
            total_len = len(transcript)
            
            while current_pos < total_len:
                if total_len - current_pos <= chunk_size:
                    chunks.append(transcript[current_pos:])
                    break
                end_pos = current_pos + chunk_size
                space_pos = transcript.rfind(" ", current_pos, end_pos)
                if space_pos > current_pos:
                    end_pos = space_pos
                chunks.append(transcript[current_pos:end_pos])
                current_pos = end_pos + 1
                
            # 2. 各チャンクをGeminiで要約 (Map)
            logger.info(f"⏳ {len(chunks)}個のセグメントに分割完了。順次中間要約を実行します...")
            summarized_parts = []
            for i, chunk in enumerate(chunks):
                logger.info(f" - セグメント {i+1}/{len(chunks)} の要約を試行中...")
                summary = self.summarize_chunk(i, len(chunks), chunk, video_data["title"])
                if summary and not summary.startswith("⚠️") and not summary.startswith("❌"):
                    summarized_parts.append(summary)
                else:
                    logger.warning(f"⚠️ セグメント {i+1} の要約が空、またはエラーになりました。")
                    
            if not summarized_parts:
                logger.error("❌ 全セグメントの要約に失敗したため、処理を打ち切ります。")
                return "❌ エラー: 字幕の分割要約に失敗しました。"
                
            # 3. 中間要約を結合して transcript を上書き (Reduce)
            transcript = "\n\n".join(summarized_parts)
            logger.info(f"📉 中間要約により、字幕長が {total_len:,}文字 ➜ {len(transcript):,}文字 に圧縮されました。")
            
        import httpx
        
        api_key = os.environ.get("ANTIGRAVITY_API_KEY", "default_dev_key_2026")
        url = "http://localhost:8000/api/v1/agent/generate"
        headers = {
            "X-Antigravity-Key": api_key,
            "Content-Type": "application/json"
        }
        
        # 動画タイトルからチャンピオン名を推定し、関連ナレッジを取得
        knowledge_context = ""
        try:
            from v2_CORE.knowledge_retriever import knowledge_retriever
            guessed_champs = knowledge_retriever.guess_champions_from_title(video_data["title"])
            if guessed_champs:
                logger.info(f"🧠 タイトルからチャンピオン名を推定: {guessed_champs}")
                pk_entries = knowledge_retriever.fetch_by_champions(guessed_champs, limit=5)
                if pk_entries:
                    knowledge_context = knowledge_retriever.format_as_context(pk_entries, max_chars=3000)
                    logger.info(f"📚 攻略ライブラリから {len(pk_entries)} 件のナレッジを注入します")
        except Exception as ke:
            logger.warning(f"⚠️ ナレッジ取得をスキップ: {ke}")
        
        payload = {
            "prompt_id": "youtube_bible_forge",
            "variables": {
                "title": video_data["title"],
                "url": video_data["url"],
                "transcript": transcript,
                "knowledge_context": knowledge_context
            }
        }
        
        try:
            logger.info("📡 AI Agent Gateway (Port 8000) へ要約生成リクエストを送信中...")
            res = httpx.post(url, headers=headers, json=payload, timeout=240)
            if res.status_code == 200:
                data = res.json()
                if data.get("success"):
                    logger.info(f"✅ AI Agent Gateway経由での生成成功 (モデル: {data.get('model_used')}, フォールバック: {data.get('fallback_occurred')})")
                    return data.get("text")
                else:
                    logger.error(f"❌ AI Agent Gatewayがエラーを返しました: {data.get('error_message')}")
                    return None
            else:
                logger.error(f"❌ AI Agent Gateway接続失敗 (HTTP {res.status_code}): {res.text[:200]}")
                return None
        except Exception as e:
            logger.error(f"❌ AI Agent Gatewayとの通信で例外が発生しました: {e}")
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
            if len(targets) >= limit:
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
            # ===== タイトルが未取得（フォールバック値）の場合、先にyt-dlpで実タイトルを取得 =====
            if not item.get("title") or item["title"] in ("YouTube Video", "Unknown", ""):
                logger.info(f"🔍 [TitleFix] タイトル未取得のため yt-dlp で実タイトルを取得します: {item['url']}")
                try:
                    result = self._run_ytdlp([
                        "--print", "%(title)s\n%(uploader)s",
                        "--no-warnings",
                        item["url"]
                    ], capture_output=True, text=True, timeout=20)
                    lines = result.stdout.strip().split("\n")
                    if lines[0] and lines[0].strip():
                        real_title = lines[0].strip()
                        real_channel = lines[1].strip() if len(lines) > 1 and lines[1].strip() else item.get("channel_name", "Unknown")
                        self.update_video(item["id"], {"title": real_title, "channel_name": real_channel})
                        item["title"] = real_title
                        item["channel_name"] = real_channel
                        logger.info(f"✅ [TitleFix] タイトル取得成功: 「{real_title}」")
                    else:
                        logger.warning(f"⚠️ [TitleFix] タイトル取得失敗（空文字）。動画IDをタイトルとして使用します。")
                        item["title"] = f"LoL Guide ({item['id']})"
                except Exception as e:
                    logger.warning(f"⚠️ [TitleFix] yt-dlp タイトル取得エラー: {e}。動画IDをタイトルとして使用します。")
                    item["title"] = f"LoL Guide ({item['id']})"

            logger.info(f"Processing: {item['title']}")
            
            logger.info(f"Attempting to download YouTube subtitles/auto-subtitles for: {item['title']}")
            transcript = self.download_subtitle(item["url"], item["id"])
            
            if transcript and len(transcript) >= 100:
                logger.info(f"✅ Successfully retrieved subtitles from YouTube: {len(transcript):,} chars")
            else:
                logger.info(f"⚠️ Subtitles not available on YouTube. Falling back to local Whisper processing: {item['title']}")
                # フォールバック: ローカルの Whisper で音声認識を実行
                logger.info(f"Downloading audio for Whisper processing: {item['title']}")
                audio_path = self.download_audio(item["url"], item["id"])
                transcript = ""
                if audio_path:
                    try:
                        transcript = self.transcribe_audio_local(audio_path)
                    except Exception as e:
                        logger.error(f"Whisper transcription failed: {e}")
                    finally:
                        if os.path.exists(audio_path):
                            try:
                                os.remove(audio_path)
                                logger.info(f"Cleaned up audio file: {audio_path}")
                            except Exception as ce:
                                logger.warning(f"Failed to clean up audio file: {ce}")
                
            if not transcript or len(transcript) < 100:
                logger.warning(f"No valid transcript found for {item['id']}")
                self.update_video(item["id"], {
                    "status": "error_no_transcript",
                    "title": f"{item['title']} [エラー: 日本語/英語字幕が動画に見つかりません]"
                })
                continue

            # 実際の字幕長をログに記録
            logger.info(f"📝 字幕取得完了: {len(transcript):,}文字 ({item['title'][:40]})")

                
            bible_text = self.generate_bible(item, transcript)
            if bible_text and not bible_text.startswith("⚠️") and not bible_text.startswith("❌"):
                # チャンピオン名の抽出
                extracted_champ = "Unknown"
                champ_match = re.search(r"\[Champion[s]?:\s*([^\]]+)\]", bible_text)
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
                    updates["title"] = f"{item['title']} [エラー: 5回リトライしましたが要約を生成できませんでした]"
                    logger.warning(f"❌ Video {item['id']} has failed after 5 retries. Marked as failed.")
                else:
                    updates["status"] = "error_generation"
                    updates["title"] = f"{item['title']} [エラー: AI要約生成に失敗しました (リトライ {retry_count}回目)]"
                self.update_video(item["id"], updates)
                

            
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
                
                # 自動同期の直後に辞典整理を実行して即座にマージ・要約する
                logger.info("📚 DictSynthesizer を呼び出して辞典の整理・統合を実行します...")
                from v2_CORE._LOL.dict_synthesizer import DictSynthesizer
                synthesizer = DictSynthesizer()
                synthesizer.process_and_update(limit=5)
            except Exception as e:
                logger.error(f"❌ 自動同期・辞典整理呼び出しエラー: {e}")
            
        return success_count

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    try:
        from v2_CORE.lock import SocketLock
    except ImportError:
        import sys
        from pathlib import Path
        sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
        from v2_CORE.lock import SocketLock
    
    import sys
    lock = SocketLock(19003, "YouTube Absorber")
    if not lock.acquire():
        sys.exit(0)
    try:
        absorber = YouTubeAbsorber()
        # 429 Too Many Requests エラーを回避するため、1回の実行上限を 1 本に制限し、
        # sre_daemon.py 経由で定期的に少しずつ消化する方針に変更
        absorber.run_cycle(limit=1)
    finally:
        lock.release()
