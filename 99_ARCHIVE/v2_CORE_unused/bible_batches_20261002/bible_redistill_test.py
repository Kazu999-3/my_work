"""
bible_redistill_test.py - 既存バイブルを最新9大柱フォーマットへAI再蒸留するテストスクリプト
"""
import os
import sys
import json
import logging
from pathlib import Path
import dotenv

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parents[3]
dotenv.load_dotenv(ROOT_DIR / ".env")

try:
    from v2_CORE.settings import settings
    from v2_CORE.ai_helper import generate_content_safe
    from v2_CORE.logger_config import setup_sovereign_logging
    from v2_CORE._LOL.bible_dispatcher import dispatch_bible
    logger = setup_sovereign_logging("BibleRedistill")
except ImportError:
    sys.path.append(str(ROOT_DIR / "03_SYSTEMS"))
    from v2_CORE.settings import settings
    from v2_CORE.ai_helper import generate_content_safe
    from v2_CORE.logger_config import setup_sovereign_logging
    from v2_CORE._LOL.bible_dispatcher import dispatch_bible
    logger = setup_sovereign_logging("BibleRedistill")

from google import genai

API_KEY = settings.GEMINI_API_KEY_FREE or settings.GEMINI_API_KEY
client = genai.Client(api_key=API_KEY) if API_KEY else None

def redistill_bible(file_path: Path):
    if not client:
        print("❌ Gemini API Key is missing")
        return None

    raw_text = file_path.read_text(encoding="utf-8")
    video_id = file_path.stem
    print(f"📖 対象ファイル: {file_path.name} ({len(raw_text):,}文字)")

    prompt = f"""
あなたは世界最高峰のLoLプロコーチ（JG専属）です。
以下のテキストは、過去に解析されたLoL動画の攻略メモ・バイブルです。
この既存テキストのすべての情報・戦術知見を読み込み、ハルシネーション（嘘の捏造）を一切起こさず、
最新の【JG思考プロセス完全解剖 9大柱フォーマット】に高密度に再整理・再蒸留してください。

【制約事項】
- 元テキストに書かれている具体的な根拠、チャンピオン名、アイテム、ルート、秒数、考え方を1つも漏らさず引き継ぐこと。
- 元テキストに言及がない項目は勝手に作らず、「※該当言及なし」と記載すること。
- 日本語で出力すること。

【構成フォーマット】
[Champion: (対象チャンピオン名)]
# (動画タイトル)

> 📺 **元動画情報**: [https://www.youtube.com/watch?v={video_id}](https://www.youtube.com/watch?v={video_id})

## 📌 戦術の核心（1行サマリー）

## 🌲 1. 初動3分ルート ＆ スカトル衝突判断 ＆ ファーム中のカメラワーク
- **周回ルートと最速クリア秒数**:
- **2:55〜3:30 スカトル衝突の判断根拠**:
- **モンスター狩り中のカメラワーク（情報収集の視線）**:

## 🎯 2. 各レーンのマッチアップ ＆ ガンク成立条件 ＆ ウェーブ介入ルール ＆ ピン誘導
- **各レーンの盤面状況とガンク判断の因果関係**:
- **ガンク後のウェーブ介入ルール（触る vs 触らないの基準）**:
- **レーナーを動かすピン（Pings）誘導術**:

## 👁️ 3. 敵JGトラッキング ＆ 視界セットアップ（赤トリ変更秒数）
- **敵JGの位置特定（推論の根拠）**:
- **不在の証明（クロスアクション）**:
- **視界管理と赤トリ（オラクルレンズ）への変更タイミング**:

## ⚔️ 4. 戦闘ミクロ ＆ スキル温存の理由（我慢のトリガー）
- **スキルの撃ち順と「あえて温存した理由」**:
- **主要アクションのタイムラインと「Why（判断の根拠）」**:

## 🛒 5. リコールテンポ ＆ スマイト管理（50/50回避） ＆ 即興の買い物判断
- **リコール（Bキー）の引き金**:
- **スマイト管理 ＆ 50/50（運ゲー）勝負の絶対回避法**:
- **端数ゴールドと敵の育ちに応じたアドリブ購入**:

## ⚖️ 6. ウィンコンディション選定 ＆ 14分以降の居場所 ＆ 劣勢逆転シナリオ
- **勝たせるレーン（ストロングサイド）と捨てるレーン（ウィークサイド）**:
- **14分以降（中盤）のJGの居場所・迷子防止（シャドウの基準）**:
- **崩壊した試合を拾う逆転シナリオ（劣勢時の耐え方・クロストレード）**:

## ⚠️ 7. JGの罠・NG行動 ＆ 冷徹なオペレーターメンタル（ミュート基準）
- **JGの罠・NG行動（やってはいけない没理由）**:
- **冷徹なオペレーターメンタル（ミュート基準）**:

## 🎯 8. ピック判断基準（先出し・後出し・構成マッチング）
- **先出し適性（Blind Pick: ◎/◯/△）と理由**:
- **後出し刺さり条件（Counter Pick）**:
- **こういう時にピックおすすめ（構成トリガー）**:

## 💡 重要な金言（JG上達の思考トリガー）

【note発信ストック: 有料級エピソード・思考の言語化】
(note記事のメインエピソードとしてそのまま使える、プロの肉声・判断理由の言語化)

【対象テキスト】
{raw_text}
"""

    print("🤖 Geminiで最新9大柱へ再蒸留中...")
    result = generate_content_safe(
        client,
        prompt,
        model_id="gemini-3.1-flash-lite",
        feature_name="bible_redistill"
    )

    if result and not result.startswith("⚠️") and not result.startswith("❌"):
        print("✅ 再蒸留成功！")
        # 上書き保存
        file_path.write_text(result, encoding="utf-8")
        
        # ディスパッチャーでレーンガイドとnoteストックへも即時反映
        dispatch_res = dispatch_bible(result, video_id=video_id)
        print(f"🌲 レーンガイド反映: {dispatch_res.get('lane_merged')}")
        print(f"📝 noteストック更新: {dispatch_res.get('note_stock_path')}")
        return result
    else:
        print(f"❌ 再蒸留失敗: {result}")
        return None

if __name__ == "__main__":
    target = ROOT_DIR / "02_FACTORY" / "_LOL" / "bible" / "kirei_bible" / "-b3oDSepyT0.md"
    redistill_bible(target)
