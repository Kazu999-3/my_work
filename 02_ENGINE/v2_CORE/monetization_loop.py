import os
import random
import time
import logging
from pathlib import Path
import requests
import google.generativeai as genai
import dotenv

dotenv.load_dotenv(Path("D:/my_work/.env"))
logger = logging.getLogger("MonetizationLoop")

DISCORD_WEBHOOK = os.environ.get("DISCORD_WEBHOOK")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

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

def generate_x_promo_thread(champion: str, bible_text: str):
    """バイブルをもとにX(Twitter)用の煽りスレッド原稿を錬成する"""
    if not GEMINI_API_KEY:
        return "Gemini APIキーが設定されていません。"
        
    model = genai.GenerativeModel('gemini-2.0-flash')
    prompt = f"""
    あなたは超一流のWebマーケターであり、League of Legendsの戦略家です。
    以下の{champion}の攻略バイブルを元に、X（Twitter）で爆発的にバズり、noteの購入へ誘導するための
    「煽り」と「有益性」が同居したツリー形式（スレッド形式）の投稿原稿を作成してください。
    
    【ルール】
    1. 1ポスト目は、読者の常識を破壊するフック（例：「まだ〇〇で苦労してるの？14.xパッチはこれ一択」）。
    2. 2〜3ポスト目は、具体的な強さの証明（バイブル内の情報から抜粋）。
    3. 最後のポストは、詳細な解説記事（note等）への誘導リンク枠を含める。
    4. AI臭い言葉（「結論から言うと」「〜と言えるでしょう」）は絶対に使わないこと。
    5. **「ティアリスト（Tier List）」や「Sティア」「Aティア」といった安っぽい格付け表現は一切使わないこと。**
    6. 各ポストは140文字以内に収める想定で書くこと。
    
    【バイブル本文】
    {bible_text[:5000]}
    """
    
    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        logger.error(f"Gemini Error generating X thread: {e}")
        return "原稿の生成に失敗しました。"

def run_monetization_loop():
    """トレンド検知（アイテム起点） ➔ バイブル生成 ➔ X原稿 のループ"""
    logger.info("💰 自動錬金術ループ（アイテム・ルーン起点）を開始します...")
    
    # 1. アイテム・ルーン起点のトレンド調査
    from v2_CORE.item_scout import ItemScout
    scout = ItemScout()
    item_name, impact, beneficiaries = scout.select_best_target()
    
    if not item_name or not beneficiaries:
        logger.warning("No clear item trends detected. Falling back to default list.")
        trending_champ = random.choice(["Lillia", "JarvanIV", "Shyvana"])
        meta_context = "標準的なメタ調査"
    else:
        # トレンドアイテムに合致するチャンプからランダムで1体選択
        trending_champ = random.choice(beneficiaries)
        meta_context = f"【{item_name}】の影響: {impact}"
        
    logger.info(f"📈 トレンド検知: {item_name} の影響により {trending_champ} をターゲットに設定しました。")
    notify_discord(f"🚨 **[Sovereign Scout]** トレンド検知: **{item_name}** がメタを支配中。\n恩恵を受ける **{trending_champ}** の本気バイブルを生成します。\n文脈: {impact}")
    
    # 2. バイブル（記事）の錬成とChampionDBの更新
    from v2_CORE.bible_forge import generate_bible
    logger.info(f"📖 {trending_champ} の本気バイブルを錬成中... (Context: {meta_context})")
    
    # generate_bible に meta_context を渡せるように後ほど bible_forge.py も改修する
    output_path = generate_bible(trending_champ, meta_context=meta_context)
    if not output_path or not output_path.exists():
        notify_discord(f"❌ {trending_champ} のバイブル錬成に失敗しました。")
        return
        
    bible_text = output_path.read_text(encoding="utf-8")
    
    # 3. X(Twitter)用スレッドの生成
    logger.info(f"🐦 {trending_champ} のX販促スレッドを錬成中...")
    x_thread_text = generate_x_promo_thread(trending_champ, bible_text)
    
    promo_path = Path(f"D:/my_work/01_INTEL/prompts/X_PROMO_{trending_champ}.md")
    promo_path.parent.mkdir(parents=True, exist_ok=True)
    promo_path.write_text(x_thread_text, encoding="utf-8")
    
    # 4. 完了通知
    success_msg = (
        f"✅ **[自動錬金術ループ完了]**\n"
        f"対象: **{trending_champ}**\n\n"
        f"1️⃣ **ChampionDB更新**: 最新の立ち回り・ビルドを辞典にマージ完了。\n"
        f"2️⃣ **バイブル生成**: `{output_path.name}` に1万文字級の攻略記事を出力しました。\n"
        f"3️⃣ **X販促原稿**: `{promo_path.name}` にバズ誘発用のスレッド原稿を出力しました。コピペして投稿可能です。\n"
        f"💰 次の行動: Xへ投稿し、noteへのリンクを繋げてください。"
    )
    logger.info("✨ ループ完了")
    notify_discord(success_msg)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_monetization_loop()
