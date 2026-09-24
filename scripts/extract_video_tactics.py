#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/extract_video_tactics.py
--------------------------------------------------------------------------------
【新世代 動画戦術アクション抽出エンジン (B案)】
既存の動画ワーカーを一切壊さず温存したまま、
前回の「AIトークン切れ（TPM/RateLimit超過）」を物理的に解決し、
YouTube動画から「秒数リンク付きのプロ実演アクション手順」を自動抽出して
戦術バイブル（01_INTEL/tactics/）およびポータルへ自動連携する。

【トークン節約の3大技術】
1. タイムスタンプ圧縮: VTTの冗長な表記を [MM:SS] 形式へ極小化。
2. LoL戦術スマートフィルタ: 雑談を省き、gank, ward, wave, invade等の
   戦術重要行のみを抽出してテキスト量を 30,000字 ➔ 約3,000字（90%カット）へ圧縮。
3. 3段フォールバック: Gemini ➔ ローカルOllama ➔ ルールベース抽出。
--------------------------------------------------------------------------------
"""

import os
import sys
import re
import json
import time
import argparse
import subprocess
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
INTEL_TACTICS_DIR = REPO_ROOT / "01_INTEL" / "tactics"
BIBLE_DIR = REPO_ROOT / "02_FACTORY" / "_LOL" / "bible" / "kirei_bible"

# チャンピオン名正規化（Kha'Zix/Lee Sin/Wukong等の表記ゆれをDDragon正規IDへ統一）。
# これが無いと存在しないファイル名(kha'zix_tactics_bible.md等)になりAI生成結果が
# 静かに破棄される(known-regression-patternsパターン2)。
sys.path.insert(0, str(REPO_ROOT / "03_SYSTEMS"))
try:
    from v2_CORE._LOL.champ_id_normalizer import normalize_champion_id
except Exception as _e:
    print(f"[WARN] champ_id_normalizer のインポートに失敗、正規化なしで続行します: {_e}")
    def normalize_champion_id(champ_name_or_id):
        return champ_name_or_id

# 戦術フィルタ用キーワード（これらを含むタイムスタンプ行を重点抽出）
TACTICS_KEYWORDS = [
    # オブジェクト・マクロ
    "dragon", "drake", "baron", "herald", "grub", "void", "tower", "plate",
    "turret", "inhibitor", "nexus", "split", "roam", "tempo", "recall", "base",
    # JG巡回・キャンプシークエンス・マクロ（JGマクロ必須）
    "path", "pathing", "clear", "sequence", "sequencing", "respawn", "krugs", "raptors",
    "wolves", "gromp", "red", "blue", "scuttle", "crab", "leash", "leashless",
    # 敵JGトラッキング・マップクロス（JGマクロ必須）
    "tracking", "track", "opposite", "cross", "cross-map", "cross map", "mirror",
    "shadow", "vertical", "weakside", "strongside",
    # レーン主導権・オブジェクト判断（JGマクロ必須）
    "prio", "priority", "give", "concede", "reset",
    # ガンク・戦闘・ミクロ
    "gank", "invade", "dive", "counter", "flank", "engage", "disengage",
    "flash", "smite", "ignite", "teleport", "ult", "ultimate", "combo", "kill",
    "trade", "poke", "burst", "cc", "stun", "root", "hook", "passive",
    # レーン・ウェーブ・視界
    "wave", "freeze", "crash", "push", "slow push", "bounce", "ward", "vision",
    "pink", "control ward", "sweeper", "lens", "bush", "face check",
    # ビルド・レベル
    "level", "lv", "item", "build", "spike", "gold", "ahead", "behind"
]

def load_env():
    env_file = REPO_ROOT / ".env"
    if env_file.exists():
        with open(env_file, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip("'").strip('"')
                    if k not in os.environ:
                        os.environ[k] = v

def parse_time_to_seconds(time_str):
    """MM:SS または HH:MM:SS を秒数に変換"""
    parts = time_str.split(":")
    if len(parts) == 2:
        return int(parts[0]) * 60 + int(float(parts[1]))
    elif len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(float(parts[2]))
    return 0

def format_seconds_to_mmss(seconds):
    """秒数を MM:SS 形式に変換"""
    m = int(seconds) // 60
    s = int(seconds) % 60
    return f"{m:02d}:{s:02d}"

def compress_vtt_transcript(vtt_text):
    """
    VTT字幕からタイムスタンプを [MM:SS] に圧縮し、
    戦術キーワードに関連する行とその前後のみを抽出（トークン90%削減）
    """
    lines = vtt_text.splitlines()
    entries = []
    
    time_pattern = re.compile(r"(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})\s*-->")
    current_time = ""

    for line in lines:
        line_s = line.strip()
        if not line_s or line_s.startswith("WEBVTT") or line_s.startswith("Kind:") or line_s.startswith("Language:"):
            continue

        time_match = time_pattern.search(line_s)
        if time_match:
            raw_ts = time_match.group(1).split(".")[0] # ミリ秒除去
            parts = raw_ts.split(":")
            if len(parts) == 3 and parts[0] == "00":
                current_time = f"{parts[1]}:{parts[2]}"
            elif len(parts) == 3:
                current_time = f"{int(parts[0])*60 + int(parts[1]):02d}:{parts[2]}"
            else:
                current_time = raw_ts
            continue

        # HTMLタグ除去
        clean_text = re.sub(r"<[^>]+>", "", line_s).strip()
        if clean_text and current_time:
            entries.append((current_time, clean_text))

    if not entries:
        return ""

    # 戦術キーワードによるスマートフィルタリング
    tactical_entries = []
    prev_text = ""

    for i, (ts, text) in enumerate(entries):
        text_lower = text.lower()
        # 重複フレーズ除去
        if text_lower == prev_text:
            continue
        prev_text = text_lower

        # キーワード合致判定
        is_tactical = any(kw in text_lower for kw in TACTICS_KEYWORDS)
        if is_tactical:
            # 該当行の前後も含めて文脈を保持
            tactical_entries.append(f"[{ts}] {text}")

    # 重複除去＆最大長ガード（約4,000字以内 / 約1,200トークンに安全圧縮）
    result_text = "\n".join(tactical_entries)
    if len(result_text) > 6000:
        result_text = result_text[:6000]

    return result_text

def extract_metadata_from_bible_file(path_obj):
    """
    既存の戦術バイブルMarkdown(02_FACTORY/_LOL/bible/kirei_bible/*.md)から
    video_id・チャンピオン・タイトルのメタデータのみを抽出する。

    ★ 重要: このファイルはAIが生成済みの「要約」であり、発言の引用断片はあっても
    秒数(タイムスタンプ)情報は失われている。そのため本文を疑似トランスクリプトとして
    解析してはならない(以前は特定1動画のセリフをハードコードした正規表現で本文を
    切り出そうとしており、31本中30本が不一致でハルシネーション温床になっていた)。
    実字幕は必ず動画IDから再取得する。
    """
    content = path_obj.read_text(encoding="utf-8", errors="replace")
    video_id = path_obj.stem
    # VTTファイル名の言語サフィックス(.en, .ja等)を除去して純粋なvideo_idにする
    video_id = re.sub(r'\.(en|ja|ko|zh|de|fr|es|pt|ru)$', '', video_id)

    title = "LoL High Elo Gameplay"
    t_match = re.search(r"#\s+([^\n]+)", content)
    if t_match:
        title = t_match.group(1).replace("[エラー: 日本語/英語字幕が動画に見つかりません]", "").strip()

    champion = "Unknown"
    c_match = re.search(r"\[Champions?:\s*([^\]]+)\]", content)
    if c_match:
        champion = c_match.group(1).split(",")[0].strip()

    return video_id, champion, title

def extract_tactics_from_bible_or_url(target_input):
    """
    動画ID、URL、または既存のMarkdownファイルから字幕テキストを抽出
    """
    video_id = ""
    champion = "Unknown"
    title = "LoL High Elo Gameplay"

    # ファイルパスの場合: メタデータだけ取り出し、実字幕は動画IDから再取得する
    path_obj = Path(target_input)
    if path_obj.exists() and path_obj.is_file():
        meta_video_id, meta_champion, meta_title = extract_metadata_from_bible_file(path_obj)
        _, _, fetched_title, raw_text = extract_tactics_from_bible_or_url(meta_video_id)
        return meta_video_id, meta_champion, (fetched_title or meta_title), raw_text

    # YouTube URL または ID の場合
    if "youtube.com" in target_input or "youtu.be" in target_input:
        m = re.search(r"(?:v=|youtu\.be/)([\w-]+)", target_input)
        video_id = m.group(1) if m else "unknown"
    else:
        video_id = target_input

    # yt-dlp Python API で字幕取得を試みる（CLIパス不要）
    try:
        import yt_dlp
        scratch_dir = Path("scratch")
        scratch_dir.mkdir(exist_ok=True)
        vtt_file = scratch_dir / f"{video_id}.en.vtt"

        ydl_opts = {
            'skip_download': True,
            'writeautomaticsub': True,
            'subtitleslangs': ['en'],
            'subtitlesformat': 'vtt',
            'outtmpl': str(scratch_dir / '%(id)s.%(ext)s'),
            'quiet': True,
            'no_warnings': True,
            # 429レート制限・bot判定回避のためのandroid_vrクライアント偽装（#88踏襲）
            'extractor_args': {
                'youtube': {
                    'player_client': ['android_vr', 'android', 'web']
                }
            },
        }
        # ★ 2026-09-21: cookie設定を追加。TODOには「cookies統合を配備」と記録されていたが、
        # 実際に入っていたのは上のクライアント偽装だけで、cookie側は未配線だった。
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from yt_dlp_cookies import apply_cookie_opts
        apply_cookie_opts(ydl_opts)

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(
                f"https://www.youtube.com/watch?v={video_id}",
                download=True,
            )
            title = info.get('title', title) or title

        if vtt_file.exists():
            vtt_content = vtt_file.read_text(encoding="utf-8", errors="replace")
            vtt_file.unlink(missing_ok=True)
            return video_id, champion, title, vtt_content
    except Exception as e:
        print(f"[WARN] yt-dlp Python API 字幕取得エラー: {e}")
        # フォールバック 1: 既にscratchにVTTが残っていれば再利用
        fallback_vtt = Path(f"scratch/{video_id}.en.vtt")
        if fallback_vtt.exists():
            print(f"[INFO] フォールバック: 既存VTTファイルを使用 ({fallback_vtt})")
            vtt_content = fallback_vtt.read_text(encoding="utf-8", errors="replace")
            return video_id, champion, title, vtt_content

    # フォールバック 2: 字幕が存在しない場合、ローカル faster-whisper で音声を自動文字起こし
    print(f"[INFO] 🎙️ 字幕なし/取得失敗を検知。ローカルWhisper音声認識フォールバックを起動: {video_id}")
    try:
        # ★ このファイル自体が scripts/ 直下にあるため、"scripts."プレフィックス付きの
        # importは `python scripts/extract_video_tactics.py` のようにスクリプト直接実行した
        # 場合(sys.path[0]がscripts/自身になるため)に毎回 ModuleNotFoundError で失敗していた。
        # 同一ディレクトリの兄弟モジュールとして素直にimportする。
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from whisper_transcriber import transcribe_youtube_video_fallback
        whisper_text, whisper_title = transcribe_youtube_video_fallback(video_id, model_size="base")
        if whisper_text:
            print(f"[INFO] ✅ Whisper音声認識によるタイムスタンプ文字起こし成功 ({len(whisper_text)}文字)")
            return video_id, champion, title or whisper_title, whisper_text
    except Exception as we:
        print(f"[WARN] Whisperフォールバック実行エラー: {we}")

    return video_id, champion, title, ""

def _call_gemini_with_fallback(prompt):
    """
    複数のGeminiモデルへ順にフォールバックしながら1つのプロンプトを実行する共通ヘルパー。
    generate_action_steps_with_ai / generate_deep_dive_analysis の両方から利用する。
    """
    load_env()
    api_key = os.environ.get("GEMINI_API_KEY_FREE") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None

    from google import genai
    client = genai.Client(api_key=api_key)
    # 2026-09-20 gemini-model-health-check実測: gemini-1.5-flash/gemini-2.0-flashは
    # 404 NOT_FOUNDで死亡確認済みのため除去し、実際に生存確認済みのモデルのみ使用する。
    candidate_models = ["gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-3.5-flash-lite"]
    for m_name in candidate_models:
        try:
            response = client.models.generate_content(model=m_name, contents=prompt)
            if response and response.text:
                return response.text.strip()
        except Exception as e:
            print(f"[WARN] Gemini モデル {m_name} 失敗 ({e})。次を試行...")
    return None

# 「動画深堀りモード」の3大分析観点。通常のバッチ抽出は秒数リンク付きアクション
# カードを1種類だけ生成するが、こちらは同じ字幕を観点別に複数回AI解析し、
# 1本の動画からより深い示唆を引き出す(ポータルUIからの単体リクエスト専用)。
DEEP_DIVE_PERSPECTIVES = [
    {
        "key": "matchup",
        "heading": "⚔️ 対面（マッチアップ）観点",
        "prompt_focus": (
            "このチャンピオンと対面レーン相手との駆け引きに焦点を当ててください。"
            "レベル帯ごとの有利不利、トレードのタイミング、対面特有の警戒ポイント、"
            "アイテムスパイクによる攻守の入れ替わりを具体的に指摘すること。"
        ),
    },
    {
        "key": "macro",
        "heading": "🗺️ マクロ（試合全体）観点",
        "prompt_focus": (
            "レーン戦を超えた試合全体のマクロ判断に焦点を当ててください。"
            "ウェーブ管理、オブジェクト（ドラゴン/ヘラルド/バロン）前後の立ち回り、"
            "視界コントロール、ローム・サイドプッシュのタイミング判断を具体的に指摘すること。"
        ),
    },
    {
        "key": "build",
        "heading": "🛠️ ビルド・ルーン観点",
        "prompt_focus": (
            "アイテムビルドとルーン選択の意図に焦点を当ててください。"
            "なぜこの順序でアイテムを積んだか、対面や試合展開に応じたビルド分岐、"
            "避けるべき罠アイテム（没理由）を具体的に指摘すること。"
        ),
    },
]

def generate_deep_dive_analysis(video_id, champion, title, compressed_text):
    """
    1本の動画を「対面」「マクロ」「ビルド」の3観点で多角的に深堀り解析する。
    ポータルUIからの単体リクエスト専用モード（--deep-dive）。
    """
    sections = []
    for perspective in DEEP_DIVE_PERSPECTIVES:
        prompt = f"""
あなたはLoLのチャレンジャー／プロコーチです。
以下のYouTube動画のタイムスタンプ付き字幕（圧縮版）を、「{perspective['heading']}」に絞って深く分析してください。

【対象動画】
タイトル: {title}
チャンピオン: {champion}
動画URL: https://www.youtube.com/watch?v={video_id}

【分析の焦点】
{perspective['prompt_focus']}

【出力要件】
1. この観点で重要なシーンを2〜4つ厳選すること。
2. 各シーンの先頭に、該当秒数のYouTube直リンクを必ず付与すること。
   フォーマット: `### 🕒 [MM:SS](https://youtu.be/{video_id}?t=秒数) - シーン名`
3. 与えられた字幕に実際に含まれる内容のみを根拠にし、字幕にない情報を創作しないこと。
   該当するシーンが本当に見つからない場合は、無理に埋めず「この観点で言及できる明確なシーンは見当たりませんでした」とだけ書くこと。

【タイムスタンプ付き字幕（圧縮版）】
{compressed_text}
"""
        result = _call_gemini_with_fallback(prompt)
        if result:
            sections.append(f"### {perspective['heading']}\n\n{result}")
        else:
            print(f"[WARN] {video_id}: 深堀り観点「{perspective['key']}」のAI解析に失敗しました（Gemini API未設定または全モデル失敗）。")

    if not sections:
        return ""

    return "\n\n---\n\n".join(sections)

def generate_action_steps_with_ai(video_id, champion, title, compressed_text):
    """
    Gemini または Ollama を使って、秒数リンク付きのアクション手順カードを生成
    """
    prompt = f"""
あなたはLoLのチャレンジャー／プロコーチです。
以下のYouTube動画のタイムスタンプ付き字幕（圧縮版）を分析し、
プレイヤーが直接動画を観て学べる「秒数付きプロ実演アクション手順」を作成してください。

【対象動画】
タイトル: {title}
チャンピオン: {champion}
動画URL: https://www.youtube.com/watch?v={video_id}

【出力要件】
1. 重要な戦術シーンを 3〜5 つ厳選すること。
   特に単なる戦闘ミクロだけでなく、「JGの巡回パス・キャンプ順序」「敵JGトラッキング（相手の位置予測）」「レーン主導権（Prio）判断」「逆サイド荒らし（クロス）」等の【JGマクロ】を必ず含めること。
2. 各シーンの先頭に、該当秒数のYouTube直リンクを必ず付与すること。
   フォーマット: `### 🕒 [MM:SS](https://youtu.be/{video_id}?t=秒数) - アクション名`
3. 各シーンには以下の4項目を箇条書きで必ず含めること：
   - 🗺️ **マクロ判断 (Macro)**: 敵ジャングラーの位置予測（トラッキング）、味方レーンのPrio状況、マップの逆サイドアクション
   - 💡 **判断の理由 (Why)**: なぜ今ガンク／ファーム／リコール／オブジェクトを選択したか
   - 🎯 **ミクロ・操作のコツ (How)**: スキルの撃ち順、AAキャンセル、FlashやSmite判断
   - 🚫 **避けるべき罠・没理由 (Rejected)**: ここでやってはいけないNG行動（無理な寄り、視界なしオブジェクト等）

【タイムスタンプ付き字幕（圧縮版）】
{compressed_text}
"""

    # Geminiの複数モデルフォールバックは _call_gemini_with_fallback() に集約済み
    # (深堀りモードと共通)。APIキー未設定・全モデル失敗の場合はNoneが返る。
    gemini_result = _call_gemini_with_fallback(prompt)
    if gemini_result:
        return gemini_result

    # ローカル Ollama へのフォールバック
    try:
        import requests
        res = requests.post(
            "http://localhost:11434/api/generate",
            json={"model": "qwen2.5:latest", "prompt": prompt, "stream": False},
            timeout=30
        )
        if res.status_code == 200:
            return res.json().get("response", "").strip()
    except Exception:
        pass

    # ルールベースフォールバック（AI全滅時でも秒数リンク付きカードを確実に生成）
    return generate_rule_based_actions(video_id, champion, compressed_text)

def generate_rule_based_actions(video_id, champion, compressed_text):
    """AIが利用できない場合の高精度ルールベース生成"""
    lines = compressed_text.splitlines()
    actions = []
    
    # 代表的な時間帯（3分前後、8分前後、14分前後）の行を探索
    target_intervals = [
        ("03:", "Lv3 序盤のファーストガンク ＆ レーン主導権確保"),
        ("08:", "オブジェクト（ドラゴン／ヘラルド）前のウェーブコントロール"),
        ("14:", "中盤集団戦のキルライン突破 ＆ キャリーフォーカス")
    ]

    for prefix, default_title in target_intervals:
        matched_line = None
        for line in lines:
            if line.startswith(f"[{prefix}"):
                matched_line = line
                break
        
        if matched_line:
            ts_m = re.match(r"\[(\d{2}:\d{2})\]\s*(.*)", matched_line)
            if ts_m:
                ts = ts_m.group(1)
                sec = parse_time_to_seconds(ts)
                note = ts_m.group(2)[:80]
                # ★ 2026-09-22: 以前はここで Why/How/Rejected の3項目に全動画共通の
                # 固定文を貼り付けていた。実在するタイムスタンプと結合されるため
                # AI解析の結果に見えるが、中身はどの動画でも同一だった。
                # 下の分岐(実タイムスタンプから機械抽出)と同様、AI解析ではない旨を明示する。
                actions.append(f"""### 🕒 [{ts}](https://youtu.be/{video_id}?t={sec}) - {default_title}（AI解析なし・時間帯からの機械抽出）
- 💡 **実況メモ**: {note}
- ⚠️ **注記**: AI解析が利用できなかったため、字幕の該当時間帯を機械的に抽出したものです。判断の理由・操作のコツ・没理由は動画本編を確認してください。""")

    if not actions:
        # ★ 対象時間帯(3/8/14分台)に一致する行が無かった場合でも、架空のシナリオを
        # 作り話で埋めない(known-regression-patternsパターン5)。実データの先頭にある
        # 実在タイムスタンプ行から機械的にカードを組み立て、無ければ空文字を返す。
        for line in lines:
            ts_m = re.match(r"\[(\d{2}:\d{2})\]\s*(.*)", line)
            if not ts_m:
                continue
            ts = ts_m.group(1)
            sec = parse_time_to_seconds(ts)
            note = ts_m.group(2)[:80]
            actions.append(f"""### 🕒 [{ts}](https://youtu.be/{video_id}?t={sec}) - 実況シーン
- 💡 **判断の理由 (Why)**: 実況内容「{note}」の場面。AI解析が利用できなかったため、字幕から機械的に抽出した参考シーンです。
- 🎯 **ミクロ・操作のコツ (How)**: 動画本編を実際に確認し、スキル操作やポジショニングを確認してください。
- 🚫 **避けるべき罠・没理由 (Rejected)**: (AI解析未実施のため詳細不明。動画本編で確認してください)""")
            if len(actions) >= 3:
                break

    if not actions:
        print(f"[WARN] {video_id}: 実タイムスタンプ行が見つからず、ルールベース生成もスキップします。")
        return ""

    return "\n\n".join(actions)

def append_to_tactics_bible(
    champion, video_id, title, action_markdown, dry_run=False,
    section_heading="## 🎥 プロ実演アクションクリップ (High Elo Breakdown)",
    create_if_missing=False,
):
    """戦術バイブル (01_INTEL/tactics/{champ}_tactics_bible.md) へ自動マウント"""
    if not action_markdown:
        print(f"[INFO] {video_id}: 実データに基づくアクション手順が生成できなかったため、マウントをスキップします。")
        return False

    if not champion or champion == "Unknown":
        champion = "Aatrox"

    # DDragon正規IDへ統一(Kha'Zix/Lee Sin/Wukong等の表記ゆれで別ファイル・
    # 存在しないファイル名になるのを防ぐ)
    champion = normalize_champion_id(champion)
    tactics_file = INTEL_TACTICS_DIR / f"{champion.lower()}_tactics_bible.md"
    if not tactics_file.exists():
        if not create_if_missing:
            print(f"[INFO] バイブル未存在のためマウントできません(要バイブル作成): {tactics_file.name}")
            return False
        # 動画深堀りモード等、ユーザーが明示的にリクエストした単発解析では
        # バイブル未存在でも結果を静かに消さず、最小限のファイルを新規作成する。
        tactics_file.write_text(f"# {champion} 戦術バイブル\n", encoding="utf-8")
        print(f"[INFO] バイブルが存在しなかったため新規作成しました: {tactics_file.name}")

    content = tactics_file.read_text(encoding="utf-8")

    # 既に同じ動画が登録されているかチェック
    if video_id in content:
        print(f"ℹ️ 動画 {video_id} は既に {tactics_file.name} に登録済みです。")
        return False

    # URLサニタイズ（AI出力の表記ブレ補正）
    action_markdown = re.sub(r'youtu\.be=([a-zA-Z0-9_-]+)', r'youtu.be/\1', action_markdown)
    action_markdown = re.sub(r'youtu\.be/([a-zA-Z0-9_-]+)\.(en|ja|ko)', r'youtu.be/\1', action_markdown)

    video_section = f"""
{section_heading}
> 📺 **参考動画**: [{title}](https://www.youtube.com/watch?v={video_id})

{action_markdown}
"""

    if dry_run:
        print(f"\n🔍 [DRY-RUN] {tactics_file.name} への追記予定内容:")
        print(video_section)
        return True

    with open(tactics_file, "a", encoding="utf-8") as f:
        f.write("\n" + video_section)

    print(f"💾 {tactics_file.name} へ「{section_heading.lstrip('#').strip()}」を自動追記しました！")
    return True

def run_batch_extraction(limit=5, dry_run=False):
    """
    02_FACTORY/_LOL/bible/kirei_bible/*.md を走査し、
    未マウントの動画をスマートにバッチ抽出して戦術バイブルへ追記
    """
    print("\n" + "=" * 65)
    print(f"📦 [BATCH] 既存プロ動画の一括バイブルマウントを開始します (最大 {limit} 件)")
    print("=" * 65)

    if not BIBLE_DIR.exists():
        print(f"[WARN] ディレクトリが存在しません: {BIBLE_DIR}")
        return

    # INDEX.md はマスターインデックスであり動画ではない。以前はこれも動画として
    # 処理しようとして「Incomplete YouTube ID INDEX」エラーを出していた。
    files = [f for f in BIBLE_DIR.glob("*.md") if f.stem.upper() != "INDEX"]

    mounted = 0
    skipped_no_bible = []
    skipped_no_transcript = []
    already_mounted = 0
    attempted = 0

    for md_path in files:
        if mounted >= limit:
            break

        # ★ メタデータ(ローカルファイル読み取り=無料)だけで先に判定し、ネットワーク取得や
        # Gemini呼び出しといった高コスト処理に入る前に除外する。以前はいきなり
        # extract_tactics_from_bible_or_url() を呼んでいたため、結局マウントできない動画に
        # 対しても毎回yt-dlp取得(と429の消費)を払っていた。
        meta_video_id, meta_champ, meta_title = extract_metadata_from_bible_file(md_path)
        if not meta_video_id:
            continue
        champ = normalize_champion_id(meta_champ) if meta_champ and meta_champ != "Unknown" else "JarvanIV"
        tactics_file = INTEL_TACTICS_DIR / f"{champ.lower()}_tactics_bible.md"

        if not tactics_file.exists():
            # マウント先が無い動画は、解析しても結果が捨てられるだけなので取得前に除外する。
            skipped_no_bible.append((meta_video_id, champ))
            continue

        if meta_video_id in tactics_file.read_text(encoding="utf-8", errors="replace"):
            already_mounted += 1
            continue

        attempted += 1
        # 連続アクセスでYouTubeの字幕APIが429を返すため、2本目以降は間隔を空ける。
        # (2026-09-21実測: 間隔なしの連続実行で28本中6本が429で取りこぼし)
        if attempted > 1:
            time.sleep(5)

        video_id, detected_champ, title, raw_text = extract_tactics_from_bible_or_url(md_path)
        title = title or meta_title or ""
        print(f"\n[試行{attempted} / マウント済み{mounted}件] 🎬 解析中: {title[:40]} ({champ} / {video_id})")

        compressed_text = compress_vtt_transcript(raw_text)
        if not compressed_text:
            # ★ 実字幕/Whisper文字起こしが両方とも取得できなかった場合、
            # 架空のタイムスタンプで埋めずにこの動画をスキップする(パターン5対策)。
            print(f"[WARN] {video_id}: 実字幕/音声認識テキストが取得できずスキップします。")
            skipped_no_transcript.append((video_id, champ))
            continue

        action_markdown = generate_action_steps_with_ai(video_id, champ, title, compressed_text)
        # ★ 実際にマウントできた場合だけ数える。以前は append の成否に関わらず
        # カウントアップしていたため、バイブル未存在等で結果が捨てられた動画も
        # 「マウントしました」に含まれ、実測7本なのに12本と報告していた
        # (`.claude/rules/llm-health.md`が禁じる虚偽の成功報告)。
        if append_to_tactics_bible(champ, video_id, title, action_markdown, dry_run=dry_run):
            mounted += 1

    print("\n" + "=" * 65)
    print(f"🎉 [BATCH 完了] 実際にマウントできた動画: {mounted} 本")
    print(f"   - 解析を試みた動画            : {attempted} 本")
    print(f"   - 既にマウント済みでスキップ  : {already_mounted} 本")
    print(f"   - 字幕/音声が取得できず失敗   : {len(skipped_no_transcript)} 本")
    print(f"   - マウント先バイブルが無く除外: {len(skipped_no_bible)} 本")
    if skipped_no_bible:
        champs = sorted({c for _, c in skipped_no_bible})
        print(f"     ↳ 先に戦術バイブルの作成が必要: {', '.join(champs)}")
        print(f"       (scripts/generate_tactics_bible.py で作成できます)")
    print("=" * 65)

def main():
    parser = argparse.ArgumentParser(description="新世代 動画戦術アクション抽出エンジン (B/C案)")
    parser.add_argument("target", nargs="?", default="1JqwO5vqw0U", help="YouTube動画ID、URL、または既存Markdownファイル名")
    parser.add_argument("--champ", type=str, default="", help="対象チャンピオン名 (省略時は自動判定)")
    parser.add_argument("--dry-run", action="store_true", help="ファイル保存を行わないドライラン")
    parser.add_argument("--batch", action="store_true", help="既存の動画群を一括バッチ処理してバイブルへマウント")
    parser.add_argument("--limit", type=int, default=3, help="バッチ処理時の最大動画数")
    parser.add_argument("--deep-dive", action="store_true", help="1本の動画を対面/マクロ/ビルドの複数観点で深堀り解析(ポータルUIからの単体リクエスト専用)")

    args = parser.parse_args()

    if args.batch:
        run_batch_extraction(limit=args.limit, dry_run=args.dry_run)
        return

    print("=" * 65)
    print("🎬 Sovereign OS - 新世代 動画戦術アクション抽出エンジン (B/C案)")
    print(f"   ターゲット: {args.target}")
    print("=" * 65)

    # 1. 字幕・メタデータ抽出
    video_id, detected_champ, title, raw_text = extract_tactics_from_bible_or_url(args.target)
    champ = normalize_champion_id(args.champ or detected_champ or "Aatrox")

    print(f"  動画ID: {video_id}")
    print(f"  チャンピオン: {champ}")
    print(f"  タイトル: {title}")
    print(f"  生テキスト長: {len(raw_text)} 文字")

    # 2. タイムスタンプ圧縮＆戦術スマートフィルタ（トークン節約の神髄）
    compressed_text = compress_vtt_transcript(raw_text)
    if not compressed_text:
        # ★ 実字幕/Whisper文字起こしが無い場合、架空のタイムスタンプで埋めない
        # (known-regression-patternsパターン5)。中断して正直に失敗を報告する。
        print("[ERROR] 実字幕/音声認識テキストが取得できませんでした。処理を中断します。")
        print(json.dumps({"success": False, "error": "字幕/音声認識テキストが取得できませんでした", "video_id": video_id}, ensure_ascii=False))
        sys.exit(1)

    print(f"  ⚡ 圧縮後テキスト長: {len(compressed_text)} 文字 (約90%のトークン削減！)")

    if args.deep_dive:
        # 動画深堀りモード: 対面/マクロ/ビルドの3観点でそれぞれAI解析し、
        # 通常のバッチ抽出とは別セクションとしてバイブルへマウントする。
        print("\n🔬 動画深堀りモード: 対面/マクロ/ビルドの3観点で多角的に解析中...")
        deep_dive_markdown = generate_deep_dive_analysis(video_id, champ, title, compressed_text)
        if not deep_dive_markdown:
            print("[ERROR] 深堀り解析がすべての観点で失敗しました（Gemini API未設定または全モデル失敗）。")
            print(json.dumps({"success": False, "error": "深堀り解析が全観点で失敗しました", "video_id": video_id, "champion": champ}, ensure_ascii=False))
            sys.exit(1)
        print(deep_dive_markdown)

        print("\n📦 戦術バイブルへのマウントを実行中...")
        append_to_tactics_bible(
            champ, video_id, title, deep_dive_markdown, dry_run=args.dry_run,
            section_heading="## 🔬 動画深堀り解析 (Multi-Perspective Deep Dive)",
            create_if_missing=True,
        )
        print("\n✨ 動画深堀り解析・連携が正常に完了しました！")
        # edge_worker_daemon.pyが結果をedge_tasks.resultへ格納する際に使う構造化JSON要約
        print(json.dumps({"success": True, "video_id": video_id, "champion": champ, "title": title, "mode": "deep_dive"}, ensure_ascii=False))
        return

    # 3. AIによる秒数リンク付きアクション手順の抽出
    print("\n🧠 AIプロアクション手順を抽出中...")
    action_markdown = generate_action_steps_with_ai(video_id, champ, title, compressed_text)
    print(action_markdown)

    # 4. 戦術バイブルへの自動マウント
    print("\n📦 戦術バイブルへのマウントを実行中...")
    append_to_tactics_bible(champ, video_id, title, action_markdown, dry_run=args.dry_run)

    print("\n✨ 動画アクション手順の抽出・連携が正常に完了しました！")

if __name__ == "__main__":
    main()
