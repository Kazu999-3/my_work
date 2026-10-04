# ============================================================
# Sovereign Pulse を「1回だけ」実行するエントリ。
#
# pulse.py 本体は常駐前提（無限ループ＋Discord常駐＋ローカルのファイル監視）で、
# そのままではスケジューラから呼べない。ここではクラウドで意味のある処理だけを
# 順に1回ずつ実行する。
#
#   - パッチ更新の検知
#   - Discordサーバーメンバーの同期
#
# LoLalytics の統計取得(check_lolalytics_stats)は2026-10-05に外した。5体分を毎回Geminiで
# 調べて記事を書くが、生成物は実行環境ごと捨てられ何も残らず、日次クォータだけを
# 消費していた(しかも戻り値の数が合わず毎回最後に落ちていた)。
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
        # ⚠️ check_lol_patches は「前回見たパッチノートURL」を self.last_patch_url に
        # メモリで保持し、値が変わったときだけ通知する実装。単発実行では毎回 None から
        # 始まるため通知条件（last_patch_url is not None）に入らず、クラウドでは
        # パッチを検知できない（2026-09-30確認）。ここは公式パッチノートHTMLの
        # 巡回として残すが、パッチ検知の正規の経路は DataDragon の versions.json と
        # current_patch.json を比較する scripts/check_patch_update.py
        # （.github/workflows/patch-watchdog.yml で1日2回実行）である。
        ("パッチ更新の検知(単発実行では通知条件に入らない)", lambda: pulse.check_lol_patches()),
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
