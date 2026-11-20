# -*- coding: utf-8 -*-
"""
SPEC 13: Ollama と Gemini の生成品質・量の比較検証スクリプト
対象A: 知見分解（knowledgeDecompose 記事3本）
対象B: 事実抽出（llm_fallback_adapter 字幕3本）
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error
from dotenv import load_dotenv

# 環境変数ロード
load_dotenv()
load_dotenv('05_PILOT/.env.local')

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("❌ GEMINI_API_KEY が見つかりません。")
    sys.exit(1)

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = "qwen2.5:7b"
GEMINI_MODELS = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-2.5-flash"]

OUTPUT_DIR = "05_PILOT/docs/specs/reports/raw_outputs"
os.makedirs(OUTPUT_DIR, exist_ok=True)


# -------------------------------------------------------------------------
# LLM 呼び出し関数
# -------------------------------------------------------------------------

def call_ollama(prompt: str, is_json: bool = True, temperature: float = 0.2) -> tuple[dict | str, float, str | None]:
    """Ollama API 呼び出し (返り値: (結果, 所要時間秒, エラー))"""
    url = f"{OLLAMA_BASE_URL}/v1/chat/completions"
    
    user_prompt = prompt
    if is_json and "【最重要: 出力指示】" not in prompt:
        user_prompt += "\n\n------------------------\n【最重要: 出力指示】\n上記の指示に従い、直ちに { から始まる純粋なJSONオブジェクトのみを出力してください。前置きや解説テキストは一切出力しないでください。"

    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {
                "role": "system",
                "content": "You are a professional League of Legends tactical analyst. Output only a pure, valid JSON object strictly matching the schema requested. Every string in 'facts' or 'insights' must be in natural Japanese even if transcript is English. Do not output any conversational talk, intro, or markdown fences." if is_json else "You are a specialized game analyst. Output in natural, accurate Japanese."
            },
            {"role": "user", "content": user_prompt}
        ],
        "temperature": temperature
    }
    if is_json:
        payload["response_format"] = {"type": "json_object"}

    start_time = time.time()
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=300) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            elapsed = time.time() - start_time
            content = data["choices"][0]["message"]["content"]
            
            clean = content.strip()
            if clean.startswith("```"):
                lines = clean.split("\n")
                if lines[0].startswith("```"): lines = lines[1:]
                if lines and lines[-1].startswith("```"): lines = lines[:-1]
                clean = "\n".join(lines).strip()
            
            if is_json:
                try:
                    parsed = json.loads(clean)
                    return parsed, elapsed, None
                except Exception as e:
                    return clean, elapsed, f"JSONParseError: {e}"
            return clean, elapsed, None
    except Exception as e:
        elapsed = time.time() - start_time
        return None, elapsed, str(e)


def call_gemini(prompt: str, is_json: bool = True, temperature: float = 0.2) -> tuple[dict | str, float, str | None]:
    """Gemini API 呼び出し (自動フォールバック, 返り値: (結果, 所要時間秒, エラー))"""
    start_time = time.time()
    last_err = None

    for model in GEMINI_MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": 8192
            }
        }
        if is_json:
            payload["generationConfig"]["responseMimeType"] = "application/json"

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                elapsed = time.time() - start_time
                candidates = data.get("candidates", [])
                if not candidates:
                    return None, elapsed, "No candidates returned from Gemini"
                
                parts = candidates[0].get("content", {}).get("parts", [])
                text = "".join(p.get("text", "") for p in parts)
                
                clean = text.strip()
                if clean.startswith("```"):
                    lines = clean.split("\n")
                    if lines[0].startswith("```"): lines = lines[1:]
                    if lines and lines[-1].startswith("```"): lines = lines[:-1]
                    clean = "\n".join(lines).strip()

                if is_json:
                    try:
                        parsed = json.loads(clean)
                        return parsed, elapsed, None
                    except Exception as e:
                        return clean, elapsed, f"JSONParseError: {e}"
                return clean, elapsed, None

        except urllib.error.HTTPError as e:
            last_err = f"HTTP {e.code}: {e.read().decode('utf-8')[:200]}"
            if e.code == 429:
                print(f"  ⚠️ Gemini {model} で 429 利用上限に達しました。次のモデルを試行します...")
                time.sleep(2)
                continue
            else:
                time.sleep(1)
                continue
        except Exception as e:
            last_err = str(e)
            time.sleep(1)
            continue

    elapsed = time.time() - start_time
    return None, elapsed, f"GeminiAllModelsFailed: {last_err}"


# -------------------------------------------------------------------------
# 対象A: 知見分解プロンプト
# -------------------------------------------------------------------------

def build_decompose_prompt(title: str, content: str, champ: str = "") -> str:
    return f"""あなたはLeague of Legends (LoL) のトッププロコーチ兼データアナリストAIです。
以下の入力記事（パッチ解説、ティアリスト、動画まとめ等）には、複数のチャンピオンやレーンに関する戦術・調整知見が含まれています。
この内容を精査し、【チャンピオンごと】および【レーン一般マクロごと】に独立したナレッジ（分割知見 / Atomic Insights）へ漏れなく分解・抽出してください。

【対象記事: {title}】
{content[:14000]}

【抽出・分解の絶対ルール】:
1. **主語（自チャンプ）と対面（敵チャンプ）の厳密な分離**:
   - 立ち回りや対策知見を抽出する際、「操作する自チャンピオン（プレイヤー側）」を必ず champion に指定してください。
   - 対面相手やカウンター対象（例: ○○への立ち回り、対面○○、○○対策、○○のエンゲージを阻害する相手）が出てきた場合は、その相手を enemyChampion に指定してください。
   - ⚠️ **絶対に敵チャンピオンを champion に設定してはいけません！**

2. **複数チャンピオンの完全網羅**:
   - 記事内で言及されている各チャンピオンについて、個別の知見として必ず1つずつ独立して抽出してください。
   - パッチの変更点（バフ・ナーフ）、具体的なスキル・コンボ、立ち回り、アイテム・ルーン、有利・不利な対面、集団戦の役割などを具体的に記述してください。

3. **アイテム・全体マクロの抽出（該当する場合）**:
   - 特定チャンピオンに限らないアイテム調整や、レーン全体のメタがあれば、scope="lane_general", champion="Unknown" として抽出してください。

4. **出力フォーマット**:
   必ず以下のJSONフォーマットのみを返却してください（Markdownのコードブロック等は含めない、純粋なJSON）。

{{
  "insights": [
    {{
      "champion": "操作する自チャンピオン英名 (例: JarvanIV, Mordekaiser。一般論の場合は 'Unknown')",
      "enemyChampion": "対面・敵チャンピオン英名 (例: Poppy, Sylas。対面対策知見の場合のみ指定、それ以外は null)",
      "scope": "champion_specific または lane_general",
      "targetLane": "TOP または JG または MID または ADC または SUP または COMMON",
      "title": "具体的でわかりやすい日本語タイトル (例: 【対面対策】ジャーヴァンIV vs ポッピーの立ち回り)",
      "content": "詳細なMarkdown戦術本文 (スキル運用、立ち回り、意識すべきWhy&When)",
      "tags": ["Patch26.20", "JG", "JarvanIV", "vs_Poppy"]
    }}
  ]
}}"""


# -------------------------------------------------------------------------
# 対象B: 事実抽出プロンプト
# -------------------------------------------------------------------------

CURRENT_SEASON_META_NOTE = """
【2026年シーズン（Season 16 / Patch 26.x）最新メタ前提】
- 過去シーズン（Season 14以前の旧仕様）の知識は厳禁。
- 序盤オブジェクト: リフトスカトル初湧き（02:55前倒し）への初動ルート、第1ドラゴン（05:00湧き）、ヴォイドグラブ（08:00湧き・1試合1回のみ）。
- JG基準: 初動クリア（02:55スカトル対応）、敵JGトラッキング（逆サイド交換）。
- 中盤オブジェクト: リフトヘラルド（15:00湧き）および バロン・ナッシャー（20:00湧き）。※アタカンは2026年最新パッチで完全削除済み。
- 逃げ言葉の禁止: 「状況に応じて」「味方と連携して」「意識することが大切」「落ち着いて」は出力禁止。
"""

CATEGORIES_STR = "build=ビルド・ルーン / skill=スキル・コンボ・操作 / laning=レーン戦 / jungle=ジャングルの周回・ガンク / objective=オブジェクト・視界 / macro=試合運び・ローテーション / teamfight=集団戦 / matchup=対面・相性 / mindset=考え方・よくあるミス"
TYPES_STR = "guide=解説・講座 / gameplay=実況プレイ（試合しながら説明） / highlight=ハイライト・切り抜き / shorts=Shorts（1分以内の小技） / other=その他"

def build_extract_prompt(title: str, channel: str, transcript: str) -> str:
    return f"""あなたは League of Legends の試合分析者・プロコーチです。以下の YouTube 動画の字幕から「視聴者が自分の試合で使える2026年最新の事実」だけを抜き出してください。記事はまだ書きません。

動画タイトル: {title}
チャンネル: {channel}
{CURRENT_SEASON_META_NOTE}

【抜き出す事実の条件】すべて満たすものだけ
1. 字幕の中で実際に話されている（字幕に無いことを、あなたの知識で補わない）
2. 次のどれかを含む:
   - 具体的な秒数・時間軸（初動カニ02:55、ドラゴン05:00、幼虫08:00、ヘラルド15:00、リコール秒数など）
   - 具体的な条件（「敵フラッシュ落ち」「敵JGが逆サイド見えた時」「自陣ウェーブ有利時」など）
   - スキルCDの隙やコンボ操作順（E > Flash > Qなど）
   - 理由（「なぜそうするか」「なぜそのキャンプを捨てるか」）
   - 負けている時・腐った時（Behind）のリカバリー判断
3. 「視界を取ろう」「状況に応じて判断」「意識することが大切」「落ち着いて」のような、条件も理由も数値も無い一般論ではない

【絶対に書かないこと】
- 2026年以前の旧仕様（Season 14以前の古い神話アイテムや旧パッチ）の知識
- 字幕で触れていない話題（数を水増ししない）
- 試合の実況・あらすじ。そこから読み取れる判断の理由があれば、それを事実として書く

【固有名詞の扱い】
自動字幕は固有名詞をよく聞き間違える。文脈から正しい名前が確実に分かれば直す。確実でなければ字幕の表記のまま残し、uncertain に true を付ける。

【出力】純粋な JSON のみ
{{"video_type": "<{TYPES_STR} のどれかのキー>",
 "champion": "<主題のチャンピオンの英語ID（単一なら 'LeeSin'、複数ならカンマ区切り。無ければ 'Unknown'）>",
 "role": "<主題のロール: JUNGLE / TOP / MID / ADC / SUPPORT / UNKNOWN>",
 "is_multi_champion": false,
 "enemy": null,
 "combos": [],
 "first_timing": null,
 "behind_recovery": null,
 "facts": [
   {{"category": "<{CATEGORIES_STR} のどれかのキー>",
    "claim": "<何をするか・何が起きるか。1〜2文>",
    "condition": null,
    "reason": null,
    "numbers": null,
    "ts": null,
    "uncertain": false}}
 ],
 "not_covered": []}}

字幕:
{transcript[:15000]}"""


# -------------------------------------------------------------------------
# メイン実行ルーチン
# -------------------------------------------------------------------------

def run_comparison():
    print("================================================================================")
    print("SPEC 13: Ollama (Qwen2.5 7B) vs Gemini 比較検証実行")
    print("================================================================================\n")

    results = {
        "target_a_decompose": [],
        "target_b_extract": []
    }

    # ─────────────────────────────────────────────────────────────────
    # 対象A: 知見分解 (3本)
    # ─────────────────────────────────────────────────────────────────
    articles = [
        {
            "id": "A_short",
            "name": "短め1本（Alistar）",
            "path": "02_FACTORY/_LOL/note_stocks/Alistar_lrx1X6QtJ7U.md",
            "title": "【LoL/JG】Alistar実戦思考と勝率UPマクロ",
        },
        {
            "id": "A_long",
            "name": "長め1本（Ambessa）",
            "path": "02_FACTORY/_LOL/note_stocks/Ambessa_OdttUIfSm9A.md",
            "title": "【LoL/JG】Ambessa実戦思考と勝率UPマクロ",
        },
        {
            "id": "A_multi",
            "name": "複数チャンプ混在1本（Akali/Maokai/Gwen等）",
            "path": "02_FACTORY/_LOL/note_stocks/Akali__Ahri__Maokai__Gwen__Pantheon__Milio__Sylas_.md",
            "title": "【LoL/JG】Akali, Ahri, Maokai, Gwen集団戦ガイド",
        },
    ]

    print("### 【対象A: 知見分解（knowledgeDecompose）】3記事の検証開始...")

    for art in articles:
        print(f"\n--- 検証中: {art['name']} ({art['id']}) ---")
        with open(art['path'], 'r', encoding='utf-8') as f:
            content = f.read()

        prompt = build_decompose_prompt(art['title'], content)

        # 1. Ollama
        print(f"  🏠 Ollama ({OLLAMA_MODEL}) 実行中...")
        ol_res, ol_time, ol_err = call_ollama(prompt, is_json=True)
        print(f"     所要時間: {ol_time:.2f}s | エラー: {ol_err}")
        with open(f"{OUTPUT_DIR}/{art['id']}_ollama.json", "w", encoding="utf-8") as f:
            json.dump(ol_res if isinstance(ol_res, dict) else {"raw": ol_res, "error": ol_err}, f, ensure_ascii=False, indent=2)

        # 2. Gemini
        print(f"  ☁️ Gemini 実行中...")
        gm_res, gm_time, gm_err = call_gemini(prompt, is_json=True)
        print(f"     所要時間: {gm_time:.2f}s | エラー: {gm_err}")
        with open(f"{OUTPUT_DIR}/{art['id']}_gemini.json", "w", encoding="utf-8") as f:
            json.dump(gm_res if isinstance(gm_res, dict) else {"raw": gm_res, "error": gm_err}, f, ensure_ascii=False, indent=2)

        results["target_a_decompose"].append({
            "sample": art,
            "ollama": {"time": ol_time, "error": ol_err, "data": ol_res},
            "gemini": {"time": gm_time, "error": gm_err, "data": gm_res},
        })

    # ─────────────────────────────────────────────────────────────────
    # 対象B: 事実抽出 (3本)
    # ─────────────────────────────────────────────────────────────────
    transcripts = [
        {
            "id": "B_short",
            "name": "短尺（396秒 / 3,699文字）",
            "vid": "glAzz6dz5Mg",
            "title": "Why You Don't Climb - 5 Reasons - LoL",
            "channel": "Skill Capped",
        },
        {
            "id": "B_mid",
            "name": "中尺（606秒 / 5,798文字）",
            "vid": "-8bk15KdrPw",
            "title": "Achieve Master In 2026 - Here Is How",
            "channel": "Coach Curtis",
        },
        {
            "id": "B_long",
            "name": "長尺（1656秒 / 14,800文字）",
            "vid": "ItTNMUw8Um8",
            "title": "3 BROKEN Jungle Fundamentals to Unstuck",
            "channel": "Kirei",
        },
    ]

    print("\n\n### 【対象B: 事実抽出（llm_fallback_adapter）】3動画字幕の検証開始...")

    for tr in transcripts:
        print(f"\n--- 検証中: {tr['name']} ({tr['id']}) ---")
        t_path = f"{OUTPUT_DIR}/transcripts/{tr['vid']}.txt"
        with open(t_path, 'r', encoding='utf-8') as f:
            t_text = f.read()

        prompt = build_extract_prompt(tr['title'], tr['channel'], t_text)

        # 1. Ollama
        print(f"  🏠 Ollama ({OLLAMA_MODEL}) 実行中...")
        ol_res, ol_time, ol_err = call_ollama(prompt, is_json=True)
        print(f"     所要時間: {ol_time:.2f}s | エラー: {ol_err}")
        with open(f"{OUTPUT_DIR}/{tr['id']}_ollama.json", "w", encoding="utf-8") as f:
            json.dump(ol_res if isinstance(ol_res, dict) else {"raw": ol_res, "error": ol_err}, f, ensure_ascii=False, indent=2)

        # 2. Gemini
        print(f"  ☁️ Gemini 実行中...")
        gm_res, gm_time, gm_err = call_gemini(prompt, is_json=True)
        print(f"     所要時間: {gm_time:.2f}s | エラー: {gm_err}")
        with open(f"{OUTPUT_DIR}/{tr['id']}_gemini.json", "w", encoding="utf-8") as f:
            json.dump(gm_res if isinstance(gm_res, dict) else {"raw": gm_res, "error": gm_err}, f, ensure_ascii=False, indent=2)

        results["target_b_extract"].append({
            "sample": tr,
            "ollama": {"time": ol_time, "error": ol_err, "data": ol_res},
            "gemini": {"time": gm_time, "error": gm_err, "data": gm_res},
        })

    with open(f"{OUTPUT_DIR}/summary_comparison_data.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2, default=str)

    print("\n✅ すべての比較実行が完了しました。生出力を保存しました。")

if __name__ == "__main__":
    run_comparison()
