import os
import re
import shutil
import logging
import subprocess
import json
import time
from pathlib import Path
from google import genai
from .settings import settings

logger = logging.getLogger("AutoHealer")

class AutoHealer:
    def __init__(self):
        self.attempts_file = settings.FORGE_DIR / "healer_attempts.json"
        
        # APIキーのロード (Free または Main)
        self.api_key = settings.GEMINI_API_KEY_FREE or settings.GEMINI_API_KEY
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None
            logger.error("❌ Gemini APIキーが設定されていません。")

    def _get_attempts(self) -> dict:
        if not self.attempts_file.exists():
            return {}
        try:
            with open(self.attempts_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    def _save_attempts(self, attempts: dict):
        try:
            self.attempts_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.attempts_file, "w", encoding="utf-8") as f:
                json.dump(attempts, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"❌ 試行履歴の保存失敗: {e}")

    def _check_limit(self, file_path: Path) -> bool:
        """同一ファイルに対する修復制限(1日3回)を超えていないかチェック"""
        attempts = self._get_attempts()
        path_str = str(file_path.resolve())
        
        today = time.strftime("%Y-%m-%d")
        record = attempts.get(path_str, {"date": today, "count": 0})
        
        if record["date"] != today:
            record = {"date": today, "count": 0}
            
        if record["count"] >= 3:
            logger.warning(f"⚠️ ファイル '{file_path.name}' に対する本日の自己修復試行回数が上限(3回)に達しています。")
            return False
            
        record["count"] += 1
        attempts[path_str] = record
        self._save_attempts(attempts)
        return True

    def find_error_file(self, error_text: str) -> tuple[Path | None, int]:
        """スタックトレースからd:/my_work配下のエラー発生ファイルパスと行番号を特定"""
        # Python用パターン (例: File "d:\my_work\03_SYSTEMS\v2_CORE\ai_helper.py", line 42)
        py_pattern = r'File "([^"]+)", line (\d+)'
        # Next.js/JS用パターン (例: d:/my_work/04_PORTAL/src/app/api/admin/affiliate/route.ts:45:12)
        js_pattern = r'([a-zA-Z]:[\\/][a-zA-Z0-9_\-\.\/\\\\]+\.(?:py|ts|tsx|js|json)):(\d+)'

        # まずJS/TSパターンから探す
        matches = re.findall(js_pattern, error_text)
        if not matches:
            matches = re.findall(py_pattern, error_text)

        if not matches:
            return None, 0

        # 最新（スタックトレースの最下部、例外が起きた直接の箇所）から順に走査
        for path_str, line_str in reversed(matches):
            normalized_path = Path(path_str.replace('\\', '/'))
            # プロジェクト配下のファイルのみ対象とし、かつ実在するもの
            if "d:/my_work" in normalized_path.as_posix().lower() and normalized_path.exists():
                # 自己修復エンジン自体(healer.py, sre_daemon.py, settings.py)が壊れるのを防ぐための防衛
                if any(k in normalized_path.name for k in ["healer.py", "sre_daemon.py", "settings.py"]):
                    logger.warning(f"⚠️ コアモジュール {normalized_path.name} の自動書き換えは安全のためスキップします。")
                    continue
                try:
                    return normalized_path, int(line_str)
                except ValueError:
                    continue
        
        return None, 0

    def validate_syntax(self, file_path: Path) -> bool:
        """修正したファイルの構文/ビルド検証"""
        ext = file_path.suffix.lower()
        
        if ext == ".py":
            # Pythonの構文チェック
            try:
                res = subprocess.run(
                    [r".venv\Scripts\python.exe", "-m", "py_compile", str(file_path)],
                    capture_output=True,
                    text=True,
                    check=False
                )
                if res.returncode != 0:
                    logger.error(f"❌ Python構文チェックエラー: {res.stderr}")
                    return False
                return True
            except Exception as e:
                logger.error(f"❌ Python構文検証失敗: {e}")
                return False
                
        elif ext in (".ts", ".tsx", ".js"):
            # Next.js/TypeScriptの構文チェック (04_PORTAL配下)
            portal_dir = settings.ROOT_DIR / "04_PORTAL"
            if not portal_dir.exists():
                return True # ポータルがなければスキップしてPass扱い
                
            try:
                # 高速なtsc構文チェック
                res = subprocess.run(
                    ["npx", "tsc", "--noEmit"],
                    cwd=str(portal_dir),
                    shell=True,
                    capture_output=True,
                    text=True,
                    check=False
                )
                if res.returncode != 0:
                    logger.error(f"❌ TypeScriptビルドチェックエラー: {res.stdout}\n{res.stderr}")
                    return False
                return True
            except Exception as e:
                logger.error(f"❌ TS検証失敗: {e}")
                return False
                
        return True

    def execute_git_push(self, file_path: Path) -> bool:
        """修正完了後のGitプッシュによるVercel再デプロイ連携"""
        try:
            logger.info("🚀 [AutoHealer] Git コミット＆プッシュを実行中...")
            cwd = str(settings.ROOT_DIR)
            
            # 1. 現在のブランチ名を取得
            res_branch = subprocess.run(
                ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                cwd=cwd,
                capture_output=True,
                text=True,
                check=True
            )
            branch_name = res_branch.stdout.strip()
            
            # 2. git add
            subprocess.run(["git", "add", str(file_path)], cwd=cwd, check=True)
            
            # 3. git commit
            commit_msg = f"auto-heal: fix exception in {file_path.name}"
            subprocess.run(["git", "commit", "-m", commit_msg], cwd=cwd, check=True)
            
            # 4. git push
            subprocess.run(["git", "push", "origin", branch_name], cwd=cwd, check=True)
            
            logger.info(f"✅ [AutoHealer] Git push 成功 (Branch: {branch_name})")
            return True
        except Exception as e:
            logger.error(f"❌ [AutoHealer] Git連携失敗: {e}")
            return False

    def heal_error(self, error_text: str) -> tuple[bool, str]:
        """エラーを検知し、自律修復・検証・デプロイまでを連続実行"""
        if not self.client:
            return False, "Gemini APIクライアントが初期化されていません。"

        # 1. エラーファイルの特定
        file_path, line_no = self.find_error_file(error_text)
        if not file_path:
            return False, "修復対象のファイルが特定できませんでした。"

        # 2. 制限チェック
        if not self._check_limit(file_path):
            return False, f"ファイル '{file_path.name}' の本日の自己修復上限に達しています。"

        logger.info(f"🛡️ [AutoHealer] ファイル '{file_path.name}' の {line_no}行目付近の自己修復を開始します...")

        # 3. バックアップ作成
        backup_path = file_path.with_suffix(file_path.suffix + ".bak")
        try:
            shutil.copy2(file_path, backup_path)
        except Exception as e:
            return False, f"バックアップの作成に失敗しました: {e}"

        # 4. ソースコードのロード
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                source_code = f.read()
        except Exception as e:
            if backup_path.exists():
                backup_path.unlink()
            return False, f"ソースファイルの読み込みに失敗しました: {e}"

        # 5. Gemini に修正を依頼
        prompt = f"""
あなたはシステムの自己修復エージェントです。
以下のソースコードとエラーログを解析し、バグを修正した「完全に有効なソースコード全体のみ」を出力してください。

【制約事項】
1. 説明文、マークダウンの装飾記法（```python や ``` など）、その他の解説テキストは絶対に含めないでください。出力はすべて直接実行可能なコードテキストのみとすること。
2. もし修正が不要な箇所は変更せず、そのまま残してください。
3. エラー原因となった部分（特に {line_no}行目付近）を確実に修正してください。

【対象ソースファイル名】: {file_path.name}
【エラーログ】:
{error_text}

【現在のソースコード】:
{source_code}
"""

        try:
            from .ai_helper import generate_content_safe
            response_text = generate_content_safe(
                self.client,
                prompt,
                model_id=settings.DEFAULT_MODEL,
                feature_name="oracle"
            )
            
            # APIエラー発生時のエラー通知文字列の書き込みを防止
            if not response_text or response_text.startswith("❌") or response_text.startswith("⚠️"):
                raise Exception(f"AIによる生成処理がエラー応答となりました: {response_text}")
            
            # マークダウン装飾の除去 (万が一含まれていた場合)
            clean_code = response_text
            if "```" in clean_code:
                # ```lang のような記述を消す
                clean_code = re.sub(r"^```[a-zA-Z0-9]*\n", "", clean_code)
                # 末尾 of ``` を消す
                clean_code = re.sub(r"\n```$", "", clean_code)
                clean_code = clean_code.strip()

            if not clean_code or len(clean_code) < 10:
                raise Exception("生成されたコードが空、または短すぎます。")

            # 6. 修正コードの書き込み
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(clean_code)

            # 7. 構文検証
            if self.validate_syntax(file_path):
                logger.info(f"✨ [AutoHealer] '{file_path.name}' の構文検証にパスしました！")
                
                # 8. Git Push (自動再デプロイ)
                git_success = self.execute_git_push(file_path)
                
                # バックアップの削除
                if backup_path.exists():
                    backup_path.unlink()
                
                if git_success:
                    return True, f"'{file_path.name}' の自己修復に成功し、Git pushによる自動デプロイを開始しました。"
                else:
                    return True, f"'{file_path.name}' の自己修復に成功しました（Git pushはスキップ/失敗しました）。"
            else:
                logger.error(f"❌ [AutoHealer] '{file_path.name}' の構文検証に失敗しました。ロールバックします。")
                # ロールバック
                shutil.copy2(backup_path, file_path)
                if backup_path.exists():
                    backup_path.unlink()
                return False, f"修復コードに構文エラーが検出されたため、変更をロールバックしました。"

        except Exception as e:
            logger.error(f"❌ [AutoHealer] 修復処理中に例外が発生しました: {e}")
            # ロールバック
            if backup_path.exists():
                try:
                    shutil.copy2(backup_path, file_path)
                    backup_path.unlink()
                except Exception:
                    pass
            return False, f"自己修復の実行中に例外が発生しました: {e}"
