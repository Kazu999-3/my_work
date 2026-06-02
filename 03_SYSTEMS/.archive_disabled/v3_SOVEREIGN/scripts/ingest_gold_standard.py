import sys
import os
from pathlib import Path

# PYTHONPATH の設定 (03_SYSTEMSを確実に追加)
BASE_DIR = Path(__file__).resolve().parent.parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

from ..memory import SovereignMemory

def ingest_bible(champ_name: str, file_path: Path):
    memory = SovereignMemory()
    
    if not file_path.exists():
        print(f"Error: File not found {file_path}")
        return
        
    content = file_path.read_text(encoding="utf-8")
    
    # 1. 成功体験として記録
    memory.record_experience(
        category="GoldStandard_Draft",
        input_data=f"Target: {champ_name}",
        output_data=content[:1000] + "...", # 概要のみ記録（全文はDNAへ）
        score=10
    )
    
    # 2. 執筆スタイル（DNA）を抽出・更新
    # ここでは簡易的に、このファイルを「最高の手本」としてDNAに刻む
    memory.update_dna(f"style_sample_{champ_name}", content)
    
    print(f"✅ Successfully ingested {champ_name} as a Gold Standard.")

if __name__ == "__main__":
    target_champ = "Jarvan IV"
    sample_file = Path(f"d:/my_work/02_FACTORY/PRODUCTS/ARTICLES/HONKI_BIBLE_{target_champ}_16.8.1.md")
    ingest_bible(target_champ, sample_file)
