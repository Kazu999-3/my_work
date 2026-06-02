import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class SovereignSettings(BaseSettings):
    """
    Antigravity Sovereign OS v2.0: 統治環境設定 (Uniform Context)
    全ての絶対パスと環境変数をここで一元的に定義し、デグレードを防止する。
    """
    # 基本ルートパス (クロスプラットフォーム対応)
    ROOT_DIR: Path = Path(__file__).resolve().parent.parent.parent
    
    # 聖域の各部パス (Sovereign Rebuilt)
    THRONE_DIR: Path = ROOT_DIR 
    NEXUS_DIR: Path = ROOT_DIR / "01_INTEL"
    WORKSHOP_DIR: Path = ROOT_DIR / "02_ENGINE"
    FORGE_DIR: Path = ROOT_DIR / "03_FACTORY"
    CITADEL_DIR: Path = ROOT_DIR / "04_SKILLS"
    LOG_DIR: Path = ROOT_DIR / "00_LOGS"
    
    # 記憶とデータベース
    VAULT_DIR: Path = NEXUS_DIR / "vault"
    CHROMA_DB_DIR: Path = VAULT_DIR / "chroma"
    NEXUS_ARCHIVE_PATH: Path = VAULT_DIR / "NEXUS_ARCHIVE.json"
    
    # エージェント・インフラ
    LEGACY_AGENTS_DIR: Path = WORKSHOP_DIR / "agents"
    V2_CORE_DIR: Path = WORKSHOP_DIR / "v2_CORE"
    SCRIPTS_DIR: Path = WORKSHOP_DIR / "INFRA/scripts"
    
    # 環境変数 (.env から読み込み)
    GAS_DEPLOYMENT_URL: Optional[str] = None
    ANTIGRAVITY_API_KEY: Optional[str] = None
    DISCORD_WEBHOOK: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_API_KEY_FREE: Optional[str] = None
    DISCORD_BOT_TOKEN: Optional[str] = None
    KTM_GUILD_ID: str = "1485636149379858567"
    # 統治者 (ユーザー) 設定
    KING_RIOT_ID: str = "Kazurin#4036"
    RIOT_API_KEY: Optional[str] = None
    
    # PULSE: Lolalytics 監視設定
    WATCH_CHAMPIONS: list[str] = ["Nidalee", "Lillia", "Nocturne", "Zyra", "Jarvan IV"]
    LOLALYTICS_ENABLED: bool = True

    # モデル設定
    DEFAULT_MODEL: str = "gemini-2.5-flash"
    # OLE（動画解析）専用モデル: 無料枠の制限分散のため DEFAULT_MODEL とは別に設定
    # gemini-2.0-flash は gemini-2.5-flash より無料枠が広いため適している
    OLE_MODEL: str = "gemini-2.0-flash"
    
    # クォータ（1日あたりのAPI実行回数）制限: チャンピオン辞典（oracle）最優先モード
    DAILY_QUOTA_LIMITS: dict = {
        "kingdom_cycle": 20,   # 記事作成、リライト、SNSフック等の合計 (制限)
        "draft_analyzer": 10,  # ライブドラフトの分析 (制限)
        "news_scout": 5,       # 海外ニュースの翻訳・要約 (制限)
        "oracle": 150,         # 隠れメタの調査/チャンピオン辞典 (最優先・枠最大化)
        "video_forge": 5,      # 動画台本の作成 (制限)
        "bounty_hunter": 5,    # 競合noteのハンティング (制限)
        "magazine_forge": 2,   # マガジン生成 (制限)
        "bible_forge": 10,     # バイブルの生成 (制限)
        "x_analyzer": 10,      # Xのトレンド解析 (制限)
    }
    
    model_config = SettingsConfigDict(
        env_file=str(ROOT_DIR / ".env"),
        env_file_encoding='utf-8',
        extra='ignore'
    )

# グローバルな実行コンテキストの提供
settings = SovereignSettings()

def get_settings() -> SovereignSettings:
    return settings

if __name__ == "__main__":
    print(f"🏰 Sovereign Context Initialized at: {settings.ROOT_DIR}")
    print(f"🔮 Chroma DB Path: {settings.CHROMA_DB_DIR}")
    if settings.GAS_DEPLOYMENT_URL:
        print("✅ GAS Connectivity Configured.")
    else:
        print("⚠️ GAS_DEPLOYMENT_URL not found in .env")
