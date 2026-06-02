import sys
from pathlib import Path
import threading
import time
import logging

# Add project root and engine directories to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
ENGINE_DIR = BASE_DIR / "02_ENGINE"
sys.path.append(str(ENGINE_DIR))
sys.path.append(str(ENGINE_DIR / "LEGACY"))

from v2_CORE.pulse import pulse
from LEGACY.autonomous_kingdom import SovereignCoordinator
from v2_CORE.logger_config import setup_sovereign_logging

# Setup integrated logging
logger = setup_sovereign_logging("MasterEngine")

def run_master_engine():
    logger.info("==================================================")
    logger.info("   👑 SOVEREIGN OS: Integrated Master Engine")
    logger.info("==================================================")

    # 1. Start Pulse (Monitoring Heartbeat) in a background thread
    logger.info("[+] Starting Pulse (Real-time Monitoring)...")
    pulse.start()

    # 2. Start Autonomous Kingdom (Content Generation) in the main thread
    logger.info("[+] Starting Autonomous Kingdom (Content Pipeline)...")
    coordinator = SovereignCoordinator()
    
    try:
        # Run the perpetual loop (default 3 hours interval)
        coordinator.main_loop(interval_hours=3)
    except KeyboardInterrupt:
        logger.info("[-] Shutdown signal received. Stopping services...")
        pulse.stop()
        logger.info("[!] Sovereign OS stopped.")
    except Exception as e:
        logger.error(f"🔥 Critical failure in Master Engine: {e}")
        pulse.stop()
        sys.exit(1)

if __name__ == "__main__":
    run_master_engine()
