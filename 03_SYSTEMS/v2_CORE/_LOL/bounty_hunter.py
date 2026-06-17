import logging
import requests
from bs4 import BeautifulSoup
from v2_CORE.settings import settings
import urllib.parse

logger = logging.getLogger("BountyHunter")

class BountyHunter:
    """
    【市場破壊】競合狩りモジュール
    note.com等から特定の高額（または有料）記事を抽出し、その上位互換記事を生成するための
    「Bounty（賞金首）」リストを返す。
    """
    def __init__(self):
        pass

    def scout_competitors(self, keyword="LoL 有料 パッチ"):
        """
        競合のnote記事を検索し、タイトルやURLのリストを返す。
        （※注：高度なスクレイピング対策があるため、ここでは簡易的な検索結果の取得を行う）
        """
        logger.info(f"🔍 競合狩りを開始します: キーワード '{keyword}'")
        encoded_kw = urllib.parse.quote(keyword)
        url = f"https://note.com/search?q={encoded_kw}&context=note&sort=popular"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
        
        try:
            r = requests.get(url, headers=headers)
            if not r.ok:
                logger.error(f"Scout failed: HTTP {r.status_code}")
                return []
                
            soup = BeautifulSoup(r.text, "html.parser")
            # noteの記事カードは aタグ等でラップされている
            # 実際の構造に合わせて調整が必要だが、ここではモック的な取得ロジック
            results = []
            for item in soup.find_all("a", href=True):
                if "/n/" in item["href"]:  # 記事URLのパターン
                    title = item.get_text(strip=True)
                    if title and len(title) > 10:
                        results.append({
                            "title": title,
                            "url": "https://note.com" + item["href"] if item["href"].startswith("/") else item["href"]
                        })
            
            # 重複排除とフィルタリング
            unique_results = []
            seen = set()
            for res in results:
                if res["url"] not in seen and ("LoL" in res["title"] or "パッチ" in res["title"] or "Tier" in res["title"]):
                    seen.add(res["url"])
                    unique_results.append(res)
                    
            if unique_results:
                logger.info(f"🎯 {len(unique_results)}件の賞金首（競合記事）を発見しました！")
                for r in unique_results[:3]:
                    logger.info(f" - {r['title']} ({r['url']})")
                    
            return unique_results[:3] # 上位3件をターゲットとする
            
        except Exception as e:
            logger.error(f"Error while scouting competitors: {e}")
            return []

    def generate_crushing_prompt(self, competitor_title: str):
        """
        発見した競合記事のタイトルを元に、それを完全に無価値にするための指示プロンプトを生成する。
        """
        prompt = f"""
        【Bounty Hunter 起動：競合狩りモード】
        現在、競合他者が以下のタイトルで有料記事を販売（または集客）しています。
        ターゲット: 「{competitor_title}」
        
        【指示】
        この競合記事の情報を完全に包括し、かつ「より深く、より実戦的で、より文字数が多い」上位互換の攻略バイブルを生成してください。
        読者が「あの有料記事を買わなくてよかった。こっちの（無料/500円の）記事の方が圧倒的に質が高い」と確信するように、
        緻密な数値データ（ダメージトレードの目安等）やミクロのコツをあえて過剰なまでに詳細に記述してください。
        """
        return prompt

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    hunter = BountyHunter()
    bounties = hunter.scout_competitors()
    if bounties:
        print(hunter.generate_crushing_prompt(bounties[0]['title']))
