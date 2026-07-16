import os
import sys
import json
import time
import logging
from pathlib import Path
from datetime import datetime, timezone
import requests
import dotenv

# パス追加と設定の読み込み
try:
    from v2_CORE.settings import settings
    from v2_CORE.ai_helper import generate_content_safe
    from v2_CORE._LOL.champ_db_updater import update_champion_db
    from v2_CORE._LOL.power_spike_generator import generate_power_spike
    from v2_CORE._LOL.herald import herald
except ImportError:
    sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
    from v2_CORE.settings import settings
    from v2_CORE.ai_helper import generate_content_safe
    from v2_CORE._LOL.champ_db_updater import update_champion_db
    from v2_CORE._LOL.power_spike_generator import generate_power_spike
    from v2_CORE._LOL.herald import herald

dotenv.load_dotenv(Path("d:/my_work/.env"))

# ログディレクトリの作成
os.makedirs("d:/my_work/00_LOGS", exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [ChampBulk] %(levelname)s: %(message)s",
    handlers=[
        logging.FileHandler("d:/my_work/00_LOGS/champion_db_bulk_update_run.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY_FREE") or os.environ.get("GEMINI_API_KEY")
QUEUE_FILE = Path("d:/my_work/02_FACTORY/_LOL/champion_update_queue.json")

def get_latest_patch() -> str:
    url = "https://ddragon.leagueoflegends.com/api/versions.json"
    try:
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            return r.json()[0]
    except Exception as e:
        logging.error(f"Failed to fetch patch version from Ddragon: {e}")
    raise RuntimeError(
        "最新パッチバージョンの取得に失敗しました。古いパッチのまま同期を継続すると"
        "誤ったデータで辞典を上書きするため、同期を中断します。DDragonの疎通を確認してください。"
    )

def get_all_champions(patch_version: str) -> dict:
    url = f"https://ddragon.leagueoflegends.com/cdn/{patch_version}/data/ja_JP/champion.json"
    try:
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            return r.json()["data"]
    except Exception as e:
        logging.error(f"Failed to fetch champions: {e}")
    return {}

def load_queue() -> dict:
    if QUEUE_FILE.exists():
        try:
            with open(QUEUE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logging.error(f"Failed to load queue file: {e}")
    return {}

def save_queue(data: dict):
    try:
        os.makedirs(QUEUE_FILE.parent, exist_ok=True)
        with open(QUEUE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logging.error(f"Failed to save queue file: {e}")

def research_champion(champ_name: str, champ_id: str, patch_version: str) -> str:
    # 1. まず Gemini API での生成を試みる
    if GEMINI_API_KEY:
        try:
            from google import genai
            client = genai.Client(api_key=GEMINI_API_KEY)
            patch_major = ".".join(patch_version.split(".")[:2]) if patch_version else "16.11"
            
            prompt = f"""
            League of Legendsのチャンピオン「{champ_name} ({champ_id})」について、最新パッチ（パッチ {patch_major}想定）の情報をリサーチしてください。
            
            以下の項目を詳しくまとめてください：
            1. 強み (Strengths)
            2. 弱み (Weaknesses)
            3. パワースパイク (コアアイテムやレベル)
            4. 推奨ビルドと主要ルーン
            5. フルクリア時間とルート（ジャングラーの場合のみ。それ以外は「対象外」と記載）
            6. 基本的な立ち回りとメタでの位置づけ
            
            情報は Lolalytics や u.gg などの統計に基づいた客観的な内容にしてください。
            """
            
            # generate_content_safe は内部で APIGateway を介してレート制限をハンドリングする
            response_text = generate_content_safe(
                client, 
                prompt, 
                model_id=settings.DEFAULT_MODEL,
                feature_name="oracle",
                sleep_on_rate_limit=False  # クォータ回避のためスリープはしない
            )
            # 正常に取得できたら返す
            if response_text and not response_text.startswith("❌") and not response_text.startswith("⚠️") and "本日の利用上限に達しました" not in response_text:
                return response_text
        except Exception as e:
            logging.warning(f"⚠️ Geminiでの {champ_name} のリサーチに失敗しました。ローカルOllamaへのフォールバックを試みます。エラー: {e}")

    # 2. Gemini が制限やエラーで失敗した場合は、ローカルの Ollama (gemma3:12b) にフォールバックする
    logging.info(f"🏠 Ollama (ローカルLLM) を使用して {champ_name} をリサーチします...")
    try:
        from v2_CORE.ai_helper import _generate_with_ollama
        patch_major = ".".join(patch_version.split(".")[:2]) if patch_version else "16.11"
        prompt = f"""
        League of Legendsのチャンピオン「{champ_name} ({champ_id})」について、最新パッチ（パッチ {patch_major}想定）の情報をリサーチしてください。
        
        以下の項目を詳しくまとめてください：
        1. 強み (Strengths)
        2. 弱み (Weaknesses)
        3. パワースパイク (コアアイテムやレベル)
        4. 推奨ビルドと主要ルーン
        5. フルクリア時間とルート（ジャングラーの場合のみ。それ以外は「対象外」と記載）
        6. 基本的な立ち回りとメタでの位置づけ
        
        情報は Lolalytics や u.gg などの統計に基づいた客観的な内容にしてください。
        """
        
        response_text = _generate_with_ollama(prompt, model=settings.OLLAMA_MODEL)
        if response_text:
            return response_text
    except Exception as e:
        logging.error(f"❌ ローカルOllamaでの {champ_name} のリサーチも失敗しました: {e}")
        
    return "❌ リサーチに失敗しました。"

def run_bulk_update():
    logging.info("🏁 チャンピオン辞典一括更新プロセスを起動しました。")
    
    # 1. キューファイルの初期化・読み込み
    queue_data = load_queue()
    patch_version = queue_data.get("patch_version")
    
    if not queue_data or not queue_data.get("queue"):
        try:
            patch_version = get_latest_patch()
        except RuntimeError as e:
            logging.error(f"❌ {e}")
            herald.notify_progress(
                f"❌ **【辞典一括更新 中断】** {e}", portal_link=True, page="champdb"
            )
            return
        logging.info(f"🌐 最新パッチ特定: {patch_version}")
        champions = get_all_champions(patch_version)
        if not champions:
            logging.error("❌ チャンピオンリストの取得に失敗したため、処理を中断します。")
            return
            
        queue_data = {
            "patch_version": patch_version,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "status": "running",
            "queue": {}
        }
        for champ_id, info in champions.items():
            queue_data["queue"][champ_id] = {
                "name": info["name"],
                "status": "pending",
                "updated_at": None,
                "error": None
            }
        save_queue(queue_data)
        logging.info(f"🆕 新規更新キューを作成しました: {len(queue_data['queue'])} 件のチャンピオン")
    else:
        logging.info(f"📂 既存の更新キューを読み込みました。パッチバージョン: {patch_version}")
        queue_data["status"] = "running"
        queue_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        # 起動時に running 状態のまま放置されているチャンピオンがあれば pending に戻す (レジューム用)
        for champ_id, info in queue_data["queue"].items():
            if info["status"] == "running":
                info["status"] = "pending"
                info["error"] = "Process was interrupted"
        save_queue(queue_data)

    # 2. キューの処理
    queue = queue_data["queue"]
    
    # 処理対象（pending または failed）の抽出
    target_champs = [cid for cid, info in queue.items() if info["status"] in ("pending", "failed")]
    total_targets = len(target_champs)
    logging.info(f"🔄 未処理または失敗済みのチャンピオン数: {total_targets} 件 (全体: {len(queue)} 件)")
    
    if total_targets == 0:
        logging.info("✅ すべてのチャンピオンの更新が完了しています。")
        queue_data["status"] = "completed"
        queue_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        save_queue(queue_data)
        return

    processed_count = 0
    consecutive_db_failures = 0
    suspended = False
    
    for champ_id in target_champs:
        info = queue[champ_id]
        champ_name = info["name"]
        
        logging.info(f"📖 [{processed_count + 1}/{total_targets}] {champ_name} ({champ_id}) の更新を開始します...")
        
        # ステータスを running に
        queue[champ_id]["status"] = "running"
        queue_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        save_queue(queue_data)
        
        # AIリサーチの実行
        intel = research_champion(champ_name, champ_id, patch_version)
        
        # エラー判定 (ai_helper の戻り値検証)
        # 「本日の利用上限」は日次クォータ枯渇であり、これ以降の全チャンピオンも
        # 確実に失敗するため、ここでのみバッチ全体を安全に一時停止する。
        # それ以外の一過性エラー(❌/⚠️)は当該チャンピオンだけ failed にして次へ進める。
        if intel and "本日の利用上限に達しました" in intel:
            logging.warning(f"⚠️ [{champ_id}] 日次クォータ上限を検知しました。バッチ全体を一時停止します。")
            queue[champ_id]["status"] = "failed"
            queue[champ_id]["error"] = intel
            suspended = True
            break

        if not intel or intel.startswith("❌") or intel.startswith("⚠️"):
            logging.warning(f"⚠️ [{champ_id}] 一時的なエラーを検知しました。このチャンピオンをスキップして次へ進みます。エラー: {(intel or '')[:100]}")
            queue[champ_id]["status"] = "failed"
            queue[champ_id]["error"] = intel or "Empty response"
            queue_data["updated_at"] = datetime.now(timezone.utc).isoformat()
            save_queue(queue_data)
            processed_count += 1
            time.sleep(5)
            continue

        # データベースの更新
        success = update_champion_db(champ_id, champ_name, intel, patch_version)
        
        if success:
            queue[champ_id]["status"] = "completed"
            queue[champ_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
            queue[champ_id]["error"] = None
            logging.info(f"✅ {champ_name} の更新に成功しました。")
            consecutive_db_failures = 0
            processed_count += 1

            # パワースパイク(時間帯別の強さ)の生成・格納。失敗してもチャンピオン辞典本体の
            # 更新は既に成功済みなので、ここでのエラーはバッチを止めずログのみで次へ進む。
            try:
                generate_power_spike(champ_id, role="GLOBAL", patch=patch_version)
            except Exception as e:
                logging.warning(f"⚠️ [{champ_id}] パワースパイク生成でエラーが発生しましたが処理を継続します: {e}")
        else:
            logging.error(f"❌ {champ_name} のデータベース更新に失敗しました。")
            queue[champ_id]["status"] = "failed"
            queue[champ_id]["error"] = "Database upsert failed"
            consecutive_db_failures += 1
            processed_count += 1
            if consecutive_db_failures >= 5:
                logging.error("❌ データベースの連続更新失敗が上限(5回)に達したため、処理を一時停止します。")
                suspended = True
                break
            else:
                logging.warning(f"⚠️ {champ_name} のデータベース更新失敗をスキップして次のチャンピオンへ進みます (連続失敗: {consecutive_db_failures}/5)")
            
        # キューの進捗を保存
        queue_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        save_queue(queue_data)
        
        # クォータに余裕を持たせるため、5秒のスリープ (APIGatewayと二重で保護)
        time.sleep(5)

    # 3. 終了処理と通知
    queue_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    if suspended:
        logging.info("⏸️ API制限またはエラーにより、一括更新を安全に一時停止しました。次回実行時に再開します。")
        queue_data["status"] = "suspended"
        save_queue(queue_data)
        herald.notify_progress("⚠️ **【辞典一括更新一時停止】** API利用上限または一時的な接続エラーのため、一括更新を一時停止しました。残りのチャンピオンは次回実行時に再開します。", portal_link=True, page="champdb")
    else:
        # 完了チェック
        still_pending = [cid for cid, info in queue.items() if info["status"] in ("pending", "failed")]
        if len(still_pending) == 0:
            logging.info("🎉 すべてのチャンピオンの一括更新が正常に完了しました！")
            queue_data["status"] = "completed"
            save_queue(queue_data)
            # 完了時にキューファイルを削除して次回まっさらな状態からスタートできるようにする
            try:
                if QUEUE_FILE.exists():
                    # 削除する前に最終状態を残しておきたいが、UI側での完了表示のためにすぐ削除せず、
                    # ステータスを completed にした状態で維持し、UIでリセットボタンを押すか次回起動時に初期化させる
                    pass
            except Exception:
                pass
            
            herald.notify_progress("🎉 **【辞典一括更新完了】** 全チャンピオンの統計データとトレンド基本戦略の一括アップデートが完了しました！", portal_link=True, page="champdb")
        else:
            logging.info(f"⏸️ ループが終了しました。残り未処理: {len(still_pending)} 件")
            queue_data["status"] = "suspended"
            save_queue(queue_data)

if __name__ == "__main__":
    run_bulk_update()
