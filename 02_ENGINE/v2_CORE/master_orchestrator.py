import sys
import threading
import time
import logging
from pathlib import Path

# ==========================================
# Sovereign OS: Unified Master Orchestrator
# YouTube監視、コンテンツ生成、同期を統合管理する中心核
# ==========================================

# パス設定
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENGINE_DIR = BASE_DIR / "02_ENGINE"
sys.path.append(str(ENGINE_DIR))
sys.path.append(str(ENGINE_DIR / "LEGACY"))

from v2_CORE.pulse import pulse
from v2_CORE.logger_config import setup_sovereign_logging
from LEGACY.autonomous_kingdom import SovereignCoordinator
from v2_CORE.riot_observer import RiotObserver
import youtube_playlist_watcher

# 統合ロガー
logger = setup_sovereign_logging("Orchestrator")

def run_pulse():
    """インフラ監視エンジンの起動"""
    logger.info("💓 Pulse (Heartbeat) starting...")
    try:
        pulse.start()
    except Exception as e:
        logger.error(f"🔥 Pulse failed: {e}")

def run_youtube_watcher():
    """YouTubeプレイリスト監視エンジンの起動"""
    logger.info("📺 YouTube Playlist Watcher starting...")
    try:
        # すでに youtube_playlist_watcher.py に main() があるためそれを呼び出す
        youtube_playlist_watcher.main()
    except Exception as e:
        logger.error(f"🔥 YouTube Watcher failed: {e}")

def run_riot_observer():
    """ソロキュー試合監視エンジンの起動"""
    logger.info("🎮 Riot Observer (SoloQ Monitoring) starting...")
    try:
        observer = RiotObserver()
        observer.monitor()
    except Exception as e:
        logger.error(f"🔥 Riot Observer failed: {e}")

def run_coordinator():
    """メインのコンテンツ生成・リサーチエンジンの起動"""
    logger.info("🏰 Sovereign Coordinator (Kingdom) starting...")
    try:
        coordinator = SovereignCoordinator()
        # デフォルト3時間おきに実行
        coordinator.main_loop(interval_hours=3)
    except Exception as e:
        logger.error(f"🔥 Coordinator failed: {e}")

def main():
    logger.info("==================================================")
    logger.info("   🔱 SOVEREIGN OS: UNIFIED MASTER ORCHESTRATOR")
    logger.info("   (YouTube + Research + Forge + Sync + Pulse)")
    logger.info("==================================================")

    threads = []

    # 1. Pulse (監視)
    t_pulse = threading.Thread(target=run_pulse, name="PulseThread", daemon=True)
    threads.append(t_pulse)

    # 2. YouTube Watcher (目)
    t_yt = threading.Thread(target=run_youtube_watcher, name="YouTubeThread", daemon=True)
    threads.append(t_yt)

    # 3. Coordinator (脳)
    t_coord = threading.Thread(target=run_coordinator, name="KingdomThread", daemon=True)
    threads.append(t_coord)

    # 4. Riot Observer (ソロキュー監視)
    t_riot = threading.Thread(target=run_riot_observer, name="RiotThread", daemon=True)
    threads.append(t_riot)

    # 5. Live Scout (ローディング画面監視)
    def run_live_scout():
        from v2_CORE.live_scout import LiveScout
        logger.info("🟢 Live Scout (Client Monitor) starting...")
        try:
            LiveScout().run()
        except Exception as e:
            logger.error(f"🔥 Live Scout failed: {e}")
            
    t_live = threading.Thread(target=run_live_scout, name="LiveScoutThread", daemon=True)
    threads.append(t_live)

    # 6. Monetization Loop (自動錬金術ループ: 6時間に1回)
    def run_monetization():
        from v2_CORE.monetization_loop import run_monetization_loop
        logger.info("💰 Monetization Loop starting (Every 6 hours)...")
        while True:
            try:
                run_monetization_loop()
            except Exception as e:
                logger.error(f"🔥 Monetization Loop failed: {e}")
            time.sleep(60 * 60 * 6) # 6時間待機
            
    t_money = threading.Thread(target=run_monetization, name="MonetizationThread", daemon=True)
    threads.append(t_money)

    # 全エンジンの点火
    for t in threads:
        t.start()
        time.sleep(1) # 起動タイミングを少しずらしてログの混線を防ぐ

    logger.info("✅ All systems initialized and running in parallel.")
    logger.info("💡 Press Ctrl+C to stop all services.")

    try:
        while True:
            # メインスレッドは死活監視のみ行う
            alive_threads = [t.name for t in threads if t.is_alive()]
            if not alive_threads:
                logger.warning("⚠️ All sub-engines have stopped. Exiting...")
                break
            time.sleep(10)
    except KeyboardInterrupt:
        logger.info("👋 Shutdown signal received from King. Stopping Sovereign OS...")
    finally:
        pulse.stop()
        logger.info("[!] Unified Sovereign OS halted.")

if __name__ == "__main__":
    main()
