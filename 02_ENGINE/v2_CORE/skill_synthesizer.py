import os
import time
import json
import logging
import threading
import importlib.util
from pathlib import Path
from google import genai
from google.genai import types
import requests

from v2_CORE.settings import settings
from v2_CORE.ai_helper import generate_content_safe

logger = logging.getLogger("SkillSynthesizer")

class SkillSynthesizer:
    """
    【Skill Synthesizer: 自己スキル獲得モジュール】
    ユーザーからの要望（プロンプト）を受け取り、Geminiを用いて
    Pythonコードを自動生成し、動的にシステムへ組み込む。
    """
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.client = genai.Client(api_key=self.api_key) if self.api_key else None
        
        self.dynamic_dir = settings.ENGINE_DIR / "v2_CORE" / "dynamic_skills"
        self.dynamic_dir.mkdir(parents=True, exist_ok=True)
        
        # __init__.py が無ければ作成
        init_file = self.dynamic_dir / "__init__.py"
        if not init_file.exists():
            init_file.write_text("", encoding="utf-8")

    def synthesize_skill(self, request_text: str):
        prompt = f"""
        あなたはAntigravity Sovereign OSの自己進化コア「Skill Synthesizer」です。
        ユーザーから以下の「新機能（スキル）」の開発依頼を受けました。

        依頼内容: 「{request_text}」

        この依頼を満たすためのPythonスクリプトを生成してください。
        スクリプトは `dynamic_skills/` フォルダ内に配置され、メインオーケストレーターから `run_skill()` という関数が別スレッドで呼び出されます。

        【要件】
        1. 必ず `def run_skill():` というエントリーポイント関数を定義すること。
        2. この関数の中で `while True:` ループを用いて定期実行する（例: `time.sleep(3600)`）か、一度だけ実行するかは依頼内容から判断すること。
        3. 必要なモジュール（requests, time, logging等）はインポートすること。
        4. ロガーは `logger = logging.getLogger("DynamicSkill")` のように定義すること。
        5. `v2_CORE.settings` や `v2_CORE.ai_helper` などの既存モジュールを利用して良い。

        【出力形式（JSONのみ）】
        Markdownのコードブロック(```json ... ```)は付けずに、生のJSON文字列だけを出力すること。
        {{
            "filename": "〇〇_skill.py", 
            "description": "スキルの概要",
            "code": "Pythonのソースコード"
        }}
        """

        try:
            response_text = generate_content_safe(
                self.client, 
                prompt, 
                "gemini-2.5-pro", 
                config=types.GenerateContentConfig(response_mime_type="application/json"),
                feature_name="default"
            )
            
            if not response_text or response_text.startswith("⚠️") or response_text.startswith("❌"):
                return False
                
            skill_data = json.loads(response_text)
            
            filename = skill_data["filename"]
            # セキュリティ: ファイル名が不正でないか簡易チェック
            if not filename.endswith(".py") or "/" in filename or "\\" in filename:
                filename = f"dynamic_skill_{int(time.time())}.py"
                
            file_path = self.dynamic_dir / filename
            file_path.write_text(skill_data["code"], encoding="utf-8")
            
            logger.info(f"✨ 新しいスキル '{filename}' を合成しました: {skill_data.get('description')}")
            
            # 動的ロードを試行
            self._load_and_run(file_path)
            
            return True
        except Exception as e:
            logger.error(f"Skill synthesis failed: {e}")
            return False

    def _load_and_run(self, file_path: Path):
        """生成したPythonファイルを動的に読み込み、別スレッドで実行する"""
        try:
            module_name = f"dynamic_skills.{file_path.stem}"
            spec = importlib.util.spec_from_file_location(module_name, str(file_path))
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            
            if hasattr(module, 'run_skill'):
                t = threading.Thread(target=module.run_skill, name=f"Thread-{module_name}", daemon=True)
                t.start()
                logger.info(f"🚀 動的スキル '{module_name}' を起動しました。")
            else:
                logger.error(f"スキル '{module_name}' に run_skill() 関数がありません。")
        except Exception as e:
            logger.error(f"動的スキルのロードに失敗しました '{file_path.name}': {e}")

    def run_cycle(self):
        """Supabaseをポーリングして新しいリクエストを探す"""
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_KEY")
        if not supabase_url or not supabase_key:
            return
            
        url = f"{supabase_url}/rest/v1/matchup_sentinel?matchup_id=like.SKILL_SYNTH_*"
        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json"
        }
        
        try:
            r = requests.get(url, headers=headers)
            if r.ok:
                requests_data = r.json()
                for req in requests_data:
                    raw_data = req.get("raw_data", {})
                    if raw_data.get("status") == "pending":
                        logger.info(f"🛠️ Skill Synthesizer: 新しいスキル要求を受信: '{req['strategy']}'")
                        
                        success = self.synthesize_skill(req['strategy'])
                        
                        # ステータス更新
                        raw_data["status"] = "completed" if success else "failed"
                        update_url = f"{supabase_url}/rest/v1/matchup_sentinel?matchup_id=eq.{req['matchup_id']}"
                        requests.patch(update_url, headers=headers, json={"raw_data": raw_data})
                        
        except Exception as e:
            logger.error(f"Failed to poll synthesizer requests: {e}")

    def load_existing_skills(self):
        """起動時に既存の動的スキルを全て読み込んで起動する"""
        if not self.dynamic_dir.exists():
            return
            
        for file_path in self.dynamic_dir.glob("*.py"):
            if file_path.name == "__init__.py":
                continue
            self._load_and_run(file_path)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    synth = SkillSynthesizer()
    synth.run_cycle()
