import sys
from pathlib import Path
# Add the project engine directory to sys.path
sys.path.append(str(Path(__file__).resolve().parent.parent))

import logging
import time
import subprocess
from v2_CORE.settings import settings
from v2_CORE.logger_config import setup_sovereign_logging
from v2_CORE.database import db
from v2_CORE.forge import forge
from v2_CORE.promoter import promoter
from v2_CORE.prospector import prospector
from v2_CORE.auditor import auditor
from v2_CORE.council import council
from v2_CORE.herald import herald
from v2_CORE.oracle import oracle
from v2_CORE.strategist import strategist
from v2_CORE.recycler import recycler
from v2_CORE.archivist import archivist
from v2_CORE.matchup_sync import MatchupSync
from v2_CORE.sovereign_sync import SovereignSync
from scout_agent import ScoutAgent

# 統合ロギングの設定
logger = setup_sovereign_logging("AutonomousKingdom")

class SovereignCoordinator:
    """
    Antigravity Sovereign OS: 指揮官 (The Coordinator)
    Scout, OLE, Forge, Promoter を統括し、全自動の収益化サイクルを回す。
    """
    def __init__(self):
        self.scout = ScoutAgent()
        self.workshop_dir = Path("D:/my_work/02_ENGINE")
        
    def run_full_cycle(self):
        logger.info("🏰 === Antigravity Autonomous Kingdom Cycle Start ===")
        
        # 1. Scout: トレンド検知
        patch = self.scout.fetch_latest_patch()
        # 1. Scout: 一般的なメタトレンドを調査
        scout_targets = self.scout.fetch_real_meta_intel(patch)
        
        # 1.5 Oracle: パッチ（アイテム/ルーン）変更からメタを先読み
        patch_impacts = oracle.analyze_patch_impact(patch)
        for impact in patch_impacts:
            if not any(t['champion'] == impact['champion'] for t in scout_targets):
                scout_targets.append(impact)
        
        # 2. Oracle: プロの深層トレンド（隠れたOP）を自律調査
        oracle_findings = oracle.hunt_hidden_meta(settings.WATCH_CHAMPIONS)
        for finding in oracle_findings:
            if not any(t['champion'] == finding['champion'] for t in scout_targets):
                scout_targets.append({
                    "champion": finding['champion'], 
                    "role": "Unknown", 
                    "win_rate": "NEW META",
                    "source": "Oracle"
                })
        
        # 3. Strategist: 収益性予測に基づく優先順位付け (Fiscal Automator)
        final_targets = strategist.prioritize_targets(scout_targets)
        
        # ワークフローの執行
        for target in final_targets:
            champ = target['champion']
            role = target.get('role', 'Jungle')
            logger.info(f"🎯 Target Acquired: {champ} ({role}) - [Priority Executed]")
            
            # 2. YouTube Search & OLE Analysis
            # Prospector による自律動画発掘
            video_url = prospector.find_best_video(champ, patch)
            
            if video_url:
                logger.info(f"🔍 Analyzing tactics for {champ} via OLE Pro Beta...")
                try:
                    # OLEプロセスを起動（内部でDB登録まで行われる）
                    result = subprocess.run(
                        ["python", str(self.workshop_dir / "ole_youtube_analyzer.py"), video_url],
                        capture_output=True, text=False
                    )
                    if result.returncode == 0:
                        logger.info(f"✅ OLE Analysis Successful for {champ}")
                    else:
                        stderr = result.stderr.decode('utf-8', errors='replace')
                        logger.error(f"❌ OLE Analysis Failed: {stderr}")
                except Exception as e:
                    logger.error(f"❌ Error during OLE execution: {e}")

            # 3. Forge: 知略から記事を錬成
            logger.info(f"⚒️ Forging high-density article for {champ}...")
            try:
                # OLEで蓄積されたDB情報を元に記事生成
                content, draft_path, image_prompt = forge.generate_high_quality_article(champ, patch, role)
                
                # 4. Council: AI編集会議 (議論による推敲)
                logger.info(f"🤝 convening Sovereign Council for {champ}...")
                # コンテキスト用のデータをDBから取得
                ole_data = db.query_tactics(champ, limit=1)
                refined_content = council.debate_and_refine(content, str(ole_data))
                
                # 5. Auditor: 自律品質監査 & リライト
                logger.info(f"🛡️ Auditing and polishing article for {champ}...")
                polished_content = auditor.audit_and_rewrite(refined_content)
                with open(draft_path, "w", encoding="utf-8") as f:
                    f.write(polished_content)
                logger.info(f"📄 Article Polished: {draft_path}")

                # [NEW] 投稿パッケージの生成 (Herald v2 用)
                logger.info(f"📦 Generating PostPackage for {champ}...")
                package, package_path = forge.generate_post_package(champ, patch, role, polished_content)
                if package_path:
                    logger.info(f"✅ PostPackage Ready: {package_path.name}")
                
                # 6. Promoter: SNSフック案の作成 (従来の互換性維持)
                logger.info(f"🪩 Generating SNS hooks...")
                promo_content, promo_path = promoter.generate_ai_hooks(draft_path)

                # 7. Recycler: マルチプラットフォーム展開
                logger.info(f"♻️ Recycling content for TikTok/X/note...")
                recycled_text, recycled_path = recycler.recycle_tactics(draft_path)

                # 8. Herald: 王への進言 (Discord報告)
                logger.info(f"Trumpeting results to the King...")
                herald.announce_article(champ, patch, draft_path, promo_content, image_path=str(image_prompt) if image_prompt else None)
                
                # リサイクル成果の追加報告
                herald.notify_progress(f"マルチプラットフォーム資産を錬成しました: {recycled_path.name}")
                
                logger.info(f"📱 SNS Hooks Ready: {promo_path}")
                
            except Exception as e:
                logger.error(f"❌ Error during Forge/Promoter cycle: {e}")

        # [NEW] 9. MatchupSync: マッチアップノートへの自動同期
        logger.info("🔄 Syncing latest research intel to Matchup Memo...")
        try:
            sync = MatchupSync()
            # リサーチ結果（ターゲット情報）を結合してAIに渡す
            combined_intel = f"Current Patch: {patch}\n"
            combined_intel += "\n".join([f"- {t['champion']} ({t.get('role', 'Any')}): {t.get('win_rate', 'N/A')} via {t.get('source', 'Unknown')}" for t in scout_targets])
            sync.analyze_and_sync(combined_intel)
        except Exception as e:
            logger.error(f"❌ Matchup Sync failed during cycle: {e}")

        # [NEW] 10. SovereignSync: クラウドポータルへの自動同期
        logger.info("☁️ Syncing assets to Cloud Portal (Supabase)...")
        try:
            cloud_sync = SovereignSync()
            cloud_sync.run_sync()
        except Exception as e:
            logger.error(f"❌ Cloud Sync failed during cycle: {e}")
                
        logger.info("🏰 === Autonomous Kingdom Cycle Finished ===")



    def main_loop(self, interval_hours=3):
        """王国の永続的な監視と運用を司るメインループ"""
        logger.info(f"🌟 Sovereign Sentinel Service Started. (Interval: {interval_hours}h)")
        herald.notify_progress(f"王国の自律監視システム（Sovereign Watcher）が起動しました。間隔: {interval_hours}時間")
        
        while True:
            try:
                # 財務モニタリング (模擬データによる戦略更新)
                mock_stats = {
                    "Jarvan IV": {"pv": 1200, "likes": 45, "sales": 10},
                    "Nidalee": {"pv": 800, "likes": 30, "sales": 5}
                }
                strategist.analyze_feedback(mock_stats)
                
                self.run_full_cycle()
                
                # サイクル終了時に記録官による整理
                archivist.update_index()
                archivist.propose_bundle()
                
                logger.info(f"💤 Cycle finished. Sleeping for {interval_hours} hours...")
                time.sleep(interval_hours * 3600)
            except KeyboardInterrupt:
                logger.info("👋 Sovereign Sentinel Service stopped by King.")
                break
            except Exception as e:
                logger.error(f"🔥 Critical error in main loop: {e}")
                herald.notify_error(f"メインループで致命的なエラーが発生しました: {e}")
                time.sleep(600) # エラー時は10分待機して再開

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='Sovereign OS autonomous runner')
    parser.add_argument('--once', action='store_true', help='Run a single autonomous cycle and exit')
    args = parser.parse_args()
    coordinator = SovereignCoordinator()
    if args.once:
        # Run a single full cycle and exit
        coordinator.run_full_cycle()
    else:
        # Default: run monitoring loop every 3 hours
        coordinator.main_loop(interval_hours=3)
