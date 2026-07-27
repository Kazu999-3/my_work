"""
Sovereign Sync: ローカル資産 → Supabase クラウド同期エンジン
postgrest ライブラリで直接 REST API を叩くシンプルな実装。
"""
import os
import re
import json
import logging
import httpx
from pathlib import Path
from datetime import datetime, timezone
import dotenv
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from v2_CORE.knowledge_revisions import record_matchup_sentinel_revision
from v2_CORE._LOL.champ_id_normalizer import normalize_champion_id

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

    def _sync_to_champion_dictionary(self, champion, content, title, source_folder):
        """チャンピオン辞典 (matchup_sentinel) の GLOBAL レコードに情報を追記する"""
        if not champion or champion == "Unknown":
            return False

        # 他の全書き込み経路と同じ正規化済みIDで matchup_id を作る（重複レコード防止）
        champion = normalize_champion_id(champion)
        matchup_id = f"champ_{champion}_global"
        
        # 1. 既存のレコードを取得
        get_res = httpx.get(
            f"{self._api('matchup_sentinel')}?matchup_id=eq.{matchup_id}",
            headers={"apikey": self.key, "Authorization": f"Bearer {self.key}"},
            timeout=10
        )
        
        existing = {}
        if get_res.status_code == 200 and len(get_res.json()) > 0:
            existing = get_res.json()[0]
            
        raw_data = existing.get("raw_data", {})
        if not isinstance(raw_data, dict):
            raw_data = {}
            
        custom_fields = raw_data.get("customFields", {})
        if not isinstance(custom_fields, dict):
            custom_fields = {}
            
        # マージ用のヘルパー関数
        def merge_content(existing, new_content, title):
            if not existing or existing.strip() == "":
                return new_content
            if new_content.strip() == existing.strip():
                return existing
            
            header = f"## 【記事】{title}"
            if header in existing:
                import re
                # 既にこのタイトルの記事がマージされている場合は、そのセクションだけを更新
                pattern = r"## 【記事】" + re.escape(title) + r"\s*\n.*?(?=\n---|\Z)"
                replacement = f"{header}\n\n{new_content}"
                new_text, count = re.subn(pattern, replacement, existing, flags=re.DOTALL)
                if count > 0:
                    return new_text
            
            # すでに全文が含まれている場合は追加しない
            if new_content in existing:
                return existing
                
            # それ以外は末尾に追記
            return f"{existing}\n\n---\n\n{header}\n\n{new_content}"

        # フォルダやタイトルに応じて格納場所を振り分け、良い形でマージする
        if source_folder == "kirei_bible":
            custom_fields["動画解析・特記事項 (Kirei)"] = merge_content(custom_fields.get("動画解析・特記事項 (Kirei)", ""), content, title)
        elif "HONKI_BIBLE" in title or "ARTICLE" in title:
            # 記事ドラフトは専用フィールドに格納（既存の辞典UIの `note_draft` 枠）
            raw_data["note_draft"] = merge_content(raw_data.get("note_draft", ""), content, title)
        else:
            # その他の戦術メモ等は、タイトルをそのまま項目名として追加
            field_name = title.replace(f"{champion}_", "").replace(f"_{champion}", "")
            custom_fields[field_name] = merge_content(custom_fields.get(field_name, ""), content, title)

        raw_data["customFields"] = custom_fields
        raw_data["source"] = "champ_db"
        raw_data["role"] = "GLOBAL"
        
        # 辞典一覧の「更新日」は created_at を見ているため、更新時も明示的に現在時刻を入れる
        data = {
            "matchup_id": matchup_id,
            "champion": champion,
            "enemy": "GLOBAL",
            "title": existing.get("title", f"{champion} 基本戦略・トレンド"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "strategy": existing.get("strategy", ""),
            "raw_data": raw_data
        }

        # UPSERT
        res = httpx.post(
            self._api("matchup_sentinel") + "?on_conflict=matchup_id",
            headers=self._headers(),
            json=data,
            timeout=15
        )
        
        if res.status_code in (200, 201, 204):
            record_matchup_sentinel_revision(
                matchup_id, existing or None, data,
                source_title=f"記事同期: {title}",
                supabase_url=self.url, supabase_key=self.key
            )
            return True
        else:
            logger.error(f"❌ 辞典同期失敗 ({champion}): {res.status_code} {res.text[:200]}")
            return False

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
                display_title = title
                
                explicit_champion = None
                explicit_champions = []  # 複数チャンピオン対応リスト
                champ_match = re.search(r"\[Champion[s]?:\s*([^\]]+)\]", content)
                if champ_match:
                    raw = champ_match.group(1).strip()
                    # カンマ区切りで複数チャンピオン名をパース
                    candidates = [c.strip() for c in raw.split(",") if c.strip()]
                    fake_champs = {"unknown", "[youtube]", "youtube", "jungle", "jg", "lol", "article", "draft", "system", "live", "global", "test", "sns", "macro"}
                    valid = [c for c in candidates if c.lower() not in fake_champs]
                    if valid:
                        explicit_champions = valid
                        explicit_champion = valid[0]  # 先頭を代表チャンピオンとして使用

                # Markdown内の「# タイトル」行があれば、それを正式な表示名として採用
                for line in content.splitlines():
                    if line.startswith("# "):
                        extracted = line[2:].strip()
                        if extracted:
                            # kirei_bible や youtube 系なら [YouTube] タグを付与
                            if "kirei_bible" in md_file.parts or "youtube" in str(md_file).lower():
                                display_title = f"[YouTube] {extracted}"
                            else:
                                display_title = extracted
                        break

                # --- チャンピオン名の解析ロジックを強化 ---
                if explicit_champion:
                    champion = explicit_champion
                else:
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
                    elif len(parts) == 1:
                        # スペース区切りの場合 (例: "[YouTube] Jungle Guide...")
                        first_word = title.split(" ")[0]
                        if not first_word.startswith("["):
                            champion = first_word
                    
                    # 特殊なケース: チャンピオン名がバージョン番号っぽかったら次を探す
                    if re.match(r"^[\d\.]+$", champion) and len(parts) > parts.index(champion) + 1:
                        champion = parts[parts.index(champion) + 1]

                    # 偽のチャンピオン名（汎用タグやYouTubeタグ）を除外
                    fake_champions = ["[YouTube]", "YouTube", "Jungle", "jg", "lol", "ARTICLE", "draft", "SYSTEM", "LIVE", "GLOBAL", "test", "sns", "macro", "Unknown"]
                    if champion in fake_champions or champion.lower() in fake_champions:
                        champion = "Unknown"
                        
                    # YouTube動画ID等（Kirei_bible等での英数字羅列）の誤検知を防止
                    if len(champion) >= 6 and not re.match(r"^[A-Z][a-z]+$", champion) and ("kirei_bible" in md_file.parts or len(parts) == 1):
                        champion = "Unknown"

                # キーワード抽出
                keywords = self.extract_keywords(content)
                for champ_name in (explicit_champions if explicit_champions else ([champion] if champion != "Unknown" else [])):
                    if champ_name not in keywords:
                        keywords.insert(0, champ_name)

                # Kireiバイブル判定
                is_kirei = "kirei_bible" in md_file.parts

                # チャンピオン辞典へ統合を試みる（複数チャンピオン対応）
                champions_to_sync = explicit_champions if explicit_champions else ([champion] if champion != "Unknown" else [])
                integrated_count = 0
                for champ_name in champions_to_sync:
                    ok = self._sync_to_champion_dictionary(champ_name, content, title, md_file.parent.name)
                    if ok:
                        integrated_count += 1
                        logger.info(f"  ✅ [{champ_name}] 辞典統合完了")
                    else:
                        logger.warning(f"  ⚠️ [{champ_name}] 辞典統合スキップ")

                # 全チャンピオンへの統合が1件以上成功したかチェック
                integrated = integrated_count > 0
                
                if integrated and not is_kirei:
                    # チャンピオン専用記事（非YouTube解析）は辞典統合後、ライブラリから削除
                    httpx.delete(
                        self._api("personal_knowledge") + f"?title=eq.{display_title}",
                        headers=self._headers(),
                        timeout=10
                    )
                    synced += 1
                    continue
                # kirei_bible（YouTube動画解析）記事は辞典に統合しつつ、
                # 攻略ライブラリにも残す（汎用テーマの記事がライブラリから消える問題を防止）
                
                data = {
                    "title": display_title,
                    "raw_content": content,
                    "champion": champion if champion != "Unknown" else None,
                    "tags": keywords,
                    "source_url": str(md_file)
                }

                res = httpx.post(
                    self._api("personal_knowledge") + "?on_conflict=title",
                    headers=self._headers(),
                    json=data,
                    timeout=15
                )

                # カラムが存在しないなどの理由でエラーが発生した場合の自動フォールバック
                if res.status_code == 400 and ("column" in res.text or "tags" in res.text):
                    logger.warning(f"⚠️ {title} の同期に失敗しました（Supabase側に tags カラムがない可能性があります）。tags を除外してフォールバック同期します...")
                    fallback_data = data.copy()
                    fallback_data.pop("tags", None)
                    res = httpx.post(
                        self._api("personal_knowledge") + "?on_conflict=title",
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
                matchup_id = str(m.get("id", ""))
                # 辞典/対面メモ一覧の「更新日」は created_at を見ているため、更新時も
                # 明示的に現在時刻を入れる（同じmatchup_idを繰り返し同期するケースがある）
                data = {
                    "matchup_id": matchup_id,
                    "title": m.get("title", ""),
                    "champion": m.get("champion", ""),
                    "enemy": m.get("enemy", ""),
                    "strategy": m.get("strategy", ""),
                    "raw_data": m,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }

                existing = {}
                try:
                    get_res = httpx.get(
                        f"{self._api('matchup_sentinel')}?matchup_id=eq.{matchup_id}&select=title,strategy,raw_data",
                        headers={"apikey": self.key, "Authorization": f"Bearer {self.key}"},
                        timeout=10
                    )
                    if get_res.status_code == 200 and get_res.json():
                        existing = get_res.json()[0]
                except Exception:
                    pass

                res = httpx.post(
                    self._api("matchup_sentinel"),
                    headers=self._headers(),
                    json=data,
                    timeout=15
                )

                if res.status_code in (200, 201):
                    synced += 1
                    record_matchup_sentinel_revision(
                        matchup_id, existing or None, data,
                        source_title="ローカルマッチアップメモ同期",
                        supabase_url=self.url, supabase_key=self.key
                    )

            logger.info(f"✅ マッチアップ同期完了: {synced}/{len(matchups)} 件")
        except Exception as e:
            logger.error(f"❌ マッチアップ同期エラー: {e}")

    def flush_offline_queue(self, batch_size=50):
        """オフライン待避キューを 50 件ずつの安全バッチに分割して全送信"""
        queue_path = Path("d:/my_work/02_FACTORY/offline_queue.json")
        if not queue_path.exists() or not self.ready: return
        try:
            items = json.loads(queue_path.read_text(encoding="utf-8"))
            if not items: return
            logger.info(f"🔄 オフライン待避データ {len(items)} 件を {batch_size} 件バッチでクラウド送信中...")
            remaining = []
            for i in range(0, len(items), batch_size):
                batch = items[i:i + batch_size]
                try:
                    res = httpx.post(self._api("sovereign_tasks"), headers=self._headers(), json=batch, timeout=20)
                    if res.status_code not in (200, 201, 204): remaining.extend(batch)
                except Exception:
                    remaining.extend(batch)
            if remaining:
                queue_path.write_text(json.dumps(remaining), encoding="utf-8")
            else:
                queue_path.unlink(missing_ok=True)
        except Exception as e:
            logger.error(f"❌ オフラインキュー同期エラー: {e}")

    def run_sync(self):
        """全同期の実行"""
        logger.info("🚀 Sovereign Cloud Sync 開始...")
        self.flush_offline_queue()
        self.sync_articles()
        self.sync_matchups()
        logger.info("🏁 クラウド同期 完了。")
        
        # 完了通知
        try:
            from v2_CORE.pulse import pulse
            pulse.send_discord_notification(
                title="クラウド同期 (Sovereign Sync) 完了",
                description="ローカルの知識資産（攻略記事・Kireiバイブル・マッチアップデータ）を Supabase へ同期しました。"
            )
        except Exception as e:
            logger.error(f"通知送信エラー: {e}")



if __name__ == "__main__":
    sync = SovereignSync()
    sync.run_sync()
