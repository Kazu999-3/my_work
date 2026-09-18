#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backup_knowledge_vault.py - 重要ナレッジVaultのローカル自動スナップショット
01_INTEL/, 02_FACTORY/, .agent/ の重要Markdown・設定資産を日付付きZIPへ瞬時に安全退避します。
"""

import os
import sys
import zipfile
import datetime
from pathlib import Path

# Windows cp932対策
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKUP_DIR = REPO_ROOT / "99_ARCHIVE" / "vault_backups"

# バックアップ対象ディレクトリ（ナレッジ・ルール・工場）
TARGET_DIRS = [
    "01_INTEL",
    "02_FACTORY",
    ".agent",
]

# 対象とするテキスト・ナレッジ拡張子
TARGET_EXTENSIONS = {".md", ".json", ".yaml", ".yml", ".sql", ".txt", ".csv"}

# 除外するフォルダ名
EXCLUDE_DIRS = {
    "node_modules",
    "__pycache__",
    ".git",
    "cache",
    "vault_backups",
    "PRODUCTS",  # 生成バイナリ
    "sns_assets", # 画像・動画
    "assets",
}

def should_exclude_dir(dirname):
    return dirname in EXCLUDE_DIRS

def should_include_file(filename):
    ext = Path(filename).suffix.lower()
    return ext in TARGET_EXTENSIONS

def create_vault_backup():
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    today_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    zip_name = f"knowledge_vault_{today_str}.zip"
    zip_path = BACKUP_DIR / zip_name

    print(f"📦 ナレッジVaultのバックアップを開始します...")
    file_count = 0
    total_bytes = 0

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for target in TARGET_DIRS:
            target_path = REPO_ROOT / target
            if not target_path.exists():
                continue
            
            for root, dirs, files in os.walk(target_path):
                # 不要フォルダを走査対象から外す
                dirs[:] = [d for d in dirs if not should_exclude_dir(d)]
                
                for file in files:
                    if not should_include_file(file):
                        continue
                        
                    full_path = Path(root) / file
                    rel_path = full_path.relative_to(REPO_ROOT)
                    rel_path_str = str(rel_path).replace("\\", "/")
                    
                    zf.write(full_path, arcname=rel_path_str)
                    file_count += 1
                    total_bytes += full_path.stat().st_size


    mb_size = total_bytes / (1024 * 1024)
    print(f"✅ バックアップ完了: {zip_path.name}")
    print(f"   - 保存先: {zip_path}")
    print(f"   - 格納ファイル数: {file_count} ファイル")
    print(f"   - 総容量: {mb_size:.2f} MB")
    return zip_path

if __name__ == "__main__":
    create_vault_backup()
