# -*- coding: utf-8 -*-
import os
import sys
import time
import argparse
import logging
from pathlib import Path
from google import genai
from google.genai import types
import requests
from datetime import datetime
import dotenv
from v2_CORE.database import db
from v2_CORE.evolution import evolution_engine
from v2_CORE.ai_helper import generate_content_safe
from v2_CORE.settings import settings

dotenv.load_dotenv(Path("D:/my_work/.env"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

class BibleForge:
    """
    Tool J: Master Bible Forge v1.0
    高品質な攻略記事を分割生成して結合するエンジン。
    """
    def __init__(self):
        self.api_key = os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            logging.error("GEMINI_API_KEY is not set.")
            sys.exit(1)
            
        self.client = genai.Client(api_key=self.api_key)
        self.model_id = settings.DEFAULT_MODEL # グローバル設定に統一
        self.discord_webhook = os.environ.get("DISCORD_WEBHOOK")

    def send_notification(self, champ: str, file_path: Path):
        """Discord への完了通知"""
        if not self.discord_webhook:
            return
        try:
            payload = {
                "embeds": [{
                    "title": f"✅ 攻略記事生成完了：{champ}",
                    "description": f"パッチ 16.8.1 対応の攻略記事の生成が完了しました。\n\n**ファイルパス:** `{file_path}`",
                    "color": 0xFFD700, # Gold
                    "timestamp": datetime.now().isoformat(),
                    "footer": {"text": "Antigravity Bible Forge v1.1"}
                }]
            }
            requests.post(self.discord_webhook, json=payload, timeout=10)
            logging.info("Discord notification sent.")
        except Exception as e:
            logging.error(f"Failed to send Discord notification: {e}")

    def generate_bible(self, champion_name: str, meta_context: str = "", additional_context: str = ""):
        """指定されたチャンピオンの最高品質攻略記事を生成する"""
        logging.info(f"--- Starting Deep Forge for: {champion_name} ---")
        
        # アイテム/ルーンの文脈がある場合はプロンプトに追加
        meta_prompt = ""
        if meta_context:
            meta_prompt = f"\n【重要：今回のメタ文脈】\n{meta_context}\n今回の記事では、上記のアイテムやルーンの変更が{champion_name}に与えている影響を重点的に解説してください。"

        # テンペ氏のマーケティング・リファレンスを読み込み
        ref_path = Path("d:/my_work/01_INTEL/reference_himazinproducer.md")
        if ref_path.exists():
            try:
                himazin_ref = ref_path.read_text(encoding="utf-8")
                additional_context += f"\n\n【note販売＆収益化の超・実践フレームワーク】\n以下の「note運用の実践ノウハウ（有料ラインの引き方、無料エリアでの期待値爆上げ、商品ラダー設計）」を必ず記事の構成や文体に直接適用してください。特に記事の途中で『ここから先は有料（読者の感情がピークに達した瞬間）』という明確なラインを敷き、読者を購入へ強烈に誘導すること：\n{himazin_ref}\n"
                logging.info("Loaded marketing reference from 01_INTEL/reference_himazinproducer.md")
            except Exception as e:
                logging.error(f"Failed to load marketing reference: {e}")
        
        prompt = f"""
        League of Legendsの超ハイエンドな攻略記事（バイブル）を作成しています。
        ターゲットは「本気で勝ちたい、他を圧倒したいプレイヤー」です。
        
        【現在の対象チャンピオン】: {champion_name}
        {meta_prompt}
        【追加コンテキスト】: {additional_context}
        
        【執筆ルール】
        以下の構成に従い、Markdown形式で**1つの完全な記事として一気に出力**してください。
        合計で3000〜5000文字程度の非常に詳細な解説を記述してください。
        
        【必須構成】
        1. はじめに：現在のメタにおける立ち位置 (存在意義と強みの解説)
        2. 第1章：ビルドとルーンの選択 (状況別のアイテム分岐、ルーンの選択理由)
        3. 第2章：コンボと基本操作 (AAキャンセル、スキルの使い方、具体的な操作技術)
        4. 第3章：立ち回りとマクロ戦略 (ジャングルルートやレーン戦の動き、時間帯別の立ち回り)
        5. 第4章：マッチアップと対策 (主要な対面への具体的な対策、有利不利)
        6. まとめ：実践に向けて (実践で意識すべきポイントの総括)

        【細部ルール】
        1. 文体：「～です」「～ます」調で、丁寧かつ論理的で分かりやすい説明。
        2. 具体性：コンボ入力、秒数、距離などの具体的な数値を交えること。
        3. AI感の排除：不自然な比喩表現や冗長な挨拶は避け、端的に要点を伝えること。
        4. 客観的評価：安易な格付けは避け、具体的な理由とデータに基づいて評価を語ること。
        """
        
        max_retries = 3
        final_content = ""
        for attempt in range(max_retries):
            try:
                response_text = generate_content_safe(
                    self.client,
                    prompt,
                    self.model_id,
                    config=types.GenerateContentConfig(
                        temperature=0.75,
                        top_p=0.95,
                        max_output_tokens=8192
                    ),
                    feature_name="bible_forge"
                )
                
                if not response_text or response_text.startswith("⚠️") or response_text.startswith("❌"):
                    raise Exception("BibleForge AI generation failed due to API error")
                    
                text = response_text.strip()
                if len(text) > 500: # 最低500文字以上の出力を保証 (API破棄ループを防ぐためのMVP基準)
                    final_content = text
                    logging.info(f"Bible generated successfully in one shot ({len(text)} chars).")
                    break 
                else:
                    logging.warning(f"Output too short ({len(text)} chars). Retrying...")
            except Exception as e:
                err_msg = str(e).lower()
                if "429" in err_msg or "resource_exhausted" in err_msg or "quota" in err_msg:
                    wait_time = 65 * (attempt + 1)
                    logging.warning(f"Rate Limit (429) Error detected. Waiting for {wait_time} seconds before retrying... (Attempt {attempt+1})")
                    time.sleep(wait_time)
                else:
                    logging.warning(f"Forge Error ({e}). Retrying... (Attempt {attempt+1})")
                    time.sleep(20 * (attempt + 1))
        
        if not final_content:
            logging.error(f"Abandoning forge for {champion_name} due to failure.")
            return None
        
        # --- 自己進化（マーケティング部によるレビューと再構築） ---
        logging.info("--- 🧬 Initiating Auto-Evolution Phase ---")
        final_content = evolution_engine.evolve_draft(final_content)
        
        output_file = Path(f"d:/my_work/02_FACTORY/PRODUCTS/ARTICLES/ARTICLE_{champion_name}_16.8.1.md")
        output_file.parent.mkdir(parents=True, exist_ok=True)
        output_file.write_text(final_content, encoding="utf-8")
        
        logging.info(f"--- SUCCESS! Article generated at: {output_file} ({len(final_content)} chars) ---")
        self.send_notification(champion_name, output_file)
        
        # --- 自動でChampionDB をマージ・更新する ---
        try:
            from v2_CORE.champ_db_updater import update_champion_db
            # チャンピオン名はファイル名などから適切に取るのがベターだが、ここでは引数のchampion_nameを使用
            update_champion_db(champion_name, champion_name, final_content)
        except Exception as e:
            logging.error(f"Failed to auto-update Champion DB: {e}")
            
        return output_file

def main():
    parser = argparse.ArgumentParser(description="Master Bible Forge Engine")
    parser.add_argument("champion", help="Champion name")
    parser.add_argument("--context", help="Additional context or research data", default="")
    args = parser.parse_args()
    
    forge = BibleForge()
    forge.generate_bible(args.champion, args.context)

if __name__ == "__main__":
    main()
