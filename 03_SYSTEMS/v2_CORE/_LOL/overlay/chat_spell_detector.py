"""
Sovereign HUD - チャット・スペル自動検知エンジン (Chat Spell Detector v2.0)
====================================================================
ゲーム内チャットに出現するシステムメッセージおよびプレイヤーチャット
（例: 「ダリウスがフラッシュを使用」「Darius: Flash」「Darius - R」「mid tp」「Zed no f」）
を高速かつ網羅的に解析し、該当チャンピオンのサモスペ・Ultタイマーを自動始動させる。
"""

import re
from typing import Optional, Tuple, Dict

class ChatSpellDetector:
    # スペル種別の判定正規表現パターン
    SPELL_PATTERNS: Dict[str, list] = {
        "FLASH": [r"\bflash\b", r"フラッシュ", r"\bf\b", r"\bno\s*f\b", r"\bf\s*used\b"],
        "ULT": [r"\br\b", r"\bult\b", r"アルティメット", r"ウルト", r"\bno\s*r\b", r"\br\s*used\b"],
        "TELEPORT": [r"\btp\b", r"\bteleport\b", r"テレポ", r"テレポート"],
        "IGNITE": [r"\bignite\b", r"\bign\b", r"イグナイト", r"イグ"],
        "GHOST": [r"\bghost\b", r"ゴースト"],
        "HEAL": [r"\bheal\b", r"ヒール"],
        "BARRIER": [r"\bbarrier\b", r"バリア"],
        "CLEANSE": [r"\bcleanse\b", r"クレンズ"],
        "EXHAUST": [r"\bexhaust\b", r"\bexh\b", r"イグゾースト", r"イグゾ"],
        "SMITE": [r"\bsmite\b", r"スマイト"],
    }

    # 代表的なチャンピオンの日本語・英語別名マッピング
    CHAMPION_ALIASES: Dict[str, str] = {
        "aatrox": "Aatrox", "エイトロックス": "Aatrox", "エイト": "Aatrox",
        "ahri": "Ahri", "アーリ": "Ahri",
        "akali": "Akali", "アカリ": "Akali",
        "akshan": "Akshan", "アクシャン": "Akshan",
        "alistar": "Alistar", "アリスター": "Alistar", "牛": "Alistar",
        "ambessa": "Ambessa", "アンベッサ": "Ambessa",
        "amumu": "Amumu", "アムム": "Amumu",
        "anivia": "Anivia", "アニビア": "Anivia", "鳥": "Anivia",
        "annie": "Annie", "アニー": "Annie",
        "aphelios": "Aphelios", "アフェリオス": "Aphelios", "アフェ": "Aphelios",
        "ashe": "Ashe", "アッシュ": "Ashe",
        "aurelionsol": "AurelionSol", "オレリオンソル": "AurelionSol", "ソル": "AurelionSol", "asol": "AurelionSol",
        "aurora": "Aurora", "オーロラ": "Aurora",
        "azir": "Azir", "アジール": "Azir",
        "bard": "Bard", "バード": "Bard",
        "belveth": "Belveth", "ベルヴェス": "Belveth",
        "blitzcrank": "Blitzcrank", "ブリッツクランク": "Blitzcrank", "ブリッツ": "Blitzcrank", "ロボ": "Blitzcrank",
        "brand": "Brand", "ブランド": "Brand",
        "braum": "Braum", "ブラウム": "Braum",
        "briar": "Briar", "ブライアー": "Briar",
        "caitlyn": "Caitlyn", "ケイトリン": "Caitlyn", "ケイト": "Caitlyn",
        "camille": "Camille", "カミール": "Camille",
        "cassiopeia": "Cassiopeia", "カシオペア": "Cassiopeia", "蛇": "Cassiopeia",
        "chogath": "ChoGath", "チョガス": "ChoGath",
        "corki": "Corki", "コーキ": "Corki",
        "darius": "Darius", "ダリウス": "Darius",
        "diana": "Diana", "ダイアナ": "Diana",
        "drmundo": "DrMundo", "ムンド": "DrMundo", "ドクタームンド": "DrMundo",
        "draven": "Draven", "ドレイヴン": "Draven",
        "ekko": "Ekko", "エッコ": "Ekko",
        "elise": "Elise", "エリス": "Elise", "蜘蛛": "Elise",
        "evelynn": "Evelynn", "イブリン": "Evelynn",
        "ezreal": "Ezreal", "エズリアル": "Ezreal", "エズ": "Ezreal",
        "fiddlesticks": "Fiddlesticks", "フィドルスティックス": "Fiddlesticks", "フィドル": "Fiddlesticks",
        "fiora": "Fiora", "フィオラ": "Fiora",
        "fizz": "Fizz", "フィズ": "Fizz", "魚": "Fizz",
        "galio": "Galio", "ガリオ": "Galio",
        "gangplank": "Gangplank", "ガングプランク": "Gangplank", "gp": "Gangplank", "船長": "Gangplank",
        "garen": "Garen", "ガレン": "Garen",
        "gnar": "Gnar", "ナー": "Gnar",
        "gragas": "Gragas", "グラガス": "Gragas", "酒": "Gragas",
        "graves": "Graves", "グレイブス": "Graves",
        "gwen": "Gwen", "グウェン": "Gwen",
        "hecarim": "Hecarim", "ヘカリム": "Hecarim", "馬": "Hecarim",
        "heimerdinger": "Heimerdinger", "ハイマーディンガー": "Heimerdinger", "ハイマー": "Heimerdinger",
        "hwei": "Hwei", "フェイ": "Hwei",
        "illaoi": "Illaoi", "イラオイ": "Illaoi", "触手": "Illaoi",
        "irelia": "Irelia", "イレリア": "Irelia",
        "ivern": "Ivern", "アイバーン": "Ivern", "木": "Ivern",
        "janna": "Janna", "ジャンナ": "Janna",
        "jarvaniv": "JarvanIV", "ジャーヴァンiv": "JarvanIV", "ジャーヴァン": "JarvanIV", "j4": "JarvanIV",
        "jax": "Jax", "ジャックス": "Jax",
        "jayce": "Jayce", "ジェイス": "Jayce",
        "jhin": "Jhin", "ジン": "Jhin",
        "jinx": "Jinx", "ジンクス": "Jinx",
        "kaisa": "Kaisa", "カイサ": "Kaisa",
        "kalista": "Kalista", "カリスタ": "Kalista",
        "karma": "Karma", "カルマ": "Karma",
        "karthus": "Karthus", "カーサス": "Karthus",
        "kassadin": "Kassadin", "カサディン": "Kassadin",
        "katarina": "Katarina", "カタリーナ": "Katarina", "カタ": "Katarina",
        "kayle": "Kayle", "ケイル": "Kayle",
        "kayn": "Kayn", "ケイン": "Kayn",
        "kennen": "Kennen", "ケネン": "Kennen",
        "khazix": "KhaZix", "カジックス": "KhaZix", "カジ": "KhaZix",
        "kindred": "Kindred", "キンドレッド": "Kindred", "羊": "Kindred",
        "kled": "Kled", "クレッド": "Kled",
        "kogmaw": "KogMaw", "コグマウ": "KogMaw", "コグ": "KogMaw",
        "ksante": "KSante", "カサンテ": "KSante",
        "leblanc": "LeBlanc", "ルブラン": "LeBlanc",
        "leesin": "LeeSin", "リーシン": "LeeSin", "リー": "LeeSin",
        "leona": "Leona", "レオナ": "Leona",
        "lillia": "Lillia", "リリア": "Lillia", "鹿": "Lillia",
        "lissandra": "Lissandra", "リサンドラ": "Lissandra",
        "lucian": "Lucian", "ルシアン": "Lucian",
        "lulu": "Lulu", "ルル": "Lulu",
        "lux": "Lux", "ラックス": "Lux",
        "malphite": "Malphite", "マルファイト": "Malphite", "岩": "Malphite",
        "malzahar": "Malzahar", "マルザハール": "Malzahar", "マルザ": "Malzahar",
        "maokai": "Maokai", "マオカイ": "Maokai",
        "masteryi": "MasterYi", "マスターイー": "MasterYi", "yi": "MasterYi", "イー": "MasterYi",
        "milio": "Milio", "ミリオ": "Milio",
        "missfortune": "MissFortune", "ミスフォーチュン": "MissFortune", "mf": "MissFortune",
        "mordekaiser": "Mordekaiser", "モルデカイザー": "Mordekaiser", "モルデ": "Mordekaiser",
        "morgana": "Morgana", "モルガナ": "Morgana",
        "naafiri": "Naafiri", "ナフィーリ": "Naafiri", "犬": "Naafiri",
        "nami": "Nami", "ナミ": "Nami",
        "nasus": "Nasus", "ナサス": "Nasus",
        "nautilus": "Nautilus", "ノーチラス": "Nautilus", "ノーチ": "Nautilus",
        "neeko": "Neeko", "ニーコ": "Neeko",
        "nidalee": "Nidalee", "ニダリー": "Nidalee", "猫": "Nidalee",
        "nilah": "Nilah", "ニーラ": "Nilah",
        "nocturne": "Nocturne", "ノクターン": "Nocturne", "ノク": "Nocturne",
        "nunu": "Nunu", "ヌヌ": "Nunu",
        "olaf": "Olaf", "オラフ": "Olaf",
        "orianna": "Orianna", "オリアナ": "Orianna",
        "ornn": "Ornn", "オーン": "Ornn",
        "pantheon": "Pantheon", "パンテオン": "Pantheon", "パンテ": "Pantheon",
        "poppy": "Poppy", "ポッピー": "Poppy",
        "pyke": "Pyke", "パイク": "Pyke",
        "qiyana": "Qiyana", "キヤナ": "Qiyana",
        "quinn": "Quinn", "クイン": "Quinn",
        "rakan": "Rakan", "ラカン": "Rakan",
        "rammus": "Rammus", "ラムス": "Rammus",
        "reksai": "RekSai", "レックサイ": "RekSai",
        "rell": "Rell", "レル": "Rell",
        "renataglasc": "RenataGlasc", "レナータスク": "RenataGlasc", "レナータ": "RenataGlasc",
        "renekton": "Renekton", "レネクトン": "Renekton", "ワニ": "Renekton",
        "rengar": "Rengar", "レンガー": "Rengar",
        "riven": "Riven", "リヴェン": "Riven",
        "rumble": "Rumble", "ランブル": "Rumble",
        "ryze": "Ryze", "ライズ": "Ryze",
        "samira": "Samira", "サミラ": "Samira",
        "sejuani": "Sejuani", "セジュアニ": "Sejuani", "豚": "Sejuani",
        "senna": "Senna", "セナ": "Senna",
        "seraphine": "Seraphine", "セラフィーン": "Seraphine",
        "sett": "Sett", "セト": "Sett",
        "shaco": "Shaco", "シャコ": "Shaco",
        "shen": "Shen", "シェン": "Shen",
        "shyvana": "Shyvana", "シヴァーナ": "Shyvana", "竜": "Shyvana",
        "singed": "Singed", "シンジド": "Singed", "ハゲ": "Singed",
        "sion": "Sion", "サイオン": "Sion",
        "sivir": "Sivir", "シヴィア": "Sivir",
        "skarner": "Skarner", "スカーナー": "Skarner", "蠍": "Skarner",
        "smolder": "Smolder", "スモルダー": "Smolder",
        "sona": "Sona", "ソナ": "Sona",
        "soraka": "Soraka", "ソラカ": "Soraka",
        "swain": "Swain", "スウェイン": "Swain",
        "sylas": "Sylas", "サイラス": "Sylas",
        "syndra": "Syndra", "シンドラ": "Syndra",
        "tahmkench": "TahmKench", "タムケンチ": "TahmKench", "ナマズ": "TahmKench",
        "taliyah": "Taliyah", "タリヤ": "Taliyah",
        "talon": "Talon", "タロン": "Talon",
        "taric": "Taric", "タリック": "Taric",
        "teemo": "Teemo", "ティーモ": "Teemo",
        "thresh": "Thresh", "スレッシュ": "Thresh",
        "tristana": "Tristana", "トリスターナ": "Tristana", "トリス": "Tristana",
        "trundle": "Trundle", "トランドル": "Trundle",
        "tryndamere": "Tryndamere", "トリンダメア": "Tryndamere", "トリン": "Tryndamere",
        "twistedfate": "TwistedFate", "ツイステッドフェイト": "TwistedFate", "tf": "TwistedFate",
        "twitch": "Twitch", "トゥイッチ": "Twitch", "ネズミ": "Twitch",
        "udyr": "Udyr", "ウディア": "Udyr",
        "urgot": "Urgot", "アーゴット": "Urgot",
        "varus": "Varus", "ヴァルス": "Varus",
        "vayne": "Vayne", "ヴェイン": "Vayne",
        "veigar": "Veigar", "ベイガー": "Veigar",
        "velkoz": "VelKoz", "ヴェルコズ": "VelKoz", "イカ": "VelKoz",
        "vex": "Vex", "ヴェックス": "Vex",
        "vi": "Vi", "ヴァイ": "Vi",
        "viego": "Viego", "ヴィエゴ": "Viego",
        "viktor": "Viktor", "ビクター": "Viktor", "ヴィクター": "Viktor",
        "vladimir": "Vladimir", "ブラッドミア": "Vladimir", "ブラッド": "Vladimir",
        "volibear": "Volibear", "ボリベア": "Volibear", "熊": "Volibear",
        "warwick": "Warwick", "ワーウィック": "Warwick", "ww": "Warwick", "狼": "Warwick",
        "wukong": "MonkeyKing", "ウーコン": "MonkeyKing", "猿": "MonkeyKing",
        "xayah": "Xayah", "ザヤ": "Xayah",
        "xerath": "Xerath", "ゼラス": "Xerath",
        "xinzhao": "XinZhao", "シンジャオ": "XinZhao",
        "yasuo": "Yasuo", "ヤスオ": "Yasuo",
        "yone": "Yone", "ヨネ": "Yone",
        "yorick": "Yorick", "ヨリック": "Yorick",
        "yuumi": "Yuumi", "ユーミ": "Yuumi",
        "zac": "Zac", "ザック": "Zac",
        "zed": "Zed", "ゼド": "Zed",
        "zeri": "Zeri", "ゼリ": "Zeri",
        "ziggs": "Ziggs", "ジグス": "Ziggs",
        "zilean": "Zilean", "ジリアン": "Zilean",
        "zoe": "Zoe", "ゾーイ": "Zoe",
        "zyra": "Zyra", "ザイラ": "Zyra",
    }

    # レーン指定別名マッピング（例: "mid f" -> "MID" の Flash）
    LANE_ALIASES: Dict[str, str] = {
        "top": "TOP", "トップ": "TOP",
        "jg": "JG", "jungle": "JG", "ジャングル": "JG",
        "mid": "MID", "ミッド": "MID",
        "bot": "ADC", "adc": "ADC", "ボット": "ADC",
        "sup": "SUP", "support": "SUP", "サポ": "SUP", "サポート": "SUP",
    }

    @classmethod
    def parse_chat_message(cls, message: str) -> Optional[Tuple[str, str]]:
        """
        チャット文字列から (対象名またはロール名, スペル種別) を抽出。
        例:
          "Darius: Flash" -> ("Darius", "FLASH")
          "ダリウスがフラッシュを使用" -> ("Darius", "FLASH")
          "Zed: R" -> ("Zed", "ULT")
          "mid tp" -> ("MID", "TELEPORT")
          "bot f" -> ("ADC", "FLASH")
        """
        msg_lower = message.lower()

        # 1. スペルの判定
        detected_spell = None
        for spell_key, patterns in cls.SPELL_PATTERNS.items():
            if any(re.search(pat, msg_lower) for pat in patterns):
                detected_spell = spell_key
                break

        if not detected_spell:
            return None

        # 2. チャンピオンまたはレーンの特定
        detected_target = None

        # チャンピオン名
        for alias, normalized in cls.CHAMPION_ALIASES.items():
            if alias in msg_lower:
                detected_target = normalized
                break

        # レーン名フォールバック
        if not detected_target:
            for lane_alias, norm_lane in cls.LANE_ALIASES.items():
                if re.search(rf"\b{lane_alias}\b", msg_lower) or lane_alias in msg_lower:
                    detected_target = norm_lane
                    break

        if detected_target and detected_spell:
            return (detected_target, detected_spell)

        return None
