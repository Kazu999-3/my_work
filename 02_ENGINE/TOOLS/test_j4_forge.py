from v2_CORE.forge import forge
from v2_CORE.promoter import promoter
from v2_CORE.database import db
import logging

logging.basicConfig(level=logging.INFO)

# 1. 模擬的なコンテキストの投入（本来はPulseが自動で行う部分）
# J4に関するパッチ26.07の情報をDBに覚えさせる
db.add_intelligence(
    id="patch_26.07_summary", 
    content="パッチ26.07ではサポートのゴールド獲得制限が撤廃。レルやカシオペアが強化。ジャングラーではグレイブスがナーフされたため、Jarvan IVの序盤のガンクプレッシャーが相対的に極めて強力なメタとなっている。",
    metadata={"type": "patch_notes", "patch": "26.07"}
)

db.add_intelligence(
    id="Jarvan IV_patch_26.07_meta",
    content="Jarvan IV (Patch 26.07): 勝率52.5%。主流ビルドはプロトプラズム・ハーネスをコアにしたユーティリティ型。低レベルでのE-Qフラッシュの成否が試合を決定づける。",
    metadata={"champion": "Jarvan IV", "patch": "26.07"}
)

# 2. 記事生成（完全自動）
draft_path = forge.generate_high_quality_article("Jarvan IV", "26.07", "Jungle")

# 3. SNS案生成（完全自動）
promo_path = promoter.generate_ai_hooks(draft_path)

print("\n" + "="*50)
print(f"✅ 自動錬成が完了しました。")
print(f"📄 記事パス: {draft_path}")
print(f"🪩 SNS案パス: {promo_path}")
print("="*50 + "\n")
