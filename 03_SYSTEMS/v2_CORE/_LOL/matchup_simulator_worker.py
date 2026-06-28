import os
import sys
import json
import httpx
from datetime import datetime, timezone
from google import genai
from google.genai import types

# パス追加
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
from v2_CORE.settings import settings
from v2_CORE.ai_helper import generate_content_safe
from v2_CORE.logger_config import setup_sovereign_logging

logger = setup_sovereign_logging("MatchupSimulatorWorker")

def main():
    if len(sys.argv) < 4:
        logger.error("Usage: python matchup_simulator_worker.py <champion> <enemy> <role>")
        sys.exit(1)
        
    champion = sys.argv[1]
    enemy = sys.argv[2]
    role = sys.argv[3]
    
    logger.info(f"Starting matchup simulation: {champion} vs {enemy} ({role})")
    
    # Supabase 接続準備
    supabase_url = settings.SUPABASE_URL
    supabase_key = settings.SUPABASE_KEY
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json"
    }
    
    # 自分のGLOBALデータをロード
    my_id = f"champ_{champion}_global"
    enemy_id = f"champ_{enemy}_global"
    
    my_data = {}
    enemy_data = {}
    
    try:
        # 自分
        res = httpx.get(f"{supabase_url}/rest/v1/matchup_sentinel?matchup_id=eq.{my_id}", headers=headers, timeout=10)
        if res.status_code == 200 and res.json():
            my_data = res.json()[0].get("raw_data") or {}
            
        # 相手
        res_e = httpx.get(f"{supabase_url}/rest/v1/matchup_sentinel?matchup_id=eq.{enemy_id}", headers=headers, timeout=10)
        if res_e.status_code == 200 and res_e.json():
            enemy_data = res_e.json()[0].get("raw_data") or {}
    except Exception as e:
        logger.warning(f"Failed to fetch sentinel records: {e}. Simulating with generic knowledge.")

    # Gemini 準備
    api_key = settings.GEMINI_API_KEY_FREE or settings.GEMINI_API_KEY
    if not api_key:
        logger.error("Gemini API key is not configured.")
        sys.exit(1)
        
    client = genai.Client(api_key=api_key)
    
    # 各データの準備
    my_style = my_data.get("jg_style") or {}
    enemy_style = enemy_data.get("jg_style") or {}
    
    prompt = f"""【League of Legends 対面戦闘シミュレーター】
以下の設定において、2体のチャンピオンが同じレーン/ロールで対峙した際の詳細なレーン展開予測と立ち回りシミュレーションを行ってください。

【対面設定】
- ロール/レーン: {role}
- プレイヤー側チャンピオン: {champion}
  - プレイスタイル分類: {my_style.get('type', '未設定')}
  - 強み: {my_data.get('strengths', '一般データ')}
  - 弱み: {my_data.get('weaknesses', '一般データ')}
  - パワースパイク: {my_data.get('powerSpikes', '一般データ')}
- 対面（敵）チャンピオン: {enemy}
  - プレイスタイル分類: {enemy_style.get('type', '未設定')}
  - 強み: {enemy_data.get('strengths', '一般データ')}
  - 弱み: {enemy_data.get('weaknesses', '一般データ')}
  - パワースパイク: {enemy_data.get('powerSpikes', '一般データ')}

【条件】
アイアン〜ゴールド帯（中レート・再現性の高い立ち回り）を基準にし、お互いのスキルの噛み合わせ、プレイスタイル、パワースパイクのタイミングを踏まえて予測を立ててください。

出力は以下のJSONフォーマットのみ（マークダウンの ```json や余計な説明文は一切なし、純粋なJSONオブジェクトのみ）で返してください：

{{
  "my_champion": "{champion}",
  "enemy_champion": "{enemy}",
  "role": "{role}",
  "difficulty": 3, // 対面の難易度 (1:非常に簡単, 2:簡単, 3:普通, 4:難しい, 5:極めて困難)
  "matchup_score": 50, // プレイヤー側の有利度。50が互角、100なら圧倒的有利、0なら手も足も出ないレベルの不利（数値のみ）
  "timeline": {{
    "early": {{
      "advantage": "MY_ADVANTAGE" | "ENEMY_ADVANTAGE" | "EVEN", // いずれか1つを選択
      "description": "レベル1〜5の序盤戦（最初の周回やレーン戦、スカトルファイト等）の展開予測と立ち回り注意点（日本語で2文）"
    }},
    "mid": {{
      "advantage": "MY_ADVANTAGE" | "ENEMY_ADVANTAGE" | "EVEN",
      "description": "レベル6（アルティメット取得後、1stコア完成頃）の中盤戦における動き、どちらが主導権を握るか（日本語で2文）"
    }},
    "late": {{
      "advantage": "MY_ADVANTAGE" | "ENEMY_ADVANTAGE" | "EVEN",
      "description": "集団戦やオブジェクト戦、2ndコア完成以降の終盤戦での両者の影響力比較（日本語で2文）"
    }}
  }},
  "key_clash": "お互いの主要スキルや強みがどのようにぶつかり合うかの解説（例：相手のCCを自チャンプのスキルで避けられるか等、具体的に日本語で2文）",
  "win_keys": [
    "勝利するための具体的な立ち回り・戦術アドバイス1（日本語、1文で簡潔に）",
    "勝利するための具体的な立ち回り・戦術アドバイス2",
    "勝利するための具体的な立ち回り・戦術アドバイス3"
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
        
        # 構文チェックを兼ねてロード
        sim_data = json.loads(res_text)
        
        # 結果を標準出力へダンプ（デーモンがキャッチする）
        print(json.dumps(sim_data))
        
    except Exception as e:
        logger.error(f"Failed to generate simulation: {e}")
        sys.exit(2)

if __name__ == "__main__":
    main()
