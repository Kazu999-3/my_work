import os
import py_compile
import logging
from pathlib import Path
from v2_CORE.settings import settings
from google import genai

logger = logging.getLogger("Sentinel")

class SovereignSentinel:
    """
    Antigravity Sovereign OS v2.0: 監視哨 (The Sentinel)
    聖域の健全性を自己監査し、不整合やバグの予兆を検知する。
    """
    def __init__(self):
        self.target_dirs = [
            settings.THRONE_DIR,
            settings.NEXUS_DIR,
            settings.WORKSHOP_DIR,
            settings.FORGE_DIR,
            settings.CITADEL_DIR,
            settings.LOG_DIR
        ]
        self.api_key = settings.GEMINI_API_KEY_FREE or settings.GEMINI_API_KEY
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
            self.model_name = settings.DEFAULT_MODEL # 最新のフラッシュモデルを使用

    def audit_codebase(self):
        """全ての Python ファイルの構文チェックを行い、デグレードを防止する"""
        logger.info("🛡️ [Sentinel] コードベースの整合性監査を開始します。")
        errors = []
        for py_file in settings.WORKSHOP_DIR.rglob("*.py"):
            # 仮想環境やキャッシュ、パッケージ等の不要なディレクトリを除外
            if any(p in py_file.parts for p in (".venv", "venv", "__pycache__", "site-packages", ".git")):
                continue
            try:
                py_compile.compile(str(py_file), doraise=True)
            except py_compile.PyCompileError as e:
                errors.append(f"Syntax Error in {py_file.name}: {str(e)}")
        
        if not errors:
            logger.info("🛡️ [Sentinel] コードベースの整合性は良好です。")
        else:
            for err in errors:
                logger.error(f"⚠️ [Sentinel] 不整合を検知: {err}")
        return errors

    def audit_structure(self):
        """主要ディレクトリの存在確認と自動復旧"""
        missing = []
        for d in self.target_dirs:
            if not d.exists():
                logger.warning(f"⚠️ [Sentinel] ディレクトリ欠落を検知: {d.name}")
                d.mkdir(parents=True, exist_ok=True) # 自律的な復旧
                logger.info(f"✅ [Sentinel] ディレクトリを再構築しました: {d.name}")
                missing.append(d.name)
        return missing

    def audit_logs(self):
        """直近のログからエラーを検知し、AIによる修正案を生成する"""
        logger.info("🛡️ [Sentinel] ログの深層監査を開始します...")
        log_file = settings.LOG_DIR / "sovereign_os.log"
        if not log_file.exists():
            return "No logs found."

        try:
            from collections import deque
            with open(log_file, "r", encoding="utf-8") as f:
                recent_lines = deque(f, maxlen=100)
                # 直近100行のエラーを抽出
                recent_errors = [l for l in recent_lines if "ERROR" in l]
            
            if not recent_errors:
                logger.info("🛡️ [Sentinel] 直近のログに異常は見られません。")
                return None

            logger.warning(f"⚠️ [Sentinel] {len(recent_errors)} 件の異常を検知。AI分析を開始...")
            
            prompt = f"""
            あなたは「Antigravity OS王国」の守護騎士、Sovereign Sentinel です。
            以下のエラーログから、障害の根本原因を特定し、緊急修正案（パッチ）を作成してください。
            
            【ログデータ】:
            {''.join(recent_errors)}
            
            【出力形式】:
            # 🛡️ 緊急修正パッチ案 (PATCH PROPOSAL)
            - **障害状況**: 簡潔に。
            - **根本原因**: AIの推論。
            - **修正案**: 具体的なコード変更点、または実行すべきコマンド。
            
            王（ユーザー）が承認しやすいよう、論理的かつ誠実な言葉で伝えてください。
            """
            
            if self.api_key:
                from v2_CORE.ai_helper import generate_content_safe
                proposal = generate_content_safe(
                    self.client,
                    prompt,
                    model_id=settings.DEFAULT_MODEL,
                    feature_name="oracle"
                )
                proposal_path = settings.THRONE_DIR / "PATCH_PROPOSAL.md"
                with open(proposal_path, "w", encoding="utf-8") as f:
                    f.write(proposal)
                logger.info(f"✅ [Sentinel] 緊急修正案を錬成しました: {proposal_path}")
                return proposal
            
        except Exception as e:
            logger.error(f"[Sentinel] ログ監査中にエラー: {e}")
        return None

    def run_daily_audit(self):
        """日次監査の執行"""
        results = {
            "code_errors": self.audit_codebase(),
            "structure_recovered": self.audit_structure()
        }
        return results

# グローバルな監視哨インスタンス
sentinel = SovereignSentinel()

def get_sentinel() -> SovereignSentinel:
    return sentinel

if __name__ == "__main__":
    # 直接実行時のテスト
    res = sentinel.run_daily_audit()
    print(f"--- 🛡️ Sentinel Audit Report ---")
    print(f"Code Errors: {len(res['code_errors'])}")
    print(f"Recovered Dirs: {res['structure_recovered']}")
