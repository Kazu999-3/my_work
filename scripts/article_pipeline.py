# -*- coding: utf-8 -*-
"""
article_pipeline.py - 動画の字幕から攻略記事を作る2段階パイプライン（2026-10-19 新設）

【なぜ作ったか】
それまでの字幕→記事のプロンプト（youtube_worker.py の旧 gemini_summarize）は
「7章固定・3,000〜5,000字以上・省略厳禁」を強制していた。動画で扱っていない章まで埋めさせるため、
長いのに中身は一般論、という記事が多かった（2026-10-19 実測: 承認待ち331件のうち、
数値・時刻を含む具体的な記述が1,000字あたり1.4件未満の記事が約4分の1。
「現パッチの仕様に準拠」のように字幕に無いことを AI の記憶で書いた箇所もあった）。

【方針】（2026-10-19 ユーザーと決めたプロンプト改善 A〜H）
  A. 章立ての固定と文字数の下限をやめる。動画が扱った範囲だけ書く
  B. 2段階にする。①字幕から事実（主張・理由・条件・時刻）を JSON で抽出 → ②事実だけから記事化
     抽出した件数がそのまま「中身の量」の指標になる（analysis_meta.fact_count）
  C. 各記述に根拠（字幕の時刻）を付ける。根拠の無い文は書かない
  D. 数値・条件・理由のどれも含まない助言（「視界を取ろう」だけ等）は事実として拾わない
  E. 字幕に無い知識（現パッチでの評価・勝率・一般的なビルド等）を書かせない
  F. 動画の種類（解説 / 実況プレイ / ハイライト / Shorts）を①で判定し、②の書き方を切り替える
  G. 字幕の誤変換が疑われる固有名詞は [要確認] を付けて残す
  H. ②の最後に「字幕に根拠の無い文を消したか」を自己点検させる

再解析（承認画面の「🔁 再解析」）でも同じ関数を使い、理由・深掘りしたい観点・前回の記事を追加で渡す。
"""
import json
import re
import time
import urllib.error
import urllib.request

PROMPT_VERSION = "2stage-v1"

# 抽出する事実の分類（承認画面の「深掘りしたい観点」と同じキー）
CATEGORIES = {
    "build": "ビルド・ルーン",
    "skill": "スキル・コンボ・操作",
    "laning": "レーン戦",
    "jungle": "ジャングルの周回・ガンク",
    "objective": "オブジェクト・視界",
    "macro": "試合運び・ローテーション",
    "teamfight": "集団戦",
    "matchup": "対面・相性",
    "mindset": "考え方・よくあるミス",
}

VIDEO_TYPES = {
    "guide": "解説・講座",
    "gameplay": "実況プレイ（試合しながら説明）",
    "highlight": "ハイライト・切り抜き",
    "shorts": "Shorts（1分以内の小技）",
    "other": "その他",
}

REASONS = {
    "thin": "全体的に中身が薄い（一般論ばかり・具体的な数値や条件が少ない）",
    "focus": "特定の観点をもっと深く知りたい",
    "generic": "動画と関係ない一般論や、AIの記憶で書いた内容が混じっている",
    "wrong": "内容に誤りや聞き間違いがある",
    "other": "その他",
}


class GeminiQuotaError(RuntimeError):
    """Gemini の利用上限（429 RESOURCE_EXHAUSTED）。呼び出し側で待機・後回しにする。"""


# ---------------------------------------------------------------- 字幕

def _vtt_ts(s):
    """'00:01:02.345' / '01:02.345' → 秒"""
    parts = s.strip().split(":")
    try:
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
        if len(parts) == 2:
            return int(parts[0]) * 60 + float(parts[1])
    except ValueError:
        return None
    return None


def fmt_ts(sec):
    sec = int(sec)
    h, m, s = sec // 3600, (sec % 3600) // 60, sec % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def vtt_to_timestamped_text(vtt_text, marker_interval_sec=20, max_chars=30000):
    """VTT を「[MM:SS] 本文」形式の行へ変換する（C: 根拠の時刻を記事に残すため）。

    自動字幕は同じ文が何度も繰り返されるので重複を除き、時刻は marker_interval_sec 秒おきにだけ付ける
    （全行に付けるとトークンが倍近くになる）。
    """
    out, seen = [], set()
    cur_ts = None
    last_marker = None
    for raw in vtt_text.splitlines():
        line = raw.strip()
        if not line or line.startswith(("WEBVTT", "Kind:", "Language:", "NOTE")):
            continue
        if "-->" in line:
            cur_ts = _vtt_ts(line.split("-->")[0])
            continue
        line = re.sub(r"<[^>]+>", "", line).strip()
        if not line or line in seen or line.isdigit():
            continue
        seen.add(line)
        if cur_ts is not None and (last_marker is None or cur_ts - last_marker >= marker_interval_sec):
            out.append(f"[{fmt_ts(cur_ts)}] {line}")
            last_marker = cur_ts
        else:
            out.append(line)
    text = "\n".join(out)
    return text[:max_chars] or None


def has_timestamps(transcript):
    return bool(re.search(r"^\[\d{1,2}:\d{2}(?::\d{2})?\]", transcript or "", re.M))


# ---------------------------------------------------------------- プロンプト

def reanalysis_instructions(reanalysis):
    """再解析の依頼内容（理由・観点・メモ・前回の記事）をプロンプトに足す"""
    if not reanalysis:
        return ""
    lines = ["", "【今回は再解析です】前回の記事は管理者に「不十分」と判断されました。"]
    reason = reanalysis.get("reason")
    if reason:
        lines.append(f"- 理由: {REASONS.get(reason, reason)}")
    focus = [f for f in (reanalysis.get("focus") or []) if f in CATEGORIES]
    if focus:
        lines.append("- 特に深掘りしてほしい観点: " + "、".join(CATEGORIES[f] for f in focus)
                     + "（この観点の事実は、字幕にある限り細部まで漏らさず拾うこと）")
    note = (reanalysis.get("note") or "").strip()
    if note:
        lines.append(f"- 管理者のメモ（字幕と矛盾する場合は字幕を優先）: {note[:500]}")
    prev = (reanalysis.get("previous_article") or "").strip()
    if prev:
        lines.append("- 前回の記事（これと同じ一般論を繰り返さないこと。前回に無い具体的な事実を優先して拾うこと）:")
        lines.append("<<<前回の記事")
        lines.append(prev[:6000])
        lines.append("前回の記事>>>")
    return "\n".join(lines) + "\n"


def build_extract_prompt(title, channel, transcript, is_short=False, reanalysis=None):
    """① 字幕から事実だけを抜き出す（B・C・D・E・F・G）"""
    ts_rule = (
        "- ts: その事実が話されている字幕の時刻。字幕の行頭の [MM:SS] のうち、その発言の直前にある時刻を書く。分からなければ null"
        if has_timestamps(transcript) else
        "- ts: この字幕には時刻が無いので常に null"
    )
    cats = " / ".join(f"{k}={v}" for k, v in CATEGORIES.items())
    types = " / ".join(f"{k}={v}" for k, v in VIDEO_TYPES.items())
    return f"""あなたは League of Legends の試合分析者です。以下の YouTube 動画の字幕から「視聴者が自分の試合で使える事実」だけを抜き出してください。記事はまだ書きません。

動画タイトル: {title}
チャンネル: {channel}
{"（1分以内の Shorts 動画）" if is_short else ""}
【抜き出す事実の条件】すべて満たすものだけ
1. 字幕の中で実際に話されている（字幕に無いことを、あなたの知識で補わない）
2. 次のどれかを含む: 数値（秒・分・レベル・ゴールド・CS・%など）／具体的な条件（「相手のフラッシュが無い時」など）／理由（「なぜそうするか」）
3. 「視界を取ろう」「状況に応じて判断」「意識することが大切」のような、条件も理由も数値も無い一般論ではない

【絶対に書かないこと】
- 現在のパッチでの強さ・勝率・ティア・流行のビルドなど、字幕に出てこない知識
- 字幕で触れていない話題（触れていない分類は空のままでよい。数を水増ししない）
- 試合の実況・あらすじ（「この試合では3分にキルを取った」）。そこから読み取れる判断の理由があれば、それを事実として書く

【固有名詞の扱い】
自動字幕は固有名詞をよく聞き間違える（例: チャンピオン名・アイテム名がカタカナの別語になる）。
文脈から正しい名前が確実に分かれば直す。確実でなければ字幕の表記のまま残し、uncertain に true を付ける。

【出力】純粋な JSON のみ
{{"video_type": "<{types} のどれかのキー>",
 "champion": "<主題のチャンピオンの英語ID（単一なら 'Camille'、複数チャンピオンを扱うティアリストやまとめならカンマ区切りで 'Camille, Darius, Renekton'。特定チャンピオンが無ければ 'Unknown'）>",
 "is_multi_champion": <複数チャンピオンを扱った動画（ティアリスト・パッチまとめ・複数ピック紹介等）なら true, 単一チャンピオンなら false>,
 "enemy": "<対面が明確ならその英語ID。無ければ null>",
 "facts": [
   {{"category": "<{cats} のどれかのキー>",
    "claim": "<何をするか・何が起きるか。1〜2文>",
    "condition": "<いつ・どんな状況で。無ければ null>",
    "reason": "<なぜか。字幕で説明されていなければ null>",
    "numbers": "<関係する数値。無ければ null>",
    "ts": "<MM:SS または null>",
    "uncertain": <聞き間違いの疑いがある固有名詞を含むなら true>}}
 ],
 "not_covered": ["<動画で触れていない分類のキー>"]}}

【時刻】
{ts_rule}
{reanalysis_instructions(reanalysis)}
字幕:
{transcript}"""


_TYPE_STYLE = {
    "guide": "解説動画なので、話されている順ではなく、視聴者が使う場面ごと（序盤→中盤→終盤、または分類ごと）に並べ直す。",
    "gameplay": "実況プレイなので、試合の流れは書かず、プレイヤーが口にした判断とその理由を「判断ルール」として並べる。",
    "highlight": "ハイライトなので、各場面から読み取れる判断（なぜその行動が成功したか）だけを短く書く。事実が少なければ記事も短くてよい。",
    "shorts": "Shorts なので、1つの小技に絞り、手順・条件・注意点を短く書く。",
    "other": "動画の内容に合わせて、読み手が使う場面ごとに並べる。",
}


def build_write_prompt(title, channel, extraction, reanalysis=None):
    """② 抜き出した事実だけから記事を書く（A・C・E・F・G・H）"""
    vtype = extraction.get("video_type") if extraction.get("video_type") in VIDEO_TYPES else "other"
    facts_json = json.dumps(extraction.get("facts") or [], ensure_ascii=False, indent=1)
    used = sorted({f.get("category") for f in (extraction.get("facts") or []) if f.get("category") in CATEGORIES})
    used_labels = "、".join(CATEGORIES[c] for c in used) or "（なし）"
    return f"""あなたは League of Legends のコーチです。下の「事実リスト」だけを材料に、日本語の攻略記事（Markdown）を書いてください。

動画タイトル: {title}
チャンネル: {channel}
動画の種類: {VIDEO_TYPES[vtype]}
事実がある分類: {used_labels}

【書き方】
- {_TYPE_STYLE[vtype]}
- 見出しは「事実がある分類」だけ作る。事実の無い分類の見出しは作らない。決まった章立てや文字数の目安は無い。事実が少なければ短い記事でよい（水増し禁止）
- 1つの記述は「状況（condition）→ 行動（claim）→ 理由（reason）」の順で、数値（numbers）があれば必ず書く
- 各記述の末尾に、事実の ts を `[MM:SS]` の形で付ける（ts が null の事実には付けない）
- uncertain が true の事実に出てくる固有名詞には、その直後に `[要確認]` を付ける
- 事実リストに無い内容（あなたの知識・現パッチの評価・一般論・励まし）は一切書かない
- 最後に「## ⚠️ よくあるミス」を、事実リストに mindset のミスがある時だけ作る
- 冒頭に `## 🎯 この動画で分かること` として、記事全体の要点を3行以内で書く（事実リストから言えることだけ）
{reanalysis_instructions({k: v for k, v in (reanalysis or {}).items() if k != "previous_article"}) if reanalysis else ""}
【出力前の自己点検】書き終えたら、各文について「事実リストのどれかに根拠があるか」を確認し、根拠の無い文を削除してから出力すること。

【出力】純粋な JSON のみ
{{"title": "<記事の内容が分かる具体的な日本語タイトル。誇張語（究極・最強・完全など）は使わない>",
 "summary": "<Markdown 本文>",
 "genre": "<LoL攻略 / ビルド / マクロ / その他 のどれか>",
 "tags": ["<最大5つ。複数チャンピオンを扱う動画なら '複数チャンピオン' を必ず含める>"],
 "champion": "<主題のチャンピオンの英語ID（単一なら 'Camille'、複数チャンピオンを扱うならカンマ区切りで 'Camille, Darius, Renekton'。無ければ 'Unknown'）>",
 "is_multi_champion": <複数チャンピオン対象なら true, 単一なら false>}}

事実リスト:
{facts_json}"""


# ---------------------------------------------------------------- Gemini

def _is_quota_error(err):
    s = str(err)
    return "429" in s or "RESOURCE_EXHAUSTED" in s or "quota" in s.lower()


def call_gemini_json(prompt, api_key, model, max_tokens=8192, temperature=0.2, retries=3, log_prefix="gemini"):
    """Gemini（REST）を呼んで JSON を返す。429 が続いたら GeminiQuotaError。"""
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
            "responseMimeType": "application/json",
        },
    }
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
                data=json.dumps(body).encode(), method="POST")
            req.add_header("Content-Type", "application/json")
            with urllib.request.urlopen(req, timeout=240) as r:
                res = json.loads(r.read().decode())
            # 返事は複数の part に分かれることがある。最初の part だけだと途中で切れるため、考え中のメモ以外をつなげる（2026-10-20）
            text = "".join(p.get("text", "") for p in res["candidates"][0]["content"]["parts"] if not p.get("thought")).strip()
            if res["candidates"][0].get("finishReason") not in (None, "STOP"):
                print(f"⚠️ Gemini の生成が途中で止まりました: {res['candidates'][0].get('finishReason')}")
            text = re.sub(r"^```[a-z]*\n?|```$", "", text).strip()
            s, e = text.find("{"), text.rfind("}")
            return json.loads(text[s:e + 1])
        except urllib.error.HTTPError as err:
            last_err = err
            detail = ""
            try:
                detail = err.read().decode(errors="replace")[:300]
            except Exception:
                pass
            if err.code == 429:
                wait = 20 * (attempt + 1)
                print(f"[{log_prefix}] 429 レート制限。{wait}秒待って再試行 ({attempt + 1}/{retries})")
                time.sleep(wait)
                continue
            if err.code in (500, 502, 503, 504):
                wait = 5 * (attempt + 1)
                print(f"[{log_prefix}] Google側一時エラー {err.code} ({detail[:60]})。{wait}秒待って再試行 ({attempt + 1}/{retries})")
                time.sleep(wait)
                continue
            if err.code == 404:
                raise RuntimeError(f"モデル {model} が見つかりません (404): {detail}") from err
            print(f"[{log_prefix}] HTTPエラー {err.code}: {detail} ({attempt + 1}/{retries})")
            time.sleep(3)
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as err:
            last_err = err
            wait = 4 * (attempt + 1)
            print(f"[{log_prefix}] 通信一時切断 ({err})。{wait}秒待って再試行 ({attempt + 1}/{retries})")
            time.sleep(wait)
        except Exception as err:
            last_err = err
            print(f"[{log_prefix}] 応答の解釈に失敗: {err} ({attempt + 1}/{retries})")
            time.sleep(2)
    if last_err is not None and _is_quota_error(last_err):
        raise GeminiQuotaError(f"Gemini 429（{retries}回待っても回復せず）: {last_err}")
    raise RuntimeError(f"Gemini の応答を JSON として読めませんでした: {last_err}")


def _valid_article(a):
    return (isinstance(a, dict) and all(a.get(k) for k in ("title", "summary"))
            and isinstance(a.get("tags", []), list))


def _clean_facts(facts):
    """形の崩れた事実を落とす（claim が無い・分類不明）"""
    out = []
    for f in facts or []:
        if not isinstance(f, dict) or not str(f.get("claim") or "").strip():
            continue
        if f.get("category") not in CATEGORIES:
            f["category"] = "mindset"
        ts = f.get("ts")
        if ts and not re.fullmatch(r"\d{1,2}:\d{2}(?::\d{2})?", str(ts).strip()):
            f["ts"] = None
        out.append(f)
    return out


def generate_article(title, channel, transcript, api_key, model, is_short=False, reanalysis=None):
    """字幕 → ①事実抽出 → ②記事化。戻り値は記事の dict（title/summary/genre/tags/champion/analysis_meta）。

    事実が1件も取れなかった時は記事を作らず ValueError（中身の無い記事を承認待ちに積まない）。
    """
    extraction = call_gemini_json(
        build_extract_prompt(title, channel, transcript, is_short=is_short, reanalysis=reanalysis),
        api_key, model, max_tokens=8192, temperature=0.1, log_prefix="抽出")
    facts = _clean_facts(extraction.get("facts"))
    extraction["facts"] = facts
    if not facts:
        raise ValueError("字幕から使える事実が1件も見つかりませんでした（実況なし・雑談のみの動画の可能性）")
    if is_short:
        extraction["video_type"] = "shorts"

    article = None
    for attempt in range(2):
        article = call_gemini_json(build_write_prompt(title, channel, extraction, reanalysis=reanalysis),
                                   api_key, model, max_tokens=8192, temperature=0.3, log_prefix="記事化")
        if _valid_article(article):
            break
        print(f"[記事化] 必要な項目が欠けています。再試行 ({attempt + 1}/2)")
    if not _valid_article(article):
        raise RuntimeError("記事化の出力に title / summary がありませんでした")

    if not article.get("champion") or article.get("champion") == "Unknown":
        article["champion"] = extraction.get("champion") or "Unknown"
    article.setdefault("genre", "LoL攻略")
    tags = list(article.get("tags") or [])
    is_multi = bool(article.get("is_multi_champion") or extraction.get("is_multi_champion") or ("," in str(article.get("champion", ""))))
    if is_multi and "複数チャンピオン" not in tags:
        tags.append("複数チャンピオン")
    article["tags"] = tags
    cats = {}
    for f in facts:
        cats[f["category"]] = cats.get(f["category"], 0) + 1
    article["analysis_meta"] = {
        "prompt_version": PROMPT_VERSION,
        "model": model,
        "video_type": extraction.get("video_type"),
        "is_multi_champion": is_multi,
        "fact_count": len(facts),
        "facts_with_reason": sum(1 for f in facts if f.get("reason")),
        "facts_with_numbers": sum(1 for f in facts if f.get("numbers")),
        "facts_with_ts": sum(1 for f in facts if f.get("ts")),
        "uncertain_count": sum(1 for f in facts if f.get("uncertain")),
        "categories": cats,
        "not_covered": [c for c in (extraction.get("not_covered") or []) if c in CATEGORIES],
        "enemy": extraction.get("enemy"),
        # 2026-10-20: 承認画面で全文を読まずに判断できるよう、抽出した事実の一覧も残す（件数だけでは中身が分からなかった）
        "facts": [
            {k: (str(f.get(k))[:200] if f.get(k) is not None else None)
             for k in ("category", "claim", "condition", "reason", "numbers", "ts")}
            | {"uncertain": bool(f.get("uncertain"))}
            for f in facts[:30]
        ],
    }
    return article


def link_timestamps(summary, video_url):
    """本文の [MM:SS] を動画のその時刻へのリンクにする"""
    m = re.search(r"(?:v=|youtu\.be/|shorts/)([a-zA-Z0-9_-]{11})", video_url or "")
    if not summary or not m:
        return summary
    vid = m.group(1)

    def repl(mt):
        ts = mt.group(1)
        parts = [int(p) for p in ts.split(":")]
        sec = parts[0] * 60 + parts[1] if len(parts) == 2 else parts[0] * 3600 + parts[1] * 60 + parts[2]
        return f"[▶ {ts}](https://youtu.be/{vid}?t={sec})"

    # すでにリンクになっている [▶ 02:15](...) は触らない
    return re.sub(r"(?<!▶ )\[(\d{1,2}:\d{2}(?::\d{2})?)\](?!\()", repl, summary)
