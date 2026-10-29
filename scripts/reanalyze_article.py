#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
reanalyze_article.py - 承認待ちの動画記事を作り直す（2026-10-19 新設）

05 の承認画面（/admin/review）の「🔁 再解析」が edge_tasks に article_reanalyze を積み、
クラウドワーカー（scripts/edge_cloud_worker.py）か PC の常駐デーモン（task_dispatch.py）がこれを実行する。

  python scripts/reanalyze_article.py '<payload JSON>'
  payload: {"article_id": 123, "base_id": 456, "reason": "thin", "focus": ["build"], "note": "...", "model": "standard|high"}
    article_id: 元の記事（再解析版をさらに作り直す時も元の記事）
    base_id   : 管理者が「不十分」と判断した版（前回の記事として渡す）。省略時は article_id

流れ:
  1. 元の記事と保存済みの字幕（transcript 列、無ければ raw_content）を読む
  2. 字幕があれば article_pipeline の2段階（事実抽出→記事化）に、理由・観点・前回の記事を添えて作り直す
     字幕が無ければ（映像解析で作った記事・字幕が先頭8,000字しか無い古い記事）字幕を取り直し、
     それも無理なら映像解析で作り直す
  3. 新しい版を review_status='pending'・reanalysis_of=元の記事ID で保存する（元の記事はそのまま）
     どちらを採用するかは承認画面で選ぶ。採用しなかった方は __DELETED__ / __SUPERSEDED__ を付けて残す

最後の行に結果の JSON を出す（edge_cloud_worker.py がエラー表示に使う）。
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import youtube_worker as yw  # noqa: E402  sb / fetch_subtitles / gemini_analyze_video / 設定値を共用
from article_pipeline import (  # noqa: E402
    generate_article, link_timestamps, reanalysis_instructions,
    GeminiQuotaError, CATEGORIES, REASONS,
)

RAW_CONTENT_LIMIT = 8000  # youtube_worker が raw_content に入れる字幕の上限
META_HEADER_RE = re.compile(r"^(> 📺 \*\*元動画情報\*\*.*?\n---\n\n)", re.S)


def out(ok, message, **extra):
    print(json.dumps({"success": ok, "message": message, **extra}, ensure_ascii=False))
    sys.exit(0 if ok else 1)


def strip_header(content):
    """元動画情報・チャプター一覧を除いた本文（前回の記事として渡す用）"""
    body = META_HEADER_RE.sub("", content or "", count=1)
    body = re.sub(r"^> ⏱️ \*\*実演チャプター.*?\n\n", "", body, flags=re.S)
    return body.strip()


def load_transcript(row):
    """(字幕, 由来) を返す。全文が無ければ (None, 理由)"""
    t = (row.get("transcript") or "").strip()
    if t:
        return t, "保存済みの字幕（全文）"
    raw = (row.get("raw_content") or "").strip()
    if raw and not raw.startswith("映像直接解析") and len(raw) < RAW_CONTENT_LIMIT - 10:
        # 8,000字未満なら切れていない＝全文
        return raw, "保存済みの字幕"
    return None, ("字幕が先頭8,000字しか保存されていない" if raw and not raw.startswith("映像直接解析")
                  else "映像解析で作った記事で字幕が無い")


def resolve_unique_title(candidate_title, article_id):
    """
    personal_knowledge の title UNIQUE 制約 (personal_knowledge_title_key) 衝突を回避する。
    元記事や他の記事とタイトルが被る場合、「... (再解析)」や「... (再解析 v2)」を付与して一意化する。
    """
    import urllib.parse
    base = re.sub(r"\s*\(再解析(?:\s*v\d+)?\)$", "", candidate_title or "").strip()
    if not base:
        base = f"再解析記事 #{article_id}"

    # まずそのまま空いているか確認
    rows = yw.sb("GET", f"personal_knowledge?title=eq.{urllib.parse.quote(base)}&select=id") or []
    if not rows:
        return base

    # 埋まっていれば (再解析)
    c1 = f"{base} (再解析)"
    rows = yw.sb("GET", f"personal_knowledge?title=eq.{urllib.parse.quote(c1)}&select=id") or []
    if not rows:
        return c1

    # さらに埋まっていれば v2, v3...
    v = 2
    while v <= 30:
        cv = f"{base} (再解析 v{v})"
        rows = yw.sb("GET", f"personal_knowledge?title=eq.{urllib.parse.quote(cv)}&select=id") or []
        if not rows:
            return cv
        v += 1

    return f"{base} (再解析 #{article_id}-{v})"


def main():
    if len(sys.argv) < 2:
        out(False, "payload が指定されていません")
    try:
        payload = json.loads(sys.argv[1])
        article_id = int(payload["article_id"])
    except Exception as e:
        out(False, f"payload を読めません: {e}")

    reason = payload.get("reason") if payload.get("reason") in REASONS else "thin"
    focus = [f for f in (payload.get("focus") or []) if f in CATEGORIES]
    note = str(payload.get("note") or "")[:500]
    use_high = payload.get("model") == "high"

    base_id = int(payload.get("base_id") or article_id)
    rows = yw.sb("GET", f"personal_knowledge?id=in.({article_id},{base_id})&select=*")
    by_id = {r["id"]: r for r in rows or []}
    row = by_id.get(article_id)
    if not row:
        out(False, f"記事 #{article_id} が見つかりません（却下・削除済みの可能性）")
    base = by_id.get(base_id) or row
    url = (row.get("source_url") or "").strip()
    if "youtu" not in url:
        out(False, "YouTube 動画の記事ではないため再解析できません")

    title_src = re.sub(r"^\[旧\]\s*", "", row.get("title") or "")
    channel = ""
    m = re.search(r">\s*-\s*\*\*チャンネル\*\*:\s*([^\n]+)", row.get("content") or "")
    if m:
        channel = m.group(1).strip()
    is_short = "Shorts" in (row.get("tags") or [])
    reanalysis = {"reason": reason, "focus": focus, "note": note,
                  "previous_article": strip_header(base.get("content"))}

    transcript, source = load_transcript(base)
    if not transcript and base is not row:
        transcript, source = load_transcript(row)
    if not transcript:
        vid_m = re.search(r"(?:v=|youtu\.be/|shorts/)([a-zA-Z0-9_-]{11})", url)
        try:
            transcript = yw.fetch_subtitles(url, vid_m.group(1) if vid_m else "video")
            if transcript:
                source = "字幕を取り直した"
        except Exception as e:  # GitHub Actions の IP は YouTube に弾かれやすい（RateLimited 等）
            print(f"字幕の取り直しに失敗: {e}", file=sys.stderr)

    # 2026-10-29: 単一モデル依存による503過負荷・一時エラー即死を根絶する多層フォールバック
    fallback_pool = [yw.GEMINI_MODEL, "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3-flash-preview"]
    # 順序を保ちつつ重複排除
    models = list(dict.fromkeys([yw.VIDEO_MODEL] + fallback_pool if use_high else fallback_pool))
    article, used_model, notes = None, None, []
    for model in models:
        try:
            if transcript:
                article = generate_article(title_src, channel, transcript, yw.GEMINI_KEY, model,
                                           is_short=is_short, reanalysis=reanalysis)
                article["summary"] = link_timestamps(article.get("summary") or "", url)
            else:
                if not yw.ENABLE_VIDEO_ANALYSIS:
                    out(False, f"字幕が無く（{source}）、映像解析も無効のため再解析できません")
                source = f"映像解析（{source}）"
                article = yw.gemini_analyze_video(url, title_src, channel, is_short=is_short,
                                                  extra_instructions=reanalysis_instructions(reanalysis))
                article["analysis_meta"] = {"prompt_version": "video-v1", "model": model}
            used_model = model
            break
        except (GeminiQuotaError, yw.GeminiQuotaExceeded) as e:
            notes.append(f"{model}: 利用上限 (429)")
            if model == models[-1]:
                out(False, f"Gemini の利用上限に達しています。時間をおいて再解析してください（{e}）"[:400])
        except ValueError as e:  # 事実が1件も取れない
            out(False, f"{e}。この動画は字幕からは記事にできません")
        except RuntimeError as e:
            notes.append(f"{model}: {str(e)[:120]}")
            if model == models[-1]:
                out(False, f"再解析に失敗しました: {e}"[:400])
        except Exception as e:
            # httpx.RemoteProtocolError や接続一時切断も安全に捕捉して次モデルへフェイルオーバー
            notes.append(f"{model}: {type(e).__name__} ({str(e)[:100]})")
            if model == models[-1]:
                out(False, f"再解析に失敗しました: {type(e).__name__} - {e}"[:400])

    header_m = META_HEADER_RE.match(row.get("content") or "")
    header = header_m.group(1) if header_m else ""
    content = f"{header}{article.get('summary') or ''}"

    old_tags = [t for t in (row.get("tags") or []) if not str(t).startswith("__")]
    tags = list(dict.fromkeys(old_tags + [t for t in (article.get("tags") or []) if isinstance(t, str)] + ["再解析"]))[:10]
    title = article.get("title") or row.get("title")
    if (row.get("title") or "").startswith("[旧]") and not title.startswith("[旧]"):
        title = f"[旧] {title}"

    meta = dict(article.get("analysis_meta") or {})
    meta.update({
        "reanalysis": {"reason": reason, "focus": focus, "note": note, "source": source,
                       "requested_model": "high" if use_high else "standard"},
        "model": used_model,
        "fallback_notes": notes or None,
    })
    unique_title = resolve_unique_title(title, article_id)

    new_row = {
        "title": unique_title,
        "content": content,
        "raw_content": row.get("raw_content"),
        "transcript": transcript or row.get("transcript"),
        "source_url": url,
        "genre": article.get("genre") or row.get("genre") or "LoL攻略",
        "tags": tags,
        "champion": row.get("champion") if row.get("champion") and row.get("champion") != "Unknown" else (article.get("champion") or "Unknown"),
        "review_status": "pending",
        "reanalysis_of": article_id,
        "analysis_meta": meta,
    }

    created = None
    for attempt in range(3):
        try:
            created = yw.sb("POST", "personal_knowledge", [new_row], prefer="return=representation")
            break
        except Exception as e:
            if any(k in str(e) for k in ("duplicate key", "23505", "personal_knowledge_title_key")):
                clean = re.sub(r"\s*\(再解析.*?\)$", "", new_row["title"]).strip()
                new_row["title"] = f"{clean} (再解析 #{article_id}-{attempt + 1})"
                continue
            raise
    new_id = created[0].get("id") if created else None

    # 同じ元記事から前に作った、まだ採用されていない再解析版は履歴として隠す（承認画面には最新の版だけ出す）
    olds = yw.sb("GET", f"personal_knowledge?reanalysis_of=eq.{article_id}&review_status=eq.pending"
                        f"&id=neq.{new_id}&select=id,tags") or []
    for o in olds:
        tags_o = list(dict.fromkeys((o.get("tags") or []) + ["__DELETED__", "__SUPERSEDED__"]))
        yw.sb("PATCH", f"personal_knowledge?id=eq.{o['id']}", {"tags": tags_o})
    fc = meta.get("fact_count")
    out(True, f"記事 #{article_id} を再解析しました → 新しい版 #{new_id}"
              + (f"（事実 {fc}件、{source}）" if fc is not None else f"（{source}）"),
        new_id=new_id, article_id=article_id)


if __name__ == "__main__":
    main()
