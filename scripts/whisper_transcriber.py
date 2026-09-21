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
    
    ydl_opts = {
        'format': 'bestaudio[ext=m4a]/bestaudio/best',
        'outtmpl': target_tmpl,
        'quiet': True,
        'no_warnings': True,
        'extractor_args': {
            'youtube': {
                'player_client': ['android_vr', 'android', 'web']
            }
        },
    }

    # ★ 2026-09-21: cookie設定を追加。ここが最も403を食らう経路(メタデータ・字幕は
    # 通るのに音声DLだけが403になる実測結果)にもかかわらず、cookie設定を一切
    # 読んでいなかった。`.env`のYT_DLP_COOKIES_FROMは停止済みのyoutube_absorber.pyしか
    # 読んでおらず、現役のこの経路には届いていなかった。
    import sys as _sys
    _sys.path.insert(0, str(Path(__file__).resolve().parent))
    from yt_dlp_cookies import apply_cookie_opts
    apply_cookie_opts(ydl_opts)

    if ffmpeg_exe:
        ydl_opts['ffmpeg_location'] = ffmpeg_exe

    url = f"https://www.youtube.com/watch?v={video_id}"
    logger.info(f"🎙️ 音声のみダウンロードを開始: {video_id}")
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
            
        for ext in ['m4a', 'opus', 'webm', 'mp3']:
            candidate = output_dir / f"{video_id}_audio.{ext}"
            if candidate.exists() and candidate.stat().st_size > 1000:
                logger.info(f"✅ 音声ダウンロード完了: {candidate.name} ({candidate.stat().st_size // 1024} KB)")
                return candidate
                
    except Exception as e:
        logger.error(f"❌ 音声ダウンロード失敗 ({video_id}): {e}")
        
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
