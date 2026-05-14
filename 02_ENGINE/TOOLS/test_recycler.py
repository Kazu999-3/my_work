import sys
import os
from pathlib import Path

# プロジェクトルートをパスに追加
sys.path.append(str(Path("d:/my_work/02_ENGINE")))

from v2_CORE.recycler import recycler
from v2_CORE.settings import settings

def test_recycle():
    test_report = Path("d:/my_work/03_FACTORY/note_drafts/ole_reports/OLE_Report_DeYA1K-MXMI.md")
    
    if not test_report.exists():
        print(f"Error: Test report not found at {test_report}")
        return

    print(f"--- [Test] Recycler v1.0 Execution ---")
    recycled_text, output_file = recycler.recycle_tactics(test_report)
    
    if recycled_text:
        print(f"[SUCCESS] Content recycled and saved to: {output_file}")
        print("\n--- [Preview: TikTok Script] ---")
        # 最初のセクションを少し表示
        print(recycled_text[:500] + "...")
        
        # Discordフォーマットのテスト
        fields = recycler.format_for_discord(recycled_text, test_report.name)
        print(f"\n[Discord] Generated {len(fields)} embed fields.")
    else:
        print("[FAILED] Recycler returned no output.")

if __name__ == "__main__":
    test_recycle()
