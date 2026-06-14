# Test script to verify SRE Auto-Healer
import time
import os
import logging
from v2_CORE.logger_config import setup_sovereign_logging

logger = setup_sovereign_logging("HealerTest")

def test_func():
    logger.info("Testing Auto-Healer in progress...")
    try:
        # わざと NameError 例外を発生させる（バグ箇所）
        undefined_variable_error_test()
    except Exception as e:
        logger.exception(f"❌ Exception caught in test_func: {e}")

if __name__ == "__main__":
    test_func()
