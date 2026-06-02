import logging
from google import genai
from google.genai import types
from .settings import settings
from v2_CORE.ai_helper import generate_content_safe
import requests
from bs4 import BeautifulSoup

logger = logging.getLogger("Oracle")

class SovereignOracle:
    """
    Antigravity Sovereign OS v2.0: 託宣者 (The Oracle)
    プロの対戦データや最新のトレンドから、まだ統計に現れていない「隠れたOP」を自律的に発掘する。
    """
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY_FREE or settings.GEMINI_API_KEY
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
            self.model_id = settings.DEFAULT_MODEL
        else:
            self.client = None

    def hunt_hidden_meta(self, champions):
        """指定されたチャンピオンの中から、プロが試行している独自のビルドやロールを調査する"""
        if not self.client:
            logger.warning("[Oracle] APIキーがないため調査をスキップします。")
            return []

        targets = []
        logger.info(f"[Oracle] プロの深層トレンドを調査中 (Model: {self.model_id}): {', '.join(champions)}")
        
        for champ in champions:
            # プロトレンドの兆候を判定するプロンプト
            prompt = f"""
            あなたは王国のオラクル（神託者）です。
            現在、{champ} に関してプロシーンで特定の特異なビルドや運用が試行されている兆候があります。
            
            これが「統計にはまだ現れていないが、プロが確信を持って使っている隠れた最強戦律」である可能性を評価し、
            解析が必要な場合は「FLAG」を立ててその理由を具体的に提示せよ。
            """
            
            try:
                response_text = generate_content_safe(
                    self.client,
                    prompt,
                    self.model_id,
                    feature_name="oracle"
                )
                if response_text and "FLAG" in response_text:
                    logger.warning(f"🔮 [Oracle] {champ} に深層トレンドを検知！解析を推奨します。")
                    targets.append({"champion": champ, "reason": response_text})
            except Exception as e:
                err_str = str(e)
                if any(kw in err_str for kw in ["429", "503", "quota", "RESOURCE_EXHAUSTED"]):
                    logger.warning(f"[Oracle] {champ} の調査中に一時的なAPI制限を検知しました (スキップ): {e}")
                else:
                    logger.error(f"[Oracle] {champ} の調査中にエラー: {e}")
        
        return targets

    def analyze_patch_impact(self, patch_version):
        """最新パッチのアイテム・ルーン変更をWeb検索し、メタに浮上するチャンピオンを推測する"""
        if not self.client:
            logger.warning("[Oracle] APIキーがないためパッチ影響調査をスキップします。")
            return []
            
        logger.info(f"🔮 [Oracle] パッチ {patch_version} のアイテム・ルーン変更から次期メタを先読み中 (Model: gemini-2.5-flash)...")
        
        prompt = f"""
        League of Legends の パッチ {patch_version} のパッチノート（特にアイテムやルーンの変更部分）を最新のWeb検索を用いて調査してください。
        その変更内容から、最も大きな恩恵を受ける（OPになり得る、またはメタに浮上する）チャンピオンを最大3体推測し、
        以下のJSONフォーマット（配列のみ）で出力してください。Markdownのバッククォート(```json)は付けないでください。
        
        [
          {{"champion": "チャンピオン名", "role": "想定ロール", "reason": "アイテムXがバフされたため相性が良い", "win_rate": "NEW META", "ban_rate": "N/A", "key_item": "該当アイテム/ルーン"}}
        ]
        """
        
        try:
            # 最新のWeb検索を行うために gemini-2.5-flash と Grounding を使用
            response_text = generate_content_safe(
                self.client,
                prompt,
                "gemini-2.5-flash",
                config=types.GenerateContentConfig(
                    tools=[{"google_search": {}}],
                    temperature=0.4
                ),
                feature_name="oracle"
            )
            
            import json
            import re
            
            # JSON部分の抽出とパース
            text = response_text
            match = re.search(r'\[.*\]', text, re.DOTALL)
            if match:
                json_str = match.group(0)
                meta_candidates = json.loads(json_str)
                logger.info(f"✅ [Oracle] パッチ先読みから {len(meta_candidates)} 体の次期メタ候補を発見しました。")
                return meta_candidates
            else:
                logger.warning("[Oracle] パッチ影響調査の出力が想定されたJSON形式ではありませんでした。")
                return []
                
        except Exception as e:
            err_str = str(e)
            if any(kw in err_str for kw in ["429", "503", "quota", "RESOURCE_EXHAUSTED"]):
                logger.warning(f"⚠️ [Oracle] クォータ制限または一時的なエラーによりパッチ影響調査をスキップします: {e}")
            else:
                logger.error(f"❌ [Oracle] パッチ影響調査中にエラー: {e}")
            return []

# インスタンス提供
oracle = SovereignOracle()

def get_oracle() -> SovereignOracle:
    return oracle
