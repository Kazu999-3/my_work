import os
import sys
import time
import json
import logging
import threading
import webview
import httpx
from pathlib import Path
import dotenv

# ロードパスの設定（v2_CORE をインポートできるようにする）
dotenv.load_dotenv(Path("d:/my_work/.env"))
sys.path.append(str(Path("d:/my_work/03_SYSTEMS")))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
logger = logging.getLogger("MentalCheckerBackend")

CONFIG_PATH = Path("d:/my_work/03_SYSTEMS/v2_CORE/_LOL/mental_checker/config.json")
CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)

# デフォルト設定
DEFAULT_CONFIG = {
    "riot_id": "",
    "unlocked": False,
    "passcode": "SOVEREIGN_MIND_777", # デフォルトの共通パスコード
    "check_interval": 120, # 監視間隔 (秒)
    "gemini_key": "", # ユーザー独自の Gemini API キー
    "history": [] # 過去のティルト診断履歴
}

def load_config():
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return {**DEFAULT_CONFIG, **json.load(f)}
        except Exception as e:
            logger.error(f"Config load error: {e}")
    return DEFAULT_CONFIG.copy()

def save_config(config):
    try:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=4, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Config save error: {e}")

class MentalCheckerAPI:
    def __init__(self):
        self.window = None
        self.config = load_config()
        self.riot_key = os.getenv("RIOT_API_KEY", "")
        self.region = "asia"
        self.platform = "jp1"
        self.monitor_thread = None
        self.is_monitoring = False
        self.last_match_id = None
        self.in_game_flag = False

    def get_config(self):
        """フロントエンドへ設定を返す"""
        return {
            "riot_id": self.config["riot_id"],
            "unlocked": self.config["unlocked"],
            "gemini_key": self.config.get("gemini_key", "")
        }

    def unlock_app(self, input_passcode):
        """パスコードを検証してアプリをアンロックする"""
        target_passcode = os.getenv("MENTAL_CHECK_PASSCODE", self.config["passcode"])
        if input_passcode == target_passcode:
            self.config["unlocked"] = True
            save_config(self.config)
            logger.info("🔑 アプリがアンロックされました。")
            return {"success": True}
        else:
            logger.warning("❌ 無効なパスコードが入力されました。")
            return {"success": False, "message": "パスコードが正しくありません。"}

    def save_settings(self, riot_id, gemini_key):
        """Riot ID と Gemini API キーを保存し、監視を開始する"""
        if not riot_id or "#" not in riot_id:
            return {"success": False, "message": "Riot IDの形式が正しくありません (Name#Tag)。"}

        self.config["riot_id"] = riot_id
        self.config["gemini_key"] = gemini_key.strip()
        save_config(self.config)
        logger.info(f"💾 設定を保存しました。Riot ID: {riot_id}, Gemini Key: {'設定済' if gemini_key else '未設定'}")

        if self.config["unlocked"]:
            self.start_monitoring()
            return {"success": True, "message": "設定を保存し、自動監視を開始しました。"}
        return {"success": True, "message": "設定を保存しました（パスコードロック中）。"}

    def save_riot_id(self, riot_id):
        """Riot ID保存の互換用フォールバックメソッド"""
        return self.save_settings(riot_id, self.config.get("gemini_key", ""))

    def get_recent_stats(self):
        """非同期で最新戦績を取得するスレッドを起動して即座に終了する（フリーズ防止）"""
        riot_id = self.config["riot_id"]
        if not riot_id or "#" not in riot_id:
            return {"error": "Riot IDが設定されていません。"}
        
        # ワーカースレッドを起動して通信を別スレッドで処理
        threading.Thread(target=self._fetch_stats_worker, daemon=True).start()
        return {"status": "loading"}

    def _fetch_stats_worker(self):
        """別スレッドで重い通信処理を実行し、完了時にJSコールバックを呼ぶ"""
        riot_id = self.config["riot_id"]
        try:
            name, tag = riot_id.split("#")
            puuid = self._riot_get_puuid(name, tag)
            if not puuid:
                self._trigger_js_stats_failed("PUUIDを取得できませんでした。Riot IDを確認してください。")
                return
            
            match_ids = self._riot_get_recent_matches(puuid, count=5)
            if not match_ids:
                self._trigger_js_stats_failed("直近のランク戦（ソロキュー）履歴が見つかりませんでした。")
                return
            
            latest_match_id = match_ids[0]
            detail = self._riot_get_match_detail(latest_match_id)
            if not detail:
                self._trigger_js_stats_failed("最新試合の詳細を取得できませんでした。")
                return
            
            me = self._extract_participant_stats(detail, puuid)
            if not me:
                self._trigger_js_stats_failed("試合詳細から自分の戦績が見つかりませんでした。")
                return
            
            # 連敗数の計算
            losing_streak = 0
            for mid in match_ids:
                m_detail = self._riot_get_match_detail(mid)
                if m_detail:
                    p_stats = self._extract_participant_stats(m_detail, puuid)
                    if p_stats and not p_stats["win"]:
                        losing_streak += 1
                    else:
                        break
            
            result_data = {
                "success": True,
                "latest_match": {
                    "match_id": latest_match_id,
                    "win": me["win"],
                    "kills": me["kills"],
                    "deaths": me["deaths"],
                    "assists": me["assists"],
                    "champion_name": me["championName"],
                    "cs": me["totalMinionsKilled"] + me["neutralMinionsKilled"],
                    "duration_min": detail["info"]["gameDuration"] // 60
                },
                "losing_streak": losing_streak
            }
            
            # JS コールバックを実行して成功データを渡す
            js_code = f"if(window.onStatsLoaded) {{ window.onStatsLoaded({json.dumps(result_data)}); }}"
            self.window.evaluate_js(js_code)
            logger.info("✅ 最新戦績の非同期ロードが完了し、JSへ送信しました。")

        except Exception as e:
            logger.error(f"Error in stats worker: {e}")
            self._trigger_js_stats_failed(f"戦績取得中にエラーが発生しました: {str(e)}")

    def _trigger_js_stats_failed(self, error_msg):
        js_code = f"if(window.onStatsFailed) {{ window.onStatsFailed('{error_msg}'); }}"
        self.window.evaluate_js(js_code)

    # --- AI アドバイス ＆ 履歴管理 ＆ マッチアップ検索 API ---

    def get_ai_advice(self, deaths, win, anger, fatigue, team):
        """非同期でAIティルトアドバイスを生成するスレッドを起動（フリーズ防止）"""
        threading.Thread(
            target=self._generate_ai_advice_worker,
            args=(deaths, win, anger, fatigue, team),
            daemon=True
        ).start()
        return {"status": "loading"}

    def _generate_ai_advice_worker(self, deaths, win, anger, fatigue, team):
        """別スレッドで Gemini API を直接呼び出してアドバイスを生成"""
        # APIキーの選択 (ユーザー独自設定優先 ➔ 環境変数フォールバック)
        api_key = self.config.get("gemini_key") or os.getenv("GEMINI_API_KEY", "")
        if not api_key:
            js_code = "if(window.onAdviceFailed) { window.onAdviceFailed('Gemini API キーを設定画面から登録してください。'); }"
            self.window.evaluate_js(js_code)
            return

        result_str = "DEFEAT (敗北)" if not win else "VICTORY (勝利)"
        prompt = f"""あなたはLoLの非常に厳しくも的確な「ティルト防止プロコーチ（AI鬼コーチ）」です。
以下のプレイヤーの直前のランク戦データと現在の感情状態から、ティルトをリセットして次の試合で勝利を掴むための「100文字程度の冷徹かつ実戦的なアドバイス」を1文または2文で作成してください。

【データ】
結果: {result_str}
デス数: {deaths} デス
感情状態:
- イライラ・怒り度: {anger}/5
- 疲労度: {fatigue}/5
- 味方へのフラストレーション: {team}/5

【ルール】
- 「〜の調べ」「〜の舞」などのAI臭いポエミーな言葉は一切禁止。
- LoLの具体的なゲーム用語（ウェーブ管理、視界確保、デスの回避、マップ警戒、感情コントロールなど）を絡めてください。
- 厳しくも、次に勝つための具体的な行動を指示してください。
"""
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        post_data = {
            "contents": [{
                "parts": [{
                    "text": prompt
                }]
            }]
        }

        try:
            r = httpx.post(url, headers=headers, json=post_data, timeout=10)
            if r.status_code == 200:
                res_json = r.json()
                advice = res_json["candidates"][0]["content"]["parts"][0]["text"].strip()
                # JS 側にプッシュ
                js_code = f"if(window.onAdviceLoaded) {{ window.onAdviceLoaded({json.dumps(advice)}); }}"
                self.window.evaluate_js(js_code)
                logger.info("🤖 AIアドバイスの生成が完了し、JSへ送信しました。")
            else:
                logger.error(f"Gemini API Error: {r.status_code} - {r.text}")
                js_code = f"if(window.onAdviceFailed) {{ window.onAdviceFailed('Gemini API エラーが発生しました。キーが有効かご確認ください。'); }}"
                self.window.evaluate_js(js_code)
        except Exception as e:
            logger.error(f"Error generating AI advice: {e}")
            js_code = f"if(window.onAdviceFailed) {{ window.onAdviceFailed('AIアドバイス取得中に通信エラーが発生しました。'); }}"
            self.window.evaluate_js(js_code)

    def save_diagnosis_to_history(self, record):
        """診断履歴を config に保存する"""
        try:
            history = self.config.get("history", [])
            history.insert(0, record)
            # 最大50件に制限
            self.config["history"] = history[:50]
            save_config(self.config)
            logger.info("💾 診断結果を履歴に保存しました。")
            return {"success": True}
        except Exception as e:
            logger.error(f"Failed to save history: {e}")
            return {"success": False, "error": str(e)}

    def get_history(self):
        """履歴リストを取得"""
        return self.config.get("history", [])

    def _detect_enemy_jg_and_fetch_strategy(self, game_data, my_puuid):
        """試合開始データから敵のジャングルチャンピオンを検知し、対策メモをSupabaseから取得する"""
        participants = game_data.get("participants", [])
        my_champ_id = None
        my_team_id = None
        enemy_jg_champ_id = None
        
        # 自分の特定
        for p in participants:
            if p.get("puuid") == my_puuid:
                my_champ_id = p.get("championId")
                my_team_id = p.get("teamId")
                break
                
        if my_champ_id is None:
            return
            
        # 敵チームのジャングル（Smite=ID 11 持ち）を特定
        for p in participants:
            if p.get("teamId") != my_team_id:
                s1, s2 = p.get("spell1Id", 0), p.get("spell2Id", 0)
                if s1 == 11 or s2 == 11:
                    enemy_jg_champ_id = p.get("championId")
                    break
                    
        if not enemy_jg_champ_id:
            logger.warning("敵ジャングル（Smite持ち）を特定できませんでした。")
            return
            
        logger.info(f"Detected matchup: My Champ ID={my_champ_id} vs Enemy JG Champ ID={enemy_jg_champ_id}")
        
        # チャンピオンIDを名前に変換 (Data Dragon 動的取得)
        champ_map = self._get_champion_name_map()
        my_champ_name = champ_map.get(my_champ_id, "Unknown")
        enemy_champ_name = champ_map.get(enemy_jg_champ_id, "Unknown")
        
        logger.info(f"Translated matchup: {my_champ_name} vs {enemy_champ_name}")
        
        if my_champ_name == "Unknown" or enemy_champ_name == "Unknown":
            return
            
        # Supabase から対策メモを検索
        strategy = self._fetch_strategy_from_supabase(my_champ_name, enemy_champ_name)
        
        matchup_info = {
            "my_champ": my_champ_name,
            "enemy_champ": enemy_champ_name,
            "strategy": strategy or "このマッチアップに関する対策メモは未登録です。落ち着いてセーフプレイを心がけましょう。"
        }
        # フロントエンドにプッシュしてポップアップ表示させる
        js_code = f"if(window.onMatchupDetected) {{ window.onMatchupDetected({json.dumps(matchup_info)}); }}"
        self.window.evaluate_js(js_code)
        logger.info("⚔️ JG対策メモを検出し、フロントエンドへプッシュしました！")

    def _get_champion_name_map(self):
        """Data Dragon からチャンピオンのIDと名前のマッピングを動的取得"""
        try:
            r = httpx.get("https://ddragon.leagueoflegends.com/api/versions.json", timeout=5)
            version = r.json()[0]
            r = httpx.get(f"https://ddragon.leagueoflegends.com/cdn/{version}/data/ja_JP/champion.json", timeout=5)
            champs = r.json()["data"]
            # key（IDの文字列表記）から英語IDへのマップを作る（例: "120" -> "Hecarim"）
            return {int(data["key"]): name for name, data in champs.items()}
        except Exception as e:
            logger.error(f"Failed to fetch champ name map: {e}")
            return {}

    def _fetch_strategy_from_supabase(self, champion, enemy):
        """Supabaseから LeeSin vs Viego などの対策を検索（無ければGLOBAL）"""
        supabase_url = os.getenv("SUPABASE_URL", "")
        supabase_key = os.getenv("SUPABASE_KEY", "")
        if not supabase_url or not supabase_key:
            return None
            
        url = f"{supabase_url}/rest/v1/matchup_sentinel"
        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}"
        }
        
        # 1. 固有対面を検索
        params = {
            "champion": f"eq.{champion}",
            "enemy": f"eq.{enemy}",
            "select": "strategy"
        }
        try:
            r = httpx.get(url, headers=headers, params=params, timeout=5)
            if r.status_code == 200 and r.json():
                return r.json()[0].get("strategy")
            
            # 2. 固有がなければ GLOBAL 対策を検索
            params["enemy"] = "eq.GLOBAL"
            r = httpx.get(url, headers=headers, params=params, timeout=5)
            if r.status_code == 200 and r.json():
                return r.json()[0].get("strategy")
        except Exception as e:
            logger.error(f"Supabase fetch matchup error: {e}")
        return None

    # --- バックグラウンド監視スレッド ---

    def start_monitoring(self):
        if self.is_monitoring:
            return
        self.is_monitoring = True
        self.monitor_thread = threading.Thread(target=self._monitoring_loop, daemon=True)
        self.monitor_thread.start()
        logger.info("📡 自動試合監視スレッドを開始しました。")

    def _monitoring_loop(self):
        interval = self.config.get("check_interval", 120)
        riot_id = self.config["riot_id"]
        name, tag = riot_id.split("#")
        
        # PUUID を取得
        puuid = self._riot_get_puuid(name, tag)
        if not puuid:
            logger.error("🚫 監視用PUUIDの取得に失敗しました。2分後に再試行します。")
            time.sleep(120)
            self.is_monitoring = False
            self.start_monitoring()
            return

        # 初回の最新マッチIDを記録（起動直後の誤爆防止）
        try:
            match_ids = self._riot_get_recent_matches(puuid, count=1)
            if match_ids:
                self.last_match_id = match_ids[0]
        except Exception as e:
            logger.error(f"Failed to get initial match id: {e}")

        logger.info(f"👀 {riot_id} のソロキュー監視を開始します (現在の MatchID: {self.last_match_id})")

        while self.is_monitoring:
            try:
                # 試合中かどうか確認
                active_game = self._riot_check_active_game(puuid)
                
                if active_game:
                    if not self.in_game_flag:
                        logger.info("⚔️ 試合開始を検知しました (Active Game Detected)。")
                        self.in_game_flag = True
                        # 敵JG対策の自動検知＆表示をスレッドで並行実行
                        threading.Thread(
                            target=self._detect_enemy_jg_and_fetch_strategy,
                            args=(active_game, puuid),
                            daemon=True
                        ).start()
                else:
                    if self.in_game_flag:
                        logger.info("🏁 試合終了を検知しました。メンタルチェック画面をポップアップします。")
                        self.in_game_flag = False
                        self._trigger_popup()
                    else:
                        # 念のため、Spectator APIで試合中フラグが立たなかった場合も、Match IDの更新で試合終了を検知するフォールバック
                        matches = self._riot_get_recent_matches(puuid, count=1)
                        if matches and matches[0] != self.last_match_id:
                            logger.info(f"🏁 新しい試合が履歴に反映されました ({matches[0]} != {self.last_match_id})。ポップアップします。")
                            self.last_match_id = matches[0]
                            self._trigger_popup()
                            
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
            
            time.sleep(interval)

    def _trigger_popup(self):
        """アプリ画面を最前面にポップアップ表示し、フロントエンドに通知する"""
        logger.info("🚀 ポップアップトリガー起動！")
        # ウィンドウの表示と最前面化
        self.window.restore()
        self.window.show()
        # Windowsの最前面フォーカスのためのトリック
        self.window.focus()
        
        # フロントエンドに通知を送る
        self.window.evaluate_js("if(window.onMatchFinished) { window.onMatchFinished(); }")

    # --- Riot API ヘルパーメソッド ---

    def _riot_get(self, url):
        headers = {"X-Riot-Token": self.riot_key}
        try:
            r = httpx.get(url, headers=headers, timeout=5)
            if r.status_code == 200:
                return r.json()
            elif r.status_code == 429:
                wait_time = int(r.headers.get("Retry-After", 2))
                logger.warning(f"Riot API Rate Limit (429). Retry after {wait_time}s")
                time.sleep(wait_time)
                return self._riot_get(url)
            else:
                logger.debug(f"Riot API HTTP {r.status_code} for {url[:60]}...")
                return None
        except Exception as e:
            logger.error(f"Riot API Request Error: {e}")
            return None

    def _riot_get_puuid(self, name, tag):
        url = f"https://{self.region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{name}/{tag}"
        res = self._riot_get(url)
        return res.get("puuid") if res else None

    def _riot_check_active_game(self, puuid):
        url = f"https://{self.platform}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/{puuid}"
        headers = {"X-Riot-Token": self.riot_key}
        try:
            r = httpx.get(url, headers=headers, timeout=15)
            if r.status_code == 200:
                return r.json()
            return None
        except Exception as e:
            logger.error(f"Spectator API check error: {e}")
            return None

    def _riot_get_recent_matches(self, puuid, count=5):
        url = f"https://{self.region}.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids?type=ranked&start=0&count={count}"
        return self._riot_get(url) or []

    def _riot_get_match_detail(self, match_id):
        url = f"https://{self.region}.api.riotgames.com/lol/match/v5/matches/{match_id}"
        return self._riot_get(url)

    def _extract_participant_stats(self, match_detail, puuid):
        participants = match_detail.get("info", {}).get("participants", [])
        for p in participants:
            if p.get("puuid") == puuid:
                return p
        return None

def start_app():
    logger.info("🚀 Mental Checker Desktop Starting...")
    
    # pywebview ウィンドウの初期化
    ui_dir = Path(__file__).parent / "ui"
    html_path = ui_dir / "index.html"
    
    if not html_path.exists():
        logger.error(f"UI HTML file not found at: {html_path}")
        return

    # API インスタンスを先に作成
    api = MentalCheckerAPI()

    # ウィンドウの作成 (js_api 引数に渡す)
    window = webview.create_window(
        title="Sovereign Mind - LoL Mental Checker",
        url=str(html_path.resolve()),
        width=850,
        height=680,
        resizable=True,
        min_size=(600, 500),
        hidden=False,
        js_api=api
    )
    
    # APIにウィンドウインスタンスをセット
    api.window = window
    
    # 監視の開始
    if api.config["riot_id"] and api.config["unlocked"]:
        api.start_monitoring()
    
    # アプリの起動
    webview.start(debug=True)

if __name__ == "__main__":
    start_app()
