import sys
import time
import logging
import os
import msvcrt
import schedule
from pathlib import Path

# ==========================================
# Single Instance Lock
# ==========================================
LOCK_FILE_PATH = Path(__file__).resolve().parent / "orchestrator.lock"
lock_file = open(LOCK_FILE_PATH, "w")
try:
    msvcrt.locking(lock_file.fileno(), msvcrt.LK_NBLCK, 1)
except IOError:
    print("[ERROR] 既に別のオーケストレーターが起動しています。多重起動を防止するため終了します。")
    sys.exit(0)

# ==========================================
# Sovereign OS: Unified Master Orchestrator
# (Centralized Schedule Manager)
# ==========================================

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENGINE_DIR = BASE_DIR / "02_ENGINE"
sys.path.append(str(ENGINE_DIR))
sys.path.append(str(ENGINE_DIR / "LEGACY"))

from v2_CORE.pulse import pulse
from v2_CORE.logger_config import setup_sovereign_logging
from v2_CORE.sentinel import sentinel
from v2_CORE.monetization_loop import run_monetization_loop
from v2_CORE.darwin_engine import DarwinEngine
from v2_CORE.bounty_hunter import BountyHunter
from v2_CORE.bible_forge import BibleForge
from v2_CORE.publisher import NotePublisher
from v2_CORE.match_importer import import_matches
from v2_CORE.champ_db_updater import process_interrogation_queue

# 統合ロガー
logger = setup_sovereign_logging("Orchestrator")

# --- ジョブ定義 ---

def job_pulse_cycle():
    pulse.run_cycle()

def job_pulse_patches():
    pulse.check_lol_patches()

def job_pulse_ranks():
    pulse.sync_player_ranks()

def job_match_importer():
    try:
        import_matches()
        process_interrogation_queue()
    except Exception as e:
        logger.error(f"Match Importer failed: {e}")

def job_sentinel_audit():
    try:
        sentinel.run_daily_audit()
    except Exception as e:
        logger.error(f"Sentinel Audit failed: {e}")

def job_monetization():
    try:
        run_monetization_loop()
    except Exception as e:
        logger.error(f"Monetization Loop failed: {e}")

def job_darwin():
    try:
        DarwinEngine().run_cycle()
    except Exception as e:
        logger.error(f"Darwin Engine failed: {e}")

def job_bounty_hunter():
    try:
        hunter = BountyHunter()
        bounties = hunter.scout_competitors()
        if bounties:
            target = bounties[0]
            logger.info(f"🎯 競合狩りを実行します: {target['title']}")
            prompt = hunter.generate_crushing_prompt(target['title'])
            forge = BibleForge()
            bible_text = forge.generate_bible("Meta Champion", additional_context=prompt)
            note_pub = NotePublisher(headless=True)
            note_pub.post_draft(
                title=f"【完全版】{target['title']} の上位互換バイブル（格安）",
                markdown_body=bible_text,
                auto_publish=True,
                price="500"
            )
    except Exception as e:
        logger.error(f"Bounty Hunter failed: {e}")

def main():
    logger.info("==================================================")
    logger.info("   🔱 SOVEREIGN OS: UNIFIED MASTER ORCHESTRATOR")
    logger.info("   (Centralized Schedule Manager - Diet Mode)")
    logger.info("==================================================")

    # 1. 初期起動タスク
    try:
        pulse.initial_startup()
    except Exception as e:
        logger.error(f"Initial startup failed: {e}")

    # ---------------------------------------------
    # 2. スケジュール登録（MVPと収益化に特化）
    # ---------------------------------------------
    
    # 毎分: 内部ファイル監視（Pulse）
    schedule.every(1).minutes.do(job_pulse_cycle)
    
    # 30分毎: 公式パッチ監視
    schedule.every(30).minutes.do(job_pulse_patches)
    
    # 15分毎: ソロキューの戦績自動取り込み
    schedule.every(15).minutes.do(job_match_importer)
    
    # 6時間毎: 収益化ループ（note記事の自動作成と公開）
    schedule.every(6).hours.do(job_monetization)
    
    # 12時間毎: プレイヤーランク同期
    schedule.every(12).hours.do(job_pulse_ranks)
    
    # 毎日 00:00: 自己監査 (Sentinel Audit)
    schedule.every().day.at("00:00").do(job_sentinel_audit)
    
    # ---------------------------------------------
    # 3. 無効化されたオーバースペック機能（コメントアウト）
    # API節約・無料枠維持のため、本当に必要な時以外は動かさない
    # ---------------------------------------------
    # - Darwin進化 (DBレビューと学習 - 毎日 02:00)
    # - 競合狩り / Bounty Hunter (毎日 04:00 - 自動スパム防止のため停止)
    # - Live Scout (ライブ試合監視)
    # - Personal Coach (15分ごとのコーチング)
    # - Auto Healer (1分ごとの自己修復 - リソース過多)
    # - Skill Synthesizer (1分ごとのスキル自己生成 - 無限API消費の危険)
    # - Overseas Scout (海外メタ精査)
    # - Draft Analyzer
    # - News Scout
    # - Magazine Forge (月刊誌自動生成)
    # - VOD Oracle (動画視覚メタ学習 - 12時間ごと)
    # - YouTube Watcher (旧YouTube監視機能)
    
    logger.info("✅ Scheduler initialized. Entering main loop...")
    
    try:
        while True:
            # 時間が来たジョブを1つずつ順番に実行する（API衝突の完全回避）
            schedule.run_pending()
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("👋 Shutdown signal received. Stopping Sovereign OS...")
    except Exception as e:
        logger.error(f"🚨 Orchestrator crashed: {e}")

if __name__ == "__main__":
    main()
