#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/whisper_transcriber.py
--------------------------------------------------------------------------------
【ローカルWhisper音声認識フォールバックモジュール】
YouTubeで字幕（VTT）が提供されていない動画や字幕取得に失敗した動画に対して、
yt-dlp で軽量音声（m4a）を取得し、faster-whisper（int8 / CPU最適化）によって
タイムスタンプ付きのテキスト（[MM:SS] テキスト）へ自動文字起こしを行う。

特徴:
- APIトークン消費ゼロ（ローカル推論）
- faster-whisper (CTranslate2) による4倍高速・省メモリ処理
- imageio-ffmpeg 自動連動（システムffmpeg不要）
- 処理後の一時音声ファイル自動クリーンアップ
--------------------------------------------------------------------------------
"""

import os
import sys
import shutil
import logging
from pathlib import Path

# Windows cp932対策
if sys.platform == "win32":
    import io
    if not getattr(sys.stdout, "_custom_utf8", False):
        try:
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
            sys.stdout._custom_utf8 = True
        except Exception:
            pass

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRATCH_DIR = REPO_ROOT / "scratch"
SCRATCH_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [WhisperTranscriber] %(levelname)s: %(message)s"
)
logger = logging.getLogger(__name__)

# 単体実行（python scripts/whisper_transcriber.py <video_id>）でも .env を読む。
# 2026-09-23: これが無いため単体テストだけ cookie 未設定になり、
# 「cookieを設定したのに403のまま」という誤った結論を出しかけた。
try:
    from dotenv import load_dotenv as _load_dotenv
    for _env in [Path(__file__).resolve().parent.parent / "04_PORTAL" / ".env.local",
                 Path(__file__).resolve().parent.parent / "04_PORTAL" / ".env",
                 Path(__file__).resolve().parent.parent / ".env"]:
        if _env.exists():
            _load_dotenv(_env)
except ImportError:
    pass


def get_ffmpeg_path() -> str:
    """ffmpeg の実行可能パスを取得（imageio_ffmpeg から取得）"""
    try:
        import imageio_ffmpeg
        exe = imageio_ffmpeg.get_ffmpeg_exe()
        if os.path.exists(exe):
            return exe
    except Exception as e:
        logger.debug(f"imageio_ffmpeg lookup error: {e}")

    sys_ffmpeg = shutil.which("ffmpeg")
    if sys_ffmpeg:
        return sys_ffmpeg

    return ""

def format_timestamp(seconds: float) -> str:
    """秒数を MM:SS または HH:MM:SS に変換"""
    total_sec = int(seconds)
    hours, remainder = divmod(total_sec, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"

def download_audio_only(video_id: str, output_dir: Path) -> Path | None:
    """yt-dlp を用いて動画から音声のみを軽量ダウンロード"""
    import yt_dlp
    
    ffmpeg_exe = get_ffmpeg_path()
    if ffmpeg_exe:
        ffmpeg_dir = str(Path(ffmpeg_exe).parent)
        if ffmpeg_dir not in os.environ.get("PATH", ""):
            os.environ["PATH"] = f"{ffmpeg_dir};{os.environ.get('PATH', '')}"

    target_tmpl = str(output_dir / f"{video_id}_audio.%(ext)s")

    # ⚠️ 2026-09-23 実測メモ（同じ轍を踏まないための記録）
    # ・android_vr は**メタデータは取れるが音声の実ダウンロードで 403 Forbidden**
    #   になる。cookie を付けても変わらない。web_safari / mweb は同じ動画を
    #   問題なくダウンロードできた。
    # ・player_client に複数を並べて一度に渡すと、yt-dlp は全クライアントの
    #   フォーマットをまとめてから選ぶため、`bestaudio` が android_vr 由来の
    #   音声専用フォーマットに当たってしまい、結局403になる。
    #   そのため**1クライアントずつ順に試す**。
    CLIENT_CANDIDATES = ["web_safari", "mweb", "android_vr", "android", "web"]

    import sys as _sys
    _sys.path.insert(0, str(Path(__file__).resolve().parent))
    from yt_dlp_cookies import apply_cookie_opts

    def build_opts(client: str) -> dict:
        opts = {
            "format": "bestaudio[ext=m4a]/bestaudio/best",
            "outtmpl": target_tmpl,
            "quiet": True,
            "no_warnings": True,
            "extractor_args": {"youtube": {"player_client": [client]}},
        }
        # 音声DLはcookieが最も効く経路。メタデータや字幕が通っても
        # ここだけ403になることがある。
        apply_cookie_opts(opts)
        if ffmpeg_exe:
            opts["ffmpeg_location"] = ffmpeg_exe
        return opts

    url = f"https://www.youtube.com/watch?v={video_id}"
    logger.info(f"🎙️ 音声のみダウンロードを開始: {video_id}")

    last_err = None
    for client in CLIENT_CANDIDATES:
        for old_file in output_dir.glob(f"{video_id}_audio.*"):
            try:
                old_file.unlink()
            except Exception:
                pass
        try:
            with yt_dlp.YoutubeDL(build_opts(client)) as ydl:
                ydl.download([url])
            found = sorted(output_dir.glob(f"{video_id}_audio.*"))
            if found:
                logger.info(f"✅ 音声を取得しました ({client}): {found[0].name}")
                return found[0]
            last_err = "ダウンロードは成功したがファイルが見つからない"
        except Exception as e:
            last_err = str(e)
            logger.warning(f"  ↻ {client} で失敗、次のクライアントを試します: {str(e)[:120]}")

    logger.error(f"❌ 音声ダウンロード失敗 ({video_id}): {last_err}")
    return None


def transcribe_audio_with_whisper(audio_path: Path, model_size: str = "base") -> str:
    """faster-whisper を使ってローカルで音声を文字起こしし、タイムスタンプ付きテキストを生成"""
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        logger.error("❌ faster-whisper がインストールされていません。")
        return ""

    logger.info(f"🧠 faster-whisper モデルロード開始 ({model_size} / int8 CPU)...")
    try:
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
    except Exception as e:
        logger.error(f"❌ Whisperモデルの初期化に失敗: {e}")
        return ""

    logger.info(f"📝 音声文字起こし実行中: {audio_path.name}")
    try:
        segments, info = model.transcribe(
            str(audio_path),
            beam_size=5,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500),
        )
        
        logger.info(f"Detected language: {info.language} (prob: {info.language_probability:.2f})")
        
        lines = []
        for segment in segments:
            ts_start = format_timestamp(segment.start)
            ts_end = format_timestamp(segment.end)
            text = segment.text.strip()
            if text:
                lines.append(f"[{ts_start} --> {ts_end}] {text}")
                
        result = "\n".join(lines)
        logger.info(f"✅ 文字起こし完了: 合計 {len(lines)} セグメント ({len(result)} 文字)")
        return result
        
    except Exception as e:
        logger.error(f"❌ 音声文字起こしエラー: {e}")
        return ""

def transcribe_youtube_video_fallback(video_id: str, model_size: str = "base") -> tuple[str, str]:
    """字幕欠落時の全自動フォールバック"""
    output_dir = SCRATCH_DIR / "whisper_temp"
    output_dir.mkdir(exist_ok=True)
    
    audio_path = download_audio_only(video_id, output_dir)
    if not audio_path:
        return "", ""

    try:
        transcript = transcribe_audio_with_whisper(audio_path, model_size=model_size)
        return transcript, f"YouTube Video {video_id}"
    finally:
        if audio_path and audio_path.exists():
            try:
                audio_path.unlink()
                logger.info(f"🧹 一時音声ファイルを消去しました: {audio_path.name}")
            except Exception:
                pass

if __name__ == "__main__":
    if len(sys.argv) > 1:
        test_id = sys.argv[1]
        print(f"Testing Whisper fallback on {test_id}...")
        txt, t = transcribe_youtube_video_fallback(test_id)
        print("\n--- SAMPLE TRANSCRIPT (First 500 chars) ---")
        print(txt[:500])
    else:
        print("Usage: python whisper_transcriber.py <video_id>")
