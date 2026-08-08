import os
import time
import logging
import requests
import json
import random
from datetime import datetime, timezone
from google import genai
from v2_CORE.settings import settings
from v2_CORE.ai_helper import generate_content_safe
from v2_CORE._LOL.herald import herald
from v2_CORE._LOL.champ_id_normalizer import get_latest_ddragon_version
from v2_CORE.knowledge_revisions import record_matchup_sentinel_revision
from v2_CORE._LOL.champ_id_normalizer import normalize_champion_id

logger = logging.getLogger("OverseasScout")

class OverseasScout:
    """
    Antigravity Sovereign OS: Overseas Scout
    海外のメタ情報やプロのビルドを分析し、チャンピオン辞典の空欄を自動で埋める。
    """
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY_FREE or settings.GEMINI_API_KEY
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None
            
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_KEY")

    def _get_headers(self):
        return {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"
        }

    def fetch_champions(self):
        """DDragon から最新のチャンピオンリストを取得"""
        try:
            latest = get_latest_ddragon_version()
            if latest:
                r = requests.get(f'https://ddragon.leagueoflegends.com/cdn/{latest}/data/ja_JP/champion.json')
                if r.status_code == 200:
                    data = r.json().get('data', {})
                    return list(data.keys())
        except Exception as e:
            logger.error(f"Failed to fetch champions dynamically: {e}")
        return []

    def generate_champ_data(self, champ_id):
        """Gemini を用いて特定のチャンピオンの攻略データを生成"""
        if not self.client:
            return None

        from v2_CORE.database import db
        try:
            # データベースからこのチャンピオンに関する知識を引き出す
            tactics_results = db.query_intelligence(f"tactical_report {champ_id}", n_results=3)
            tactics_info = tactics_results.get("documents", []) if tactics_results else []
        except Exception as e:
            logger.warning(f"Failed to query ChromaDB for {champ_id}: {e}")
            tactics_info = []

        prompt = f"""
        あなたは LoL の世界情勢を精査するプロのアナリストです。
        【最重要】必ず「2026年（パッチ26.x以降）」の最新環境に基づいて、チャンピオン「{champ_id}」の攻略辞典データを生成してください。
        古い過去のパッチ（14.x, 15.x等）のデータは絶対に除外してください。

        【データベースからの参考知識（Kirei氏の動画や教科書の知識など）】
        以下の検索結果がある場合、その知識を優先して辞典に組み込んでください。
        {tactics_info}

        【ジャングルフルクリア時間に関する注意】
        - パッチ26.x（2026年）では中立モンスターのHPが約15%増加しているため、過去のパッチの高速クリア時間（3:10前後など）は現在不可能です。
        - 必ず「2026年現在の、モンスターHP増加調整を受けた後の現実的な最速フルクリア時間（例：3:20〜3:38程度）」を調査または推測して記載してください。

        【出力フォーマット (JSONのみ)】
        {{
            "strengths": "2026年環境における強み（例：序盤のガンクが強力、集団戦のエンゲージ等）を箇条書きで簡潔に",
            "weaknesses": "2026年環境における弱み（例：CCに弱い、マナ持ちが悪い等）を箇条書きで簡潔に",
            "powerSpikes": "2026年現在のパワースパイク（いつ、どの新アイテム完成で最も強いか）",
            "buildRunes": "2026年（パッチ26.x以降）の最新推奨コアビルド（新アイテム対応）とキーストーン・ルーン",
            "fullClearTime": "ジャングラーの場合、2026年の仕様変更後（モンスター硬化後）の平均フルクリア時間（ジャングラー以外は空文字にする）",
            "counterChampions": "対面で不利な、あるいは有利なカウンターチャンプ数名（理由も簡潔に）",
            "mustBanChampions": "このチャンプを使う場合にBAN必須・推奨のチャンプ名",
            "pickRecommendation": "先出し（ブラインドピック）が安全か、後出しでカウンターとして出すべきかの推奨情報",
            "strategy": "2026年最新メタでの立ち回りや、BAN/ピックにおける評価を100文字程度で"
        }}
        """

        max_retries = 3
        for attempt in range(max_retries):
            try:
                response_text = generate_content_safe(
                    self.client,
                    prompt,
                    settings.DEFAULT_MODEL,
                    feature_name="oracle"
                )
                
                if not response_text or response_text.startswith("⚠️") or response_text.startswith("❌"):
                    raise Exception("OverseasScout AI generation failed")
                
                # 安全なJSON抽出
                import re
                text = response_text.strip()
                match = re.search(r'\{.*\}', text, re.DOTALL)
                if match:
                    json_str = match.group(0)
                    return json.loads(json_str)
                else:
                    return json.loads(text)
            except Exception as e:
                if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e) or "503" in str(e):
                    wait_time = 60 + (30 * attempt) + random.uniform(5.0, 15.0)
                    logger.warning(f"⚠️ Rate limit or server error ({e}) for {champ_id}. Retrying in {wait_time:.1f}s... (Attempt {attempt+1}/{max_retries})")
                    time.sleep(wait_time)
                else:
                    logger.error(f"Generation failed for {champ_id}: {e}")
                    return None
        return None

    def update_champion_dictionary(self, champ_id, data):
        """Supabase のマッチアップ辞典 (GLOBAL) を更新"""
        # 他の全書き込み経路と同じ正規化済みIDで matchup_id を作る（重複レコード防止）
        champ_id = normalize_champion_id(champ_id)
        matchup_id = f"champ_{champ_id}_global"
        url = f"{self.supabase_url}/rest/v1/matchup_sentinel?on_conflict=matchup_id"

        existing_record = None
        try:
            get_url = f"{self.supabase_url}/rest/v1/matchup_sentinel?matchup_id=eq.{matchup_id}&select=title,strategy,raw_data"
            get_r = requests.get(get_url, headers=self._get_headers(), timeout=10)
            if get_r.ok and get_r.json():
                existing_record = get_r.json()[0]
        except Exception as e:
            logger.warning(f"既存データの取得に失敗（新規作成として続行）: {e}")

        # 辞典一覧の「更新日」は created_at を見ているため、更新時も明示的に現在時刻を入れる
        #
        # raw_data は champion_trend_worker.py（「最新トレンド取得」）が書き込む
        # patch_meta/jg_style/pro_builds 等と共有のJSONカラムなので、既存分を維持したまま
        # このスカウトが持つ項目だけを上書きする。以前は raw_data を丸ごと新規オブジェクトで
        # 置き換えていたため、スカウトが3回/日で巡回するたびに他機能が入れたトレンド情報が
        # 毎回消えてしまっていた。
        existing_raw_data = (existing_record or {}).get("raw_data") or {}
        if not isinstance(existing_raw_data, dict):
            existing_raw_data = {}
        payload = {
            "matchup_id": matchup_id,
            "champion": champ_id,
            "enemy": "GLOBAL",
            "title": f"{champ_id} 基本戦略・トレンド (AI Auto)",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "strategy": data.get("strategy", ""),
            "raw_data": {
                **existing_raw_data,
                "source": "overseas_scout",
                "role": "GLOBAL",
                "strengths": data.get("strengths", ""),
                "weaknesses": data.get("weaknesses", ""),
                "powerSpikes": data.get("powerSpikes", ""),
                "buildRunes": data.get("buildRunes", ""),
                "fullClearTime": data.get("fullClearTime", "")
            }
        }
        try:
            r = requests.post(url, headers=self._get_headers(), json=payload)
            if r.ok:
                logger.info(f"✅ Updated dictionary for {champ_id}")
                record_matchup_sentinel_revision(
                    matchup_id, existing_record, payload,
                    source_title="海外情報スカウト（AI自動収集）",
                    supabase_url=self.supabase_url, supabase_key=self.supabase_key
                )
            else:
                logger.error(f"Failed to update Supabase for {champ_id}: {r.text}")
        except Exception as e:
            logger.error(f"Supabase update error: {e}")

    def _pick_stalest(self, champs, batch):
        """
        更新が最も古いチャンピオンから順に選ぶ。

        以前は random.sample だったため同じチャンプを何度も引き、
        全170体を一巡するのに期待324日かかっていた（クーポンコレクター問題）。
        古い順に選べば 170/batch 日で確実に一巡する。
        未登録のチャンピオンは最優先で埋める。
        """
        try:
            res = requests.get(
                f"{self.supabase_url}/rest/v1/champion_facts?select=champion,updated_at",
                headers=self._get_headers(), timeout=15,
            )
            rows = res.json() if res.status_code == 200 else []
        except Exception as e:
            logger.warning(f"更新日時の取得に失敗したためランダム選出にフォールバックします: {e}")
            return random.sample(champs, min(batch, len(champs)))

        updated_at = {}
        for r in rows:
            name = str(r.get("champion") or "")
            if name:
                updated_at[name.lower()] = r.get("updated_at") or ""

        # 未登録(空文字)が先頭に来るので、そのまま昇順で古い順になる
        ordered = sorted(champs, key=lambda c: updated_at.get(c.lower(), ""))
        picked = ordered[:batch]
        never = [c for c in picked if c.lower() not in updated_at]
        logger.info(f"🎯 対象 {len(picked)}体 (うち未登録 {len(never)}体): {', '.join(picked)}")
        return picked

    def run_cycle(self, force_targets=None):
        """一度の実行サイクル"""
        logger.info("🌐 Overseas Scout cycle starting...")
        champs = self.fetch_champions()
        if not champs:
            return 0

        if force_targets:
            targets = [c for c in force_targets if c in champs]
        else:
            # 1サイクルあたりの体数。API負荷とのバランスで調整できるようにする。
            batch = int(os.getenv("SCOUT_BATCH_SIZE", "8"))
            targets = self._pick_stalest(champs, batch)
        
        updated_list = []
        for champ in targets:
            logger.info(f"Researching: {champ}...")
            data = self.generate_champ_data(champ)
            if data:
                self.update_champion_dictionary(champ, data)
                updated_list.append(champ)
            time.sleep(10) # APIレートリミット対策を強化
            
        if updated_list:
            herald.notify_progress(f"👑 **【海外メタ・リサーチ完了】** {', '.join(updated_list)} の戦略データ同期がすべて完了しました！", portal_link=True, page="champdb")
            return len(updated_list)
        return 0

    def run(self):
        """無限ループ"""
        # 他の起動負荷と衝突するのを防ぐため、最初は30秒間待機してから実行を開始する
        logger.info("🌐 Overseas Scout: Waiting 30s before first run to prevent rate-limit clash at startup...")
        time.sleep(30)
        while True:
            updated_count = self.run_cycle()
            if updated_count == 0:
                logger.warning("⚠️ No champions were successfully updated in this cycle. Retrying in 5 minutes...")
                time.sleep(60 * 5)
            else:
                logger.info(f"✅ Successful cycle completed ({updated_count} champs). Sleeping for 24 hours.")
                time.sleep(60 * 60 * 24) # 24時間おき

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    scout = OverseasScout()
    scout.run_cycle()
