import os
import sys
from pathlib import Path

# PYTHONPATHの調整
sys.path.append(str(Path(__file__).resolve().parent.parent))

from v2_CORE.pulse import system_pulse
import logging

if __name__ == "__main__":
    logging.info("Starting Sovereign Pulse from CLI (Github Actions / Cron)")
    system_pulse()
    logging.info("Sovereign Pulse execution completed.")
