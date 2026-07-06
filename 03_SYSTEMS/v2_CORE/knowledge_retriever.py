"""
KnowledgeRetriever — personal_knowledge テーブルからナレッジを横断検索する共有ユーティリティ

各コンポーネント（PersonalCoach, MatchupSimulator, YouTubeAbsorber 等）が
AI生成時にナレッジを参照するための共通インターフェースを提供する。

使い方:
    from v2_CORE.knowledge_retriever import knowledge_retriever
    
    # チャンピオン名で取得
    entries = knowledge_retriever.fetch_by_champion("JarvanIV")
    context = knowledge_retriever.format_as_context(entries)
    
    # 複数チャンピオンを一括取得
    entries = knowledge_retriever.fetch_by_champions(["JarvanIV", "Zyra"])
    context = knowledge_retriever.format_as_context(entries, max_chars=5000)
"""

import os
import logging
import httpx
from typing import Optional

try:
    from v2_CORE.settings import settings
except ImportError:
    import sys
    from pathlib import Path
    sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
    from v2_CORE.settings import settings

logger = logging.getLogger("KnowledgeRetriever")


class KnowledgeRetriever:
    """personal_knowledge テーブルからナレッジを横断検索する共有ユーティリティ"""

    def __init__(self):
        self.url = settings.SUPABASE_URL
        self.key = settings.SUPABASE_KEY
        self.ready = bool(self.url and self.key)
        if not self.ready:
            logger.warning("⚠️ Supabase 環境変数が未設定のため、KnowledgeRetriever は無効です。")

    def _headers(self):
        return {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }

    def _api(self, params: str = "") -> str:
        return f"{self.url}/rest/v1/personal_knowledge{params}"

    def _fetch(self, query_params: str, limit: int = 10) -> list[dict]:
        """共通の取得処理。__DELETED__ タグ付きレコードは自動除外する。"""
        if not self.ready:
            return []

        # __DELETED__ を除外するフィルタを追加
        separator = "&" if "?" in query_params else "?"
        full_params = f"{query_params}{separator}tags=not.cs.{{__DELETED__}}&order=created_at.desc&limit={limit}&select=id,title,content,raw_content,champion,genre,tags"

        try:
            res = httpx.get(self._api(full_params), headers=self._headers(), timeout=10)
            if res.status_code == 200:
                return res.json()
            else:
                logger.warning(f"⚠️ ナレッジ取得失敗: {res.status_code} - {res.text[:200]}")
                return []
        except Exception as e:
            logger.warning(f"⚠️ ナレッジ取得エラー: {e}")
            return []

    def fetch_by_champion(self, champion: str, limit: int = 5) -> list[dict]:
        """特定チャンピオンのナレッジを取得する（champion カラムで完全一致フィルタ）"""
        return self._fetch(f"?champion=eq.{champion}", limit=limit)

    def fetch_by_champions(self, champions: list[str], limit: int = 20) -> list[dict]:
        """複数チャンピオンのナレッジを一括取得する（in 演算子）"""
        if not champions:
            return []
        champs_str = ",".join(champions)
        return self._fetch(f"?champion=in.({champs_str})", limit=limit)

    def fetch_by_genre(self, genre: str, limit: int = 10) -> list[dict]:
        """ジャンルでフィルタリングしてナレッジを取得する"""
        return self._fetch(f"?genre=eq.{genre}", limit=limit)

    def fetch_recent(self, limit: int = 30) -> list[dict]:
        """最新のナレッジを取得する（ジャンル・チャンピオン不問）"""
        return self._fetch("?", limit=limit)

    @staticmethod
    def format_as_context(entries: list[dict], max_chars: int = 3000) -> str:
        """
        取得したナレッジをAIプロンプト注入用のテキストに整形する。
        
        各エントリの title + content を連結し、max_chars でカットする。
        content が空の場合は raw_content の先頭500文字を使う。
        """
        if not entries:
            return ""

        lines = []
        total_chars = 0

        for entry in entries:
            title = entry.get("title", "無題")
            # content を優先、なければ raw_content の冒頭を使う
            body = entry.get("content") or ""
            if not body:
                raw = entry.get("raw_content") or ""
                body = raw[:500] + ("..." if len(raw) > 500 else "")

            # 長すぎる content は切り詰め
            if len(body) > 600:
                body = body[:600] + "..."

            line = f"- 【{title}】{body}"

            # 文字数上限チェック
            if total_chars + len(line) > max_chars:
                # 残り文字数で入る分だけ切り出す
                remaining = max_chars - total_chars
                if remaining > 50:
                    lines.append(line[:remaining] + "...")
                break

            lines.append(line)
            total_chars += len(line)

        return "\n".join(lines)

    def _fetch_champion_names(self) -> list[str]:
        """matchup_sentinel の GLOBAL レコードからチャンピオン名一覧をキャッシュ付きで取得する"""
        if hasattr(self, "_champion_names_cache") and self._champion_names_cache:
            return self._champion_names_cache

        if not self.ready:
            return []

        try:
            url = f"{self.url}/rest/v1/matchup_sentinel?enemy=eq.GLOBAL&select=champion"
            res = httpx.get(url, headers=self._headers(), timeout=10)
            if res.status_code == 200:
                names = [r["champion"] for r in res.json() if r.get("champion")]
                self._champion_names_cache = names
                return names
        except Exception as e:
            logger.warning(f"⚠️ チャンピオン名一覧の取得に失敗: {e}")
        return []

    def guess_champions_from_title(self, title: str) -> list[str]:
        """
        動画タイトルからチャンピオン名を推定する。
        matchup_sentinel に登録済みのチャンピオン名と、タイトル内の単語を照合する。
        大文字小文字は区別しない。
        """
        champion_names = self._fetch_champion_names()
        if not champion_names:
            return []

        title_lower = title.lower()
        matched = []
        for name in champion_names:
            # チャンピオン名が2文字以下の場合は誤マッチ防止のためスキップ
            if len(name) <= 2:
                continue
            if name.lower() in title_lower:
                matched.append(name)

        return matched


# シングルトンインスタンス — 各モジュールで `from v2_CORE.knowledge_retriever import knowledge_retriever` で使う
knowledge_retriever = KnowledgeRetriever()
