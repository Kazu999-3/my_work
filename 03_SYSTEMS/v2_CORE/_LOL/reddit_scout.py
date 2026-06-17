import os
import json
import time
import logging
import httpx
from datetime import datetime
from pathlib import Path
import dotenv

dotenv.load_dotenv(Path("d:/my_work/.env"))
from v2_CORE.logger_config import setup_sovereign_logging
logger = setup_sovereign_logging("RedditScout")

from v2_CORE.ai_helper import generate_content_safe
from v2_CORE._LOL.herald import herald
from google import genai

class RedditScout:
    def __init__(self):
        self.url = os.getenv("SUPABASE_URL")
        self.key = os.getenv("SUPABASE_KEY")
        self.gemini_key = os.getenv("GEMINI_API_KEY_FREE") or os.getenv("GEMINI_API_KEY")
        
        self.ready = bool(self.url and self.key and self.gemini_key)
        if not self.ready:
            logger.error("⚠️ 環境変数が不足しています。")
            
        if self.gemini_key:
            self.client = genai.Client(api_key=self.gemini_key)

        # Reddit はデフォルトの User-Agent をブロックするため、カスタムブラウザを模倣
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SovereignOS/1.0 (LoL Trend Scout)"
        }

    def _headers(self):
        return {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json"
        }

    def _api(self, table):
        return f"{self.url}/rest/v1/{table}"

    def fetch_reddit_trends(self, subreddit="summonerschool", limit=15):
        """Reddit の指定 subreddit の RSS フィードからホットな議論を収集"""
        rss_url = f"https://www.reddit.com/r/{subreddit}/hot.rss?limit={limit}"
        logger.info(f"🔍 Reddit r/{subreddit} RSSから最新スレッドを取得中...")
        
        try:
            res = httpx.get(rss_url, headers=self.headers, timeout=20)
            if res.status_code != 200:
                logger.error(f"❌ Reddit RSSエラー: {res.status_code}")
                return []
                
            import xml.etree.ElementTree as ET
            import html
            import re
            
            # Atom フィードのパース
            xml_data = res.text
            root = ET.fromstring(xml_data.encode('utf-8'))
            
            namespaces = {'atom': 'http://www.w3.org/2005/Atom'}
            entries = root.findall('atom:entry', namespaces)
            valid_posts = []
            
            # フィルタキーワード (LoLのゲームプレイ、ビルド、ルーンに関連するもの)
            match_keywords = ["build", "rune", "item", "patch", "meta", "champion", "jungle", "lane", "strong", "op", "nerf", "buff", "how to", "opinion"]
            
            for entry in entries[:limit]:
                title_elem = entry.find('atom:title', namespaces)
                link_elem = entry.find('atom:link', namespaces)
                content_elem = entry.find('atom:content', namespaces)
                
                title = title_elem.text if title_elem is not None else ""
                url = link_elem.attrib.get('href') if link_elem is not None else ""
                content_html = content_elem.text if content_elem is not None else ""
                
                # HTMLのデコードとタグ除去
                selftext = html.unescape(content_html)
                selftext = re.sub(r'<[^>]+>', ' ', selftext)
                selftext = re.sub(r'\s+', ' ', selftext).strip()
                
                title_lower = title.lower()
                selftext_lower = selftext.lower()
                
                # ゲームプレイに関係しそうな議論スレッドか判定
                matched = any(kw in title_lower for kw in match_keywords) or any(kw in selftext_lower[:500] for kw in match_keywords)
                if matched and len(selftext) > 100:
                    valid_posts.append({
                        "title": title,
                        "selftext": selftext,
                        "url": url,
                        "score": 100  # RSSにはスコア情報が明示的に入っていないためデフォルトの重み
                    })
                    
            logger.info(f"✅ 条件に合致する有用なスレッドを {len(valid_posts)} 件検出しました。")
            return valid_posts
            
        except Exception as e:
            logger.error(f"❌ Reddit RSSデータ取得・パース失敗: {e}")
            return []

    def analyze_trends(self, posts):
        """スレッドの議論からAIでトレンド分析記事を生成"""
        if not self.client or not posts:
            return None
            
        combined_text = ""
        for i, post in enumerate(posts):
            combined_text += f"### [スレッド {i+1}] {post['title']}\n"
            combined_text += f"URL: {post['url']}\n"
            combined_text += f"議論内容:\n{post['selftext'][:1500]}\n"  # 1件あたりのトークン制限
            combined_text += "\n---\n\n"

        date_str = datetime.now().strftime("%Y-%m-%d")
        prompt = f"""
        あなたはLoLの最上位プレイヤー（チャレンジャー／プロコーチ）です。
        以下のRedditスレッドにおけるコミュニティの議論（ビルド、ルーン、メタの流行）を読み込んで、日本語で綺麗に整理された高度な戦略トレンド解説（Markdown形式）を作成してください。
        
        【作成要件】
        - 雑談や個人の愚痴は省き、現在どのチャンピオン、アイテム、ルーンが評価されているか（または低評価か）を客観的・実践的に記述してください。
        - 全て日本語で出力してください。
        - フォーマットは以下の通り整理してください：
        ### 📌 Redditトレンド概要 ({date_str})
        （現在コミュニティで最もホットな話題やパッチの評価）
        
        ### 🧠 推奨されるビルド・ルーン・メタ戦略
        （議論されている主要ビルドの具体的な強みと適用レーン）
        
        ### ⚔️ コミュニティの評価・分析
        （勝率データとの相関や、なぜそのビルドが強いか/弱いかの論理的分析）
        
        ### 💡 対策・注意点
        （その戦略のカウンターや、使用時の罠・警戒すべきこと）
        
        【Reddit議論テキスト】
        {combined_text}
        """

        logger.info("🤖 Gemini API を用いてトレンドのAI要約を生成中...")
        try:
            # 記事生成のため oracle フィーチャーのクォータを消費
            response_text = generate_content_safe(
                self.client,
                prompt,
                model_id="gemini-2.5-pro",  # 高度な要約マージのためProを優先
                feature_name="oracle"
            )
            return response_text
        except Exception as e:
            logger.error(f"❌ トレンド分析生成エラー: {e}")
            return None

    def run_scout(self):
        if not self.ready:
            return
            
        # r/summonerschool と r/leagueoflegends から収集
        posts = []
        posts.extend(self.fetch_reddit_trends("summonerschool", limit=10))
        posts.extend(self.fetch_reddit_trends("leagueoflegends", limit=10))
        
        # 重複排除
        seen_urls = set()
        unique_posts = []
        for p in posts:
            if p["url"] not in seen_urls:
                seen_urls.add(p["url"])
                unique_posts.append(p)
                
        if not unique_posts:
            logger.info("ℹ️ 分析対象の有益なスレッドが見つかりませんでした。")
            return
            
        # スコア順にソートして最大 5 件を抽出（多すぎるとコンテキスト超過や429になるため）
        unique_posts = sorted(unique_posts, key=lambda x: x["score"], reverse=True)[:5]
        
        analysis = self.analyze_trends(unique_posts)
        if not analysis or analysis.startswith("⚠️") or analysis.startswith("❌"):
            logger.error("❌ トレンドのAI要約生成に失敗しました。")
            return
            
        # 元スレッドのMarkdown絶対リンク一覧を構築して追記
        links_markdown = "\n\n---\n🔗 **元のRedditスレッドリンク:**\n"
        for p in unique_posts:
            url = p["url"]
            if url:
                if not url.startswith("http"):
                    # 相対パスの場合はドメインを補完
                    url = f"https://www.reddit.com{url}"
                links_markdown += f"- [{p['title']}]({url})\n"
                
        analysis_with_links = analysis + links_markdown
            
        # Supabase およびローカルへ保存
        date_str = datetime.now().strftime("%Y-%m-%d")
        title = f"[Redditトレンド] {date_str} のメタ分析"
        file_path = f"d:\\my_work\\02_FACTORY\\bible\\kirei_bible\\reddit_trend_{date_str.replace('-', '')}.md"
        
        payload = {
            "title": title,
            "content": analysis_with_links,
            "champion": "Unknown",
            "keywords": ["Reddit", "トレンド"],
            "file_path": file_path
        }
        
        # 保存先ディレクトリの作成
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        # Supabase へ POST (同一タイトルがある場合は UPSERT で上書き保存)
        headers = self._headers()
        headers["Prefer"] = "resolution=merge-duplicates"
        res = httpx.post(
            self._api("bible_articles") + "?on_conflict=title",
            headers=headers,
            json=payload,
            timeout=15
        )
        
        if res.status_code in (200, 201, 204):
            logger.info(f"✅ 「{title}」の攻略記事をSupabaseに保存しました！")
            try:
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(analysis_with_links)
                logger.info(f"💾 ローカルファイルに保存完了: {file_path}")
            except Exception as e:
                logger.error(f"❌ ローカルファイル保存エラー: {e}")
                
            herald.notify_progress(
                f"📰 **【Reddit Scout】** 海外コミュニティから最新のメタ・ビルドトレンドを自律検出しました！\n"
                f"- 記事タイトル: **{title}**\n"
                f"- 収集元: r/summonerschool, r/leagueoflegends\n"
                f"*(※ この後、Dict Synthesizerによって「総合バイブル(マクロ)」等へ自動でマージされます)*"
            )
        else:
            logger.error(f"❌ トレンド記事のDB保存失敗: {res.status_code} {res.text}")

if __name__ == "__main__":
    scout = RedditScout()
    scout.run_scout()
