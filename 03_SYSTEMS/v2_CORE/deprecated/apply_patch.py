# ============================================================
# 【現在未使用】インフラ保守系
# patches.json に基づいてコードへパッチを適用する。
#
# 2026-07-21 時点で、どこからも import されず CI からも起動されていない。
# 将来の復活を前提に残しているだけなので、現役のコードとして参照しないこと。
# 復活させる場合は、参照している設定やテーブルが今も存在するか確認が必要。
# ============================================================
import sys
import json
import logging
from pathlib import Path
from v2_CORE.settings import settings

logger = logging.getLogger("PatchApplier")
logging.basicConfig(level=logging.INFO)

def apply_patch(patch_id: str):
    """指定されたIDの修正パッチを適用し、ソースコードを書き換える"""
    patches_index = settings.FORGE_DIR / "INFRA/patches/patches.json"
    
    if not patches_index.exists():
        logger.error("パッチファイルが見つかりません。")
        return False
        
    try:
        with open(patches_index, "r", encoding="utf-8") as f:
            patches = json.load(f)
    except Exception as e:
        logger.error(f"パッチの読み込みに失敗しました: {e}")
        return False
        
    target_patch = next((p for p in patches if p.get("id") == patch_id), None)
    if not target_patch:
        logger.error(f"パッチ ID '{patch_id}' が見つかりません。")
        return False
        
    if target_patch.get("status") == "applied":
        logger.warning(f"パッチ ID '{patch_id}' は既に適用されています。")
        return True
        
    target_file = Path(target_patch["target_file"])
    if not target_file.exists():
        logger.error(f"修正対象のファイルが見つかりません: {target_file}")
        return False
        
    try:
        # ファイルの読み込み
        content = target_file.read_text(encoding="utf-8")
        
        search_str = target_patch["search_content"]
        replace_str = target_patch["replace_content"]
        
        if search_str not in content:
            # \r\n と \n の違いを吸収するためのフォールバック
            search_str_normalized = search_str.replace('\r\n', '\n')
            content_normalized = content.replace('\r\n', '\n')
            
            if search_str_normalized not in content_normalized:
                logger.error("置換対象のコードブロックがファイル内に見つかりません。")
                return False
            else:
                content = content_normalized
                search_str = search_str_normalized
                
        # 置換の実行
        new_content = content.replace(search_str, replace_str)
        
        # 保存
        target_file.write_text(new_content, encoding="utf-8")
        
        # ステータス更新
        target_patch["status"] = "applied"
        with open(patches_index, "w", encoding="utf-8") as f:
            json.dump(patches, f, ensure_ascii=False, indent=4)
            
        logger.info(f"✅ パッチ '{patch_id}' の適用が完了しました！ ({target_file.name})")
        return True
        
    except Exception as e:
        logger.error(f"パッチの適用中にエラーが発生しました: {e}")
        return False

def discard_patch(patch_id: str):
    """指定されたパッチを破棄（rejected）する"""
    patches_index = settings.FORGE_DIR / "INFRA/patches/patches.json"
    
    if not patches_index.exists():
        return False
        
    try:
        with open(patches_index, "r", encoding="utf-8") as f:
            patches = json.load(f)
            
        target_patch = next((p for p in patches if p.get("id") == patch_id), None)
        if target_patch:
            target_patch["status"] = "rejected"
            with open(patches_index, "w", encoding="utf-8") as f:
                json.dump(patches, f, ensure_ascii=False, indent=4)
            logger.info(f"🗑️ パッチ '{patch_id}' を破棄しました。")
            return True
            
    except Exception as e:
        logger.error(f"Error discarding patch: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python apply_patch.py [apply|discard] [patch_id]")
        sys.exit(1)
        
    action = sys.argv[1]
    patch_id = sys.argv[2]
    
    if action == "apply":
        apply_patch(patch_id)
    elif action == "discard":
        discard_patch(patch_id)
    else:
        print("Invalid action.")
