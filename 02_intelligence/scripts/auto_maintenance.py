import os
import subprocess
from datetime import datetime
import re
import shutil
import time

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SKILLS_DIR = os.path.join(ROOT_DIR, "skills")
DIR_MAP_FILE = os.path.join(ROOT_DIR, "ディレクトリ構成.md")
SKILLS_MAP_FILE = os.path.join(SKILLS_DIR, "SKILL_LIST.md")

def generate_directory_tree(startpath, exclude_dirs=None):
    if exclude_dirs is None:
        exclude_dirs = [".git", "__pycache__", ".venv", "node_modules", ".gemini", "env"]
    
    tree_str = "# リポジトリ ディレクトリ構成図\n\n"
    tree_str += f"自動更新日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    tree_str += "```text\n"
    
    for root, dirs, files in os.walk(startpath):
        # 除外ディレクトリをフィルタリング
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        dirs.sort()
        files.sort()
        
        level = root.replace(startpath, "").count(os.sep)
        indent = " " * 4 * level
        folder_name = os.path.basename(root)
        if folder_name == "":
            folder_name = "my_work (Root)"
            
        tree_str += f"{indent}📁 {folder_name}/\n"
        subindent = " " * 4 * (level + 1)
        for f in files:
            tree_str += f"{subindent}📄 {f}\n"
            
    tree_str += "```\n"
    return tree_str

def update_directory_map():
    print("[1/3] ディレクトリ構成図を更新中...")
    tree = generate_directory_tree(ROOT_DIR)
    
    with open(DIR_MAP_FILE, "w", encoding="utf-8") as f:
        f.write(tree)
    print("✅ ディレクトリ構成.md を更新しました。")

def update_skill_list():
    print("[2/3] スキル一覧を更新中...")
    if not os.path.exists(SKILLS_DIR):
        print("⚠️ skillsディレクトリが見つかりません。")
        return
        
    sk_content = "# Antigravity Skills 一覧\n\n"
    sk_content += f"自動更新日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    sk_content += "このファイルは自動生成されています。各スキルの概要を整理しています。\n\n"
    
    # skillsディレクトリ内の全該当マークダウンファイルを探索
    skills = []
    for root, dirs, files in os.walk(SKILLS_DIR):
        for file in files:
            if file.endswith(".md") and file != "SKILL_LIST.md":
                filepath = os.path.join(root, file)
                rel_path = os.path.relpath(filepath, SKILLS_DIR).replace("\\", "/")
                
                # 最初の方の行を読んでdescriptionや概要を探す
                desc = "説明なし"
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        lines = f.readlines()
                        # YML frontmatter か 最初のパラグラフを取得する簡易処理
                        for line in lines[:10]:
                            if "description:" in line.lower():
                                desc = line.split(":", 1)[1].strip()
                                break
                            elif line.startswith("# ") or line.startswith("---") or line.strip() == "":
                                continue
                            elif not line.startswith("<") and not line.startswith("["):
                                desc = line.strip()
                                break
                except Exception:
                    pass
                
                skills.append((rel_path, desc))
                
    skills.sort()
    for rel_path, desc in skills:
        sk_content += f"- **[{os.path.basename(rel_path)}](./{rel_path})**\n"
        sk_content += f"  - {desc[:100]}\n"
        
    with open(SKILLS_MAP_FILE, "w", encoding="utf-8") as f:
        f.write(sk_content)
    print("✅ SKILL_LIST.md を更新しました。")

def optimize_git():
    print("[3/3] Gitへの自動コミット＆プッシュを実行中...")
    try:
        # Add all
        subprocess.run(["git", "add", "."], cwd=ROOT_DIR, check=True, capture_output=True)
        print("✅ ファイルをステージングしました。")
        
        # Check if there's anything to commit
        status_res = subprocess.run(["git", "status", "--porcelain"], cwd=ROOT_DIR, capture_output=True, text=True)
        if not status_res.stdout.strip():
            print("💡 コミットする変更がありませんでした。処理をスキップします。")
            return
            
        # Commit
        commit_msg = f"chore(auto-sync): Maintenance sync and optimize {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        subprocess.run(["git", "commit", "-m", commit_msg], cwd=ROOT_DIR, check=True, capture_output=True)
        print("✅ 変更をコミットしました。")
        
        # Push 
        # (エラーになる可能性もあるため、エラー時は出力する)
        push_res = subprocess.run(["git", "push"], cwd=ROOT_DIR, capture_output=True, text=True)
        if push_res.returncode == 0:
            print("✅ リモートリポジトリへプッシュが成功しました。")
        else:
            print("⚠️ プッシュがスキップされたか、エラーが発生しました。")
            print(push_res.stderr)
            
    except subprocess.CalledProcessError as e:
        print(f"❌ Git処理中にエラーが発生しました: {e.stderr if hasattr(e, 'stderr') else e}")
    except Exception as e:
        print(f"❌ 予期せぬエラー: {e}")

def cleanup_factory():
    """
    03_factory フォルダ内の整理・アーカイブ化を自動で行う
    """
    print("[0/3] Factory フォルダの自動クリーンアップを実行中...")
    factory_dir = os.path.join(ROOT_DIR, "03_factory")
    daily_posts_dir = os.path.join(factory_dir, "daily_posts")
    reports_dir = os.path.join(factory_dir, "reports")
    archives_dir = os.path.join(factory_dir, "archives")
    logs_dir = os.path.join(ROOT_DIR, "04_system", "logs")

    os.makedirs(archives_dir, exist_ok=True)
    os.makedirs(logs_dir, exist_ok=True)

    # 1. reports 内のログファイルを適切な場所へ移動
    for f in os.listdir(reports_dir):
        if f.endswith(".log"):
            src = os.path.join(reports_dir, f)
            dest = os.path.join(logs_dir, f)
            try:
                shutil.move(src, dest)
                print(f"  [Log Move] {f} ➔ logs/")
            except Exception: pass

    # 2. daily_posts および reports 内の古いファイル (7日以上) をアーカイブへ
    target_folders = [daily_posts_dir, reports_dir]
    now = time.time()
    for folder in target_folders:
        if not os.path.exists(folder): continue
        for f in os.listdir(folder):
            file_path = os.path.join(folder, f)
            if os.path.isfile(file_path):
                # 7日以上前のファイルを対象
                if (now - os.path.getmtime(file_path)) > (7 * 86400):
                    try:
                        shutil.move(file_path, os.path.join(archives_dir, f))
                        print(f"  [Archive] {f} ➔ archives/")
                    except Exception: pass

    print("✅ Factory フォルダの整理が完了しました。")

if __name__ == "__main__":
    print("========================================")
    print("  🔧 Auto Maintenance Script Start")
    print("========================================")
    
    
    cleanup_factory()
    update_directory_map()
    update_skill_list()
    optimize_git()
    
    print("\n🎉 全てのメンテナンス処理が完了しました！")
