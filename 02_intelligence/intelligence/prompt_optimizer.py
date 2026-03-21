import os
import sys
from pathlib import Path
from datetime import datetime

# モジュールパス追加
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(ROOT_DIR / "02_intelligence"))
from intelligence.trend_watcher import generate_with_fallback

def optimize_tone_guide():
    """CSO/CreativeAn: 過去の成果物を分析し、トーンガイドをより鋭く最適化する"""
    posts_dir = ROOT_DIR / "03_factory" / "daily_posts"
    style_dir = ROOT_DIR / "01_spirit" / "style"
    tone_file = style_dir / "tone.md"
    
    if not posts_dir.exists(): return "No posts to analyze."
    
    # 高評価(s90+)と低評価(s50-)を収集
    high_samples = []
    low_samples = []
    
    for f in list(posts_dir.glob("draft_*_s*.md"))[:20]:
        content = f.read_text(encoding="utf-8")[:500]
        if "_s9" in f.name: high_samples.append(content)
        elif "_s[0-5]" in f.name: low_samples.append(content)

    if not high_samples: return "Not enough high-quality samples to optimize."

    current_tone = tone_file.read_text(encoding="utf-8") if tone_file.exists() else "なし"

    prompt = f"""
【役割】アンちゃんズ CSO
以下の「成功事例（評価が高い記事）」と「失敗事例」を比較分析し、
アンちゃんらしい、より鋭く読者を惹きつける執筆スタイルを言語化してください。

【現在のトーンガイド】
{current_tone}

【成功事例 (Score 90+)】
{chr(10).join(high_samples)}

【失敗事例 (Score < 60)】
{chr(10).join(low_samples)}

この分析に基づき、現在の『tone.md』を上書き更新するための、
より具体的で「重力から解放された」新しいトーンガイド（Markdown形式）を作成してください。
"""
    # 最適化は Lite で高速に行うか、Pro で深く行うか。今回は Pro
    new_tone = generate_with_fallback(prompt, preferred_model=os.getenv("MODEL_PRO"))
    
    if new_tone and len(new_tone) > 100:
        style_dir.mkdir(parents=True, exist_ok=True)
        tone_file.write_text(new_tone, encoding="utf-8")
        return "Tone guide optimized successfully."
    return "No improvement found."

if __name__ == "__main__":
    print(optimize_tone_guide())
