import os
import re
import requests
from bs4 import BeautifulSoup
from google import genai
from dotenv import load_dotenv

# .envファイルの読み込み（プロジェクトルートの.envを参照）
env_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', '.env')
load_dotenv(env_path)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        print(f"Gemini Client error: {e}")
        client = None
else:
    client = None

def extract_urls(text):
    """テキストからURLのリストを抽出する"""
    url_pattern = re.compile(r'https?://\S+')
    urls = url_pattern.findall(text)
    return urls

def fetch_page_content(url):
    """指定したURLのWebページからテキストコンテンツを取得する"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        
        # X(Twitter) のURLの場合は、api.vxtwitter.comのJSON APIを使用する
        if "twitter.com" in url or "x.com" in url:
            # URLからドメイン部分をapi.vxtwitter.comに置換
            api_url = url.replace("twitter.com", "api.vxtwitter.com").replace("x.com", "api.vxtwitter.com")
            
            response = requests.get(api_url, headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                title = f"X投稿 (by @{data.get('user_screen_name', 'unknown')})"
                text = data.get('text', '内容を取得できませんでした')
                return {"title": title, "content": text, "url": url}

        # 通常のWebページの場合
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')

        # 通常のWebページの場合
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.decompose()
            
        text = soup.get_text(separator=' ', strip=True)
        if len(text) > 15000:
            text = text[:15000] + "...(省略)"
            
        title = soup.title.string if soup.title else "無題のページ"
        return {"title": title, "content": text, "url": url}
    except Exception as e:
        print(f"Web scraping error for {url}: {e}")
        return None

def summarize_content(content_data):
    """Gemini APIを使用してコンテンツを要約する"""
    if not client:
        return None, "Gemini APIが設定されていません。"
        
    try:
        title = content_data.get('title', '')
        text = content_data.get('content', '')
        
        prompt = f"""
以下のWebページの内容を読み込み、要点を3〜5行で簡潔に要約してください。
また、この内容から得られる「アクションプラン」や「重要な気づき」があれば1〜2個抽出してください。

ページタイトル: {title}

本文:
{text}

出力フォーマット（Markdown形式）:
💡 **要約**
- 要点1
- 要点2
- 要点3

🚀 **アクション・気づき**
- アクション1
        """
        
        # genai SDKの推奨モデル 'gemini-2.0-flash' を使用
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt,
        )
        
        return response.text, None
    except Exception as e:
        print(f"Gemini API Error: {e}")
        return None, f"要約の生成中にエラーが発生しました: {e}"

def process_memo_with_ai(memo_text):
    """メモテキストを受け取り、URLがあれば要約して構造化データとして返す"""
    urls = extract_urls(memo_text)
    
    if not urls:
        # URLが含まれていない場合はプレーンなデータとして返す
        return {
            "title": memo_text,
            "url": None,
            "summary": None,
            "was_summarized": False
        }
        
    # 最初のURLのみを処理（MVP）
    target_url = urls[0]
    
    # ページの取得
    content_data = fetch_page_content(target_url)
    if not content_data:
        # 取得失敗時
        return {
            "title": memo_text,
            "url": target_url,
            "summary": "ページの内容を取得できませんでした。",
            "was_summarized": True
        }
        
    # AIで要約
    summary, error = summarize_content(content_data)
    if error:
        return {
            "title": content_data['title'],
            "url": target_url,
            "summary": f"要約エラー: {error}",
            "was_summarized": True
        }
    
    return {
        "title": content_data['title'],
        "url": target_url,
        "summary": summary,
        "was_summarized": True
    }

def chat_with_memory(user_query, memos):
    """メモの内容に基づいた回答を生成する（RAG）"""
    if not client:
        return "Gemini APIが設定されていません。"
        
    if not memos:
        context = "現在、保存されているメモはありません。"
    else:
        context = "\n".join(memos)
        
    prompt = f"""
あなたは、ユーザーの知識ベースを管理する優秀なAIアシスタント「アンちゃん」です。
以下の「保存されたメモの内容」を参考に、ユーザーの問いかけに答えてください。

【保存されたメモの内容】
{context}

【ユーザーの質問】
{user_query}

回答のガイドライン:
- メモの内容に基づいた回答を行ってください。
- メモに情報がない場合は、その旨を伝えつつ、一般的な知識で補足してください。
- 親しみやすく、論理的なトーンで話してください。
"""
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        return response.text
    except Exception as e:
        return f"AIとの対話中にエラーが発生しました: {e}"

def chat_with_lol_knowledge(user_query, lol_knowledge):
    """LoLの専門知識に基づいた回答を生成する"""
    if not client:
        return "Gemini APIが設定されていません。"
        
    context = "\n".join(lol_knowledge) if lol_knowledge else "該当するチャンピオンの情報はメモに見つかりませんでした。"
    
    prompt = f"""
あなたはLeague of Legends（LoL）に精通した戦術アドバイザー「アンちゃん」です。
ユーザー（マスター）がNotionに記録した「チャンピオン知識」に基づき、勝つための具体的なアドバイスを行ってください。

【マスターのLoL知識ベース】
{context}

【マスターの相談】
{user_query}

回答のガイドライン:
- マスターのメモにある「強み・弱み」「勝ち筋」「意識ポイント」を最大限に活用してください。
- メモにない情報でも、一般的なLoLのセオリー（マッチアップ、ビルド、立ち回り）で補足して、マスターの勝利をサポートしてください。
- 丁寧かつ熱意のあるアドバイスをお願いします！
"""

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        return response.text
    except Exception as e:
        return f"LoL分析エンジンでのエラー: {e}"

def analyze_match_as_coach(metrics, lol_knowledge):
    """詳細なメトリクスに基づき、5段階の時系列的診断を生成する"""
    if not client:
        return "Gemini APIが設定されていません。"

    knowledge_context = "\n".join(lol_knowledge) if lol_knowledge else "該当する知識はありません。"
    
    # ポジション情報
    position = metrics.get('position', 'N/A')
    
    # メトリクスの要約
    stats_summary = f"""
【試合概要】
- チャンピオン: {metrics['championName']} (ポジション: {position})
- 対面: {metrics['opponentChampionName']}
- 勝敗: {"勝利" if metrics['win'] else "敗北"}
- 試合時間: {metrics.get('gameDurationFormatted', 'N/A')}
- KDA: {metrics['kills']}/{metrics['deaths']}/{metrics['assists']} ({metrics.get('kdaRate', 'N/A')})
- CS: {metrics['cs']} ({metrics.get('csPerMin', 'N/A')}/分) (対面CS: {metrics.get('opponentCs', 0)})
- ゴールド: {metrics['goldEarned']:,} (対面: {metrics.get('opponentGold', 0):,})
- ダメージ: {metrics['damageToChampions']:,} (対面: {metrics.get('opponentDamage', 0):,})
- ビジョンスコア: {metrics.get('visionScore', 0)}
"""

    # 時間別ゴールド差
    gold_timeline = "\n【時間別ゴールド差 (自分 - 対面)】"
    for minute in [10, 15, 20]:
        my_gold = metrics.get(f'goldAt{minute}', 0)
        opp_gold = metrics.get(f'opponentGoldAt{minute}', 0)
        diff = my_gold - opp_gold
        gold_timeline += f"\n- {minute}分時点: {diff:+,}G (自分: {my_gold:,} / 対面: {opp_gold:,})"

    # タイムラインイベント
    events_text = "\n【タイムラインイベント】"
    
    kill_events = metrics.get('killEvents', [])
    if kill_events:
        events_text += "\n[キル]"
        for e in kill_events:
            events_text += f"\n- {e}"
    
    death_events = metrics.get('deathEvents', [])
    if death_events:
        events_text += "\n[デス]"
        for e in death_events:
            events_text += f"\n- {e}"
    
    objective_events = metrics.get('objectiveEvents', [])
    if objective_events:
        events_text += "\n[オブジェクト]"
        for e in objective_events:
            events_text += f"\n- {e}"
    
    building_events = metrics.get('buildingEvents', [])
    if building_events:
        events_text += "\n[建物]"
        for e in building_events:
            events_text += f"\n- {e}"
    
    # 集団戦
    teamfights = metrics.get('teamfights', [])
    teamfight_text = "\n【集団戦】"
    if teamfights:
        for tf in teamfights:
            teamfight_text += f"\n- {tf}"
    else:
        teamfight_text += "\n- 大規模な集団戦は検出されませんでした"

    prompt = f"""
あなたはLeague of Legends（LoL）のプロコーチ「アンちゃん」です。
以下の詳細な試合データを分析し、プレイヤーがさらに成長するための「5段階の診断レポート」を作成してください。

※重要: このプレイヤーは **{position}** でプレイしています。{position}の役割に即した分析を行ってください。

【試合データ】
{stats_summary}
{gold_timeline}
{events_text}
{teamfight_text}

【ユーザーのLoL知識ベース】
{knowledge_context}

【出力フォーマット】
以下の構成とレイアウト（とくに改行箇所やアイコン）を完全に模倣してください。各セクションの [達成] / [未達成] タグも忘れずに。
※ Discordでの見やすさを重視し、指定通りに改行し、余計な空白行は入れないでください。

**1. スノーボールの起点 [達成/未達成]**
[タイムスタンプなど具体的な時間] [対面とのゴールド差やリードの出来事を1文で]
要因: [簡潔に理由（キル関与数、CSリード等）]

**2. 先行有利の行使 [達成/未達成]**
[対面とのゴールド差変動やアクションを1〜2文で記述]
[有利な時間帯をどう活かしたか、またはどう耐えたかの総括]

**3. 優位性の確立 [達成/未達成]**
[中盤のオブジェクト取得や対面との比較（ゴールドやダメージ）を1〜2文で記述]
[序盤からの勢いをどう繋げたかの評価]

**4. コア先行とビルド [達成/未達成]**
[アイテムの完成速度やCS効率、{position}としての役割達成度を評価する文章。数文で簡潔に。]
[もし集団戦データがあれば、以下のように時系列で列挙してください。なければ省略]
⚔ [MM:SS] 集団戦 [勝利/敗北]（味方Xキル vs 敵Yキル）→ [生存/デス等] → 🏆 [タワー/ドラゴン獲得など]

**5. キャリーの完成 [達成/未達成]**
[終盤のマッププレッシャーや主導権への貢献度を評価する文章。]
[{position}としての役割を完遂できたか。ポジティブなら「GG！」などで締める]
⚔ [MM:SS] 集団戦 [勝利/敗北]（味方Xキル vs 敵Yキル）→ ⚠️ [反省点や最初にデスしてしまった等]
⚔ [MM:SS] 集団戦 [勝利/敗北]（味方Xキル vs 敵Yキル）→ [アクション] → 🏆 [獲得オブジェクト]

■ アイコンと記号のルール（厳守）
- 獲得や成功した結果には 🏆 を使う
- 注意点や反省点には ⚠️ を使う
- 集団戦には ⚔ を使う
- 行動の流れは → で表現する
"""

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        return response.text
    except Exception as e:
        if "429" in str(e):
            # gemini-2.5-flash が制限された場合、別モデルにフォールバック
            try:
                response = client.models.generate_content(
                    model='gemini-2.0-flash',
                    contents=prompt,
                )
                return response.text
            except Exception as e2:
                return "⚠️ アンちゃんの脳みそがちょっとオーバーヒート気味です（API制限）。30秒〜1分ほど深呼吸してからもう一回聞いてみてください！"
        return f"AIコーチング生成エラー: {e}"

def _format_mastery_text(draft_info):
    """熟練度チャンピオンをテキストにフォーマットする（共通処理）"""
    if not draft_info.get("mastery_champs"):
        return "なし"
    lines = []
    for m in draft_info["mastery_champs"]:
        lines.append(f"  - {m['name']}: 熟練度Lv.{m['level']} ({m['points']:,}pts)")
    return "\n".join(lines)

def _format_performance_text(draft_info):
    """直近パフォーマンスをテキストにフォーマットする（共通処理）"""
    if not draft_info.get("recent_performance"):
        return "なし"
    lines = []
    for p in draft_info["recent_performance"]:
        lines.append(f"  - {p['champion']}: 勝率{p['win_rate']}% ({p['wins']}勝{p['losses']}敗/{p['games']}戦) 平均KDA {p['avg_kda']}")
    return "\n".join(lines)

def _call_gemini(prompt):
    """Gemini API呼び出し共通処理（フォールバックとリトライ付き）"""
    import time
    
    models_to_try = [
        'gemini-2.0-flash',
        'gemini-2.5-flash',
        'gemini-1.5-flash',
        'gemini-flash-latest'
    ]
    
    for attempt, model in enumerate(models_to_try):
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
            )
            return response.text
        except Exception as e:
            err_msg = str(e).lower()
            print(f"[Gemini API Retry] Model {model} failed: {e}")
            
            if "429" in err_msg or "quota" in err_msg or "too many" in err_msg:
                # 最後のモデル以外なら少し待って次のモデルを試す
                if attempt < len(models_to_try) - 1:
                    time.sleep(1.5)
                    continue
                else:
                    return "⚠️ **サーバーが混雑しています（API制限）**\nGemini APIのリソース上限に達しました。15〜30秒ほど待ってからもう一度お試しください。"
            else:
                # APIリミット以外のエラーならそのまま返すか、次のモデルを試す
                if attempt < len(models_to_try) - 1:
                    continue
                return f"AI分析エラー: {e}"
                
    return "予期せぬエラーによりAI分析に失敗しました。"


def analyze_ban_phase(draft_info, lol_knowledge):
    """BANフェイズ専用のAI分析。BAN推奨チャンピオンを3体提案する。"""
    if not client:
        return "Gemini APIが設定されていません。"

    knowledge_ctx = "\n".join(lol_knowledge) if lol_knowledge else "（知識ベースなし）"
    mastery_text = _format_mastery_text(draft_info)
    perf_text = _format_performance_text(draft_info)
    lane = draft_info.get("lane", "不明")
    rank = draft_info.get("rank", "不明")

    # ★苦手対面のフォーマット
    weak_text = "なし"
    if draft_info.get("weak_matchups"):
        lines = []
        for w in draft_info["weak_matchups"]:
            lines.append(f"  - {w['champion']}: {w['losses']}敗/{w['games']}戦 (敗北率{w['loss_rate']}%)")
        weak_text = "\n".join(lines)

    # ★メタ統計のフォーマット
    meta_text = "（取得失敗）"
    meta_data = draft_info.get("meta_data", {})
    if meta_data.get("success"):
        ban_lines = []
        for b in meta_data.get("ban_top", [])[:5]:
            name_or_id = b.get("name", b.get("id", "???"))
            br = b.get("ban_rate", 0)
            wr = b.get("win_rate", 0)
            ban_lines.append(f"  - {name_or_id}: BAN率{br}%, 勝率{wr}%")
        if ban_lines:
            meta_text = "\n".join(ban_lines)
        else:
            meta_text = "（データ解析不能、一般的なメタ知識で判断してください）"

    prompt = f"""あなたはLeague of Legendsのドラフトフェイズ専門コーチ「アンちゃん」です。
チャンピオンセレクト画面の**BANフェイズ**において、このプレイヤーが最も快適にレーニングできるよう、BANすべきチャンピオンを提案してください。

===== プレイヤー情報 =====
サモナー名: {draft_info.get('summoner_name', '不明')}
担当レーン: {lane}
ランク帯: {rank}

===== 📊 現パッチのメタ統計（BAN率・勝率TOP、{lane}レーン） =====
{meta_text}

===== 😰 プレイヤーの苦手対面（直近試合で負けた対面） =====
{weak_text}

===== プレイヤーの熟練度上位チャンピオン =====
{mastery_text}

===== プレイヤーの直近試合パフォーマンス（勝率順） =====
{perf_text}

===== 内部知識ベース =====
{knowledge_ctx}

===== 出力フォーマット（厳守） =====

**🚫 BAN推奨（3体）**
1. **チャンピオン名** → 理由を1〜2行で（根拠をデータに基づいて示す）
2. **チャンピオン名** → 理由
3. **チャンピオン名** → 理由

**📝 補足**
BANの優先順位の考え方を1〜2行で説明する。

===== 判断基準（この優先順位で総合判断してください） =====
1. **苦手対面**: プレイヤーが直近で繰り返し負けている対面チャンピオンは最優先でBANを検討。本人が苦手としている明確な根拠がある。
2. **メタ統計**: 現パッチでBAN率や勝率が異常に高いOPチャンピオンは、どのランク帯でも脅威。
3. **レーン脅威**: 指定されたレーンで特にプレッシャーが強いチャンピオン。
4. **ランク帯考慮**: プレイヤーのランク帯で特に猛威を振るっているチャンピオンを優先。
- 文字数は全体で500文字以内に収めてください。

===== 絶対遵守ルール =====
- 上記で提供されたデータ（メタ統計・苦手対面・熟練度・直近勝率）のみを根拠にしてください。
- 提供されていない勝率やBAN率の数値を捏造してはいけません。数値を出す場合は上記データに記載があるもののみ使用してください。
- 分からない情報がある場合は「データなし」と正直に述べ、一般的なLoL知識からの推奨であることを明記してください。
"""

    return _call_gemini(prompt)


def analyze_pick_phase(draft_info, lol_knowledge):
    """Pickフェイズ専用のAI分析。Pick推奨チャンピオンを3体提案する。
    BANが終わった後に呼ばれることを想定し、味方・敵構成を加味する。
    """
    if not client:
        return "Gemini APIが設定されていません。"

    knowledge_ctx = "\n".join(lol_knowledge) if lol_knowledge else "（知識ベースなし）"
    mastery_text = _format_mastery_text(draft_info)
    perf_text = _format_performance_text(draft_info)
    lane = draft_info.get("lane", "不明")
    ally = draft_info.get("ally_comp", "（未入力）")
    enemy = draft_info.get("enemy_comp", "（未入力）")
    bans = draft_info.get("bans", "（未入力）")
    rank = draft_info.get("rank", "不明")

    # メタ統計のフォーマット
    meta_text = "（取得失敗）"
    meta_data = draft_info.get("meta_data", {})
    if meta_data.get("success"):
        win_lines = []
        for w in meta_data.get("win_top", [])[:5]:
            name_or_id = w.get("name", w.get("id", "???"))
            wr = w.get("win_rate", 0)
            pr = w.get("pick_rate", 0)
            win_lines.append(f"  - {name_or_id}: 勝率{wr}%, ピック率{pr}%")
        if win_lines:
            meta_text = "\n".join(win_lines)
        else:
            meta_text = "（データ解析不能、一般的なメタ知識で判断してください）"

    # 苦手対面のフォーマット（避けるべきPickの参考に）
    weak_text = "なし"
    if draft_info.get("weak_matchups"):
        lines = []
        for w in draft_info["weak_matchups"]:
            lines.append(f"  - {w['champion']}: {w['losses']}敗/{w['games']}戦 (敗北率{w['loss_rate']}%)")
        weak_text = "\n".join(lines)

    # ★マッチアップ勝率の実データフォーマット
    matchup_text = "（対面が不明のためデータなし）"
    if draft_info.get("matchup_data"):
        lines = []
        enemy_name = draft_info["matchup_data"][0]["enemy_champ"] if draft_info["matchup_data"] else "不明"
        for m in draft_info["matchup_data"]:
            lines.append(f"  - {m['my_champ']} vs {m['enemy_champ']}: 勝率 {m['win_rate']}")
        matchup_text = f"対面: {enemy_name}\n" + "\n".join(lines)
        matchup_text += "\n  ※数値はLoLalyticsの統計データに基づく実勝率です。50%以上なら有利、以下なら不利です。"

    prompt = f"""あなたはLeague of Legendsのドラフトフェイズ専門コーチ「アンちゃん」です。
チャンピオンセレクト画面の**Pickフェイズ**において、プレイヤーが最も有利にゲームを開始できる最適なチャンピオンを提案してください。

===== プレイヤー情報 =====
サモナー名: {draft_info.get('summoner_name', '不明')}
担当レーン: {lane}
ランク帯: {rank}

===== BANされたチャンピオン =====
{bans}

===== 味方の構成（分かっている範囲） =====
{ally}

===== 敵の構成（分かっている範囲） =====
{enemy}

===== 📊 現パッチのメタ統計（勝率・ピック率TOP、{lane}レーン） =====
{meta_text}

===== 😰 プレイヤーの苦手対面（負けやすい相手） =====
{weak_text}

===== ⚔️ マッチアップ勝率（LoLalytics実データ）=====
{matchup_text}

===== プレイヤーの熟練度上位チャンピオン =====
{mastery_text}

===== プレイヤーの直近試合パフォーマンス（勝率順） =====
{perf_text}

===== 内部知識ベース =====
{knowledge_ctx}

===== 出力フォーマット（厳守） =====

**💡 PICK推奨（3体）**
1. **チャンピオン名** → 理由を1〜2行で（根拠をデータに基づいて示す）
2. **チャンピオン名** → 理由
3. **チャンピオン名** → 理由

**⚔️ 戦術方針**
推奨Pickを踏まえた勝ち筋を2〜3行で端的にまとめる。

===== 判断基準（この優先順位で総合判断してください） =====
1. **カウンター性能（最重要）**: 「マッチアップ勝率」データがある場合、勝率50%以上のチャンピオンの中からPickを選ぶこと。勝率が高いほど有利。マッチアップ勝率が50%未満のチャンピオンは絶対に推奨しないこと。
2. **プレイヤーの得意キャラ**: 熟練度が高い・直近勝率が高いチャンピオンは、本人の練度で上振れしやすい。カウンター性能と両立するキャラが理想。
3. **構成シナジー**: 味方構成とのバランス（ダメージタイプ分散、CC/エンゲージ有無、スケーリングバランス）。味方がAD偏りならAPを推奨するなど。
4. **メタ統計**: 現パッチで勝率・ピック率が高いチャンピオンは地力が高い。
5. **ランク帯考慮**: プレイヤーのランク帯で特に効果的なチャンピオンを意識する。

===== 注意事項 =====
- BANされたチャンピオンは推奨に含めないでください。
- 味方や敵構成が未入力の場合は、メタ的に汎用性が高い選択を提案してください。
- プレイヤーの苦手対面に強いチャンピオンをPickすることで、敵のカウンターPickを牽制できる点も考慮してください。
- 文字数は全体で500文字以内に収めてください。

===== 絶対遵守ルール =====
- 上記で提供されたデータ（メタ統計・苦手対面・熟練度・直近勝率・構成情報）のみを根拠にしてください。
- 提供されていない勝率やピック率の数値を捏造してはいけません。数値を出す場合は上記データに記載があるもののみ使用してください。
- マッチアップの有利不利を述べる場合は、一般的なLoL知識からの判断であることを明記してください。
"""

    return _call_gemini(prompt)

def analyze_build_phase(build_info, lol_knowledge):
    """
    Pick完了後、自分が使うチャンピオンと対面（敵）のチャンピオン情報から、
    専用にカスタマイズされたルーン、ビルド、立ち回りを提案する。
    """
    if not client:
        return "Gemini APIが設定されていません。"

    knowledge_ctx = "\n".join(lol_knowledge) if lol_knowledge else "（知識ベースなし）"
    my_champ = build_info.get("my_champ", "不明")
    enemy_champ = build_info.get("enemy_champ", "不明")
    lane = build_info.get("lane", "不明")
    
    # 対面の勝率データ
    win_rate_text = build_info.get("win_rate", "不明（データなし）")
    
    prompt = f"""あなたはLeague of Legendsの戦略・ビルド専門コーチ「アンちゃん」です。
プレイヤーのセレクトが完了し、次はルーンの設定とアイテム選択に入ります。
敵の対面チャンピオンに対して、**最も有利になる、あるいは不利を覆すための対面特化セットアップ**を提案してください。

===== マッチアップ構造 =====
あなたの使用チャンピオン: {my_champ}
担当レーン: {lane}
敵の対面チャンピオン: {enemy_champ}

===== 📊 このマッチアップの実勝率（LoLalytics調べ） =====
あなたの勝率: {win_rate_text}
※50%以上なら有利、以下なら不利なマッチアップです。

===== ルーン選択の思考プロセス（内部処理用・出力不要） =====
1. {my_champ} の基本的なキーストーン候補を洗い出す。
2. 対面 {enemy_champ} のダメージタイプ（物理/魔法/確定）とプレイスタイル（バースト/継続ダメージ/ポーク）を考慮する。
3. （例）相手がポーク主体なら「息継ぎ/ビスケット」、オールイン主体やバーストなら「ボーンアーマー」、行動妨害が多いなら「気迫」など、**対面に刺さるサブパス**を必ず選定する。

===== 内部知識ベース =====
{knowledge_ctx}

===== 出力フォーマット（厳守） =====

**🛡️ 対面特化ルーン**
- **キーストーン**: (ルーン名)
- **理由**: 単なる一般的な利点ではなく、「対面（{enemy_champ}）のスキルセットや特性に対してなぜこの選択をしたのか」を具体的に解説。
- **サブパスの重要ルーン**: (ルーン名) → (例：相手がバーストならボーンアーマー等、対面の性質を名指しして理由を説明)

**⚔️ 推奨コアビルド**
- **初手アイテム / コア1**: (アイテム名) → 対面を意識した理由
- **コア2以降・シチュエーショナル**: (対面のダメージタイプや特性を考慮した防御/阻害アイテム等があれば1〜2個推奨)

**🧠 レーン戦の立ち回り（対 {enemy_champ}）**
- トレードのコツや、警戒すべき相手のパワースパイクを2〜3行で端的にまとめる。

===== 注意事項 =====
- 一般的なテンプレビルドではなく、**「対面の{enemy_champ}を想定したカスタマイズ」**を中心に語ってください。
- 文字数は全体で450文字以内に収めてください。
"""

    return _call_gemini(prompt)

if __name__ == "__main__":
    print("Gemini API Client tests")
