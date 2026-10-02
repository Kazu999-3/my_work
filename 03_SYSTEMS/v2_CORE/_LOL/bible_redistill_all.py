"""
bible_redistill_all.py - 既存176本のバイブルを最新9大柱フォーマットへ全自動・安全に再蒸留するバッチ

【特徴】
1. レートリミット（15 RPM）完全準拠: 各リクエスト間に 4.5秒のウェイトを置き、429制限を完全回避。
2. べき等性（再開可能）: 既に「## 🌲 1. 初動3分」を含むファイルはスキップ。途中で止めても次回続きから再開可能。
3. JG最優先ソート: JGメインのユーザー様のために、JGチャンピオンのバイブル（92本）から優先消化。
4. 全自動ディスパッチ: 1本完了するごとに note_stocks/ と レーンガイド（JG章）へ最新知見を即時マージ。
"""
import os
import sys
import re
import time
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
    logger = setup_sovereign_logging("BibleRedistillAll")
except ImportError:
    sys.path.append(str(ROOT_DIR / "03_SYSTEMS"))
    from v2_CORE.settings import settings
    from v2_CORE.ai_helper import generate_content_safe
    from v2_CORE.logger_config import setup_sovereign_logging
    from v2_CORE._LOL.bible_dispatcher import dispatch_bible
    logger = setup_sovereign_logging("BibleRedistillAll")

from google import genai

API_KEY = settings.GEMINI_API_KEY_FREE or settings.GEMINI_API_KEY
client = genai.Client(api_key=API_KEY) if API_KEY else None

BIBLE_DIR = ROOT_DIR / "02_FACTORY" / "_LOL" / "bible" / "kirei_bible"

JG_CHAMPS = {
    'leesin', 'viego', 'elise', 'lillia', 'zac', 'vi', 'graves', 'jarvaniv',
    'nocturne', 'xinzhao', 'kindred', 'sejuani', 'diana', 'amumu', 'warwick',
    'volibear', 'khazix', 'rengar', 'shyvana', 'kayn', 'karthus', 'masteryi',
    'evelynn', 'hecarim', 'nidalee', 'udyr', 'skarner', 'monkeyking', 'taliyah', 'ekko'
}

def is_already_redistilled(content: str) -> bool:
    return "## 🌲 1. 初動3分" in content

def is_jg_bible(content: str) -> bool:
    m = re.search(r'\[Champion[s]?:\s*([^\]]+)\]', content)
    champ_str = m.group(1).lower().replace(' ', '').replace('_', '') if m else ''
    return any(j in champ_str for j in JG_CHAMPS)

def redistill_single(file_path: Path) -> bool:
    if not client:
        logger.error("❌ Gemini API Key が設定されていません。")
        return False

    raw_text = file_path.read_text(encoding="utf-8")
    video_id = file_path.stem

    # 既に新フォーマットの場合はスキップ
    if is_already_redistilled(raw_text):
        logger.info(f"⏭️ [スキップ] 既に最新フォーマットです: {file_path.name}")
        return True

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

    result = generate_content_safe(
        client,
        prompt,
        model_id="gemini-3.1-flash-lite",
        feature_name="bible_redistill"
    )

    if result and not result.startswith("⚠️") and not result.startswith("❌"):
        # 上書き保存
        file_path.write_text(result, encoding="utf-8")
        
        # ディスパッチャーで note_stocks/ と レーンガイドへ即時反映
        try:
            dispatch_res = dispatch_bible(result, video_id=video_id)
        except Exception as de:
            logger.warning(f"⚠️ ディスパッチ例外: {de}")

        logger.info(f"✅ 再蒸留完了: {file_path.name}")
        return True
    else:
        logger.warning(f"⚠️ 再蒸留失敗: {file_path.name} -> {result[:100] if result else 'None'}")
        return False

def run_batch(max_items=None):
    logger.info("🚀 既存バイブル全件再蒸留バッチを開始します...")
    
    files = list(BIBLE_DIR.glob("*.md"))
    logger.info(f"📂 検出されたバイブル総数: {len(files)} 本")

    # 未処理のもののみ抽出
    unprocessed = []
    already_done = 0
    for f in files:
        try:
            c = f.read_text(encoding="utf-8")
            if is_already_redistilled(c):
                already_done += 1
            else:
                unprocessed.append((f, is_jg_bible(c)))
        except Exception:
            pass

    logger.info(f"📊 処理済み: {already_done} 本 / 未処理: {len(unprocessed)} 本")
    if not unprocessed:
        logger.info("🎉 すべてのバイブルがすでに最新9大柱フォーマットへ再蒸留されています！")
        return

    # ソート: JGチャンピオンを先頭に、その後その他
    unprocessed.sort(key=lambda x: (0 if x[1] else 1, x[0].name))

    targets = unprocessed[:max_items] if max_items else unprocessed
    total = len(targets)
    logger.info(f"🎯 今回処理対象: {total} 本（JG優先）")

    success_count = 0
    start_time = time.time()

    for idx, (f_path, is_jg) in enumerate(targets, 1):
        champ_label = "🌲JG" if is_jg else "🌐他"
        logger.info(f"[{idx}/{total}] ({champ_label}) 処理中: {f_path.name}...")
        
        ok = redistill_single(f_path)
        if ok:
            success_count += 1

        # レートリミット回避のインターバル（4.5秒）
        if idx < total:
            time.sleep(4.5)

    elapsed = time.time() - start_time
    logger.info("=" * 60)
    logger.info(f"🎉 バッチ完了！ 成功: {success_count}/{total} 本 (所要時間: {elapsed/60:.1f}分)")
    logger.info("=" * 60)

if __name__ == "__main__":
    # 引数があればその本数だけ実行、なければ全件
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else None
    run_batch(limit)
