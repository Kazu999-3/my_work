import os
import sys
import glob
import time
import json
import logging
from pathlib import Path
import dotenv

dotenv.load_dotenv(Path("D:/my_work/.env"))
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("PublishLocal")

# パスを追加
sys.path.append(str(Path("D:/my_work/03_SYSTEMS")))

from v2_CORE._MONETIZE.publisher import NotePublisher, XPublisher
from v2_CORE._MONETIZE.monetization_loop import generate_x_promo_thread

def publish_local_article(champion_name: str, price: str = "500", auto_publish: bool = True):
    article_dir = Path("D:/my_work/02_FACTORY/PRODUCTS/ARTICLES")
    # ARTICLE_* または HONKI_BIBLE_* を探す
    files = glob.glob(str(article_dir / f"ARTICLE_{champion_name}_*.md"))
    if not files:
        files = glob.glob(str(article_dir / f"HONKI_BIBLE_{champion_name}_*.md"))
        
    if not files:
        logger.error(f"No article found for champion: {champion_name}")
        return
        
    target_file = Path(files[0]) # 複数あっても最初の一つ
    logger.info(f"Target article found: {target_file.name}")
    
    bible_text = target_file.read_text(encoding="utf-8")
    if len(bible_text) < 200:
        logger.error("Article is too short or empty. Aborting publish.")
        return

    # X用プロモスレッドの生成
    logger.info(f"Generating X promo thread for {champion_name}...")
    x_thread_json_str = generate_x_promo_thread(champion_name, bible_text)
    
    # note への投稿
    logger.info("Starting Note Publisher...")
    note_pub = NotePublisher(headless=True)
    note_title = f"【最新メタ】{champion_name} 完全攻略ガイド"
    note_url = note_pub.post_draft(
        title=note_title,
        markdown_body=bible_text,
        auto_publish=auto_publish,
        price=price
    )
    
    if not note_url:
        logger.error("Failed to publish to Note.")
        return
        
    logger.info(f"Note URL: {note_url}")
    
    # X への投稿
    x_url = None
    if auto_publish: # auto_publishがTrueの時だけXにも投稿する想定
        logger.info("Starting X Publisher...")
        x_pub = XPublisher(headless=True)
        try:
            tweets = json.loads(x_thread_json_str)
        except Exception as e:
            logger.error(f"Failed to parse X thread JSON: {e}")
            tweets = []
            
        if tweets:
            x_url = x_pub.post_thread(tweets)
            logger.info(f"X Thread URL: {x_url}")
        else:
            logger.warning("No tweets generated for X.")
            
    print("\n===============================")
    print(f"Publish completed for {champion_name}")
    print(f"Note URL: {note_url}")
    if x_url:
        print(f"X URL: {x_url}")
    print("===============================\n")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Publish local article to Note and X")
    parser.add_argument("champion", help="Champion name (e.g., Ahri)")
    parser.add_argument("--price", default="500", help="Price for the note article")
    parser.add_argument("--draft", action="store_true", help="Post as draft only (no auto-publish to X)")
    
    args = parser.parse_args()
    publish_local_article(args.champion, price=args.price, auto_publish=not args.draft)
