import os
import json
import random
import logging
from google import genai
from google.genai import types
from v2_CORE.settings import settings
from v2_CORE.ai_helper import generate_content_safe

logger = logging.getLogger("GeneticOptimizer")

class GeneticPromptOptimizer:
    """
    Antigravity Sovereign OS v6.5: 遺伝的プロンプト最適化 (Genetic Prompt Optimizer)
    A/Bテストの成果値 (fitness) を基に、交叉 (Crossover) と突然変異 (Mutation) を
    Gemini API に行わせ、プロンプトやタイトルを進化させる GA エンジン。
    """
    def __init__(self):
        self.api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY_FREE")
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
            self.model_id = settings.DEFAULT_MODEL
        else:
            self.client = None
        
        self.supabase_url = os.environ.get("SUPABASE_URL")
        self.supabase_key = os.environ.get("SUPABASE_KEY")

    def _get_supabase_headers(self):
        return {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }

    def fetch_variations(self, task_type: str) -> list:
        """Supabaseから対象タスクのアクティブ・保留中のバリエーション（個体群）を取得する"""
        if not self.supabase_url or not self.supabase_key:
            logger.warning("[GA] Supabase URL or Key is missing. Returning empty list.")
            return []
            
        import requests
        url = f"{self.supabase_url}/rest/v1/ab_test_variations"
        params = {
            "task_type": f"eq.{task_type}",
            "status": "in.(active,pending)",
            "order": "fitness.desc"
        }
        
        try:
            r = requests.get(url, headers=self._get_supabase_headers(), params=params, timeout=10)
            if r.status_code == 200:
                return r.json()
            else:
                logger.error(f"[GA] Failed to fetch variations: {r.status_code} - {r.text}")
        except Exception as e:
            logger.error(f"[GA] Supabase request error: {e}")
        return []

    def save_variation(self, task_type: str, dna: str, generation: int, status="pending") -> bool:
        """新しいバリエーション（子供のDNA）をSupabaseに保存する"""
        if not self.supabase_url or not self.supabase_key:
            return False
            
        import requests
        url = f"{self.supabase_url}/rest/v1/ab_test_variations"
        payload = {
            "task_type": task_type,
            "dna": dna,
            "generation": generation,
            "fitness": 1.0, # 初期適合度は1.0
            "status": status
        }
        
        try:
            r = requests.post(url, headers=self._get_supabase_headers(), json=payload, timeout=10)
            if r.status_code in (200, 201):
                logger.info(f"[GA] Successfully saved new DNA (Gen {generation}): {dna[:50]}...")
                return True
            else:
                logger.error(f"[GA] Failed to save DNA: {r.status_code} - {r.text}")
        except Exception as e:
            logger.error(f"[GA] Save variation error: {e}")
        return False

    def update_fitness(self, variation_id: str, new_fitness: float) -> bool:
        """指定したバリエーションの適合度 (fitness) を更新する"""
        if not self.supabase_url or not self.supabase_key:
            return False
            
        import requests
        url = f"{self.supabase_url}/rest/v1/ab_test_variations"
        params = {"id": f"eq.{variation_id}"}
        payload = {"fitness": new_fitness}
        
        try:
            r = requests.patch(url, headers=self._get_supabase_headers(), params=params, json=payload, timeout=10)
            if r.status_code in (200, 204):
                logger.info(f"[GA] Updated fitness for {variation_id}: {new_fitness}")
                return True
        except Exception as e:
            logger.error(f"[GA] Update fitness error: {e}")
        return False

    def select_active_dna(self, task_type: str) -> str:
        """現在のアクティブ個体群から、適合度に応じた確率で1つを選択する"""
        variations = self.fetch_variations(task_type)
        if not variations:
            # DBにデータがない場合のフォールバック（初期値）
            if task_type == "note_title":
                return "動画を観ずに1秒で記事化！YouTube自動化AI 【完全版ソースコード付き】"
            elif task_type == "x_hook":
                return "30分の解説動画を「一時停止を繰り返しながらメモを取る」のは、もう時間の無駄です。"
            return ""
            
        # active なもののみ抽出
        active_variations = [v for v in variations if v.get("status") == "active"]
        if not active_variations:
            active_variations = variations[:2] # なければ上位を取得
            
        # 重み付けルーレット選択
        total_fitness = sum(max(v.get("fitness", 0.1), 0.1) for v in active_variations)
        r = random.uniform(0, total_fitness)
        current = 0.0
        for v in active_variations:
            current += max(v.get("fitness", 0.1), 0.1)
            if current >= r:
                logger.info(f"[GA] Selected active DNA ({task_type}): {v['dna'][:50]}... (Fitness: {v['fitness']})")
                return v["dna"]
                
        return active_variations[0]["dna"]

    def crossover(self, parent1: str, parent2: str, task_type: str) -> str:
        """2つの親DNAをGeminiによってセマンティックに交叉させる"""
        if not self.client:
            return parent1
            
        prompt = f"""
        あなたは遺伝的アルゴリズムの「交叉（Crossover）」オペレータです。
        成果データの高い優れた2つの「親プロンプト/タイトル（DNA）」から、それぞれの成功要因であるフック、言葉遣い、構造、感情アピールを高度に融合させ、
        より強力で魅力的な新しい第3の「子供プロンプト/タイトル（DNA）」を1つ生成してください。
        
        【タスクタイプ】: {task_type}
        【親DNA 1】: {parent1}
        【親DNA 2】: {parent2}
        
        【指示】:
        挨拶や解説は一切含めず、融合して生成された「新しい1つのプロンプト/タイトル表現」のみを直接出力してください。
        """
        
        try:
            config = types.GenerateContentConfig(temperature=0.7)
            child = generate_content_safe(
                self.client,
                prompt,
                model_id=self.model_id,
                config=config,
                feature_name="ga_crossover"
            )
            return child.strip()
        except Exception as e:
            logger.error(f"[GA] Crossover failed: {e}")
            return parent1

    def mutate(self, dna: str, task_type: str) -> str:
        """DNAをGeminiによってセマンティックに突然変異させる"""
        if not self.client:
            return dna
            
        prompt = f"""
        あなたは遺伝的アルゴリズムの「突然変異（Mutation）」オペレータです。
        既存のプロンプト/タイトル（DNA）に対して、全く異なる新しい角度、独創的な切り口、または感情的フックを注入し、
        元のDNAの基本機能は保ちつつ、表現スタイルを劇的に「突然変異」させた新しい表現を1つ生成してください。
        
        【タスクタイプ】: {task_type}
        【元のDNA】: {dna}
        
        【指示】:
        解説などは一切含めず、突然変異させた「新しい1つのプロンプト/タイトル表現」のみを直接出力してください。
        """
        
        try:
            config = types.GenerateContentConfig(temperature=0.9) # クリエイティビティ高め
            mutated = generate_content_safe(
                self.client,
                prompt,
                model_id=self.model_id,
                config=config,
                feature_name="ga_mutation"
            )
            return mutated.strip()
        except Exception as e:
            logger.error(f"[GA] Mutation failed: {e}")
            return dna

    def evolve_generation(self, task_type: str, mutation_rate=0.2):
        """対象タスクの個体群を世代交代（Evolve）させるメインGAループ"""
        logger.info(f"🧬 [GA Engine] {task_type} の世代交代プロセスを開始します...")
        
        variations = self.fetch_variations(task_type)
        if len(variations) < 2:
            logger.warning("[GA Engine] 世代交代に必要な親の数が足りません（2つ以上必要です）。")
            return
            
        # 適合度上位2つを親とする（エリート選択）
        parent1_data = variations[0]
        parent2_data = variations[1]
        
        parent1 = parent1_data["dna"]
        parent2 = parent2_data["dna"]
        current_gen = max(parent1_data["generation"], parent2_data["generation"])
        next_gen = current_gen + 1
        
        logger.info(f"[GA Engine] 親を選択完了: \nParent1 (Gen {parent1_data['generation']}, Fitness {parent1_data['fitness']}): {parent1[:40]}...\nParent2 (Gen {parent2_data['generation']}, Fitness {parent2_data['fitness']}): {parent2[:40]}...")
        
        # 1. 交叉による子供の生成
        child_dna = self.crossover(parent1, parent2, task_type)
        logger.info(f"[GA Engine] 交叉完了 (Crossover): {child_dna[:50]}...")
        
        # 2. 一定確率で突然変異
        if random.random() < mutation_rate:
            logger.info("[GA Engine] 🎲 突然変異（Mutation）が発生しました！")
            child_dna = self.mutate(child_dna, task_type)
            logger.info(f"[GA Engine] 突然変異完了: {child_dna[:50]}...")
            
        # 3. 淘汰処理と新個体保存
        self.save_variation(task_type, child_dna, next_gen, status="active")
        
        active_variations = [v for v in variations if v.get("status") == "active"]
        if len(active_variations) >= 4:
            worst = active_variations[-1]
            logger.info(f"[GA Engine] 個体群の淘汰: 適合度最下位の個体をデッドに設定します: {worst['id']}")
            self._set_variation_status(worst["id"], "dead")

    def _set_variation_status(self, variation_id: str, status: str) -> bool:
        if not self.supabase_url or not self.supabase_key:
            return False
        import requests
        url = f"{self.supabase_url}/rest/v1/ab_test_variations"
        params = {"id": f"eq.{variation_id}"}
        payload = {"status": status}
        try:
            r = requests.patch(url, headers=self._get_supabase_headers(), params=params, json=payload, timeout=10)
            return r.status_code in (200, 204)
        except Exception as e:
            logger.error(f"[GA] Set status error: {e}")
        return False

# シングルトンインスタンス提供
genetic_optimizer = GeneticPromptOptimizer()
