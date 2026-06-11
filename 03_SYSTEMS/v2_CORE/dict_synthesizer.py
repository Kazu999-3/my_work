import os
import json
import logging
import httpx
from pathlib import Path
import dotenv

dotenv.load_dotenv(Path("d:/my_work/.env"))
from v2_CORE.logger_config import setup_sovereign_logging
logger = setup_sovereign_logging("DictSynthesizer")

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

    def fetch_generic_articles(self):
        logger.info("🔍 攻略ライブラリから汎用記事を取得中...")
        res = httpx.get(
            self._api("bible_articles"),
            headers=self._headers(),
            timeout=15
        )
        if res.status_code == 200:
            articles = res.json()
            generic = []
            fake_champions = ["", "Unknown", "その他", "[YouTube]", "YouTube", "Jungle", "jg", "lol", "ARTICLE", "draft", "SYSTEM", "LIVE", "GLOBAL", "test", "sns", "macro"]
            for a in articles:
                kw = a.get("keywords", [])
                if kw and "__DELETED__" in kw:
                    continue
                champ = a.get("champion")
                if not champ or champ in fake_champions or champ.lower() in [fc.lower() for fc in fake_champions]:
                    generic.append(a)
            return generic
        else:
            logger.error(f"❌ ライブラリデータ取得失敗: {res.status_code}")
            return []

    def classify_by_genre(self, articles):
        genres = {
            "マクロ": [],
            "ジャングルルート": [],
            "集団戦": [],
            "ドラフト": []
        }
        
        genre_keywords = {
            "マクロ": ["マクロ", "macro", "判断", "ウェーブ", "ファーム", "オブジェクト", "マップ", "視界", "gank", "ガンク"],
            "ジャングルルート": ["ルート", "route", "clear", "パフ", "ジャングルルート", "jgルート", "周回", "1st", "キャンプ"],
            "集団戦": ["集団戦", "teamfight", "戦闘", "ポジショニング", "ミクロ", "立ち回り", "ファイティング"],
            "ドラフト": ["ドラフト", "draft", "構成", "ピック", "バン", "pick", "ban", "メタ"]
        }
        
        for a in articles:
            title = a.get("title", "").lower()
            content = a.get("content", "").lower()
            keywords = [k.lower() for k in a.get("keywords", []) if k]
            
            if "[総合バイブル]" in a.get("title", ""):
                continue
                
            matched_genre = None
            for genre, kws in genre_keywords.items():
                if any(kw in keywords for kw in kws) or any(kw in title for kw in kws) or any(kw in content[:200] for kw in kws):
                    matched_genre = genre
                    break
                    
            if matched_genre:
                genres[matched_genre].append(a)
                
        return genres

    def synthesize_genre_text(self, genre, text):
        prompt = f"""
        あなたはLoLの最上位プレイヤー（チャレンジャー／プロコーチ）です。
        以下のテキストは、攻略ライブラリからジャンル「{genre}」について収集された複数の攻略メモの寄せ集めです。
        情報が重複していたり、読みやすさがバラバラなため、これらを論理的で体系的な1つのMarkdownドキュメント（総合バイブル）に再構成・統合してください。

        【要件】
        - 雑談や重複する内容は省き、実践的で高度な知見を漏らさず体系化してください。
        - 全て**日本語**で出力してください。
        - フォーマットは以下の通り整理してください：
        ### 📌 ジャンル基本概念・重要性
        ### 🧠 判断基準・コア戦略
        ### ⚔️ 実践での立ち回り・コツ
        ### 💡 注意点・警戒すべきこと

        【対象の攻略テキスト群（寄せ集め）】
        {text}
        """
        return generate_content_safe(
            self.client,
            prompt,
            feature_name="dict_synthesizer"
        )

    def process_library_genres(self):
        if not self.ready:
            return
            
        generic_articles = self.fetch_generic_articles()
        if not generic_articles:
            logger.info("ℹ️ 処理対象の汎用記事がありません。")
            return
            
        genres = self.classify_by_genre(generic_articles)
        processed_any = False
        
        for genre, items in genres.items():
            if len(items) < 2:
                continue
                
            target_title = f"[総合バイブル] {genre}"
            existing_article = None
            
            for ga in generic_articles:
                if ga.get("title") == target_title:
                    existing_article = ga
                    break
            
            # API 429を回避するため、一度にマージする新規記事数を最大 5 件に制限します
            limit_items = items[:5]
            
            logger.info(f"🔄 ジャンル「{genre}」の新規記事 {len(items)} 件のうち {len(limit_items)} 件を自動マージします...")
            
            combined_text = ""
            if existing_article:
                combined_text += f"## 【既存の総合バイブル】\n\n{existing_article['content']}\n\n---\n\n"
                
            for item in limit_items:
                combined_text += f"## 【元記事】{item['title']}\n\n{item['content']}\n\n---\n\n"
                
            synthesized = self.synthesize_genre_text(genre, combined_text)
            if synthesized.startswith("⚠️") or synthesized.startswith("❌"):
                logger.error(f"❌ 「{genre}」のマージテキスト生成に失敗しました。")
                continue
                
            payload = {
                "title": target_title,
                "content": synthesized,
                "champion": "Unknown",
                "keywords": [genre, "総合バイブル"],
                "file_path": existing_article.get("file_path") if existing_article else f"d:\\my_work\\02_FACTORY\\bible\\kirei_bible\\genre_{genre}.md"
            }
            
            if existing_article:
                res = httpx.patch(
                    self._api("bible_articles") + f"?id=eq.{existing_article['id']}",
                    headers=self._headers(),
                    json=payload,
                    timeout=15
                )
            else:
                res = httpx.post(
                    self._api("bible_articles"),
                    headers=self._headers(),
                    json=payload,
                    timeout=15
                )
                
            if res.status_code in (200, 201, 204):
                logger.info(f"✅ 「{genre}」の総合バイブル記事を保存しました！")
                processed_any = True
                
                try:
                    file_path = payload["file_path"]
                    os.makedirs(os.path.dirname(file_path), exist_ok=True)
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.write(synthesized)
                    logger.info(f"💾 ローカルファイルに保存完了: {file_path}")
                except Exception as e:
                    logger.error(f"❌ ローカルファイル保存エラー: {e}")
                
                # 今回統合した個別記事のみを __DELETED__ マークします
                for item in limit_items:
                    del_payload = {"keywords": ["__DELETED__"]}
                    httpx.patch(
                        self._api("bible_articles") + f"?id=eq.{item['id']}",
                        headers=self._headers(),
                        json=del_payload,
                        timeout=10
                    )
                logger.info(f"🗑️ 今回統合した個別記事 {len(limit_items)} 件を __DELETED__ マークしました。")
            else:
                logger.error(f"❌ 総合バイブル保存エラー ({genre}): {res.status_code}")
                
        if processed_any:
            herald.notify_progress("✨ **【ライブラリ Synthesizer】** 攻略ライブラリ内の汎用攻略メモをジャンルごとに自動マージ・統合し、新たな「総合バイブル」を錬成しました！")

if __name__ == "__main__":
    synthesizer = DictSynthesizer()
    # 1. チャンピオン辞典の整理
    synthesizer.process_and_update(limit=5)
    # 2. 攻略ライブラリのジャンル別マージ
    synthesizer.process_library_genres()
