import asyncio
import logging
import os
from pathlib import Path
import time
from v2_CORE.x_analyzer import XAnalyzer
from v2_CORE._LOL.bible_forge import BibleForge
from v2_CORE._LOL.video_forge import VideoForge

logging.basicConfig(level=logging.INFO, format="%(asctime)s [MASTER-PIPELINE] %(levelname)s: %(message)s")
logger = logging.getLogger("MasterPipeline")

async def run_master_pipeline(champion_name: str):
    logger.info("==============================================")
    logger.info(f"🚀 MASTER PIPELINE START: {champion_name}")
    logger.info("==============================================")
    
    start_time = time.time()
    
    # --- PHASE 1: Xリサーチ ---
    logger.info("\n--- PHASE 1: X(Twitter) Algorithm Research ---")
    analyzer = XAnalyzer()
    keyword = f"LoL {champion_name} 勝ち方 攻略"
    # 非同期でスクレイピングを実行
    posts = await analyzer.scrape_x_posts(keyword, limit=5)
    hook_report = analyzer.analyze_hooks(keyword, posts)
    
    # リサーチレポート保存
    report_dir = Path("d:/my_work/01_INTEL/PULSE/analytics")
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = report_dir / f"master_hook_{champion_name}.md"
    report_path.write_text(hook_report, encoding="utf-8")
    logger.info(f"✅ Research Report Saved: {report_path}")

    # --- PHASE 2 & 3: 執筆 & 自己進化 ---
    logger.info("\n--- PHASE 2 & 3: Drafting & Auto-Evolution ---")
    forge_engine = BibleForge()
    note_path = forge_engine.generate_bible(champion_name)
    if note_path:
        logger.info(f"✅ Evolved Note Draft Saved: {note_path}")
        note_content = Path(note_path).read_text(encoding="utf-8")
    else:
        logger.error("❌ Note generation failed.")
        return

    # --- PHASE 4: 動画生成 ---
    logger.info("\n--- PHASE 4: YouTube Shorts Video Forge ---")
    video_forge = VideoForge()
    
    # 台本生成
    shorts_script = video_forge.generate_script(note_content)
    
    base_name = f"{champion_name}_shorts"
    audio_path = video_forge.output_dir / f"{base_name}.mp3"
    video_path = video_forge.output_dir / f"{base_name}.mp4"
    
    # 音声生成
    await video_forge.generate_voice(shorts_script, audio_path)
    
    # 動画合成
    video_forge.assemble_video(audio_path, video_path)
    logger.info(f"✅ YouTube Shorts Video Saved: {video_path}")

    # --- PHASE 5: 運用メタデータ ---
    logger.info("\n--- PHASE 5: Final Delivery ---")
    meta_path = video_forge.output_dir / f"{champion_name}_meta.md"
    meta_content = f"""# YouTube Operation Metadata: {champion_name}
    
## Video Title
{champion_name}で勝てない人、これ見て。最強の勝ち方教えます。

## Pinned Comment
続きはプロフィールのリンク（note）で超詳しく解説してます！
今だけ期間限定で公開中👇
https://note.com/your_profile

## Search Keywords
LoL, {champion_name}, 攻略, マクロ, 勝ち方
"""
    meta_path.write_text(meta_content, encoding="utf-8")
    
    elapsed = time.time() - start_time
    logger.info("==============================================")
    logger.info(f"🏆 MASTER PIPELINE COMPLETED in {elapsed:.2f}s")
    logger.info("==============================================")

if __name__ == "__main__":
    champion = "Jarvan IV"
    asyncio.run(run_master_pipeline(champion))
