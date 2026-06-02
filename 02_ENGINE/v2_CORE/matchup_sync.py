import os
import json
import logging
from pathlib import Path
from google import genai
from google.genai import types
from v2_CORE.ai_helper import generate_content_safe
import dotenv
from datetime import datetime
import uuid

# Setup
dotenv.load_dotenv(Path("D:/my_work/.env"))
logging.basicConfig(level=logging.INFO, format="%(asctime)s [MatchupSync] %(levelname)s: %(message)s")

class MatchupSync:
    """
    Antigravity Sovereign OS: マッチアップ同期エンジン
    リサーチ結果から、Matchup Memoで読み込めるJSON形式のデータを抽出し、
    auto_sync.js として出力する。
    """
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY_FREE") or os.getenv("GEMINI_API_KEY")
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
            self.model_id = "gemini-2.5-flash"
        else:
            self.client = None
            logging.error("GEMINI_API_KEY is not set.")
            
        self.output_path = Path("D:/my_work/01_INTEL/matchup_memo/auto_sync.js")

    def analyze_and_sync(self, raw_intel: str):
        """生のメタ情報やリサーチ結果をマッチアップデータに変換して同期する"""
        if not self.client: return False

        logging.info("🧠 リサーチ情報からマッチアップデータを生成中...")
        
        prompt = f"""
        あなたはLoLのプロアナリストです。
        以下の最新リサーチデータを踏まえ、**Google検索機能（グラウンディング）を用いて「Lolalytics」および「DPM.LOL」から該当マッチアップの最新統計データ（勝率、DPM差、アイテム勝率など）を検索・取得**し、
        以下のJSONフォーマットの配列で出力してください。

        【リサーチデータ（定性情報）】
        {raw_intel}

        【出力フォーマット要件】
        以下のJSON配列のみを出力すること。Markdownの```jsonや説明文は一切含めないでください。
        [
          {{
            "id": "自動生成するユニークなUUID (例: auto-1234)",
            "myChamp": "自チャンプ名 (英語表記, 例: Nidalee)",
            "enemyChamp": "敵チャンプ名 (英語表記, 例: Lee Sin)",
            "lane": "Top / Jg / Mid / Bot / Sup",
            "advantage": "有利 / 五分 / 不利",
            "coreBuild": "コアアイテム",
            "startItem": "スタートアイテム",
            "runes": "キーストーンや主要ルーン",
            "summoners": "サモナースペル",
            "strategy": "戦い方やフックワード。ここに【DPM.LOL 評価】や【Lolalytics 勝率】などの取得した定量データも美しく含めてください。",
            "powerspike": "パワースパイク (例: Lv6以降)",
            "caution": "注意事項",
            "updatedAt": "現在の日時 (ISO 8601フォーマット)"
          }}
        ]
        もし該当するマッチアップ情報がなければ空の配列 [] を出力してください。
        """

        try:
            response_text = generate_content_safe(
                self.client,
                prompt,
                self.model_id,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    tools=[{"google_search": {}}]
                ),
                feature_name="kingdom_cycle"
            )
            if not response_text or response_text.startswith("⚠️") or response_text.startswith("❌"):
                raise Exception("MatchupSync AI generation failed")
            
            # クリーニング
            result_text = response_text.strip()
            if result_text.startswith("```json"):
                result_text = result_text.replace("```json", "").replace("```", "").strip()
            elif result_text.startswith("```"):
                result_text = result_text.replace("```", "").strip()

            data = json.loads(result_text)
            
            # auto_sync.jsへの書き出し
            if data:
                # ランダムIDやタイムスタンプの補完
                for item in data:
                    if not item.get("id"):
                        item["id"] = f"auto-{uuid.uuid4().hex[:8]}"
                    if not item.get("updatedAt"):
                        item["updatedAt"] = datetime.now().isoformat()

                js_content = f"// Sovereign OS Auto-Generated Matchup Data\n// Generated at: {datetime.now().isoformat()}\nconst AUTO_SYNC_MATCHUPS = {json.dumps(data, ensure_ascii=False, indent=2)};\n"
                
                self.output_path.parent.mkdir(parents=True, exist_ok=True)
                with open(self.output_path, "w", encoding="utf-8") as f:
                    f.write(js_content)
                logging.info(f"✅ マッチアップ同期ファイルを更新しました: {self.output_path.name}")
                return True
            else:
                logging.info("ℹ️ 有効なマッチアップデータが抽出されませんでした。")
                return False
                
        except Exception as e:
            logging.error(f"❌ マッチアップ生成中にエラー: {e}")
            return False

if __name__ == "__main__":
    # テスト用の実行
    sync = MatchupSync()
    sample_intel = "最新パッチ情報: Nidaleeは序盤のジャングルクリアが早くなり、Lee Sinに対して圧倒的な有利を取れる。コアはリッチベイン。フックワードは『もうリー・シンに怯えない！最強ニダリールート』。レベル3のカニファイトで必ず仕掛けること。"
    sync.analyze_and_sync(sample_intel)
