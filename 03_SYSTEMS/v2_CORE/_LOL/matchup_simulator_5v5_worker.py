import os
import sys
import json
import httpx
from datetime import datetime, timezone
from google import genai
from google.genai import types

sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
from v2_CORE.settings import settings
from v2_CORE.ai_helper import generate_content_safe
from v2_CORE.logger_config import setup_sovereign_logging

logger = setup_sovereign_logging("MatchupSimulator5v5Worker")

def main():
    if len(sys.argv) < 3:
        logger.error("Usage: python matchup_simulator_5v5_worker.py <blue_champs_json> <red_champs_json>")
        sys.exit(1)
        
    try:
        blue_champs = json.loads(sys.argv[1])
        red_champs = json.loads(sys.argv[2])
    except Exception as parse_err:
        logger.error(f"Failed to parse arguments JSON: {parse_err}")
        sys.exit(1)
        
    logger.info(f"Starting 5v5 matchup simulation. Blue: {blue_champs}, Red: {red_champs}")
    
    # Supabase 接続準備
    supabase_url = settings.SUPABASE_URL
    supabase_key = settings.SUPABASE_KEY
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json"
    }
    
    # 10名のチャンピオンのデータを一括で取得する
    all_champ_names = list(blue_champs.values()) + list(red_champs.values())
    unique_champs = list(set(all_champ_names))
    
    # matchup_id のリストを作る
    matchup_ids = [f"champ_{c}_global" for c in unique_champs]
    
    # Supabase から in 演算子で一括ロード
    # PostgREST の in フィルターは in.(value1,value2,...) の形式
    ids_filter = ",".join(matchup_ids)
    url = f"{supabase_url}/rest/v1/matchup_sentinel?matchup_id=in.({ids_filter})"
    
    champ_data_map = {}
    try:
        res = httpx.get(url, headers=headers, timeout=15)
        if res.status_code == 200:
            records = res.json()
            for r in records:
                # チャンピオン名(小文字等含む)でマッピング
                champ_name = r.get("champion")
                champ_data_map[champ_name.lower()] = r.get("raw_data") or {}
        else:
            logger.warning(f"Supabase GET failed: {res.status_code} - {res.text}")
    except Exception as e:
        logger.warning(f"Failed to fetch champion data: {e}. Analyzing with generic knowledge.")

    # 各チャンピオンの強み・弱み・プレイスタイルのテキストを構築
    def get_champ_context(champ_name, role):
        data = champ_data_map.get(champ_name.lower()) or {}
        jg_style = data.get("jg_style") or {}
        return {
            "name": champ_name,
            "role": role,
            "style": jg_style.get("type") or "未設定",
            "strengths": data.get("strengths") or "一般データなし",
            "weaknesses": data.get("weaknesses") or "一般データなし",
            "power_spikes": data.get("powerSpikes") or "一般データなし"
        }
        
    blue_context = {role: get_champ_context(name, role) for role, name in blue_champs.items()}
    red_context = {role: get_champ_context(name, role) for role, name in red_champs.items()}

    # Gemini 準備
    api_key = settings.GEMINI_API_KEY_FREE or settings.GEMINI_API_KEY
    if not api_key:
        logger.error("Gemini API key is not configured.")
        sys.exit(1)
        
    client = genai.Client(api_key=api_key)
    now_str = datetime.now(timezone.utc).strftime("%Y/%m/%d")
    
    # プロンプト組み立て
    prompt = f"""【League of Legends 5v5 チーム構成＆勝利プラン・シミュレーター】
以下の設定において、Blue Side（味方チーム）5名と Red Side（敵チーム）5名の計10名のチャンピオン構成について、それぞれのレーンの有利不利、チーム構成タイプ、および時間帯ごとのゲームプラン（勝利のロードマップ）を詳細にシミュレーション・分析してください。

【システム日付】
現在は2026年です（本日：{now_str}）。最新パッチのメタ情報を踏まえて予測を行ってください。

【味方チーム (Blue Side)】
- TOP: {blue_context['TOP']['name']} （スタイル: {blue_context['TOP']['style']}, 強み: {blue_context['TOP']['strengths']}, パワースパイク: {blue_context['TOP']['power_spikes']}）
- JG: {blue_context['JG']['name']} （スタイル: {blue_context['JG']['style']}, 強み: {blue_context['JG']['strengths']}, パワースパイク: {blue_context['JG']['power_spikes']}）
- MID: {blue_context['MID']['name']} （スタイル: {blue_context['MID']['style']}, 強み: {blue_context['MID']['strengths']}, パワースパイク: {blue_context['MID']['power_spikes']}）
- BOT: {blue_context['BOT']['name']} （スタイル: {blue_context['BOT']['style']}, 強み: {blue_context['BOT']['strengths']}, パワースパイク: {blue_context['BOT']['power_spikes']}）
- SUP: {blue_context['SUP']['name']} （スタイル: {blue_context['SUP']['style']}, 強み: {blue_context['SUP']['strengths']}, パワースパイク: {blue_context['SUP']['power_spikes']}）

【敵チーム (Red Side)】
- TOP: {red_context['TOP']['name']} （スタイル: {red_context['TOP']['style']}, 強み: {red_context['TOP']['strengths']}, パワースパイク: {red_context['TOP']['power_spikes']}）
- JG: {red_context['JG']['name']} （スタイル: {red_context['JG']['style']}, 強み: {red_context['JG']['strengths']}, パワースパイク: {red_context['JG']['power_spikes']}）
- MID: {red_context['MID']['name']} （スタイル: {red_context['MID']['style']}, 強み: {red_context['MID']['strengths']}, パワースパイク: {red_context['MID']['power_spikes']}）
- BOT: {red_context['BOT']['name']} （スタイル: {red_context['BOT']['style']}, 強み: {red_context['BOT']['strengths']}, パワースパイク: {red_context['BOT']['power_spikes']}）
- SUP: {red_context['SUP']['name']} （スタイル: {red_context['SUP']['style']}, 強み: {red_context['SUP']['strengths']}, パワースパイク: {red_context['SUP']['power_spikes']}）

【分析基準】
アイアン〜ゴールド帯（中レート帯・再現性の高い立ち回り）を基準に、各レーン対面のスキルの噛み合わせ、プッシュ優先権（Priority）、ジャングルの周回ルートと関与力、および5v5集団戦やオブジェクト戦での構成全体のシナジーを考慮してください。

出力は以下のJSONフォーマットのみ（マークダウンの ```json や、余計な説明文は一切含めず、純粋なJSONオブジェクトのみ）で返してください：

{{
  "blue_team": {{
    "composition_style": "味方全体の構成タイプ（例：集団戦エンゲージ型、ポーク＆カイト型、1-3-1スプリット型、キャッチ＆バースト型、レイトゲームスケール型など。簡潔に1つ）",
    "strengths": "この構成の最大の強みと狙い（日本語で1文）",
    "weaknesses": "この構成が警戒すべき弱点やカウンター戦術（日本語で1文）"
  }},
  "red_team": {{
    "composition_style": "敵全体の構成タイプ（簡潔に）",
    "strengths": "敵構成の最大の強みと狙い（日本語で1文）",
    "weaknesses": "敵構成の弱点や付け入る隙（日本語で1文）"
  }},
  "lanes": {{
    "TOP": {{
      "priority": "BLUE_PRIORITY" | "RED_PRIORITY" | "EVEN", // いずれかを厳密に選択
      "reason": "TOPレーンの有利不利・プッシュ主導権の理由。お互いのスキル相性や序盤の強さを踏まえて（日本語で1文）"
    }},
    "JUNGLE": {{
      "priority": "BLUE_PRIORITY" | "RED_PRIORITY" | "EVEN",
      "reason": "ジャングルのマッチアップ・主導権展開。1v1の強さや周回速度、レーン関与性能を比較して（日本語で1文）"
    }},
    "MID": {{
      "priority": "BLUE_PRIORITY" | "RED_PRIORITY" | "EVEN",
      "reason": "MIDレーンの有利不利・プッシュ主導権の理由。射程やウェーブクリア能力を踏まえて（日本語で1文）"
    }},
    "BOT": {{
      "priority": "BLUE_PRIORITY" | "RED_PRIORITY" | "EVEN",
      "reason": "BOTレーン（ADC）のマッチアップの有利不利。キルプレッシャーやハラス能力の比較（日本語で1文）"
    }},
    "SUPPORT": {{
      "priority": "BLUE_PRIORITY" | "RED_PRIORITY" | "EVEN",
      "reason": "サポート同士のCC、エンゲージ、ピール性能、ラインコントロールの比較（日本語で1文）"
    }}
  }},
  "game_plan": {{
    "early": "序盤（〜Lv6、最初のドラゴン/グラブ戦）におけるBlue Sideの動きと戦術プラン（日本語で2文）",
    "mid": "中盤（1stタワー破壊後、スプリットプッシュ、視界確保）におけるBlue Side의動きと戦術プラン（日本語で2文）",
    "late": "終盤（集団戦、ドラゴンソウル/バロン戦）におけるBlue Sideの勝負どころと配置のアドバイス（日本語で2文）"
  }},
  "win_conditions": [
    "Blue Sideがこの試合に勝利するために絶対に通すべきゲーム目標1（日本語、簡潔に1文で）",
    "Blue Sideがこの試合に勝利するために絶対に通すべきゲーム目標2",
    "Blue Sideがこの試合に勝利するために絶対に通すべきゲーム目標3"
  ]
}}"""

    config = types.GenerateContentConfig(
        tools=[{"google_search": {}}]
    )
    
    try:
        res_text = generate_content_safe(
            client,
            prompt,
            model_id="gemini-2.5-flash",
            config=config,
            feature_name="oracle"
        )
        
        if not res_text or res_text.startswith("⚠️") or res_text.startswith("❌"):
            raise RuntimeError(f"Gemini API returned error: {res_text}")
            
        # JSON抽出
        res_text = res_text.strip()
        if res_text.startswith("```"):
            lines = res_text.split("\n")
            if lines[0].startswith("```json") or lines[0].startswith("```"):
                res_text = "\n".join(lines[1:-1])
        res_text = res_text.strip()
        
        # 構文チェック
        sim_data = json.loads(res_text)
        
        # 標準出力へダンプ
        print(json.dumps(sim_data))
        
    except Exception as e:
        logger.error(f"Failed to generate 5v5 simulation: {e}")
        sys.exit(2)

if __name__ == "__main__":
    main()
