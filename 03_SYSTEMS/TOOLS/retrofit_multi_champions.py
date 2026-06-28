"""
retrofit_multi_champions.py
============================
既存の kirei_bible .md ファイルをスキャンし、
コンテンツ内に複数チャンピオン名が含まれている場合に
[Champion: X] タグを [Champions: X, Y, Z] に更新する。

実行: python -m 03_SYSTEMS.TOOLS.retrofit_multi_champions
  または直接: python d:/my_work/03_SYSTEMS/TOOLS/retrofit_multi_champions.py
"""
import os
import re
import sys
import logging

sys.path.insert(0, "d:/my_work/03_SYSTEMS")
from v2_CORE.settings import settings

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# ============================================================
# LoL 全チャンピオン名リスト（英語正式名）
# ============================================================
ALL_CHAMPIONS = [
    "Aatrox", "Ahri", "Akali", "Akshan", "Alistar", "Ambessa", "Amumu", "Anivia",
    "Annie", "Aphelios", "Ashe", "AurelionSol", "Aurora", "Azir", "Bard", "BelVeth",
    "Blitzcrank", "Brand", "Braum", "Briar", "Caitlyn", "Camille", "Cassiopeia",
    "ChoGath", "Corki", "Darius", "Diana", "DrMundo", "Draven", "Ekko", "Elise",
    "Evelynn", "Ezreal", "Fiddlesticks", "Fiora", "Fizz", "Galio", "Gangplank",
    "Garen", "Gnar", "Gragas", "Graves", "Gwen", "Hecarim", "Heimerdinger", "Hwei",
    "Illaoi", "Irelia", "Ivern", "Janna", "JarvanIV", "Jax", "Jayce", "Jhin",
    "Jinx", "KSante", "KaiSa", "Kalista", "Karma", "Karthus", "Kassadin", "Katarina",
    "Kayle", "Kayn", "Kennen", "KhaZix", "Kindred", "Kled", "KogMaw", "LeBlanc",
    "LeeSin", "Leona", "Lillia", "Lissandra", "Lucian", "Lulu", "Lux", "Malphite",
    "Malzahar", "Maokai", "MasterYi", "Milio", "MissFortune", "MonkeyKing", "Mordekaiser",
    "Morgana", "Naafiri", "Nami", "Nasus", "Nautilus", "Neeko", "Nidalee", "Nilah",
    "Nocturne", "Nunu", "Olaf", "Orianna", "Ornn", "Pantheon", "Poppy", "Pyke",
    "Qiyana", "Quinn", "Rakan", "Rammus", "RekSai", "Rell", "Renata", "Renekton",
    "Rengar", "Riven", "Rumble", "Ryze", "Samira", "Sejuani", "Senna", "Seraphine",
    "Sett", "Shaco", "Shen", "Shyvana", "Singed", "Sion", "Sivir", "Skarner",
    "Smolder", "Sona", "Soraka", "Swain", "Sylas", "Syndra", "TahmKench", "Taliyah",
    "Talon", "Taric", "Teemo", "Thresh", "Tristana", "Trundle", "Tryndamere",
    "TwistedFate", "Twitch", "Udyr", "Urgot", "Varus", "Vayne", "Veigar", "VelKoz",
    "Vex", "Vi", "Viego", "Viktor", "Vladimir", "Volibear", "Warwick", "Wukong",
    "Xayah", "Xerath", "XinZhao", "Yasuo", "Yone", "Yorick", "Yuumi", "Zac",
    "Zed", "Zeri", "Ziggs", "Zilean", "Zoe", "Zyra",
    # 日本語表記エイリアス（よく記事に出てくる表記）
    "ノクターン", "ヴァイ", "ウォーウィック", "アムム", "リリア",
    "ジャーバンⅣ", "ジャーバン4", "モンキーキング", "悟空",
]

# 日本語名→英語名マッピング（タグ書き込み用）
JP_TO_EN = {
    "ノクターン": "Nocturne", "ヴァイ": "Vi", "ウォーウィック": "Warwick",
    "アムム": "Amumu", "リリア": "Lillia", "ジャーバンⅣ": "JarvanIV",
    "ジャーバン4": "JarvanIV", "モンキーキング": "MonkeyKing", "悟空": "MonkeyKing",
}

# 誤検知しやすい汎用単語を除外
EXCLUDE = {"Unknown", "Brand", "Vi"}  # Viは文章中の "vi" と混同しやすいので要注意
# ※ Brand/Vi は短いので誤検知リスク有り。本スクリプトでは明示的タグのみを信頼する

# ============================================================
# チャンピオン名検出ロジック
# ============================================================
def find_champions_in_text(text: str) -> list[str]:
    """テキスト内に登場するチャンピオン名を全て抽出（英語名で返す）"""
    found = set()
    for champ in ALL_CHAMPIONS:
        en_name = JP_TO_EN.get(champ, champ)
        # 単語境界でマッチ（例: "Viegar" が "Vi" にマッチしないよう）
        pattern = r'\b' + re.escape(champ) + r'\b'
        if re.search(pattern, text, re.IGNORECASE):
            found.add(en_name)
    return sorted(found)


def get_current_tag(content: str):
    """現在の [Champion: X] または [Champions: X, Y] タグを取得"""
    m = re.search(r'\[Champions?:\s*([^\]]+)\]', content)
    if m:
        raw = m.group(1).strip()
        names = [n.strip() for n in raw.split(",") if n.strip()]
        return names
    return []


def update_champion_tag(content: str, new_champions: list[str]) -> str:
    """コンテンツ内の Champion タグを新しいリストで置き換える"""
    if len(new_champions) == 1:
        new_tag = f"[Champion: {new_champions[0]}]"
    else:
        new_tag = f"[Champions: {', '.join(new_champions)}]"

    # 既存タグを置換
    updated = re.sub(r'\[Champions?:\s*[^\]]+\]', new_tag, content, count=1)
    return updated


# ============================================================
# メイン処理
# ============================================================
def main():
    bible_dir = os.path.join(str(settings.ROOT_DIR), "02_FACTORY", "bible", "kirei_bible")
    files = [f for f in os.listdir(bible_dir) if f.endswith(".md")]
    logger.info(f"📂 対象ファイル数: {len(files)}")

    updated_count = 0
    skipped_count = 0
    no_change_count = 0

    for fname in sorted(files):
        fpath = os.path.join(bible_dir, fname)
        try:
            content = open(fpath, encoding="utf-8").read()
        except Exception as e:
            logger.warning(f"  ⚠️ 読み込みエラー {fname}: {e}")
            continue

        current_tags = get_current_tag(content)

        # タグなし or Unknown → 本文からチャンピオン名を検出
        if not current_tags or (len(current_tags) == 1 and current_tags[0].lower() == "unknown"):
            detected = find_champions_in_text(content)
            if len(detected) >= 2:
                new_content = update_champion_tag(content, detected)
                open(fpath, "w", encoding="utf-8").write(new_content)
                logger.info(f"  ✅ {fname}: Unknown → {detected}")
                updated_count += 1
            elif len(detected) == 1:
                new_content = update_champion_tag(content, detected)
                open(fpath, "w", encoding="utf-8").write(new_content)
                logger.info(f"  🔄 {fname}: Unknown → [{detected[0]}]")
                updated_count += 1
            else:
                no_change_count += 1

        # 単体タグ → 本文に他のチャンピオンがいないか確認
        elif len(current_tags) == 1:
            detected = find_champions_in_text(content)
            # 現在のチャンピオン + 追加の2体以上言及がある場合のみ更新
            extra = [c for c in detected if c != current_tags[0]]
            if len(extra) >= 2:
                all_champs = list(dict.fromkeys([current_tags[0]] + extra))  # 順序保持・重複除去
                new_content = update_champion_tag(content, all_champs)
                open(fpath, "w", encoding="utf-8").write(new_content)
                logger.info(f"  ✅ {fname}: [{current_tags[0]}] → {all_champs}")
                updated_count += 1
            elif len(extra) == 1:
                all_champs = [current_tags[0], extra[0]]
                new_content = update_champion_tag(content, all_champs)
                open(fpath, "w", encoding="utf-8").write(new_content)
                logger.info(f"  ✅ {fname}: [{current_tags[0]}] → {all_champs}")
                updated_count += 1
            else:
                no_change_count += 1

        # 既に複数タグ → スキップ
        else:
            skipped_count += 1

    logger.info(f"\n📊 結果: 更新={updated_count}件 / 変更なし={no_change_count}件 / スキップ(既に複数)={skipped_count}件")
    logger.info("✅ 完了！次回の sovereign_sync 実行時に全チャンピオン辞典へ反映されます。")


if __name__ == "__main__":
    main()
