import os
import sys
import re
import py_compile
import logging
from pathlib import Path

# Windows環境での絵文字出力エラー対策
if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [Sentinel] %(levelname)s: %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("Sentinel")

# プロジェクトのルート（03_SYSTEMSの一つ上）
ROOT_DIR = Path("d:/my_work")

class SovereignSentinel:
    """
    Antigravity OS: 監視哨 (The Sentinel)
    セキュリティ、ディレクトリ構造、構文の3軸で監査を行う。
    """
    def __init__(self):
        # 必須基幹ディレクトリ
        self.core_dirs = [
            ROOT_DIR / "01_INTEL",
            ROOT_DIR / "03_SYSTEMS",
            ROOT_DIR / "02_FACTORY",
            ROOT_DIR / "99_ARCHIVE",
            ROOT_DIR / "scratch"
        ]
        
        # スキャンから除外するディレクトリ
        self.ignore_dirs = {".venv", ".git", "99_ARCHIVE", "node_modules", ".agent"}

        # 検知対象の秘密情報パターン (正規表現)
        self.secret_patterns = {
            "Google/Gemini API Key": re.compile(r'AIza[0-9A-Za-z-_]{35}'),
            "Discord Bot Token": re.compile(r'[MNT][a-zA-Z0-9_-]{23,25}\.[a-zA-Z0-9_-]{6}\.[a-zA-Z0-9_-]{27}'),
            "Generic Private Key": re.compile(r'-----BEGIN (?:RSA|OPENSSH) PRIVATE KEY-----'),
        }

    def is_ignored(self, path: Path) -> bool:
        """パスが除外対象ディレクトリに含まれているかチェック"""
        for part in path.parts:
            if part in self.ignore_dirs:
                return True
        return False

    def audit_security(self):
        """ハードコードされた機密情報のスキャン"""
        logger.info("🔒 Security Audit: 機密情報の直書きスキャンを開始します...")
        leaks_found = []
        
        # 拡張子を限定（ソースコード・テキスト）
        target_extensions = {".py", ".js", ".gs", ".json", ".md", ".txt"}
        
        for file_path in ROOT_DIR.rglob("*"):
            if not file_path.is_file():
                continue
            if self.is_ignored(file_path):
                continue
            if file_path.name == ".env":
                continue # .env 内にある分には正しい
            if file_path.suffix not in target_extensions:
                continue
                
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    lines = f.readlines()
                    for i, line in enumerate(lines, 1):
                        for name, pattern in self.secret_patterns.items():
                            if pattern.search(line):
                                msg = f"[{name} MIGHT BE COMPROMISED] in {file_path.relative_to(ROOT_DIR)} (Line: {i})"
                                leaks_found.append(msg)
                                logger.error(f"🚨 {msg}")
            except UnicodeDecodeError:
                pass # バイナリ等の場合は無視
            except Exception as e:
                logger.warning(f"Failed to read {file_path.name}: {e}")

        if not leaks_found:
            logger.info("✅ Security Audit: 機密情報の漏洩リスクは検知されませんでした。")
        return leaks_found

    def audit_structure(self):
        """基幹ディレクトリの存在・健全性チェック"""
        logger.info("📁 Structure Audit: ディレクトリ健全性チェックを開始します...")
        missing = []
        for d in self.core_dirs:
            if not d.exists():
                logger.warning(f"⚠️ ディレクトリの欠損を検知しました: {d.name}")
                d.mkdir(parents=True, exist_ok=True)
                logger.info(f"🔄 自己修復: {d.name} を再構築しました。")
                missing.append(d.name)
                
        if not missing:
            logger.info("✅ Structure Audit: ディレクトリ構成は正常です。")
        return missing

    def audit_syntax(self):
        """Pythonソースコードの致命的な構文エラーチェック"""
        logger.info("⚙️ Syntax Audit: Pythonコードの構文チェックを開始します...")
        errors = []
        for py_file in ROOT_DIR.rglob("*.py"):
            if self.is_ignored(py_file):
                continue
            try:
                py_compile.compile(str(py_file), doraise=True)
            except py_compile.PyCompileError as e:
                errors.append(f"{py_file.name}: {str(e)}")
                logger.error(f"❌ 構文エラー検知: {py_file.relative_to(ROOT_DIR)}")
                
        if not errors:
            logger.info("✅ Syntax Audit: 全てのPythonファイル (除外を除く) で構文は正常です。")
        return errors

    def run_daily_audit(self):
        print(f"\n{'='*50}\n🛡️ SOVEREIGN SENTINEL: 監査プロセス起動\n{'='*50}")
        leaks = self.audit_security()
        missing = self.audit_structure()
        errors = self.audit_syntax()
        
        print("\n--- 📊 Sentinel 最終レポート ---")
        if not leaks and not missing and not errors:
            print("[+] STATUS: ALL SYSTEMS CLEAR. 王の玉座は堅守されています。")
        else:
            print("[!] STATUS: ISSUES DETECTED. 以下に対処が必要です。")
            if leaks:
                print(f"  - 🚨 重大セキュリティインシデント: {len(leaks)} 件")
            if missing:
                print(f"  - ⚠️ 破損・復旧ディレクトリ: {len(missing)} 件")
            if errors:
                print(f"  - ❌ 構文エラー: {len(errors)} 件")
        print("==================================================")
        return {"leaks": leaks, "missing_dirs": missing, "syntax_errors": errors}

if __name__ == "__main__":
    sentinel = SovereignSentinel()
    sentinel.run_daily_audit()
