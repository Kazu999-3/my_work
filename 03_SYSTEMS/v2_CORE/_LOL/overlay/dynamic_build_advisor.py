"""
Sovereign HUD - 動的ビルド推薦エンジン (Dynamic Build Advisor)
=============================================================
敵5人の構成（AD/AP比率、回復持ち、アーマー/MR防具、CC数）および
自身のチャンピオン、現在所持アイテム、ゲーム時間から
「次に買うべき最適なコアアイテム/対抗アイテム」をリアルタイムに自動判定する。
"""

# 主要アイテムのID・名前・価格・アイコン名
# 主要アイテムのID・名前・価格・アイコン名
ITEM_DB = {
    # ブーツ
    "PlatedSteelcaps": {"id": 3047, "name": "プレート スチールキャップ", "price": 1100, "icon": "3047.png", "type": "boots"},
    "MercuryTreads": {"id": 3111, "name": "マーキュリー ブーツ", "price": 1200, "icon": "3111.png", "type": "boots"},
    "IonianBoots": {"id": 3158, "name": "アイオニア ブーツ", "price": 900, "icon": "3158.png", "type": "boots"},
    "SorcerersShoes": {"id": 3020, "name": "ソーサラー シューズ", "price": 1100, "icon": "3020.png", "type": "boots"},
    "BerserkersGreaves": {"id": 3006, "name": "バーサーカー ブーツ", "price": 1100, "icon": "3006.png", "type": "boots"},
    "BootsOfSwiftness": {"id": 3009, "name": "スイフトネス ブーツ", "price": 1000, "icon": "3009.png", "type": "boots"},

    # 重傷（回復阻害）
    "ExecutionersCalling": {"id": 3123, "name": "処刑人の劫罰", "price": 800, "icon": "3123.png", "type": "heal_cut"},
    "OblivionOrb": {"id": 3916, "name": "忘却のオーブ", "price": 800, "icon": "3916.png", "type": "heal_cut"},
    "BrambleVest": {"id": 3076, "name": "ブランブル ベスト", "price": 800, "icon": "3076.png", "type": "heal_cut"},
    "MortalReminder": {"id": 3033, "name": "モータル リマインダー", "price": 3000, "icon": "3033.png", "type": "heal_cut"},
    "Morellonomicon": {"id": 3165, "name": "モレロノミコン", "price": 2200, "icon": "3165.png", "type": "heal_cut"},
    "Thornmail": {"id": 3075, "name": "ソーンメイル", "price": 2700, "icon": "3075.png", "type": "heal_cut"},

    # 貫通（AR/MR対策）
    "BlackCleaver": {"id": 3071, "name": "ブラック クリーバー", "price": 3000, "icon": "3071.png", "type": "pen"},
    "LordDominiksRegards": {"id": 3036, "name": "ドミニク リガード", "price": 3000, "icon": "3036.png", "type": "pen"},
    "SeryldasGrudge": {"id": 6694, "name": "セリルダの怨恨", "price": 3200, "icon": "6694.png", "type": "pen"},
    "Cryptbloom": {"id": 3137, "name": "クリプトブルーム", "price": 2850, "icon": "3137.png", "type": "pen"},
    "VoidStaff": {"id": 3135, "name": "ヴォイド スタッフ", "price": 3000, "icon": "3135.png", "type": "pen"},
    "Terminus": {"id": 3302, "name": "ターミナス", "price": 3000, "icon": "3302.png", "type": "pen"},

    # 防御・ユーティリティ
    "GuardianAngel": {"id": 3026, "name": "ガーディアン エンジェル", "price": 3200, "icon": "3026.png", "type": "core"},
    "ZhonyasHourglass": {"id": 3157, "name": "ゾーニャの砂時計", "price": 3250, "icon": "3157.png", "type": "core"},
    "SteraksGage": {"id": 3053, "name": "ステラックの篭手", "price": 3200, "icon": "3053.png", "type": "defensive_core"},
    "MawOfMalmortius": {"id": 3156, "name": "マルモティウスの胃袋", "price": 3100, "icon": "3156.png", "type": "mr_core"},
    "KaenicRookern": {"id": 2504, "name": "カイーニック ルーケーン", "price": 2900, "icon": "2504.png", "type": "mr_core"},
    "EdgeOfNight": {"id": 3814, "name": "ナイト エッジ", "price": 2800, "icon": "3814.png", "type": "core"},
    "Shieldbow": {"id": 6673, "name": "イモータル シールドボウ", "price": 3000, "icon": "6673.png", "type": "core"},

    # 汎用ファイター・アサシン・ADC コア
    "SunderedSky": {"id": 6610, "name": "サンダード スカイ", "price": 3100, "icon": "6610.png", "type": "core"},
    "Eclipse": {"id": 6692, "name": "エクリプス", "price": 2800, "icon": "6692.png", "type": "core"},
    "TrinityForce": {"id": 3078, "name": "トリニティ フォース", "price": 3333, "icon": "3078.png", "type": "core"},
    "BladeOfTheRuinedKing": {"id": 3153, "name": "ルインドキング ブレード", "price": 3200, "icon": "3153.png", "type": "core"},
    "Shojin": {"id": 3161, "name": "ショウジンの矛", "price": 3100, "icon": "3161.png", "type": "core"},
    "Muramana": {"id": 3004, "name": "マナムネ", "price": 2900, "icon": "3004.png", "type": "core"},
    "ProfaneHydra": {"id": 6698, "name": "プロフェイン ハイドラ", "price": 3300, "icon": "6698.png", "type": "core"},
    "RavenousHydra": {"id": 3074, "name": "ラバナス ハイドラ", "price": 3300, "icon": "3074.png", "type": "core"},
    "TitanicHydra": {"id": 3748, "name": "タイタン ハイドラ", "price": 3300, "icon": "3748.png", "type": "core"},
    "YoumuusGhostblade": {"id": 3142, "name": "妖夢の霊剣", "price": 2800, "icon": "3142.png", "type": "core"},
    "Hubris": {"id": 6697, "name": "ヒューブリス", "price": 3000, "icon": "6697.png", "type": "core"},
    "Opportunity": {"id": 6695, "name": "オポチュニティ", "price": 2700, "icon": "6695.png", "type": "core"},

    # マークスマン (ADC) コア
    "InfinityEdge": {"id": 3031, "name": "インフィニティ エッジ", "price": 3400, "icon": "3031.png", "type": "core"},
    "KrakenSlayer": {"id": 6672, "name": "クラーケン スレイヤー", "price": 3100, "icon": "6672.png", "type": "core"},
    "StatikkShiv": {"id": 3087, "name": "スタティック シヴ", "price": 2900, "icon": "3087.png", "type": "core"},
    "GuinsoosRageblade": {"id": 3124, "name": "グインソー レイジブレード", "price": 3000, "icon": "3124.png", "type": "core"},
    "TheCollector": {"id": 6676, "name": "コレクター", "price": 3200, "icon": "6676.png", "type": "core"},
    "EssenceReaver": {"id": 3508, "name": "エッセンス リーバー", "price": 3150, "icon": "3508.png", "type": "core"},
    "Bloodthirster": {"id": 3072, "name": "ブラッドサースター", "price": 3400, "icon": "3072.png", "type": "core"},
    "Navori": {"id": 6675, "name": "ナヴォリ フリッカーブレード", "price": 2600, "icon": "6675.png", "type": "core"},
    "RapidFirecannon": {"id": 3094, "name": "ラピッド ファイアキャノン", "price": 3000, "icon": "3094.png", "type": "core"},
    "RunaansHurricane": {"id": 3085, "name": "ルナーン ハリケーン", "price": 2600, "icon": "3085.png", "type": "core"},
    "PhantomDancer": {"id": 3046, "name": "ファントム ダンサー", "price": 2600, "icon": "3046.png", "type": "core"},

    # メイジ (AP) コア
    "LudensCompanion": {"id": 3285, "name": "ルーデン コンパニオン", "price": 3000, "icon": "3285.png", "type": "core"},
    "LiandrysTorment": {"id": 3151, "name": "ライアンドリーの苦悶", "price": 3000, "icon": "3151.png", "type": "core"},
    "RabadonsDeathcap": {"id": 3089, "name": "ラバドン デスキャップ", "price": 3600, "icon": "3089.png", "type": "core"},
    "Shadowflame": {"id": 4645, "name": "シャドウフレイム", "price": 3200, "icon": "4645.png", "type": "core"},
    "Malignance": {"id": 3118, "name": "マリグナンス", "price": 2700, "icon": "3118.png", "type": "core"},
    "HorizonFocus": {"id": 4628, "name": "ホライゾン フォーカス", "price": 2700, "icon": "4628.png", "type": "core"},
    "NashorsTooth": {"id": 3115, "name": "ナッシャー トゥース", "price": 3000, "icon": "3115.png", "type": "core"},
    "LichBane": {"id": 3100, "name": "リッチ ベイン", "price": 3100, "icon": "3100.png", "type": "core"},
    "Rocketbelt": {"id": 3152, "name": "ヘクステック ロケットベルト", "price": 2500, "icon": "3152.png", "type": "core"},
    "Riftmaker": {"id": 4633, "name": "リフトメーカー", "price": 3100, "icon": "4633.png", "type": "core"},
    "RylaisCrystalScepter": {"id": 3116, "name": "クリスタル セプター", "price": 2600, "icon": "3116.png", "type": "core"},
    "ArchangelsStaff": {"id": 3003, "name": "大天使の杖", "price": 2900, "icon": "3003.png", "type": "core"},

    # タンク・サポート
    "Heartsteel": {"id": 3084, "name": "ハートスチール", "price": 3000, "icon": "3084.png", "type": "core"},
    "SunfireAegis": {"id": 3068, "name": "サンファイア イージス", "price": 2700, "icon": "3068.png", "type": "core"},
    "WarmogsArmor": {"id": 3083, "name": "ワーモグ アーマー", "price": 3100, "icon": "3083.png", "type": "core"},
    "FrozenHeart": {"id": 3110, "name": "フローズン ハート", "price": 2500, "icon": "3110.png", "type": "core"},
    "IcebornGauntlet": {"id": 3069, "name": "アイスボーン ガントレット", "price": 2600, "icon": "3069.png", "type": "core"},
    "DeadMansPlate": {"id": 3742, "name": "デッドマン プレート", "price": 2900, "icon": "3742.png", "type": "core"},
    "SpiritVisage": {"id": 3065, "name": "スピリット ビサージュ", "price": 2700, "icon": "3065.png", "type": "core"},
    "LocketOfTheIronSolari": {"id": 3190, "name": "ソラリのロケット", "price": 2200, "icon": "3190.png", "type": "core"},
    "KnightsVow": {"id": 3109, "name": "騎士の誓い", "price": 2200, "icon": "3109.png", "type": "core"},
    "Trailblazer": {"id": 3002, "name": "トレイルブレイザー", "price": 2400, "icon": "3002.png", "type": "core"},
    "MoonstoneRenewer": {"id": 6617, "name": "ムーンストーンの再生", "price": 2200, "icon": "6617.png", "type": "core"},
    "EchoesOfHelia": {"id": 6620, "name": "ヘリアの残響", "price": 2200, "icon": "6620.png", "type": "core"},
    "ImperialMandate": {"id": 4005, "name": "帝国の指令", "price": 2200, "icon": "4005.png", "type": "core"},
    "ArdentCenser": {"id": 3504, "name": "アーデント センサー", "price": 2200, "icon": "3504.png", "type": "core"},
    "Redemption": {"id": 3107, "name": "リデンプション", "price": 2300, "icon": "3107.png", "type": "core"},
}

# チャンピオン別 基本ビルドツリー (全ロール網羅)
CHAMPION_CORE_BLUEPRINTS = {
    # ADC (Marksman)
    "KaiSa": {"class": "marksman", "first_core": "StatikkShiv", "second_cores": ["GuinsoosRageblade", "NashorsTooth"], "boots_default": "BerserkersGreaves"},
    "Kaisa": {"class": "marksman", "first_core": "StatikkShiv", "second_cores": ["GuinsoosRageblade", "NashorsTooth"], "boots_default": "BerserkersGreaves"},
    "Jinx": {"class": "marksman", "first_core": "KrakenSlayer", "second_cores": ["InfinityEdge", "RunaansHurricane"], "boots_default": "BerserkersGreaves"},
    "Caitlyn": {"class": "marksman", "first_core": "TheCollector", "second_cores": ["InfinityEdge", "LordDominiksRegards"], "boots_default": "BerserkersGreaves"},
    "Ezreal": {"class": "marksman", "first_core": "TrinityForce", "second_cores": ["Muramana", "SeryldasGrudge"], "boots_default": "IonianBoots"},
    "Vayne": {"class": "marksman", "first_core": "BladeOfTheRuinedKing", "second_cores": ["GuinsoosRageblade", "Terminus"], "boots_default": "BerserkersGreaves"},
    "Ashe": {"class": "marksman", "first_core": "KrakenSlayer", "second_cores": ["TrinityForce", "Terminus"], "boots_default": "BerserkersGreaves"},
    "Jhin": {"class": "marksman", "first_core": "TheCollector", "second_cores": ["InfinityEdge", "RapidFirecannon"], "boots_default": "BootsOfSwiftness"},
    "Lucian": {"class": "marksman", "first_core": "TheCollector", "second_cores": ["InfinityEdge", "EssenceReaver"], "boots_default": "BerserkersGreaves"},
    "MissFortune": {"class": "marksman", "first_core": "TheCollector", "second_cores": ["InfinityEdge", "LordDominiksRegards"], "boots_default": "BootsOfSwiftness"},
    "Samira": {"class": "marksman", "first_core": "TheCollector", "second_cores": ["InfinityEdge", "LordDominiksRegards"], "boots_default": "PlatedSteelcaps"},
    "Draven": {"class": "marksman", "first_core": "Bloodthirster", "second_cores": ["InfinityEdge", "LordDominiksRegards"], "boots_default": "BerserkersGreaves"},
    "Twitch": {"class": "marksman", "first_core": "BladeOfTheRuinedKing", "second_cores": ["RunaansHurricane", "InfinityEdge"], "boots_default": "BerserkersGreaves"},
    "Zeri": {"class": "marksman", "first_core": "StatikkShiv", "second_cores": ["RunaansHurricane", "InfinityEdge"], "boots_default": "BerserkersGreaves"},
    "Smolder": {"class": "marksman", "first_core": "EssenceReaver", "second_cores": ["Shojin", "RapidFirecannon"], "boots_default": "IonianBoots"},
    "Tristana": {"class": "marksman", "first_core": "KrakenSlayer", "second_cores": ["Navori", "InfinityEdge"], "boots_default": "BerserkersGreaves"},
    "Sivir": {"class": "marksman", "first_core": "StatikkShiv", "second_cores": ["Navori", "InfinityEdge"], "boots_default": "BerserkersGreaves"},
    "Varus": {"class": "marksman", "first_core": "BladeOfTheRuinedKing", "second_cores": ["GuinsoosRageblade", "Terminus"], "boots_default": "BerserkersGreaves"},

    # Mid / AP Mage / AP Assassin
    "Heimerdinger": {"class": "ap_mage", "first_core": "LiandrysTorment", "second_cores": ["RylaisCrystalScepter", "ZhonyasHourglass"], "boots_default": "SorcerersShoes"},
    "Urgot": {"class": "ad_juggernaut", "first_core": "BlackCleaver", "second_cores": ["SteraksGage", "TitanicHydra"], "boots_default": "PlatedSteelcaps"},
    "Teemo": {"class": "ap_mage", "first_core": "LiandrysTorment", "second_cores": ["NashorsTooth", "Shadowflame"], "boots_default": "SorcerersShoes"},
    "Kennen": {"class": "ap_mage", "first_core": "Rocketbelt", "second_cores": ["Shadowflame", "ZhonyasHourglass"], "boots_default": "SorcerersShoes"},
    "Gwen": {"class": "ap_fighter", "first_core": "NashorsTooth", "second_cores": ["Riftmaker", "RabadonsDeathcap"], "boots_default": "PlatedSteelcaps"},
    "Rumble": {"class": "ap_fighter", "first_core": "LiandrysTorment", "second_cores": ["Shadowflame", "ZhonyasHourglass"], "boots_default": "SorcerersShoes"},
    "Vladimir": {"class": "ap_mage", "first_core": "Rocketbelt", "second_cores": ["RabadonsDeathcap", "ZhonyasHourglass"], "boots_default": "IonianBoots"},
    "Singed": {"class": "ap_fighter", "first_core": "RylaisCrystalScepter", "second_cores": ["LiandrysTorment", "DeadMansPlate"], "boots_default": "BootsOfSwiftness"},
    "Kayle": {"class": "ap_fighter", "first_core": "NashorsTooth", "second_cores": ["GuinsoosRageblade", "RabadonsDeathcap"], "boots_default": "BerserkersGreaves"},
    "Gangplank": {"class": "ad_fighter", "first_core": "TrinityForce", "second_cores": ["TheCollector", "InfinityEdge"], "boots_default": "IonianBoots"},
    "Jayce": {"class": "ad_fighter", "first_core": "Eclipse", "second_cores": ["Muramana", "SeryldasGrudge"], "boots_default": "IonianBoots"},
    "Gnar": {"class": "ad_fighter", "first_core": "TrinityForce", "second_cores": ["BlackCleaver", "SteraksGage"], "boots_default": "PlatedSteelcaps"},
    "Illaoi": {"class": "ad_juggernaut", "first_core": "SunderedSky", "second_cores": ["SteraksGage", "BlackCleaver"], "boots_default": "PlatedSteelcaps"},
    "Nasus": {"class": "tank", "first_core": "TrinityForce", "second_cores": ["FrozenHeart", "SpiritVisage"], "boots_default": "PlatedSteelcaps"},
    "Olaf": {"class": "ad_fighter", "first_core": "RavenousHydra", "second_cores": ["TrinityForce", "SteraksGage"], "boots_default": "PlatedSteelcaps"},
    "Pantheon": {"class": "ad_fighter", "first_core": "Eclipse", "second_cores": ["SunderedSky", "BlackCleaver"], "boots_default": "PlatedSteelcaps"},
    "Poppy": {"class": "tank", "first_core": "SunfireAegis", "second_cores": ["IcebornGauntlet", "DeadMansPlate"], "boots_default": "PlatedSteelcaps"},
    "Quinn": {"class": "marksman", "first_core": "YoumuusGhostblade", "second_cores": ["TheCollector", "LordDominiksRegards"], "boots_default": "BerserkersGreaves"},
    "TahmKench": {"class": "tank", "first_core": "Heartsteel", "second_cores": ["SunfireAegis", "UnendingDespair"], "boots_default": "PlatedSteelcaps"},
    "Trundle": {"class": "ad_fighter", "first_core": "TrinityForce", "second_cores": ["RavenousHydra", "BladeOfTheRuinedKing"], "boots_default": "PlatedSteelcaps"},
    "Tryndamere": {"class": "ad_melee", "first_core": "RavenousHydra", "second_cores": ["PhantomDancer", "InfinityEdge"], "boots_default": "BerserkersGreaves"},
    "Volibear": {"class": "ad_juggernaut", "first_core": "SunderedSky", "second_cores": ["Riftmaker", "DeadMansPlate"], "boots_default": "IonianBoots"},
    "Warwick": {"class": "ad_fighter", "first_core": "BladeOfTheRuinedKing", "second_cores": ["TitanicHydra", "SteraksGage"], "boots_default": "PlatedSteelcaps"},
    "Wukong": {"class": "ad_fighter", "first_core": "TrinityForce", "second_cores": ["SunderedSky", "Eclipse"], "boots_default": "PlatedSteelcaps"},
    "Yorick": {"class": "ad_juggernaut", "first_core": "ProfaneHydra", "second_cores": ["SeryldasGrudge", "TrinityForce"], "boots_default": "PlatedSteelcaps"},
    "Kled": {"class": "ad_fighter", "first_core": "ProfaneHydra", "second_cores": ["Eclipse", "BlackCleaver"], "boots_default": "PlatedSteelcaps"},
    "Akshan": {"class": "marksman", "first_core": "KrakenSlayer", "second_cores": ["TheCollector", "InfinityEdge"], "boots_default": "BerserkersGreaves"},
    "Swain": {"class": "ap_mage", "first_core": "RylaisCrystalScepter", "second_cores": ["LiandrysTorment", "ZhonyasHourglass"], "boots_default": "SorcerersShoes"},
    "Malzahar": {"class": "ap_mage", "first_core": "LiandrysTorment", "second_cores": ["RylaisCrystalScepter", "Shadowflame"], "boots_default": "IonianBoots"},
    "Brand": {"class": "ap_mage", "first_core": "LiandrysTorment", "second_cores": ["RylaisCrystalScepter", "ZhonyasHourglass"], "boots_default": "SorcerersShoes"},
    "Cassiopeia": {"class": "ap_mage", "first_core": "ArchangelsStaff", "second_cores": ["RylaisCrystalScepter", "LiandrysTorment"], "boots_default": "SorcerersShoes"},
    "Anivia": {"class": "ap_mage", "first_core": "ArchangelsStaff", "second_cores": ["LiandrysTorment", "ZhonyasHourglass"], "boots_default": "SorcerersShoes"},
    "Annie": {"class": "ap_mage", "first_core": "Malignance", "second_cores": ["Shadowflame", "ZhonyasHourglass"], "boots_default": "SorcerersShoes"},
    "Kassadin": {"class": "ap_assassin", "first_core": "Malignance", "second_cores": ["ArchangelsStaff", "ZhonyasHourglass"], "boots_default": "SorcerersShoes"},
    "Ryze": {"class": "ap_mage", "first_core": "ArchangelsStaff", "second_cores": ["RodOfAges", "ZhonyasHourglass"], "boots_default": "SorcerersShoes"},
    "TwistedFate": {"class": "ap_mage", "first_core": "LichBane", "second_cores": ["RapidFirecannon", "ZhonyasHourglass"], "boots_default": "IonianBoots"},
    "Zoe": {"class": "ap_mage", "first_core": "LudensCompanion", "second_cores": ["HorizonFocus", "Shadowflame"], "boots_default": "SorcerersShoes"},
    "Ziggs": {"class": "ap_mage", "first_core": "LudensCompanion", "second_cores": ["LiandrysTorment", "HorizonFocus"], "boots_default": "SorcerersShoes"},
    "Xerath": {"class": "ap_mage", "first_core": "LudensCompanion", "second_cores": ["HorizonFocus", "Shadowflame"], "boots_default": "SorcerersShoes"},
    "Velkoz": {"class": "ap_mage", "first_core": "LudensCompanion", "second_cores": ["HorizonFocus", "LiandrysTorment"], "boots_default": "SorcerersShoes"},
    "Karthus": {"class": "ap_mage", "first_core": "Malignance", "second_cores": ["LiandrysTorment", "Shadowflame"], "boots_default": "SorcerersShoes"},
    "Lillia": {"class": "ap_fighter", "first_core": "LiandrysTorment", "second_cores": ["Riftmaker", "RylaisCrystalScepter"], "boots_default": "IonianBoots"},
    "Gragas": {"class": "ap_fighter", "first_core": "LichBane", "second_cores": ["Shadowflame", "ZhonyasHourglass"], "boots_default": "SorcerersShoes"},
    "Shyvana": {"class": "ap_fighter", "first_core": "Shojin", "second_cores": ["LiandrysTorment", "Riftmaker"], "boots_default": "IonianBoots"},
    "Udyr": {"class": "ap_fighter", "first_core": "LiandrysTorment", "second_cores": ["DeadMansPlate", "ForceOfNature"], "boots_default": "BootsOfSwiftness"},
    "Nocturne": {"class": "ad_assassin", "first_core": "Eclipse", "second_cores": ["BlackCleaver", "SteraksGage"], "boots_default": "PlatedSteelcaps"},
    "Shaco": {"class": "ad_assassin", "first_core": "ProfaneHydra", "second_cores": ["TheCollector", "InfinityEdge"], "boots_default": "BerserkersGreaves"},
    "KhaZix": {"class": "ad_assassin", "first_core": "ProfaneHydra", "second_cores": ["YoumuusGhostblade", "SeryldasGrudge"], "boots_default": "IonianBoots"},
    "Rengar": {"class": "ad_assassin", "first_core": "ProfaneHydra", "second_cores": ["Hubris", "TheCollector"], "boots_default": "IonianBoots"},
    "Hecarim": {"class": "ad_fighter", "first_core": "Shojin", "second_cores": ["Eclipse", "SteraksGage"], "boots_default": "IonianBoots"},
    "Graves": {"class": "marksman", "first_core": "TheCollector", "second_cores": ["InfinityEdge", "LordDominiksRegards"], "boots_default": "PlatedSteelcaps"},
    "Kindred": {"class": "marksman", "first_core": "KrakenSlayer", "second_cores": ["TrinityForce", "Terminus"], "boots_default": "BerserkersGreaves"},
    "BelVeth": {"class": "ad_fighter", "first_core": "KrakenSlayer", "second_cores": ["BladeOfTheRuinedKing", "Terminus"], "boots_default": "PlatedSteelcaps"},
    "Briar": {"class": "ad_fighter", "first_core": "TitanicHydra", "second_cores": ["BlackCleaver", "SteraksGage"], "boots_default": "PlatedSteelcaps"},
    "Diana": {"class": "ap_assassin", "first_core": "NashorsTooth", "second_cores": ["LichBane", "ZhonyasHourglass"], "boots_default": "SorcerersShoes"},
    "Nidalee": {"class": "ap_assassin", "first_core": "LichBane", "second_cores": ["Shadowflame", "ZhonyasHourglass"], "boots_default": "SorcerersShoes"},
    "Fiddlesticks": {"class": "ap_mage", "first_core": "LiandrysTorment", "second_cores": ["ZhonyasHourglass", "Shadowflame"], "boots_default": "SorcerersShoes"},
    "Ivern": {"class": "enchanter", "first_core": "MoonstoneRenewer", "second_cores": ["EchoesOfHelia", "ImperialMandate"], "boots_default": "IonianBoots"},

    # Mid / AP Mage / AP Assassin
    "Ahri": {"class": "ap_mage", "first_core": "LudensCompanion", "second_cores": ["Malignance", "ZhonyasHourglass"], "boots_default": "SorcerersShoes"},
    "Syndra": {"class": "ap_mage", "first_core": "LudensCompanion", "second_cores": ["Shadowflame", "RabadonsDeathcap"], "boots_default": "SorcerersShoes"},
    "Lux": {"class": "ap_mage", "first_core": "LudensCompanion", "second_cores": ["HorizonFocus", "RabadonsDeathcap"], "boots_default": "SorcerersShoes"},
    "Hwei": {"class": "ap_mage", "first_core": "LudensCompanion", "second_cores": ["HorizonFocus", "LiandrysTorment"], "boots_default": "IonianBoots"},
    "Viktor": {"class": "ap_mage", "first_core": "LudensCompanion", "second_cores": ["LiandrysTorment", "ZhonyasHourglass"], "boots_default": "SorcerersShoes"},
    "Orianna": {"class": "ap_mage", "first_core": "LudensCompanion", "second_cores": ["ArchangelsStaff", "RabadonsDeathcap"], "boots_default": "SorcerersShoes"},
    "Veigar": {"class": "ap_mage", "first_core": "LudensCompanion", "second_cores": ["RabadonsDeathcap", "ZhonyasHourglass"], "boots_default": "SorcerersShoes"},
    "AurelionSol": {"class": "ap_mage", "first_core": "LiandrysTorment", "second_cores": ["RylaisCrystalScepter", "ZhonyasHourglass"], "boots_default": "SorcerersShoes"},
    "Vex": {"class": "ap_mage", "first_core": "LudensCompanion", "second_cores": ["Shadowflame", "ZhonyasHourglass"], "boots_default": "SorcerersShoes"},
    "Sylas": {"class": "ap_fighter", "first_core": "Rocketbelt", "second_cores": ["LichBane", "ZhonyasHourglass"], "boots_default": "SorcerersShoes"},
    "Akali": {"class": "ap_assassin", "first_core": "Rocketbelt", "second_cores": ["Shadowflame", "ZhonyasHourglass"], "boots_default": "SorcerersShoes"},
    "Katarina": {"class": "ap_assassin", "first_core": "NashorsTooth", "second_cores": ["LichBane", "Shadowflame"], "boots_default": "SorcerersShoes"},
    "LeBlanc": {"class": "ap_assassin", "first_core": "LudensCompanion", "second_cores": ["Shadowflame", "ZhonyasHourglass"], "boots_default": "SorcerersShoes"},
    "Ekko": {"class": "ap_assassin", "first_core": "LichBane", "second_cores": ["NashorsTooth", "ZhonyasHourglass"], "boots_default": "SorcerersShoes"},
    "Fizz": {"class": "ap_assassin", "first_core": "LichBane", "second_cores": ["ZhonyasHourglass", "Shadowflame"], "boots_default": "SorcerersShoes"},

    # AD Assassin / AD Mid
    "Zed": {"class": "ad_assassin", "first_core": "Eclipse", "second_cores": ["ProfaneHydra", "SeryldasGrudge"], "boots_default": "IonianBoots"},
    "Yasuo": {"class": "ad_melee", "first_core": "BladeOfTheRuinedKing", "second_cores": ["InfinityEdge", "Shieldbow"], "boots_default": "BerserkersGreaves"},
    "Yone": {"class": "ad_melee", "first_core": "BladeOfTheRuinedKing", "second_cores": ["InfinityEdge", "Shieldbow"], "boots_default": "BerserkersGreaves"},
    "Talon": {"class": "ad_assassin", "first_core": "YoumuusGhostblade", "second_cores": ["ProfaneHydra", "SeryldasGrudge"], "boots_default": "IonianBoots"},
    "Qiyana": {"class": "ad_assassin", "first_core": "ProfaneHydra", "second_cores": ["SeryldasGrudge", "EdgeOfNight"], "boots_default": "IonianBoots"},

    # Top Fighter / Bruiser
    "Aatrox": {"class": "ad_fighter", "first_core": "SunderedSky", "second_cores": ["Eclipse", "BlackCleaver"], "boots_default": "PlatedSteelcaps"},
    "Darius": {"class": "ad_juggernaut", "first_core": "TrinityForce", "second_cores": ["SteraksGage", "DeadMansPlate"], "boots_default": "PlatedSteelcaps"},
    "Garen": {"class": "ad_juggernaut", "first_core": "PhantomDancer", "second_cores": ["InfinityEdge", "DeadMansPlate"], "boots_default": "BerserkersGreaves"},
    "Sett": {"class": "ad_juggernaut", "first_core": "Heartsteel", "second_cores": ["TitanicHydra", "SteraksGage"], "boots_default": "PlatedSteelcaps"},
    "Mordekaiser": {"class": "ap_juggernaut", "first_core": "RylaisCrystalScepter", "second_cores": ["LiandrysTorment", "Riftmaker"], "boots_default": "PlatedSteelcaps"},
    "Fiora": {"class": "ad_fighter", "first_core": "RavenousHydra", "second_cores": ["TrinityForce", "Eclipse"], "boots_default": "PlatedSteelcaps"},
    "Camille": {"class": "ad_fighter", "first_core": "TrinityForce", "second_cores": ["RavenousHydra", "SteraksGage"], "boots_default": "PlatedSteelcaps"},
    "Jax": {"class": "ad_fighter", "first_core": "TrinityForce", "second_cores": ["SunderedSky", "SteraksGage"], "boots_default": "PlatedSteelcaps"},
    "Renekton": {"class": "ad_fighter", "first_core": "Eclipse", "second_cores": ["BlackCleaver", "SteraksGage"], "boots_default": "PlatedSteelcaps"},
    "Riven": {"class": "ad_fighter", "first_core": "Eclipse", "second_cores": ["SunderedSky", "BlackCleaver"], "boots_default": "IonianBoots"},
    "Irelia": {"class": "ad_fighter", "first_core": "BladeOfTheRuinedKing", "second_cores": ["SunderedSky", "Terminus"], "boots_default": "PlatedSteelcaps"},

    # Top / Jungle Tank
    "Malphite": {"class": "tank", "first_core": "SunfireAegis", "second_cores": ["FrozenHeart", "Thornmail"], "boots_default": "PlatedSteelcaps"},
    "Ornn": {"class": "tank", "first_core": "SunfireAegis", "second_cores": ["KaenicRookern", "Heartsteel"], "boots_default": "PlatedSteelcaps"},
    "KSante": {"class": "tank", "first_core": "IcebornGauntlet", "second_cores": ["SunfireAegis", "KaenicRookern"], "boots_default": "PlatedSteelcaps"},
    "Sion": {"class": "tank", "first_core": "Heartsteel", "second_cores": ["SunfireAegis", "TitanicHydra"], "boots_default": "PlatedSteelcaps"},
    "DrMundo": {"class": "tank", "first_core": "Heartsteel", "second_cores": ["WarmogsArmor", "SunfireAegis"], "boots_default": "PlatedSteelcaps"},
    "ChoGath": {"class": "tank", "first_core": "Heartsteel", "second_cores": ["SunfireAegis", "KaenicRookern"], "boots_default": "PlatedSteelcaps"},

    # Jungle
    "LeeSin": {"class": "ad_fighter", "first_core": "Eclipse", "second_cores": ["SunderedSky", "BlackCleaver"], "boots_default": "PlatedSteelcaps"},
    "Viego": {"class": "ad_fighter", "first_core": "KrakenSlayer", "second_cores": ["TrinityForce", "SunderedSky"], "boots_default": "PlatedSteelcaps"},
    "JarvanIV": {"class": "ad_fighter", "first_core": "SunderedSky", "second_cores": ["Eclipse", "SteraksGage"], "boots_default": "PlatedSteelcaps"},
    "XinZhao": {"class": "ad_fighter", "first_core": "SunderedSky", "second_cores": ["TitanicHydra", "SteraksGage"], "boots_default": "PlatedSteelcaps"},
    "Kayn": {"class": "ad_assassin", "first_core": "ProfaneHydra", "second_cores": ["SeryldasGrudge", "EdgeOfNight"], "boots_default": "IonianBoots"},
    "Elise": {"class": "ap_assassin", "first_core": "LichBane", "second_cores": ["Shadowflame", "ZhonyasHourglass"], "boots_default": "SorcerersShoes"},
    "Evelynn": {"class": "ap_assassin", "first_core": "LichBane", "second_cores": ["Shadowflame", "RabadonsDeathcap"], "boots_default": "SorcerersShoes"},
    "Zac": {"class": "tank", "first_core": "SunfireAegis", "second_cores": ["SpiritVisage", "Thornmail"], "boots_default": "IonianBoots"},
    "Sejuani": {"class": "tank", "first_core": "SunfireAegis", "second_cores": ["WarmogsArmor", "KaenicRookern"], "boots_default": "PlatedSteelcaps"},
    "Amumu": {"class": "tank", "first_core": "SunfireAegis", "second_cores": ["LiandrysTorment", "Thornmail"], "boots_default": "PlatedSteelcaps"},

    # Support
    "Nautilus": {"class": "tank_support", "first_core": "LocketOfTheIronSolari", "second_cores": ["KnightsVow", "Trailblazer"], "boots_default": "BootsOfSwiftness"},
    "Leona": {"class": "tank_support", "first_core": "LocketOfTheIronSolari", "second_cores": ["KnightsVow", "Thornmail"], "boots_default": "PlatedSteelcaps"},
    "Thresh": {"class": "tank_support", "first_core": "LocketOfTheIronSolari", "second_cores": ["KnightsVow", "Trailblazer"], "boots_default": "BootsOfSwiftness"},
    "Blitzcrank": {"class": "tank_support", "first_core": "LocketOfTheIronSolari", "second_cores": ["Trailblazer", "FrozenHeart"], "boots_default": "BootsOfSwiftness"},
    "Lulu": {"class": "enchanter", "first_core": "MoonstoneRenewer", "second_cores": ["EchoesOfHelia", "ArdentCenser"], "boots_default": "IonianBoots"},
    "Nami": {"class": "enchanter", "first_core": "ImperialMandate", "second_cores": ["MoonstoneRenewer", "EchoesOfHelia"], "boots_default": "IonianBoots"},
    "Soraka": {"class": "enchanter", "first_core": "MoonstoneRenewer", "second_cores": ["WarmogsArmor", "Redemption"], "boots_default": "IonianBoots"},
    "Pyke": {"class": "ad_assassin", "first_core": "YoumuusGhostblade", "second_cores": ["Opportunity", "EdgeOfNight"], "boots_default": "BootsOfSwiftness"},
}

HEAL_HEAVY_CHAMPS = {
    "Aatrox", "Warwick", "Vladimir", "Soraka", "Briar", "Swain",
    "Fiora", "Sylas", "DrMundo", "Yuumi", "Olaf", "Illaoi", "Irelia"
}

HEAVY_CC_CHAMPS = {
    "Leona", "Nautilus", "Malzahar", "Morgana", "Amumu", "Sejuani",
    "Rell", "Maokai", "Lissandra", "Skarner", "Thresh", "Blitzcrank"
}

import re
from v2_CORE._LOL.overlay.item_price_manager import ItemPriceManager

def is_item_owned(item_info: dict, my_items: list) -> bool:
    """アイテム（IDまたは名前）をすでにインベントリに所持しているかを100%確実に判定"""
    if not item_info or not my_items:
        return False

    target_id = int(item_info.get("id", 0))
    target_name = str(item_info.get("name", "")).lower().replace(" ", "").replace("（", "").replace("）", "")

    for it in my_items:
        # 1. 直接の itemID / id の整数照合
        i_id = int(it.get("itemID") or it.get("id") or 0)
        if target_id > 0 and i_id == target_id:
            return True

        # 2. rawDisplayName / rawDescription からのID抽出 (例: "Item_3151_Name" -> 3151)
        for raw_k in ["rawDisplayName", "rawDescription"]:
            raw_v = str(it.get(raw_k, ""))
            if raw_v:
                m = re.search(r'item_(\d+)', raw_v, re.IGNORECASE)
                if m and int(m.group(1)) == target_id:
                    return True

        # 3. displayName または rawDisplayName による名称照合
        for name_k in ["displayName", "name", "rawDisplayName"]:
            d_name = str(it.get(name_k, "")).lower().replace(" ", "").replace("（", "").replace("）", "").replace("'", "")
            if d_name:
                if target_name and (target_name in d_name or d_name in target_name):
                    return True

    return False

class DynamicBuildAdvisor:
    @staticmethod
    def advise_next_item(
        my_champion: str,
        my_items: list,
        enemy_players: list,
        game_time_sec: float
    ) -> dict:
        """次に購入すべき最適な【未所持】アイテムとその理由を判定"""
        my_item_ids = {int(it.get("itemID", 0)) for it in my_items}
        has_completed_boots = any(int(it.get("itemID", 0)) in [3047, 3111, 3158, 3020, 3006, 3009] for it in my_items)

        # 敵チームの分析
        enemy_has_heal = any(ep.get("championName") in HEAL_HEAVY_CHAMPS for ep in enemy_players)
        cc_count = sum(1 for ep in enemy_players if ep.get("championName") in HEAVY_CC_CHAMPS)
        
        # 敵の防具集計
        enemy_armor_count = sum(
            1 for ep in enemy_players for it in ep.get("items", [])
            if any(k in it.get("displayName", "").lower() for k in ["armor", "sunfire", "thornmail", "heartsteel", "frozen", "tabi"])
        )
        enemy_ap_count = sum(
            1 for ep in enemy_players if ep.get("championName") in ["Ahri", "Elise", "Sylas", "Vladimir", "Syndra", "Orianna", "Viktor", "Veigar", "Evelynn"]
        )

        # チャンピオン名正規化マッチング (大文字小文字・記号・別名を完全吸収)
        norm_name = str(my_champion).replace(" ", "").replace("'", "").replace(".", "").lower()
        blueprint = None
        for k, v in CHAMPION_CORE_BLUEPRINTS.items():
            if k.replace(" ", "").replace("'", "").replace(".", "").lower() == norm_name:
                blueprint = v
                break

        if not blueprint:
            # チャンピオン名キーワードによる推論フォールバック
            c_low = norm_name
            if any(k in c_low for k in ["heimer", "lux", "ahri", "syndra", "veigar", "viktor", "hwei", "xerath", "velkoz", "ziggs", "anivia", "brand", "malzahar", "cassiopeia", "teemo", "kennen", "swain", "annie", "kassadin", "ryze", "zoe"]):
                blueprint = {"class": "ap_mage", "first_core": "LiandrysTorment" if "heimer" in c_low or "teemo" in c_low or "brand" in c_low else "LudensCompanion", "second_cores": ["Shadowflame", "ZhonyasHourglass"], "boots_default": "SorcerersShoes"}
            elif any(k in c_low for k in ["urgot", "darius", "garen", "sett", "illaoi", "yorick", "mordekaiser"]):
                blueprint = {"class": "ad_juggernaut", "first_core": "BlackCleaver" if "urgot" in c_low else "SunderedSky", "second_cores": ["SteraksGage", "TitanicHydra"], "boots_default": "PlatedSteelcaps"}
            elif any(k in c_low for k in ["kaisa", "jinx", "vayne", "caitlyn", "ashe", "jhin", "lucian", "sivir", "tristana", "varus", "kogmaw", "aphelios", "kalista", "quinn", "akshan"]):
                blueprint = {"class": "marksman", "first_core": "KrakenSlayer", "second_cores": ["InfinityEdge", "LordDominiksRegards"], "boots_default": "BerserkersGreaves"}
            elif any(k in c_low for k in ["zed", "talon", "qiyana", "khazix", "rengar", "naafiri", "shaco", "pyke", "kayn"]):
                blueprint = {"class": "ad_assassin", "first_core": "ProfaneHydra", "second_cores": ["YoumuusGhostblade", "SeryldasGrudge"], "boots_default": "IonianBoots"}
            elif any(k in c_low for k in ["malphite", "ornn", "sion", "mundo", "chogath", "zac", "sejuani", "amumu", "rammus", "shen", "poppy", "tahm"]):
                blueprint = {"class": "tank", "first_core": "SunfireAegis", "second_cores": ["Heartsteel", "KaenicRookern"], "boots_default": "PlatedSteelcaps"}
            elif any(k in c_low for k in ["nautilus", "leona", "thresh", "blitzcrank", "alistar", "braum", "rell"]):
                blueprint = {"class": "tank_support", "first_core": "LocketOfTheIronSolari", "second_cores": ["KnightsVow", "Trailblazer"], "boots_default": "BootsOfSwiftness"}
            elif any(k in c_low for k in ["lulu", "nami", "soraka", "janna", "sona", "milio", "yuumi", "ivern"]):
                blueprint = {"class": "enchanter", "first_core": "MoonstoneRenewer", "second_cores": ["EchoesOfHelia", "ArdentCenser"], "boots_default": "IonianBoots"}
            else:
                blueprint = {"class": "ad_fighter", "first_core": "SunderedSky", "second_cores": ["Eclipse", "BlackCleaver"], "boots_default": "PlatedSteelcaps"}

        champ_class = blueprint.get("class", "ad_fighter")
        
        # 完成コア数 (価格2600G以上または代表的完成アイテム)
        completed_core_count = sum(
            1 for it in my_items
            if ItemPriceManager.get_item_price(it.get("itemID", 0)) >= 2600
            or it.get("price", 0) >= 2600
        )

        # --- 判定1: 回復阻害（重傷）が最優先で必要か？ ---
        has_heal_cut = any(it.get("itemID") in [3123, 3916, 3076, 3033, 3165, 3075] for it in my_items)
        if enemy_has_heal and not has_heal_cut and completed_core_count >= 1:
            if "ap" in champ_class:
                it_info = ITEM_DB.get("OblivionOrb")
                if not is_item_owned(it_info, my_items):
                    return {
                        "item_name": it_info["name"],
                        "price": it_info["price"],
                        "tag": "🩸 重傷必須",
                        "reason": "敵に強回復持ちがいます。800G忘却のオーブで回復を半減させましょう！",
                        "priority": "HIGH",
                    }
            elif "tank" in champ_class:
                it_info = ITEM_DB.get("BrambleVest")
                if not is_item_owned(it_info, my_items):
                    return {
                        "item_name": it_info["name"],
                        "price": it_info["price"],
                        "tag": "🩸 重傷反射",
                        "reason": "敵の通常攻撃・回復持ちに対抗するため、800Gブランブルを挟みましょう！",
                        "priority": "HIGH",
                    }
            else:
                it_info = ITEM_DB.get("ExecutionersCalling")
                if not is_item_owned(it_info, my_items):
                    return {
                        "item_name": it_info["name"],
                        "price": it_info["price"],
                        "tag": "🩸 重傷必須",
                        "reason": "敵の回復量が激しいため、800Gの処刑人を早期購入してキルラインを下げましょう！",
                        "priority": "HIGH",
                    }

        # --- 判定2: 靴のアップグレード ---
        if not has_completed_boots and completed_core_count >= 1:
            if cc_count >= 2:
                b_info = ITEM_DB.get("MercuryTreads")
            elif enemy_ap_count >= 3:
                b_info = ITEM_DB.get("MercuryTreads")
            else:
                b_key = blueprint.get("boots_default", "PlatedSteelcaps")
                b_info = ITEM_DB.get(b_key, ITEM_DB["PlatedSteelcaps"])
            
            if not is_item_owned(b_info, my_items):
                return {
                    "item_name": b_info["name"],
                    "price": b_info["price"],
                    "tag": "👟 靴完成",
                    "reason": "移動速度と戦闘ステータス（耐性/攻撃速度）を確保して機動力を最大化！",
                    "priority": "HIGH",
                }

        # --- 判定3: 敵タンク多数・高AR時の貫通アイテム ---
        has_armor_pen = any(it.get("itemID") in [3071, 3036, 6694, 3302] for it in my_items)
        if enemy_armor_count >= 3 and not has_armor_pen and completed_core_count >= 2:
            if "ad" in champ_class:
                bc_info = ITEM_DB.get("BlackCleaver")
                if not is_item_owned(bc_info, my_items):
                    return {
                        "item_name": bc_info["name"],
                        "price": bc_info["price"],
                        "tag": "🛡️ 物理破砕",
                        "reason": "敵前衛が硬化中。味方全員の物理与ダメージを引き上げる黒斧を推奨！",
                        "priority": "HIGH",
                    }

        # --- 判定4: 敵APバーストが育っている時の防魔アイテム ---
        has_mr_item = any(it.get("itemID") in [3156, 2504, 3001, 3065] for it in my_items)
        if enemy_ap_count >= 3 and not has_mr_item and completed_core_count >= 2:
            if "ad" in champ_class:
                maw_info = ITEM_DB.get("MawOfMalmortius")
                if not is_item_owned(maw_info, my_items):
                    return {
                        "item_name": maw_info["name"],
                        "price": maw_info["price"],
                        "tag": "🛡️ 対APバリア",
                        "reason": "敵APのバースト対策。HP低下時に巨大な魔法シールドを展開！",
                        "priority": "HIGH",
                    }
            else:
                kr_info = ITEM_DB.get("KaenicRookern")
                if not is_item_owned(kr_info, my_items):
                    return {
                        "item_name": kr_info["name"],
                        "price": kr_info["price"],
                        "tag": "🛡️ 最強対AP盾",
                        "reason": "常時魔法ダメージシールドを付与し、敵メイジのポーク・コンボを無効化！",
                        "priority": "HIGH",
                    }

        # --- 判定5: 1stコア / 2ndコア / 3rdコア以降の順次推薦 ---
        core1_key = blueprint.get("first_core", "SunderedSky")
        core1_info = ITEM_DB.get(core1_key, {"name": "サンダード スカイ", "price": 3100, "id": 6610})

        # 1st コア未所持なら 1st コア
        if not is_item_owned(core1_info, my_items):
            return {
                "item_name": core1_info["name"],
                "price": core1_info["price"],
                "tag": "👑 1st コア",
                "reason": f"{my_champion} のパワースパイクの核。完成時のサステインと火力が劇的向上！",
                "priority": "HIGH",
            }

        # 2nd コア候補から未所持のものを選択
        core2_candidates = blueprint.get("second_cores", ["Eclipse", "BlackCleaver"])
        for c2_k in core2_candidates:
            c2_info = ITEM_DB.get(c2_k)
            if c2_info and not is_item_owned(c2_info, my_items):
                return {
                    "item_name": c2_info["name"],
                    "price": c2_info["price"],
                    "tag": "⚔️ 2nd コア",
                    "reason": "1stコアとの相乗効果で集団戦の生存率とバースト火力を最大化！",
                    "priority": "HIGH",
                }

        # 3rd コア以降（ロール別 未所持の決定打アイテム）
        fallback_pool = []
        if "ap" in champ_class:
            fallback_pool = ["ZhonyasHourglass", "RabadonsDeathcap", "VoidStaff", "Shadowflame", "LiandrysTorment"]
        elif "marksman" in champ_class:
            fallback_pool = ["InfinityEdge", "LordDominiksRegards", "GuardianAngel", "Bloodthirster", "MortalReminder"]
        elif "tank" in champ_class:
            fallback_pool = ["KaenicRookern", "Thornmail", "WarmogsArmor", "FrozenHeart", "UnendingDespair"]
        else: # ad_fighter / ad_assassin
            fallback_pool = ["SteraksGage", "BlackCleaver", "GuardianAngel", "DeathDance", "MawOfMalmortius", "SeryldasGrudge"]

        for item_key in fallback_pool:
            cand_info = ITEM_DB.get(item_key)
            if cand_info and not is_item_owned(cand_info, my_items):
                return {
                    "item_name": cand_info["name"],
                    "price": cand_info["price"],
                    "tag": "🛡️ 3rd+ コア",
                    "reason": f"集団戦での決定打と生存力を最大化する最適アイテム！",
                    "priority": "MID",
                }

        # 最終フォールバック (エリクサー等)
        return {
            "item_name": "憤怒のエリクサー",
            "price": 500,
            "tag": "🍷 決戦強化",
            "reason": "フルビルド達成！エリクサーを服用して決戦のステータスを底上げしましょう。",
            "priority": "LOW",
        }
