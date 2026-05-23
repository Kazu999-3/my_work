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

dotenv.load_dotenv(Path("D:/my_work/.env"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

class BibleForge:
    """
    Tool J: Master Bible Forge v1.0
    10,000文字級の「本気」バイブルを分割生成して結合するエンジン。
    """
    def __init__(self):
        self.api_key = os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            logging.error("GEMINI_API_KEY is not set.")
            sys.exit(1)
            
        self.client = genai.Client(api_key=self.api_key)
        self.model_id = "gemini-1.5-flash-8b" # 最新の2.5系を採用
        self.discord_webhook = os.environ.get("DISCORD_WEBHOOK")

    def send_notification(self, champ: str, file_path: Path):
        """Discord への完了通知"""
        if not self.discord_webhook:
            return
        try:
            payload = {
                "embeds": [{
                    "title": f"👑 究極の書、完成せり：{champ}",
                    "description": f"パッチ 16.8.1 対応の10,000文字級『本気バイブル』の鍛造が完了しました。\n\n**ファイルパス:** `{file_path}`",
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
        
        # 章の定義
        sections = [
            {
                "title": "🎭 序章：心理的支配とメタの解釈",
                "focus": "読者の心を掴む煽り、パッチメタにおける存在意義、心理的優位性の構築。AI臭を一蹴する強い言葉。"
            },
            {
                "title": "🧭 第1章：適応型ビルド理論と深層統計",
                "focus": "状況別のアイテム分岐、ルーンの数学的根拠、Hidden Stat（隠れた勝率スパイク）の解説。"
            },
            {
                "title": "⚡ 第2章：ミクロの極致・スキルの『呼吸』",
                "focus": "AAキャンセル、隠しコンボ、エフェクトの隠蔽、プロ級の操作技術を詳細に言語化。"
            },
            {
                "title": "🗺️ 第3章：マクロプロトコル・戦場の支配",
                "focus": "ジャングルルート（時間指定）、オブジェクト優先順位、時間帯別の立ち回り。"
            },
            {
                "title": "⚔️ 第4章：マッチアップ・全方位制圧マトリクス",
                "focus": "主要対面への具体的なカウンタープラン、スキル交換のタイミング、心理戦の仕掛け方。"
            },
            {
                "title": "🎓 終章：王への道・明日からの宿題",
                "focus": "今日から意識を変えるための一つの行動、読者への激励。"
            }
        ]
        
        full_markdown = []
        
        for i, sec in enumerate(sections):
            logging.info(f"Forging Section {i+1}/{len(sections)}: {sec['title']}")
            
            prompt = f"""
            League of Legendsの超ハイエンドな攻略記事（バイブル）を作成しています。
            ターゲットは「本気で勝ちたい、他を圧倒したいプレイヤー」です。
            
            【現在の対象チャンピオン】: {champion_name}
            【この章のタイトル】: {sec['title']}
            【重点項目】: {sec['focus']}
            {meta_prompt}
            【追加コンテキスト】: {additional_context}
            
            【厳格な執筆ルール (Ghost Writer 制約)】
            1. **圧倒的な密度**: 1つの章だけで1,500～2,000文字程度の圧倒的ボリュームを執筆してください。
            2. **Antigravityスタイル**: 「～だ」「～である」といった強い口調。感情を揺さぶる論理的かつ情熱的な煽り。
            3. **情報の具体性**: コンボ入力、秒数、距離、心理状態の変化を具体的に記述してください。
            4. **Anti-AI-Smell**: 挨拶、まとめ（「いかがでしたか？」）、メタな構造宣言（「本記事では〜」）、保険表現（「状況によりますが」）、AI特有のテンプレ比喩（「羅針盤」「架け橋」）は絶対に禁止。
            5. **「ティアリスト」形式の安易な格付けは禁止**: 具体的な戦術的優位性を論理で語ってください。
            6. **Evidence Gap**: 具体的なプロの動きや対面事例を挙げ、「いつ・どこで・何が起きたか」の架空ではない証拠感を演出してください。
            """
            
            max_retries = 3
            section_success = False
            for attempt in range(max_retries):
                try:
                    response = self.client.models.generate_content(
                        model=self.model_id,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            temperature=0.75,
                            top_p=0.95,
                            max_output_tokens=4000
                        )
                    )
                    text = response.text.strip() if response.text else ""
                    if len(text) > 500: # 最低500文字以上の出力を保証
                        full_markdown.append(text)
                        logging.info(f"Section {i+1} completed ({len(text)} chars).")
                        section_success = True
                        # クォータ制限徹底回避のため長めのインターバル
                        time.sleep(60)
                        break 
                    else:
                        logging.warning(f"Section {i+1} output too short ({len(text)} chars). Retrying...")
                except Exception as e:
                    if ("503" in str(e) or "429" in str(e) or "exhausted" in str(e).lower()) and attempt < max_retries - 1:
                        wait_time = (attempt + 1) * 120 
                        logging.warning(f"Forge Error ({e}). Retrying in {wait_time}s... (Attempt {attempt+1})")
                        time.sleep(wait_time)
                    else:
                        logging.error(f"Section {i+1} failed definitively: {e}")
                        break
            
            if not section_success:
                logging.error(f"Abandoning forge for {champion_name} due to failure at section {i+1}")
                return None

        # 結合とディレクトリ保存
        if not full_markdown or len(full_markdown) < len(sections):
            logging.error("Not all sections were forged. Aborting file write.")
            return None
            
        final_content = "\n\n---\n\n".join(full_markdown)
        
        # --- 自己進化（マーケティング部によるレビューと再構築） ---
        logging.info("--- 🧬 Initiating Auto-Evolution Phase ---")
        final_content = evolution_engine.evolve_draft(final_content)
        
        output_file = Path(f"d:/my_work/03_FACTORY/PRODUCTS/ARTICLES/HONKI_BIBLE_{champion_name}_16.8.1.md")
        output_file.parent.mkdir(parents=True, exist_ok=True)
        output_file.write_text(final_content, encoding="utf-8")
        
        logging.info(f"--- SUCCESS! 'Honki' Bible forged at: {output_file} ({len(final_content)} chars) ---")
        self.send_notification(champion_name, output_file)
        
        # --- 自動でChampionDB (辞典) をマージ・更新する ---
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
