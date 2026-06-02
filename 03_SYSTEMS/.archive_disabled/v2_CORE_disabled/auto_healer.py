import time
import re
import json
import logging
import traceback
from pathlib import Path
from datetime import datetime
from google import genai
from google.genai import types
import requests
from v2_CORE.settings import settings
from v2_CORE.ai_helper import generate_content_safe
from v2_CORE.apply_patch import apply_patch
import os

logger = logging.getLogger("AutoHealer")

class AutoHealer:
    """
    【Auto-Healer: システム自己治癒モジュール】
    Sovereign OSの統合ログを監視し、エラーや例外を検知した際に
    Gemini に該当ソースコードとエラー内容を渡して「修復パッチ」を自動生成する。
    """
    def __init__(self):
        self.log_file = settings.LOG_DIR / "sovereign_os.log"
        # 修正パッチの保存場所 (コマンドセンターが読み取る)
        self.patches_dir = settings.FORGE_DIR / "INFRA/patches"
        self.patches_dir.mkdir(parents=True, exist_ok=True)
        self.patches_index = self.patches_dir / "patches.json"
        
        self.api_key = settings.GEMINI_API_KEY_FREE or settings.GEMINI_API_KEY
        self.client = genai.Client(api_key=self.api_key) if self.api_key else None
        
        self.last_position = 0
        if self.log_file.exists():
            # 初回起動時は既存のログの末尾から読み始める
            self.last_position = self.log_file.stat().st_size

    def read_new_logs(self):
        if not self.log_file.exists():
            return ""
        
        try:
            with open(self.log_file, "r", encoding="utf-8", errors="replace") as f:
                f.seek(self.last_position)
                new_logs = f.read()
                self.last_position = f.tell()
                return new_logs
        except Exception as e:
            logger.error(f"Failed to read log file: {e}")
            return ""

    def analyze_error(self, error_trace: str):
        # トレースバックから該当のPythonファイル群を抽出
        files_mentioned = re.findall(r'File "([^"]+\.py)"', error_trace)
        
        # 自分のコードベース（03_SYSTEMS内）のファイルに絞る
        target_files = [f for f in files_mentioned if "03_SYSTEMS" in f.replace("\\", "/")]
        
        source_context = ""
        target_file = None
        if target_files:
            target_file = target_files[-1] # エラー発生源に最も近いファイルを対象とする
            try:
                content = Path(target_file).read_text(encoding="utf-8")
                # 行番号がある場合はその周辺だけを抽出する高度な処理も可能だが、
                # 1.5 Pro のコンテキスト長を活かして全コードを投げる
                source_context = f"\n\nSource code of {target_file}:\n```python\n{content}\n```"
            except Exception as e:
                logger.error(f"Failed to read source {target_file}: {e}")

        prompt = f"""
        あなたはAntigravity Sovereign OSのシステム自己修復AI「Auto-Healer」です。
        以下のログからシステムエラーを検知しました。このエラーを完全に修復する「Pythonコードの修正パッチ」を提案してください。
        
        【エラーログ】
        ```text
        {error_trace}
        ```
        {source_context}
        
        出力は JSON 形式で、以下のキーを厳密に含めてください。Markdownのコードブロック(```json ... ```)は付けずに、生のJSON文字列だけを出力すること。
        {{
            "description": "エラーの原因と修正内容の簡単な説明（日本語）",
            "target_file": "{target_file if target_file else 'パス不明'}",
            "search_content": "置換対象となる既存のコード（完全一致すること。前後の行も含めると安全）",
            "replace_content": "修正後のコード"
        }}
        """

        try:
            # 推論能力の高いモデルを使用
            response_text = generate_content_safe(
                self.client, 
                prompt, 
                "gemini-2.5-pro", 
                config=types.GenerateContentConfig(response_mime_type="application/json"),
                feature_name="default" # Healerはシステム基盤なので制限しない（または専用クォータ）
            )
            
            if not response_text or response_text.startswith("⚠️") or response_text.startswith("❌"):
                return None
                
            patch_data = json.loads(response_text)
            patch_data["created_at"] = datetime.now().isoformat()
            patch_data["id"] = f"patch_{int(time.time())}"
            patch_data["status"] = "pending"
            
            # エラーの最後の行をプレビュー用として保存
            lines = [line.strip() for line in error_trace.strip().split('\n') if line.strip()]
            patch_data["error_preview"] = lines[-1] if lines else "Unknown Error"
            
            return patch_data
            
        except Exception as e:
            logger.error(f"Failed to generate/parse AutoHealer patch: {e}")
            return None

    def run_cycle(self):
        """定期監視サイクル（数秒〜数分に1回実行）"""
        logs = self.read_new_logs()
        if not logs:
            return
            
        # 「Traceback」を含むエラーブロックを抽出
        error_blocks = []
        current_block = []
        in_traceback = False
        
        for line in logs.split('\n'):
            if "Traceback (most recent call last):" in line:
                in_traceback = True
                current_block = [line]
            elif in_traceback:
                # 次のログの始まり（日時）を検知したらトレースバック終了
                if re.match(r'^\d{4}-\d{2}-\d{2}', line) and "Traceback" not in line:
                    in_traceback = False
                    error_blocks.append("\n".join(current_block))
                    current_block = []
                else:
                    current_block.append(line)
                    
        if in_traceback and current_block:
            error_blocks.append("\n".join(current_block))
            
        for err in error_blocks:
            logger.info("🛠️ Auto-Healer: エラーを検知しました。自己修復パッチを生成中...")
            patch = self.analyze_error(err)
            if patch:
                # AUTO_HEAL: ユーザーの手動承認を待たず、即座に自己修復を実行する
                patch['status'] = 'approved'
                self.save_patch(patch)
                
                logger.info(f"⚡ 限界突破モード: パッチ {patch['id']} を即時自動適用します！")
                success = apply_patch(patch['id'])
                
                new_status = 'applied' if success else 'failed'
                self._update_supabase_status(patch['id'], new_status)
                
        # 過去の手動承認済みパッチの確認と適用
        self.poll_approved_patches()
        
    def poll_approved_patches(self):
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_KEY")
        if not supabase_url or not supabase_key:
            return
            
        url = f"{supabase_url}/rest/v1/system_patches?status=eq.approved"
        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json"
        }
        
        try:
            r = requests.get(url, headers=headers)
            if r.ok:
                patches = r.json()
                for p in patches:
                    logger.info(f"✨ 承認済みパッチを検知しました。適用を開始します: {p['id']}")
                    success = apply_patch(p['id'])
                    
                    # 適用結果をSupabaseに反映
                    new_status = 'applied' if success else 'failed'
                    update_url = f"{supabase_url}/rest/v1/system_patches?id=eq.{p['id']}"
                    requests.patch(update_url, headers=headers, json={"status": new_status})
                    
        except Exception as e:
            logger.error(f"Failed to poll approved patches: {e}")

    def save_patch(self, patch):
        """パッチ情報をインデックスJSONに追記して保存"""
        patches = []
        if self.patches_index.exists():
            try:
                patches = json.loads(self.patches_index.read_text(encoding="utf-8"))
            except Exception:
                pass
                
        # 同一ファイルへの重複したpendingパッチがあれば古いものを破棄する等のロジックを入れるとより安全
        patches.insert(0, patch)
        
        self.patches_index.write_text(json.dumps(patches, ensure_ascii=False, indent=4), encoding="utf-8")
        logger.info(f"✅ Auto-Healer: パッチが準備されました (ID: {patch['id']})")
        logger.info("💡 コマンドセンターのHealerPanelから適用（承認）できます。")
        
        # Supabaseにも登録する
        self._sync_to_supabase(patch)
        
    def _sync_to_supabase(self, patch):
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_KEY")
        if not supabase_url or not supabase_key:
            return
            
        url = f"{supabase_url}/rest/v1/system_patches?on_conflict=id"
        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"
        }
        
        try:
            r = requests.post(url, headers=headers, json=patch)
            if not r.ok:
                logger.error(f"Failed to sync patch to Supabase: {r.text}")
        except Exception as e:
            logger.error(f"Supabase sync error: {e}")

    def _update_supabase_status(self, patch_id: str, status: str):
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_KEY")
        if not supabase_url or not supabase_key:
            return
            
        url = f"{supabase_url}/rest/v1/system_patches?id=eq.{patch_id}"
        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json"
        }
        try:
            requests.patch(url, headers=headers, json={"status": status})
        except Exception as e:
            logger.error(f"Failed to update patch status: {e}")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    healer = AutoHealer()
    # テストとして1サイクル回す
    healer.run_cycle()
