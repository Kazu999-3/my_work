import os
import json
import logging
import threading
from datetime import datetime, timedelta
from pathlib import Path
from v2_CORE.settings import settings

logger = logging.getLogger("QuotaManager")

class QuotaExceededError(Exception):
    """APIのクォータ上限に達した際に発生する例外"""
    pass

class QuotaManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(QuotaManager, cls).__new__(cls)
                cls._instance._init()
            return cls._instance

    def _init(self):
        # 環境変数 ANTIGRAVITY_DATA_DIR があればそこを使い、なければ既存のローカルパスをフォールバックする
        data_dir_str = os.environ.get("ANTIGRAVITY_DATA_DIR", str(settings.ROOT_DIR / "03_SYSTEMS" / "v2_CORE"))
        self.data_file = Path(data_dir_str) / "quota_usage.json"
        self.file_lock = threading.Lock()

    def _get_today_str(self):
        # Gemini APIのリセット時間（太平洋標準時 PST/PDT: 深夜0時）に合わせるため、
        # 厳密にUTC-8（米国太平洋時間）を基準にして日付を切り替える
        # ※夏時間(PDT: UTC-7)のズレを考慮し、最も安全なUTC-8(日本時間の17:00リセット)を採用
        pt_now = datetime.utcnow() - timedelta(hours=8)
        return pt_now.strftime("%Y-%m-%d")

    def _acquire_file_lock(self):
        """プロセス間でのファイル競合を防ぐための簡易ロックファイル制御"""
        import time
        lock_path = self.data_file.with_suffix(".json.lock")
        start_time = time.time()
        while True:
            try:
                # 排他的にロックファイルを作成 (x モード)
                fd = os.open(str(lock_path), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                os.close(fd)
                break
            except FileExistsError:
                # タイムアウト (最大5秒) を設けてデッドロックを防ぐ
                if time.time() - start_time > 5.0:
                    logger.warning("[QuotaManager] File lock acquisition timed out. Proceeding anyway.")
                    break
                time.sleep(0.05)

    def _release_file_lock(self):
        """ロックファイルの解放"""
        lock_path = self.data_file.with_suffix(".json.lock")
        try:
            os.remove(lock_path)
        except Exception:
            pass

    def _get_supabase_creds(self):
        try:
            import dotenv
            dotenv.load_dotenv(settings.ROOT_DIR / ".env")
        except Exception:
            pass
        return os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_KEY")

    def _fetch_remote_usage(self, today: str) -> dict:
        """Supabase(api_usage_logs)上の当日usage_dataを取得する。取得できなければ空dictを返す。

        GitHub Actions等の実行環境は毎回まっさらな状態でリポジトリをcheckoutするため、
        quota_usage.json(gitignore対象)が存在せず、ローカルファイルだけを信頼すると
        「1日の合計使用量」を常にゼロから誤認してしまう。さらに_save_data()がその
        ゼロ起点の値をそのままSupabaseへupsertすると、PC常駐のdaemon等が1日かけて
        積み上げていたカウントを小さい値で上書き(巻き戻し)してしまうバグがあった
        (2026-08-10発覚、error_429が10→6に逆行して発覚)。
        """
        supabase_url, supabase_key = self._get_supabase_creds()
        if not supabase_url or not supabase_key:
            return {}
        try:
            import httpx
            headers = {"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}"}
            res = httpx.get(
                f"{supabase_url}/rest/v1/api_usage_logs?date=eq.{today}&select=usage_data",
                headers=headers, timeout=5.0
            )
            if res.status_code == 200 and res.json():
                return res.json()[0].get("usage_data") or {}
        except Exception as e:
            logger.warning(f"[QuotaManager] Supabaseからの当日使用量取得に失敗(ローカル値のみで判定): {e}")
        return {}

    def _load_data(self):
        self._acquire_file_lock()
        try:
            if not self.data_file.exists():
                return {}
            with open(self.data_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"[QuotaManager] Failed to load data: {e}")
            return {}
        finally:
            self._release_file_lock()

    def _save_data(self, data):
        self._acquire_file_lock()
        try:
            self.data_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.data_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=4)
            
            # Supabaseへの同期
            try:
                import httpx
                supabase_url, supabase_key = self._get_supabase_creds()
                if supabase_url and supabase_key:
                    today = self._get_today_str()
                    usage_data = data.get(today, {}).copy()

                    # ローカルの値だけでそのままupsertすると、他の実行環境(GitHub Actions等)が
                    # 積み上げていたカウントを小さい値で上書き(巻き戻し)てしまう(2026-08-10発覚)。
                    # 書き込み前にSupabase側の現在値を取得し、カウンタ系のキーはmax(ローカル,
                    # リモート)を採用することで単調増加を保証する。
                    remote_usage = self._fetch_remote_usage(today)
                    for k, v in remote_usage.items():
                        if k.startswith("__limit_"):
                            continue
                        if isinstance(v, (int, float)):
                            usage_data[k] = max(usage_data.get(k, 0), v)

                    # ポータル側で上限値と機能ごとの内訳を表示できるように、limitの値を付与する
                    limits = getattr(settings, "DAILY_QUOTA_LIMITS", {})
                    for k, v in limits.items():
                        usage_data[f"__limit_{k}"] = v

                    url = f"{supabase_url}/rest/v1/api_usage_logs?on_conflict=date"
                    headers = {
                        "apikey": supabase_key,
                        "Authorization": f"Bearer {supabase_key}",
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates"
                    }
                    payload = {"date": today, "usage_data": usage_data}
                    httpx.post(url, headers=headers, json=payload, timeout=5.0)
            except Exception as e:
                logger.warning(f"[QuotaManager] Supabase sync failed: {e}")
        except Exception as e:
            logger.error(f"[QuotaManager] Failed to save data: {e}")
        finally:
            self._release_file_lock()

    def check_quota(self, feature_name: str) -> bool:
        """指定された機能が今日のクォータ上限に達していないか確認する"""
        if feature_name == "default":
            return True # デフォルトは無制限（または別途制限）
            
        limit = getattr(settings, "DAILY_QUOTA_LIMITS", {}).get(feature_name, None)
        if limit is None:
            return True # 制限が定義されていない場合は無制限

        today = self._get_today_str()
        # GitHub Actions等の実行環境は毎回まっさらな状態でリポジトリをcheckoutするため、
        # ローカルファイルだけを信頼すると「today not in data」で常にTrue(制限なし)を
        # 返してしまい、PC常駐daemon等が既に積み上げている使用量を見落とす(2026-08-10発覚)。
        # ローカルとSupabase側の値のうち大きい方を採用して判定する。
        remote_today = self._fetch_remote_usage(today)

        with self.file_lock:
            data = self._load_data()
            local_today = data.get(today, {})

            # サーキットブレーカー: consume_quota()は成功時にしかカウントされないため、
            # クォータ枯渇で429が連発している間は成功カウンタ(current_usage)が増えず
            # 上限チェックをすり抜け続ける。今日のエラー数が閾値を超えたら、成功回数に
            # 関わらずスキップし、5分おきの自動巡回が丸1日失敗し続けるのを防ぐ。
            #
            # 機能ごとに独立集計する(以前は全機能共通の"error_429"を見ており、無関係な
            # 機能で429が10回超えただけで、辞典一括更新(oracle)のように自分の残り枠には
            # まだ十分余裕がある機能まで一律で巻き込んで止めてしまっていた。2026-08-11、
            # oracleが300回中8回しか使っていないのに他機能由来のerror_429が原因で
            # 2日連続で一括更新が中断される問題として発覚)。
            error_key = f"error_429:{feature_name}"
            error_count = max(local_today.get(error_key, 0), remote_today.get(error_key, 0))
            if error_count >= settings.DAILY_ERROR_CIRCUIT_BREAKER:
                # クールダウン: 最後のエラーから一定時間静かならブロックを解除する
                # (日付が変わるまで固定ロックされる問題への対処。上のDAILY_ERROR_COOLDOWN_MINUTES
                # コメント参照)。タイムスタンプが記録されていない古い形式のデータの場合は
                # 従来通り安全側(ブロック継続)にフォールバックする。
                ts_key = f"{error_key}:last_ts"
                last_ts = max(local_today.get(ts_key, 0), remote_today.get(ts_key, 0))
                cooled_down = False
                if last_ts:
                    elapsed_min = (datetime.utcnow().timestamp() - last_ts) / 60.0
                    # このマシンでdatetime.utcnow()がまれに約9時間ズレた値を返す環境要因の
                    # 不整合が確認されており(2026-08-14発覚)、その場合elapsed_minが負の値
                    # (=最終エラーが未来時刻)になる。あり得ない値なので時計側を疑い、
                    # クールダウン解除側(安全側)に倒す。これが無いと一度ズレを引いた瞬間に
                    # 「経過時間が永久にマイナス」扱いとなり、実際は何時間経っていても
                    # サーキットブレーカーが二度と解除されなくなってしまう。
                    cooled_down = elapsed_min < 0 or elapsed_min >= settings.DAILY_ERROR_COOLDOWN_MINUTES
                if not cooled_down:
                    return False

            current_usage = max(local_today.get(feature_name, 0), remote_today.get(feature_name, 0))
            return current_usage < limit

    def check_quota_or_raise(self, feature_name: str):
        """クォータ上限に達している場合は例外を発生させる厳格なチェック"""
        if not self.check_quota(feature_name):
            logger.warning(f"🚨 APIクォータ制限到達: {feature_name}")
            raise QuotaExceededError(f"APIクォータが上限に達しました: {feature_name}。本日はこれ以上リクエストできません。")

    def consume_quota(self, feature_name: str):
        """指定された機能の今日のクォータを1消費する"""
        if feature_name == "default":
            return

        limit = getattr(settings, "DAILY_QUOTA_LIMITS", {}).get(feature_name, None)
        if limit is None:
            return

        with self.file_lock:
            data = self._load_data()
            today = self._get_today_str()
            
            # 過去のデータをクリアしてサイズ肥大化を防ぐ
            keys_to_delete = [k for k in data.keys() if k != today]
            for k in keys_to_delete:
                del data[k]
                
            if today not in data:
                data[today] = {}
                
            current_usage = data[today].get(feature_name, 0)
            data[today][feature_name] = current_usage + 1
            
            self._save_data(data)
            logger.debug(f"[QuotaManager] Consumed quota for '{feature_name}': {current_usage + 1}/{limit}")

    def record_error(self, error_type: str, feature_name: str = None):
        """指定されたエラー（429など）の発生回数を記録する。

        feature_name指定時は"{error_type}:{feature_name}"としても記録し、
        check_quota()の機能別サーキットブレーカー判定に使わせる（全機能共通の
        error_type単体キーも後方互換のため引き続き記録する）。
        """
        with self.file_lock:
            data = self._load_data()
            today = self._get_today_str()

            if today not in data:
                data[today] = {}

            keys = [error_type]
            if feature_name:
                keys.append(f"{error_type}:{feature_name}")
            for key in keys:
                current_count = data[today].get(key, 0)
                data[today][key] = current_count + 1

            # サーキットブレーカーのクールダウン判定用に、機能別エラーの最終発生時刻を記録する
            # (check_quota()参照)。
            if feature_name:
                data[today][f"{error_type}:{feature_name}:last_ts"] = datetime.utcnow().timestamp()

            self._save_data(data)
            logger.debug(f"[QuotaManager] Recorded error '{error_type}' (feature={feature_name})")

quota_manager = QuotaManager()
