# ============================================================
# Sovereign Pulse を「1回だけ」実行するエントリ。
#
# pulse.py 本体は常駐前提（無限ループ＋Discord常駐＋ローカルのファイル監視）で、
# そのままではスケジューラから呼べない。ここではクラウドで意味のある処理だけを
# 順に1回ずつ実行する。
#
#   - パッチ更新の検知
#   - LoLalytics の統計取得
#   - Discordサーバーメンバーの同期
#
# ローカルのファイル監視(check_file_changes)はPC上のファイルが対象なので呼ばない。
# ============================================================
import asyncio
import logging
import os
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("run_pulse_once")


def main() -> int:
    from v2_CORE.pulse import pulse

    # 1つコケても後続を止めない。どれが失敗したかは最後にまとめて報告する。
    failures = []

    steps = [
        ("パッチ更新の検知", lambda: pulse.check_lol_patches()),
        ("LoLalytics統計の取得", lambda: pulse.check_lolalytics_stats()),
        ("Discordメンバー同期", lambda: asyncio.run(pulse.sync_server_members())),
    ]

    for label, fn in steps:
        try:
            logger.info(f"▶ {label} を実行します...")
            fn()
            logger.info(f"✅ {label} 完了")
        except Exception as e:
            logger.error(f"❌ {label} に失敗: {e}")
            failures.append(f"{label}: {e}")

    if failures:
        logger.error("一部の処理が失敗しました:\n  - " + "\n  - ".join(failures))
        # 全滅した場合だけ異常終了にする（一部失敗で毎回赤くなると通知が形骸化するため）
        return 1 if len(failures) == len(steps) else 0

    logger.info("すべての処理が完了しました。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
