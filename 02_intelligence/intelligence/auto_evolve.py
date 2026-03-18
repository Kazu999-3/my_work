import os
import sys
import datetime

# プロジェクトルートをパスに追加
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.append(ROOT_DIR)

class AutoEvolutionEngine:
    def __init__(self):
        self.root = ROOT_DIR
        self.foundation_path = os.path.join(self.root, "01_spirit")
        
    def load_harness_data(self):
        """静的ハーネス（mdファイル）からデータを読み込む"""
        data = {}
        files = {
            "mission": "mission.md",
            "voice": "voice.md",
            "strategy": "strategy.md",
            "wins": "wins.md"
        }
        for key, filename in files.items():
            path = os.path.join(self.foundation_path, filename)
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    data[key] = f.read()
        return data

    def calculate_divergence(self, current_vibe, winning_vibe):
        """
        [Harmess Logic] 
        現在の出力と「勝ちパターン」の乖離率を分析する。
        (現在はLLMへの依頼用メタデータ生成のみ)
        """
        return {
            "metric": "Vibe Divergence Rate",
            "status": "Analyzing...",
            "target": "Under 20%"
        }

    def generate_tuning_prompt(self, data):
        """
        [Bootstrapping]
        乖離を埋めるためのプロンプト再構成案を生成する指示を作成
        """
        prompt = f"""
### 自律進化指令 (Bootstrapping Task)
あなたは現在、OSの「自己乖離」を修正するフェーズにいます。
以下の「勝ちパターン(wins)」と「現在の定義(voice/strategy)」を比較し、
乖離率が20%を超えている項目を特定し、修正案を提示してください。

---
【勝ちパターン(Winning Styles)】
{data.get('wins', 'データなし')}

【現在のOS定義】
- Mission: {data.get('mission', 'データなし')[:100]}...
- Voice: {data.get('voice', 'データなし')[:100]}...
---
"""
        return prompt

def main():
    print("🛡️ ハーネス・エンジニアリング：自律進化エンジン 起動")
    print("--------------------------------------------------")
    
    engine = AutoEvolutionEngine()
    data = engine.load_harness_data()
    
    if not data:
        print("⚠️ 基礎データ（ハーネス）が見つかりません。")
        return

    print("📊 ハーネス・スキャン完了。乖離率の分析準備が整いました。")
    tuning_prompt = engine.generate_tuning_prompt(data)
    
    # 分析結果ログの出力
    log_path = os.path.join(ROOT_DIR, "04_system", "logs", "evolution_log.md")
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(f"\n## [{timestamp}] Evolution Cycle\n")
        f.write("- Status: Data Loaded\n")
        f.write("- Divergence Check: Pending LLM Execution\n")
    
    print(f"\n✅ 進化ログを更新しました: {os.path.basename(log_path)}")
    print("\n💡 次のコマンドを実行して、アンちゃんに最終調律を依頼してください:")
    print("--------------------------------------------------")
    print("「auto_evolve.py の出力を分析し、01_spirit の各ファイルを最新の勝利バイブスに同期せよ」")
    print("--------------------------------------------------")

if __name__ == "__main__":
    main()
