"""
Sovereign Sync: ローカル資産 → Supabase クラウド同期エンジン
postgrest ライブラリで直接 REST API を叩くシンプルな実装。
"""
import os
import json
import logging
import httpx
from pathlib import Path
import dotenv

dotenv.load_dotenv(Path("d:/my_work/.env"))
logger = logging.getLogger("SovereignSync")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s [%(name)s] %(message)s"))
    logger.addHandler(handler)


class SovereignSync:
    """
    ローカルの記事・マッチアップデータを Supabase REST API 経由でクラウドへ同期する。
    """
    def __init__(self):
        self.url = os.getenv("SUPABASE_URL")
        self.key = os.getenv("SUPABASE_KEY")
        self.ready = bool(self.url and self.key)
        if not self.ready:
            logger.warning("⚠️ SUPABASE_URL / SUPABASE_KEY が未設定。同期スキップ。")

    def _headers(self):
        return {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"  # UPSERT 動作
        }

    def _api(self, table):
        return f"{self.url}/rest/v1/{table}"

    def extract_keywords(self, content):
        """記事内容からキーワード（アイテム名、チャンプ名、重要タグ）を抽出"""
        import re
        keywords = []
        # 1. 【 】で囲まれた単語
        brackets = re.findall(r"【(.*?)】", content)
        for b in brackets:
            term = b.strip()
            # バージョン番号（数字とドットのみ）は除外
            if not re.match(r"^[\d\.]+$", term) and len(term) < 15:
                keywords.append(term)
        
        # 重複削除
        return list(set(keywords))[:10]

    def sync_articles(self):
        """02_FACTORY/PRODUCTS/ARTICLES 内の .md ファイルを全て同期"""
        if not self.ready:
            return

        article_dirs = [
            Path("d:/my_work/02_FACTORY/PRODUCTS/ARTICLES"),
            Path("d:/my_work/02_FACTORY/bible/kirei_bible"),
            Path("d:/my_work/01_INTEL/tactics")
        ]
        
        md_files = []
        for d in article_dirs:
            if d.exists():
                md_files.extend(list(d.glob("*.md")))
                
        if not md_files:
            logger.warning("⚠️ 記事フォルダに.mdファイルが見つかりません。")
            return

        logger.info(f"📂 {len(md_files)} 件の記事ファイルを検出 (複数ディレクトリ合計)")

        synced = 0
        for md_file in md_files:
            try:
                content = md_file.read_text(encoding="utf-8")
                title = md_file.stem

                # --- チャンピオン名の解析ロジックを強化 ---
                parts = title.split("_")
                champion = "Unknown"
                
                if "HONKI_BIBLE" in title:
                    # HONKI_BIBLE_Champion_Patch.md
                    if len(parts) >= 3: champion = parts[2]
                elif "sovereign_draft" in title:
                    # sovereign_draft_Patch_Champion_Role.md
                    if len(parts) >= 4: champion = parts[3]
                elif len(parts) > 1:
                    # Champion_Description.md
                    champion = parts[0]
                
                # 特殊なケース: チャンピオン名がバージョン番号っぽかったら次を探す
                import re
                if re.match(r"^[\d\.]+$", champion) and len(parts) > parts.index(champion) + 1:
                    champion = parts[parts.index(champion) + 1]

                # キーワード抽出
                keywords = self.extract_keywords(content)
                if champion != "Unknown" and champion not in keywords:
                    # チャンプ名もキーワードに含める
                    keywords.insert(0, champion)

                data = {
                    "title": title,
                    "content": content,
                    "champion": champion,
                    "keywords": keywords,
                    "file_path": str(md_file)
                }

                res = httpx.post(
                    self._api("bible_articles") + "?on_conflict=title",
                    headers=self._headers(),
                    json=data,
                    timeout=15
                )

                # カラムが存在しないなどの理由でエラーが発生した場合の自動フォールバック
                if res.status_code == 400 and ("column" in res.text or "keywords" in res.text):
                    logger.warning(f"⚠️ {title} の同期に失敗しました（Supabase側に keywords カラムがない可能性があります）。keywords を除外してフォールバック同期します...")
                    fallback_data = data.copy()
                    fallback_data.pop("keywords", None)
                    res = httpx.post(
                        self._api("bible_articles") + "?on_conflict=title",
                        headers=self._headers(),
                        json=fallback_data,
                        timeout=15
                    )

                if res.status_code in (200, 201):
                    synced += 1
                else:
                    logger.error(f"❌ 同期失敗 ({title}): {res.status_code} {res.text[:200]}")

            except Exception as e:
                logger.error(f"❌ {md_file.name}: {e}")

        logger.info(f"✅ 記事同期完了: {synced}/{len(md_files)} 件")

    def sync_matchups(self):
        """マッチアップ同期データをクラウドへ"""
        if not self.ready:
            return

        sync_js = Path("d:/my_work/01_INTEL/matchup_memo/auto_sync.js")
        if not sync_js.exists():
            logger.info("ℹ️ マッチアップ同期ファイルなし。スキップ。")
            return

        try:
            text = sync_js.read_text(encoding="utf-8")
            if "const AUTO_SYNC_MATCHUPS =" not in text:
                return

            json_str = text.split("const AUTO_SYNC_MATCHUPS =", 1)[1].strip().rstrip(";")
            matchups = json.loads(json_str)

            synced = 0
            for m in matchups:
                data = {
                    "matchup_id": str(m.get("id", "")),
                    "title": m.get("title", ""),
                    "champion": m.get("champion", ""),
                    "enemy": m.get("enemy", ""),
                    "strategy": m.get("strategy", ""),
                    "raw_data": m
                }

                res = httpx.post(
                    self._api("matchup_sentinel"),
                    headers=self._headers(),
                    json=data,
                    timeout=15
                )

                if res.status_code in (200, 201):
                    synced += 1

            logger.info(f"✅ マッチアップ同期完了: {synced}/{len(matchups)} 件")
        except Exception as e:
            logger.error(f"❌ マッチアップ同期エラー: {e}")

    def run_sync(self):
        """全同期の実行"""
        logger.info("🚀 Sovereign Cloud Sync 開始...")
        self.sync_articles()
        self.sync_matchups()
        logger.info("🏁 クラウド同期 完了。")


if __name__ == "__main__":
    sync = SovereignSync()
    sync.run_sync()
