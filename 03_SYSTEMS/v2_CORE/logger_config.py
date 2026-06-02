import logging
import sys
from logging.handlers import RotatingFileHandler
from .settings import settings

def setup_sovereign_logging(name="SovereignOS"):
    """
    Antigravity Sovereign OS: 統一ロギング設定
    コンソールとファイルの両方にログを出力し、自己修復Sentinelが監視可能にする。
    """
    log_dir = settings.LOG_DIR
    log_dir.mkdir(parents=True, exist_ok=True)
    
    log_file = log_dir / "sovereign_os.log"
    
    # ルートロガーの取得
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    
    # ロガーの取得（個別名用）
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    
    # 既存のハンドラをクリア（二重出力を防止）
    if root_logger.hasHandlers():
        root_logger.handlers.clear()
        
    formatter = logging.Formatter('%(asctime)s [%(name)s] %(levelname)s: %(message)s')
    
    # コンソールハンドラ (Windowsの絵文字による文字化け/エラー対策)
    console_handler = logging.StreamHandler(sys.stdout)
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        except:
            pass
    console_handler.setFormatter(formatter)
    
    # ファイルハンドラ (10MBごとにローテーション、最大5ファイル)
    file_handler = RotatingFileHandler(
        log_file, maxBytes=10*1024*1024, backupCount=5, encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    
    # ルートロガーにのみハンドラを追加（伝播を利用）
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)
    
    return logger

# デフォルトのグローバルロガーを作成（各モジュールでインポートして使用）
# logger = setup_sovereign_logging()
