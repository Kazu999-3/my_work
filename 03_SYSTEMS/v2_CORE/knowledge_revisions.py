"""
matchup_sentinel（チャンピオン辞典本体）への更新を knowledge_revisions テーブルへ
記録する共通ヘルパー。Next.js側 lib/matchupSentinelRevisions.ts と対になっており、
両者は同じフィールド一覧・同じテーブル構造を前提にしている（どちらかだけ直しても
辞典と履歴のズレが再発するので、フィールドを増やす際は両方に足すこと）。

Python側の各書き込みスクリプトは supabase-py を使わず生のREST API呼び出しで
統一されているため、ここも同じ流儀（httpx + REST直叩き）に合わせている。
"""
import os
import json
import httpx

TOP_LEVEL_FIELDS = ("title", "strategy")
RAW_DATA_FIELDS = (
    "strengths", "weaknesses", "powerSpikes", "buildRunes", "fullClearTime",
    "counterChampions", "mustBanChampions", "pickRecommendation",
    "note_draft", "jg_style", "patch_meta", "pro_builds", "customFields",
    # 個別対面メモ（enemy≠GLOBAL）専用フィールド
    "winCondition", "earlyGame", "firstClear", "counterJg",
)


def _to_text(v) -> str:
    if v is None:
        return ""
    if isinstance(v, str):
        return v
    try:
        return json.dumps(v, ensure_ascii=False)
    except Exception:
        return str(v)


def record_matchup_sentinel_revision(
    matchup_id: str,
    before: dict | None,
    after: dict,
    source_title: str | None = None,
    source_id=None,
    supabase_url: str | None = None,
    supabase_key: str | None = None,
) -> None:
    """
    matchup_sentinel の更新前後（{"title":..., "strategy":..., "raw_data": {...}} 形式の
    dict）を比較し、変化したフィールドだけ knowledge_revisions に1件ずつ記録する。
    before=None は「新規作成」を意味する。履歴の記録はあくまで補助機能のため、
    失敗しても例外を投げず、呼び出し元の本処理は止めない。
    """
    url = supabase_url or os.getenv("SUPABASE_URL")
    key = supabase_key or os.getenv("SUPABASE_KEY")
    if not url or not key:
        return

    before_raw = (before or {}).get("raw_data") or {}
    after_raw = after.get("raw_data") or {}

    rows = []

    for field in TOP_LEVEL_FIELDS:
        if field not in after or after.get(field) is None:
            continue
        b = _to_text(before.get(field)) if before else None
        a = _to_text(after.get(field))
        if b == a:
            continue
        rows.append((field, b, a))

    for field in RAW_DATA_FIELDS:
        if field not in after_raw:
            continue
        b = _to_text(before_raw.get(field)) if before else None
        a = _to_text(after_raw.get(field))
        if b == a:
            continue
        rows.append((field, b, a))

    if not rows:
        return

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=10) as client:
            for field, before_text, after_text in rows:
                payload = {
                    "target_type": "matchup_sentinel",
                    "target_key": matchup_id,
                    "field": field,
                    "before_text": before_text,
                    "after_text": after_text,
                    "source_title": source_title,
                    "source_id": str(source_id) if source_id is not None else None,
                }
                client.post(f"{url}/rest/v1/knowledge_revisions", headers=headers, json=payload)
    except Exception as e:
        print(f"⚠️ [knowledge_revisions] 履歴の記録に失敗: {e}")
