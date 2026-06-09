import os
import json
import logging
import httpx
from pathlib import Path
import dotenv

dotenv.load_dotenv(Path("d:/my_work/.env"))
logger = logging.getLogger("DictSynthesizer")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s [%(name)s] %(message)s"))
    logger.addHandler(handler)

from v2_CORE.ai_helper import generate_content_safe
from v2_CORE.herald import herald
from google import genai

class DictSynthesizer:
    def __init__(self):
        self.url = os.getenv("SUPABASE_URL")
        self.key = os.getenv("SUPABASE_KEY")
        self.gemini_key = os.getenv("GEMINI_API_KEY_FREE") or os.getenv("GEMINI_API_KEY")
        
        self.ready = bool(self.url and self.key and self.gemini_key)
        if not self.ready:
            logger.error("⚠️ 環境変数が不足しています。")
            
        if self.gemini_key:
            self.client = genai.Client(api_key=self.gemini_key)

    def _headers(self):
        return {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"
        }

    def _api(self, table):
        return f"{self.url}/rest/v1/{table}"

    def fetch_champions(self):
        logger.info("🔍 チャンピオン辞典(matchup_sentinel)のGLOBALレコードを取得中...")
        res = httpx.get(
            self._api("matchup_sentinel") + "?enemy=eq.GLOBAL",
            headers=self._headers(),
            timeout=15
        )
        if res.status_code == 200:
            return res.json()
        else:
            logger.error(f"❌ データ取得失敗: {res.status_code}")
            return []

    def synthesize_text(self, champion, text):
        prompt = f"""
あなたはLoLの最上位プレイヤー（チャレンジャー／プロコーチ）です。
以下のテキストは、攻略ライブラリからチャンピオン「{champion}」の辞典に統合された複数の記事の寄せ集めです。
情報が重複していたり、構成がバラバラで読みにくいため、これらの内容を読み込んで**綺麗に要約・統合（マージ）された1つのMarkdownドキュメント**に再構成してください。

【要件】
- 以下のフォーマットに沿って整理してください。
- 各記事から得られる重要な知見は漏らさず、重複する内容は1つにまとめてください。
- 日本語で出力してください。

【出力フォーマット】
### 📌 主要な戦略と役割
(このチャンピオンの強みや勝つための基本戦略)

### 🧠 マクロ・ウェーブ管理
(ファーム、ガンク、オブジェクト管理、ウェーブコントロールなど)

### 🗡️ ミクロ・スキルコンボ
(トレードのコツ、スキルの使い方、集団戦の立ち回りなど)

### 💡 対策・その他Tips
(弱点、警戒すべきこと、その他重要な知見)

【対象の生テキスト（ごちゃごちゃな状態）】
{text}
"""
        return generate_content_safe(
            self.client,
            prompt,
            feature_name="dict_synthesizer"
        )

    def process_and_update(self, limit=5):
        if not self.ready:
            return

        champions = self.fetch_champions()
        processed_count = 0
        processed_champions = []

        for champ_data in champions:
            if processed_count >= limit:
                break

            champion_name = champ_data.get("champion")
            raw_data = champ_data.get("raw_data", {})
            if not isinstance(raw_data, dict):
                continue

            needs_update = False
            updated_raw_data = dict(raw_data)
            
            # 既存のアーカイブ用フィールドがなければ作成
            if "archived_notes" not in updated_raw_data:
                updated_raw_data["archived_notes"] = {}

            # 1. note_draft の整理
            note_draft = updated_raw_data.get("note_draft", "")
            if isinstance(note_draft, str) and note_draft.count("## 【記事】") >= 1:
                logger.info(f"🔄 {champion_name} の note_draft をAIで整理します...")
                # アーカイブに退避
                updated_raw_data["archived_notes"]["note_draft_raw"] = note_draft
                
                synthesized = self.synthesize_text(champion_name, note_draft)
                if not synthesized.startswith("⚠️") and not synthesized.startswith("❌"):
                    updated_raw_data["note_draft"] = synthesized
                    needs_update = True
                    
            # 2. customFields の整理（特定のフィールドにごちゃごちゃがある場合）
            custom_fields = updated_raw_data.get("customFields", {})
            updated_custom_fields = dict(custom_fields)
            
            for field, content in custom_fields.items():
                if isinstance(content, str) and content.count("## 【記事】") >= 1:
                    logger.info(f"🔄 {champion_name} の customField '{field}' をAIで整理します...")
                    updated_raw_data["archived_notes"][f"{field}_raw"] = content
                    
                    synthesized = self.synthesize_text(champion_name, content)
                    if not synthesized.startswith("⚠️") and not synthesized.startswith("❌"):
                        updated_custom_fields[field] = synthesized
                        needs_update = True

            if needs_update:
                updated_raw_data["customFields"] = updated_custom_fields
                
                # データベースの更新
                update_payload = {
                    "matchup_id": champ_data["matchup_id"],
                    "raw_data": updated_raw_data
                }
                
                res = httpx.post(
                    self._api("matchup_sentinel") + "?on_conflict=matchup_id",
                    headers=self._headers(),
                    json=update_payload,
                    timeout=15
                )
                
                if res.status_code in (200, 201, 204):
                    logger.info(f"✅ {champion_name} の辞典整理＆更新が完了しました！")
                    processed_count += 1
                    processed_champions.append(champion_name)
                else:
                    logger.error(f"❌ 更新エラー ({champion_name}): {res.text}")

        if processed_count > 0:
            champ_list_str = ", ".join(processed_champions)
            herald.notify_progress(f"✨ **【辞典 Synthesizer】** {processed_count}体のチャンピオン辞典の乱雑な記事をAIで綺麗に整理・統合しました！\n- 対象: {champ_list_str}")
            logger.info(f"🎉 今回の整理サイクルで {processed_count} 体のチャンピオンを処理しました。")
        else:
            logger.info("ℹ️ 今回整理が必要なチャンピオンは見つかりませんでした。")

if __name__ == "__main__":
    synthesizer = DictSynthesizer()
    # 1回の実行で最大5体を処理する
    synthesizer.process_and_update(limit=5)
