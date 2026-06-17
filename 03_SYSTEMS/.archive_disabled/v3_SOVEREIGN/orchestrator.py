import sys
import asyncio
import logging
import os
from pathlib import Path
from datetime import datetime

# 親の親ディレクトリ (03_SYSTEMS) をインポートパスに追加して、v2_CORE や v3_SOVEREIGN が確実に解決できるようにする
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    handlers=[
        logging.FileHandler(BASE_DIR / "v3_SOVEREIGN/sovereign.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("Orchestrator")

class SovereignOrchestrator:
    """
    Antigravity v3 (Sovereign OS): 司令塔 (The Brain)
    各専門エージェント（Swarm）を統括し、主権的意思決定を下す。
    """
    def __init__(self):
        self.active_tasks = []
        self.memory_context = {}
        # 拡張コンポーネントの初期化
        from .router import router
        from .dispatcher import SovereignDispatcher
        from .hijacker import CompetitorHijacker
        
        self.router = router
        self.dispatcher = SovereignDispatcher()
        self.hijacker = CompetitorHijacker(self)
        
        logger.info("🛡️ Antigravity Sovereign OS (v3) Orchestrator initialized.")

    async def dispatch_task(self, agent_name: str, task_description: str):
        """特定の専門エージェントにタスクを発行する"""
        logger.info(f"📤 Dispatching to [{agent_name}]: {task_description}")
        
        # 将来的に各エージェントクラスをここで動的にロード・実行する
        # 現時点ではv2_COREのエンジンをブリッジとして利用
        try:
            if agent_name == "Research":
                from v2_CORE.x_analyzer import XAnalyzer
                analyzer = XAnalyzer()
                # 実際のスクレイピングは重いため、非同期で実行
                result = await analyzer.scrape_x_posts(task_description)
                return result
            
            elif agent_name == "Forge":
                from v2_CORE._LOL.bible_forge import BibleForge
                forge = BibleForge()
                result = forge.generate_bible(task_description)
                return result
                
            else:
                logger.warning(f"⚠️ Unknown agent: {agent_name}")
                return None
        except Exception as e:
            logger.error(f"❌ Error in [{agent_name}] execution: {e}")
            return None

    async def autonomous_loop(self):
        """主権的な自律サイクル（世界モデルに基づく判断と実行）"""
        logger.info("🌀 Autonomous Loop started. Watching the world & bot commands...")
        while True:
            # 1. ボットからの司令（Mission Queue）をチェック
            from v2_CORE.gas_gateway import gas_gateway
            try:
                logger.info("📡 Polling for missions from GAS...")
                missions = gas_gateway.call({"type": "MISSION_GET_QUEUE"})
                if missions and missions.get("status") == "SUCCESS":
                    for mission in missions.get("missions", []):
                        champ = mission.get("champion")
                        m_type = mission.get("type", "STANDARD")
                        logger.info(f"🛰️ Received Command from Bot: {m_type} for {champ}")
                        # 非同期でミッションを開始（ループを止めない）
                        asyncio.create_task(self.run_master_mission(champ, mission_type=m_type))
            except Exception as e:
                logger.error(f"❌ Error polling missions: {e}")

            # 2. Observer(世界モデル)からの入力をチェック
            # TODO: 重要イベントがあればタスクを発行
            
            await asyncio.sleep(60) # 1分ごとにチェック

    async def run_master_mission(self, champion_name: str, mission_type: str = "STANDARD"):
        """王（ユーザー）からの重要ミッション、または自律的な強奪ミッションを完遂する"""
        logger.info(f"👑 Executing [{mission_type}] Mission: {champion_name}")
        
        # 1. リサーチ (思考ルーター経由) - 重すぎるため一旦停止
        # research_data = await self.dispatch_task("Research", f"LoL {champion_name} 勝ち方")
        
        # 2. 執筆 (思考ルーター経由)
        bible_path = await self.dispatch_task("Forge", champion_name)
        
        if bible_path:
            logger.info(f"✅ Bible forged: {bible_path}")
            
            # 3. 動画生成 (APIクォータ保護のため停止)
            # from v2_CORE._LOL.video_forge import VideoForge
            # video_engine = VideoForge()
            # note_content = Path(bible_path).read_text(encoding="utf-8")
            # shorts_script = video_engine.generate_script(note_content)
            # 
            # base_name = f"{champion_name}_shorts"
            # audio_path = video_engine.output_dir / f"{base_name}.mp3"
            # video_path = video_engine.output_dir / f"{base_name}.mp4"
            # 
            # await video_engine.generate_voice(shorts_script, audio_path)
            # video_engine.assemble_video(audio_path, video_path)
            # 
            # logger.info(f"✅ Video forged: {video_path}")
            video_path = None
            
            # 4. 配信準備 & 安全監査
            audit_passed = self.dispatcher.run_security_audit(Path(bible_path))
            if audit_passed:
                logger.info(f"🚀 Asset ready for deployment: {bible_path}")
                # noteへ下書き保存
                await self.dispatcher.deploy_to_note(Path(bible_path))
                # Discordへ通知 (記事プレビューを含む)
                await self.dispatcher.notify_completion(champion_name, Path(bible_path), Path(video_path) if video_path else None)
            
            logger.info(f"🏆 Mission AccomplISHED: {champion_name}")
        else:
            logger.error("❌ Mission failed.")

if __name__ == "__main__":
    import asyncio
    orchestrator = SovereignOrchestrator()
    # 自律ループをバックグラウンドで開始
    asyncio.run(orchestrator.autonomous_loop())
