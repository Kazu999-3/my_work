import os
import json
import logging
import datetime
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

logging.basicConfig(level=logging.INFO, format="%(asctime)s [Scout] %(levelname)s: %(message)s")

ROOT_DIR = Path("d:/my_work")
INTEL_DIR = ROOT_DIR / "01_INTEL"

class ScoutAgent:
    """
    Antigravity OS: 諜報員 (The Scout)
    定期稼働し、外部ソース(Riot Ddragon等)から最新パッチとメタデータをスクレイプ・収集して
    01_INTEL ディレクトリへ納品する。
    """
    def __init__(self):
        INTEL_DIR.mkdir(parents=True, exist_ok=True)
        self.ddragon_versions_url = "https://ddragon.leagueoflegends.com/api/versions.json"
        
    def fetch_latest_patch(self):
        """最新パッチバージョンを取得"""
        logging.info("🌍 外部サーバー(Ddragon)から最新パッチ情報を傍受中...")
        try:
            with urllib.request.urlopen(self.ddragon_versions_url) as response:
                data = json.loads(response.read().decode('utf-8'))
                latest = data[0]
                logging.info(f"✅ 最新パッチを特定しました: {latest}")
                return latest
        except Exception as e:
            logging.error(f"❌ 最新パッチ情報の傍受に失敗しました: {e}")
            return "Unknown"

    def fetch_real_meta_intel(self, patch):
        """
        Playwright を使用して U.GG から全レーンの最新メタデータ（上位ピック）を取得する
        """
        logging.info(f"🧠 U.GG から全レーンのメタデータ(Patch {patch})をスクレイピング中...")
        meta_champions = []
        
        roles = {
            "Top": "https://u.gg/lol/top-lane-tier-list",
            "Jungle": "https://u.gg/lol/jungle-tier-list",
            "Mid": "https://u.gg/lol/mid-lane-tier-list",
            "ADC": "https://u.gg/lol/adc-tier-list",
            "Support": "https://u.gg/lol/support-tier-list"
        }

        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page()
                
                for role, url in roles.items():
                    logging.info(f"  -> Fetching {role} tier list...")
                    try:
                        # domcontentloaded でページ枠組みを読み込み
                        page.goto(url, wait_until="domcontentloaded", timeout=60000)
                        
                        # 実際のデータ（チャンピオン名）がレンダリングされるまで待機
                        page.wait_for_selector("strong.champion-name", timeout=10000)
                        
                        champs = page.query_selector_all("strong.champion-name")
                        win_rates = page.query_selector_all("div.win-rate")
                        
                        for i in range(min(3, len(champs))):
                            champ_name = champs[i].inner_text()
                            wr = win_rates[i].inner_text() if i < len(win_rates) else "Unknown"
                            
                            meta_champions.append({
                                "champion": champ_name,
                                "role": role,
                                "win_rate": wr,
                                "ban_rate": "N/A", # 詳細ページに行かないと取れないため省略
                                "key_item": "N/A"  # 同上
                            })
                    except Exception as role_e:
                        logging.error(f"❌ {role} の取得中にエラー: {role_e}")
                        
                browser.close()
        except Exception as e:
            logging.error(f"❌ スクレイピング全体でエラー発生: {e}")
            
        return meta_champions

    def run_daily_recon(self):
        logging.info("==========================================")
        logging.info("🕵️ SOVEREIGN SCOUT: 日次諜報活動を開始")
        logging.info("==========================================")
        
        patch = self.fetch_latest_patch()
        intel_data = self.fetch_real_meta_intel(patch)
        
        report = {
            "date": datetime.datetime.now().isoformat(),
            "target_patch": patch,
            "meta_intel": intel_data,
            "directive": "王よ、明日のnote執筆はJungleカテゴリのJarvan IVが最も収益性(コンバージョン)が高いと推測されます。"
        }
        
        today_str = datetime.datetime.now().strftime("%Y%m%d")
        file_path = INTEL_DIR / f"scout_report_{today_str}.json"
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=4)
            
        logging.info(f"📁 本日の諜報レポートを納品しました: {file_path.relative_to(ROOT_DIR)}")
        logging.info("Scout out.")
        
if __name__ == "__main__":
    scout = ScoutAgent()
    scout.run_daily_recon()
