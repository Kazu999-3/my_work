import time
import requests
import logging
import json
import os
import hashlib

# ロガーの定義
logger = logging.getLogger("DynamicSkill")

# ファイルパスの定義
# スキルの設定ファイルと状態ファイルをdynamic_skillsフォルダ内に配置
SKILL_DIR = os.path.dirname(os.path.abspath(__file__))
PAGES_TO_TRACK_CONFIG_FILE = os.path.join(SKILL_DIR, "activity_tracker_pages.json")
TRACKED_PAGES_STATE_FILE = os.path.join(SKILL_DIR, "activity_tracker_state.json")

# 監視間隔 (秒)
MONITOR_INTERVAL_SECONDS = 3600 # 1時間ごとに監視

# ユーザーエージェント (Webサイトによっては必須)
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"

def _load_json_file(filepath, default_data=None):
    """JSONファイルを読み込むヘルパー関数"""
    if not os.path.exists(filepath):
        if default_data is not None:
            _save_json_file(filepath, default_data)
            return default_data
        return {}
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        logger.error(f"Error decoding JSON from {filepath}: {e}")
        if default_data is not None:
            return default_data
        return {}
    except IOError as e:
        logger.error(f"Error reading file {filepath}: {e}")
        if default_data is not None:
            return default_data
        return {}

def _save_json_file(filepath, data):
    """JSONファイルを保存するヘルパー関数"""
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
    except IOError as e:
        logger.error(f"Error writing file {filepath}: {e}")

def _get_page_content_hash(url):
    """指定されたURLのコンテンツを取得し、そのハッシュを返す"""
    headers = {'User-Agent': USER_AGENT}
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status() # HTTPエラーを発生させる
        # コンテンツのエンコーディングを適切に処理
        content = response.content.decode(response.encoding if response.encoding else 'utf-8', errors='ignore')
        return hashlib.sha256(content.encode('utf-8')).hexdigest()
    except requests.exceptions.RequestException as e:
        logger.warning(f"Failed to fetch content from {url}: {e}")
        return None
    except Exception as e:
        logger.error(f"An unexpected error occurred while processing {url}: {e}")
        return None

def run_skill():
    """
    「最近の活動をクリックして具体的に更新したページに飛ぶようにして欲しい」
    というユーザーの依頼を満たすスキル。
    設定されたWebページを定期的に監視し、更新を検出した際にそのURLをログに出力します。
    """
    logger.info("Activity Tracker Skill started. Monitoring web pages for updates.")

    # 追跡対象ページの初期設定ファイルを生成
    initial_config = {
        "description": "監視したいWebページのURLをリスト形式で設定してください。例: [\"https://www.example.com/news\", \"https://blog.example.com/updates\"]",
        "pages": [
            "https://www.example.com" # 例: 適宜URLを追加・変更してください
        ]
    }
    # 初回起動時に存在しない場合は、デフォルト設定で作成
    if not os.path.exists(PAGES_TO_TRACK_CONFIG_FILE):
        _save_json_file(PAGES_TO_TRACK_CONFIG_FILE, initial_config)
        logger.info(f"Created default configuration file: {PAGES_TO_TRACK_CONFIG_FILE}. Please edit it to add pages to track.")

    while True:
        try:
            # 追跡対象のURLリストを読み込む
            config_data = _load_json_file(PAGES_TO_TRACK_CONFIG_FILE, initial_config)
            pages_to_track = config_data.get('pages', [])
            
            # 空のURLを除外
            pages_to_track = [url for url in pages_to_track if url.strip()]

            if not pages_to_track:
                logger.info(f"No valid pages configured to track in {PAGES_TO_TRACK_CONFIG_FILE}. Skipping this cycle.")
                time.sleep(MONITOR_INTERVAL_SECONDS)
                continue

            # 前回の状態を読み込む (URLとそのコンテンツハッシュ)
            tracked_state = _load_json_file(TRACKED_PAGES_STATE_FILE, {})

            updated_pages = []

            for url in pages_to_track:
                current_hash = _get_page_content_hash(url)

                if current_hash is None:
                    # コンテンツ取得に失敗した場合はスキップ
                    continue

                # 初めて監視するURLの場合、現在のハッシュを保存
                if url not in tracked_state:
                    tracked_state[url] = current_hash
                    logger.info(f"Now tracking new page: {url}")
                # 既存のURLでハッシュが変更された場合
                elif tracked_state[url] != current_hash:
                    tracked_state[url] = current_hash
                    updated_pages.append(url)
                    logger.info(f"PAGE UPDATED: {url}")
                    # v2_CORE.send_notification などの連携があればここに記述。
                    # 例: if hasattr(v2_CORE, 'send_notification'): v2_CORE.send_notification(f"Webページが更新されました: {url}")

            # 更新された状態を保存
            _save_json_file(TRACKED_PAGES_STATE_FILE, tracked_state)

            if updated_pages:
                # ここで更新されたURLのリストをV2_COREに渡す、またはユーザーに通知する。
                # 現状はログに出力する形式。
                logger.info(f"Detected updates on the following pages: {', '.join(updated_pages)}")
            else:
                logger.info("No page updates detected in this cycle.")

        except Exception as e:
            logger.error(f"An error occurred in Activity Tracker Skill: {e}", exc_info=True)

        logger.info(f"Activity Tracker Skill sleeping for {MONITOR_INTERVAL_SECONDS} seconds...")
        time.sleep(MONITOR_INTERVAL_SECONDS)

# メインオーケストレーターからの呼び出しをシミュレート
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger("DynamicSkill") # __main__ のときにロガーを再取得
    run_skill()
