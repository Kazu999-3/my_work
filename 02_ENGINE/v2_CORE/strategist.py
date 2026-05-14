import logging
import os
from pathlib import Path
from google import genai
from google.genai import types
import dotenv
import json

dotenv.load_dotenv(Path("D:/my_work/.env"))
logging.basicConfig(level=logging.INFO, format="%(asctime)s [Strategist] %(levelname)s: %(message)s")

class AIStrategist:
    """
    Antigravity Sovereign OS: マルチAI自己開発エンジン (The Strategist)
    「プロンプトを作るAI」と「それを評価・修正するAI」の2つの人格を使い、
    最高品質のシステム（プロンプトやロジック）を自律的に開発・進化させる。
    """
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
            self.model_id = "gemini-flash-latest"
        else:
            self.client = None

    def _ask_ai(self, persona: str, prompt: str) -> str:
        """指定された人格としてAIに回答させる"""
        full_prompt = f"【あなたは {persona} です】\n\n{prompt}"
        try:
            response = self.client.models.generate_content(
                model=self.model_id,
                contents=full_prompt,
                config=types.GenerateContentConfig(temperature=0.7)
            )
            return response.text
        except Exception as e:
            logging.error(f"AI回答取得中にエラー ({persona}): {e}")
            return ""

    def evolve_prompt(self, task_description: str, cycles: int = 2) -> str:
        """プロンプトを自律的に開発・進化させる"""
        logging.info(f"🚀 タスク「{task_description}」のための最強プロンプトを自律開発中...")
        
        # 1. 初期プロンプト案の作成 (エンジニア)
        current_prompt = self._ask_ai(
            "シニア・プロンプトエンジニア",
            f"以下のタスクを達成するための、最高に効果的なAI向けシステムプロンプトを作成してください。\nタスク: {task_description}"
        )

        for i in range(cycles):
            logging.info(f"🔄 進化サイクル {i+1}/{cycles} を実行中...")
            
            # 2. 評価・ダメ出し (評価者)
            feedback = self._ask_ai(
                "冷酷な品質管理・監査官",
                f"以下のプロンプト案を厳しく評価し、弱点や改善点を指摘してください。売上の最大化、AI臭の排除という観点でダメ出ししてください。\n\n【プロンプト案】:\n{current_prompt}"
            )
            
            logging.info(f"📝 評価者からのフィードバック: {feedback[:100]}...")

            # 3. 修正 (エンジニア)
            current_prompt = self._ask_ai(
                "シニア・プロンプトエンジニア",
                f"評価者から以下のフィードバックを受けました。これを完璧に反映し、元のプロンプトを極限まで強化してください。\n\n【フィードバック】:\n{feedback}\n\n【元のプロンプト】:\n{current_prompt}"
            )

        logging.info("✅ 最強プロンプトの自律開発が完了しました。")
        return current_prompt

    def run_self_dev_session(self, task: str):
        """自己開発セッションを実行し、結果を保存する"""
        final_prompt = self.evolve_prompt(task)
        
        output_dir = Path("d:/my_work/01_INTEL/prompts")
        output_dir.mkdir(parents=True, exist_ok=True)
        file_path = output_dir / f"evolved_prompt_{task.replace(' ', '_')[:20]}.md"
        
        file_path.write_text(final_prompt, encoding="utf-8")
        logging.info(f"📁 開発されたプロンプトを保存しました: {file_path}")
        return final_prompt

    def prioritize_targets(self, scout_targets):
        """収益性重みに基づいてターゲットを優先順位付けする"""
        weight_path = Path("D:/my_work/01_INTEL/PULSE/strategic_weights.json")
        weights = {}
        if weight_path.exists():
            try:
                data = json.loads(weight_path.read_text(encoding="utf-8"))
                weights = data.get("revenue_weights", {})
            except Exception as e:
                logging.error(f"重みファイルの読み込み失敗: {e}")

        # 重みに基づいてソート（未登録は1.0とする）
        sorted_targets = sorted(
            scout_targets,
            key=lambda t: weights.get(t.get('champion'), 1.0),
            reverse=True
        )
        
        logging.info(f"[Strategist] 収益性予測に基づくターゲット優先順位を調整中... (対象: {len(sorted_targets)}件)")
        return sorted_targets

    def analyze_feedback(self, stats):
        """実績フィードバックに基づき、戦略重みを動的に更新する"""
        logging.info("[Strategist] 実績フィードバックに基づく自己進化を開始...")
        weight_path = Path("D:/my_work/01_INTEL/PULSE/strategic_weights.json")
        
        if not weight_path.exists():
            return

        try:
            data = json.loads(weight_path.read_text(encoding="utf-8"))
            weights = data.get("revenue_weights", {})

            for champ, s in stats.items():
                pv = s.get("pv", 0)
                likes = s.get("likes", 0)
                sales = s.get("sales", 0)
                
                # スコア計算ロジック (簡易的な収益性指標)
                score = (pv * 0.01) + (likes * 0.5) + (sales * 2.0)
                # 前回の重みをベースに微調整 (学習率 0.01)
                old_weight = weights.get(champ, 1.0)
                new_weight = old_weight * 0.95 + (score / 100.0) * 0.05
                weights[champ] = round(max(0.5, min(2.0, new_weight)), 2)
                
                logging.info(f"  - {champ}: New Weight = {weights[champ]} (Score: {score})")

            data["revenue_weights"] = weights
            weight_path.write_text(json.dumps(data, indent=4, ensure_ascii=False), encoding="utf-8")
            logging.info("🔮 [Strategist] 戦略重みの更新が完了しました。")

        except Exception as e:
            logging.error(f"戦略更新中にエラー: {e}")

# グローバルなインスタンス提供
strategist = AIStrategist()

if __name__ == "__main__":
    # テスト：noteの成約率を最大化するタイトルのためのプロンプトを開発
    target_task = "読者が思わずクリックし、クレジットカードを取り出すほど魅力的な『noteのタイトル』を生成するプロンプト"
    strategist.run_self_dev_session(target_task)
