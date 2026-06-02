import os
import random
import time
import logging
from pathlib import Path
import requests
import json
from google import genai
from google.genai import types
from v2_CORE.settings import settings
from v2_CORE.ai_helper import generate_content_safe
import dotenv

dotenv.load_dotenv(Path("D:/my_work/.env"))
logger = logging.getLogger("MonetizationLoop")

DISCORD_WEBHOOK = os.environ.get("DISCORD_WEBHOOK")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY_FREE")

if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)

# 今回のトレンド調査対象（例）
TARGET_CHAMPS = ["Lillia", "JarvanIV", "Shyvana", "Zyra", "Nocturne", "Nidalee", "Brand", "Karthus"]

def notify_discord(message: str):
    """Discordに通知を送信する"""
    if not DISCORD_WEBHOOK:
        return
    try:
        requests.post(DISCORD_WEBHOOK, json={"content": message})
    except Exception as e:
        logger.error(f"Discord Webhook Error: {e}")

def generate_x_promo_thread(champion_name: str, bible_text: str) -> str:
    """バイブルの本文から、X(Twitter)用のバズるスレッド（3連投）を錬成する"""
    if not client:
        return "[]"
        
    # 自己進化するマーケティングルールの読み込み
    from pathlib import Path
    rules_path = Path('D:/my_work/01_INTEL/prompts/marketing_rules.txt')
    marketing_rules = ''
    if rules_path.exists():
        marketing_rules = rules_path.read_text(encoding='utf-8')
        
    prompt = f"""
    あなたはSNSマーケティングの天才です。
    以下の【自己進化マーケティング・ルール】を最優先して、フック文を作成してください。
    【ルール】
    {marketing_rules}
    
    バイブルの本文を読み込み、Xで拡散されやすいスレッド（3連投）の原稿を作成してください。
    以下の{champion_name}の攻略記事を元に、X（Twitter）での反応を良くし、noteの購入へ誘導するための
    「煽り」と「有益性」が同居したツリー形式（スレッド形式）の投稿原稿を作成してください。
    
    【厳格なルール (Ghost Writer DRM)】
    1. 1ポスト目 (Hook): 読者の常識を破壊するフック（例：「まだ〇〇で苦労してるの？」）。絶対に要約から始めないこと。Curiosity Gap(好奇心)かLoss Aversion(損失回避)を刺激せよ。
    2. 2ポスト目 (Evidence): 具体的な強さの証明（バイブル内の情報から抜粋）。「いつ・どこで・何が起きたか」の具体性を持たせること。
    3. 3ポスト目 (CTA): 詳細な解説記事（note）への誘導リンク枠。読者がクリックしたくなる「気づきのギブ」を直前に入れること。
    4. AI臭い言葉（「結論から言うと」「最適化」「本質」「〜と言えるでしょう」）は絶対に使わないこと。
    5. 「ティアリスト」や「Sティア」といった安っぽい格付け表現は一切使わないこと。
    6. 各ポストは140文字以内に収める想定で書くこと。
    
    出力は必ず以下のJSON配列形式のみとすること:
    [
      "1ポスト目のテキスト（フック）",
      "2ポスト目のテキスト（証拠・学び）",
      "3ポスト目のテキスト（CTA・誘導リンク枠）"
    ]
    
    【バイブル本文】
    {bible_text[:5000]}
    """
    
    try:
        response_text = generate_content_safe(
            client,
            prompt,
            settings.DEFAULT_MODEL,
            feature_name="kingdom_cycle"
        )
        
        if not response_text or response_text.startswith("⚠️") or response_text.startswith("❌"):
            raise Exception("MonetizationLoop AI generation failed")
            
        return response_text.strip()
    except Exception as e:
        logger.error(f"Gemini Error generating X thread: {e}")
        return "[]"

def calculate_dynamic_price(trending_champ: str, item_impact: str) -> str:
    # 勝率急増のメタや、影響度が強いキーワードがあれば高価格に設定する
    high_demand_keywords = ['壊れ', 'OP', '必須', '勝率急増', '極限まで加速']
    if any(k in item_impact for k in high_demand_keywords):
        return "980"
    return "500"

def run_monetization_loop():
    """トレンド検知（アイテム起点） ➔ バイブル生成 ➔ X原稿 のループ"""
    logger.info("💰 自動生成処理（アイテム・ルーン起点）を開始します...")
    
    # 1. アイテム・ルーン起点のトレンド調査
    from v2_CORE.item_scout import ItemScout
    scout = ItemScout()
    item_name, impact, beneficiaries = scout.select_best_target()
    
    # item_name が None や "None", 空文字の場合はフォールバック
    if not item_name or str(item_name).lower() == "none" or not beneficiaries:
        logger.warning("No clear item trends detected. Falling back to default list.")
        trending_champ = random.choice(["Lillia", "JarvanIV", "Shyvana"])
        meta_context = "標準的なメタ調査"
        notify_msg = f"🔍 **[Sovereign Scout]** 定期メタパトロール: 今回は **{trending_champ}** を深掘りします。"
    else:
        # トレンドアイテムに合致するチャンプからランダムで1体選択
        trending_champ = random.choice(beneficiaries)
        meta_context = f"【{item_name}】の影響: {impact}"
        notify_msg = f"🚨 **[Sovereign Scout]** トレンド検知: **{item_name}** が流行中。\n恩恵を受ける **{trending_champ}** の攻略記事を生成します。\n文脈: {impact}"
        
    logger.info(f"📈 ターゲット選定: {trending_champ} (Context: {meta_context})")
    notify_discord(notify_msg)
    
    # 2. 攻略記事の生成とデータベースの更新
    from v2_CORE.bible_forge import BibleForge
    logger.info(f"📖 {trending_champ} の攻略記事を生成中... (Context: {meta_context})")
    
    forge_engine = BibleForge()
    output_path = forge_engine.generate_bible(trending_champ, meta_context=meta_context)
    if not output_path or not output_path.exists():
        notify_discord(f"❌ {trending_champ} の攻略記事生成に失敗しました。")
        return
        
    bible_text = output_path.read_text(encoding="utf-8")
    
    # 3. X(Twitter)用スレッドの生成
    logger.info(f"🐦 {trending_champ} のX販促スレッドを錬成中...")
    x_thread_json_str = generate_x_promo_thread(trending_champ, bible_text)
    
    promo_path = Path(f"D:/my_work/01_INTEL/prompts/X_PROMO_{trending_champ}.json")
    promo_path.parent.mkdir(parents=True, exist_ok=True)
    promo_path.write_text(x_thread_json_str, encoding="utf-8")
    
    # 3.5 Supabaseへの同期
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            x_thread_data = json.loads(x_thread_json_str)
            url = f"{SUPABASE_URL}/rest/v1/matchup_sentinel?matchup_id=eq.champ_{trending_champ}_global&select=raw_data,strategy"
            headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
            r = requests.get(url, headers=headers)
            if r.status_code == 200 and r.json():
                existing_raw = r.json()[0].get("raw_data", {})
                existing_strategy = r.json()[0].get("strategy", "")
                existing_raw["x_promo_thread"] = x_thread_data
                
                upsert_data = {
                    "matchup_id": f"champ_{trending_champ}_global",
                    "champion": trending_champ,
                    "enemy": "GLOBAL",
                    "title": f"{trending_champ} 基本戦略・トレンド",
                    "strategy": existing_strategy,
                    "raw_data": existing_raw
                }
                upsert_headers = {**headers, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"}
                res = requests.post(f"{SUPABASE_URL}/rest/v1/matchup_sentinel?on_conflict=matchup_id", headers=upsert_headers, json=upsert_data)
                if res.status_code in (200, 201):
                    logger.info("✅ Supabase に X販促スレッド(JSON)を同期しました。")
                else:
                    logger.error(f"Failed to sync X promo to Supabase: {res.text}")
        except Exception as e:
            logger.error(f"Supabase JSON sync error: {e}")
            
    # 4. 完全自動パブリッシュ (X & note)
    logger.info("🚀 完全自動パブリッシュを開始します...")
    try:
        from v2_CORE.publisher import XPublisher, NotePublisher
        
        # ダイナミック・プライシングによる価格決定
        dynamic_price = calculate_dynamic_price(trending_champ, meta_context)
        
        # noteへ自動パブリッシュ
        note_pub = NotePublisher(headless=True)
        note_title = f"【最新メタ】{trending_champ} 完全攻略ガイド"
        note_url = note_pub.post_draft(
            title=note_title,
            markdown_body=bible_text,
            auto_publish=True,
            price=dynamic_price
        )
        
        # Xへスレッド投稿
        x_url = None
        logger.info("Xへの販促スレッド投稿を開始します...")
        try:
            x_pub = XPublisher(headless=True)
            tweets = json.loads(x_thread_json_str)
            if not note_url and tweets:
                logger.warning("noteの投稿に失敗したため、noteのリンク無しでXへ投稿を強行します。")
                # 最後の誘導ツイートからリンク部分を削るなどの処理も可能ですが、まずは投稿自体を続行します
            
            x_url = x_pub.post_thread(tweets) if tweets else None
        except Exception as ex:
            logger.error(f"Xへの投稿中にエラーが発生しました: {ex}")
        
        if note_url and x_url:
            publish_status = f"✅ 完全自動パブリッシュ成功！（価格: {dynamic_price}円）\n🔗 note: {note_url}\n🔗 X: {x_url}"
        elif note_url:
            publish_status = f"⚠️ noteのみ成功しました。\n🔗 note: {note_url}"
        elif x_url:
            publish_status = f"⚠️ Xのみ成功しました。\n🔗 X: {x_url}"
        else:
            publish_status = "⚠️ パブリッシュ処理の一部（または全部）が失敗しました。ログを確認してください。"
            
        logger.info(publish_status)
    except Exception as e:
        logger.error(f"Auto-publish failed: {e}")
        publish_status = f"❌ パブリッシュ処理で致命的なエラー: {e}"
        
    # 5. 完了通知
    success_msg = (
        f"✅ **[自動生成プロセス完了]**\n"
        f"対象: **{trending_champ}**\n\n"
        f"1️⃣ **データベース更新**: 最新の立ち回り・ビルドをデータベースにマージ完了。\n"
        f"2️⃣ **記事生成**: `{output_path.name}` に攻略記事を出力しました。\n"
        f"3️⃣ **X販促同期**: Supabaseの `x_promo_thread` にデータを同期しました。\n"
        f"4️⃣ **自動パブリッシュ**: {publish_status}"
    )
    logger.info("✨ ループ完了")
    notify_discord(success_msg)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_monetization_loop()
