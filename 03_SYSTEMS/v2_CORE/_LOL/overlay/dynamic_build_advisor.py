"""
Sovereign HUD - 動的ビルド推薦エンジン (Dynamic Build Advisor)
=============================================================
敵5人の構成（AD/AP比率、回復持ち、アーマー/MR防具、CC数）および
自身のチャンピオン、現在所持アイテム、ゲーム時間から
「次に買うべき最適なコアアイテム/対抗アイテム」をリアルタイムに自動判定する。
"""

# 主要アイテムのID・名前・価格・アイコン名
ITEM_DB = {
    # ブーツ
    "PlatedSteelcaps": {"id": 3047, "name": "プレート スチールキャップ", "price": 1100, "icon": "3047.png", "type": "boots"},
    "MercuryTreads": {"id": 3111, "name": "マーキュリー ブーツ", "price": 1200, "icon": "3111.png", "type": "boots"},
    "IonianBoots": {"id": 3158, "name": "アイオニア ブーツ (明敏の靴)", "price": 900, "icon": "3158.png", "type": "boots"},
    "SorcerersShoes": {"id": 3020, "name": "ソーサラー シューズ", "price": 1100, "icon": "3020.png", "type": "boots"},
    "BerserkersGreaves": {"id": 3006, "name": "バーサーカー ブーツ", "price": 1100, "icon": "3006.png", "type": "boots"},
    "BootsOfSwiftness": {"id": 3009, "name": "スイフトネス ブーツ", "price": 1000, "icon": "3009.png", "type": "boots"},

    # 重傷（回復阻害）
    "ExecutionersCalling": {"id": 3123, "name": "処刑人の劫罰 (重傷)", "price": 800, "icon": "3123.png", "type": "heal_cut"},
    "OblivionOrb": {"id": 3916, "name": "忘却のオーブ (重傷)", "price": 800, "icon": "3916.png", "type": "heal_cut"},
    "BrambleVest": {"id": 3076, "name": "ブランブル ベスト (重傷)", "price": 800, "icon": "3076.png", "type": "heal_cut"},
    "MortalReminder": {"id": 3033, "name": "モータル リマインダー", "price": 3000, "icon": "3033.png", "type": "heal_cut"},
    "Morellonomicon": {"id": 3165, "name": "モレロノミコン", "price": 2200, "icon": "3165.png", "type": "heal_cut"},
    "Thornmail": {"id": 3075, "name": "ソーンメイル", "price": 2700, "icon": "3075.png", "type": "heal_cut"},

    # 貫通（AR/MR対策）
    "BlackCleaver": {"id": 3071, "name": "ブラック クリーバー (物理破砕)", "price": 3000, "icon": "3071.png", "type": "pen"},
    "LordDominiksRegards": {"id": 3036, "name": "ドミニク リガード (物理貫通)", "price": 3000, "icon": "3036.png", "type": "pen"},
    "SeryldasGrudge": {"id": 6694, "name": "セリルダの怨恨 (物理貫通)", "price": 3200, "icon": "6694.png", "type": "pen"},
    "Cryptbloom": {"id": 3137, "name": "クリプトブルーム (魔法貫通)", "price": 2850, "icon": "3137.png", "type": "pen"},
    "VoidStaff": {"id": 3135, "name": "ヴォイド スタッフ (魔法貫通)", "price": 3000, "icon": "3135.png", "type": "pen"},

    # 汎用コアアイテム
    "SunderedSky": {"id": 6610, "name": "サンダード スカイ", "price": 3100, "icon": "6610.png", "type": "core"},
    "Eclipse": {"id": 6692, "name": "エクリプス", "price": 2800, "icon": "6692.png", "type": "core"},
    "TrinityForce": {"id": 3078, "name": "トリニティ フォース", "price": 3333, "icon": "3078.png", "type": "core"},
    "SteraksGage": {"id": 3053, "name": "ステラックの篭手", "price": 3200, "icon": "3053.png", "type": "defensive_core"},
    "MawOfMalmortius": {"id": 3156, "name": "マルモティウスの胃袋", "price": 3100, "icon": "3156.png", "type": "mr_core"},
    "ZhonyasHourglass": {"id": 3157, "name": "ゾーニャの砂時計", "price": 3250, "icon": "3157.png", "type": "core"},
    "LudensCompanion": {"id": 3285, "name": "ルーデン コンパニオン", "price": 3000, "icon": "3285.png", "type": "core"},
    "InfinityEdge": {"id": 3031, "name": "インフィニティ エッジ", "price": 3400, "icon": "3031.png", "type": "core"},
    "GuinsoosRageblade": {"id": 3124, "name": "グインソー レイジブレード", "price": 3000, "icon": "3124.png", "type": "core"},
    "Heartsteel": {"id": 3084, "name": "ハートスチール", "price": 3000, "icon": "3084.png", "type": "core"},
    "KaenicRookern": {"id": 2504, "name": "カイーニック ルーケーン (対AP最強盾)", "price": 2900, "icon": "2504.png", "type": "mr_core"},
}

# チャンピオン別 基本ビルドツリー (1stコア, 2ndコア, 3rdコア候補)
CHAMPION_CORE_BLUEPRINTS = {
    "Aatrox": {
        "class": "ad_fighter",
        "first_core": "SunderedSky",
        "second_cores": ["Eclipse", "BlackCleaver", "SteraksGage"],
        "boots_default": "PlatedSteelcaps",
    },
    "Darius": {
        "class": "ad_juggernaut",
        "first_core": "TrinityForce",
        "second_cores": ["SteraksGage", "BlackCleaver", "DeadMansPlate"],
        "boots_default": "PlatedSteelcaps",
    },
    "Ahri": {
        "class": "ap_mage",
        "first_core": "LudensCompanion",
        "second_cores": ["ZhonyasHourglass", "Shadowflame", "RabadonsDeathcap"],
        "boots_default": "SorcerersShoes",
    },
    "Zed": {
        "class": "ad_assassin",
        "first_core": "YoumuusGhostblade",
        "second_cores": ["Eclipse", "SeryldasGrudge", "ProfaneHydra"],
        "boots_default": "IonianBoots",
    },
    "Jinx": {
        "class": "marksman",
        "first_core": "KrakenSlayer",
        "second_cores": ["InfinityEdge", "RunaansHurricane", "LordDominiksRegards"],
        "boots_default": "BerserkersGreaves",
    },
    "KaiSa": {
        "class": "marksman",
        "first_core": "GuinsoosRageblade",
        "second_cores": ["NashorsTooth", "Terminus", "ZhonyasHourglass"],
        "boots_default": "BerserkersGreaves",
    }
}

HEAL_HEAVY_CHAMPS = {
    "Aatrox", "Warwick", "Vladimir", "Soraka", "Briar", "Swain",
    "Fiora", "Sylas", "DrMundo", "Yuumi", "Olaf", "Illaoi", "Irelia"
}

HEAVY_CC_CHAMPS = {
    "Leona", "Nautilus", "Malzahar", "Morgana", "Amumu", "Sejuani",
    "Rell", "Maokai", "Lissandra", "Skarner", "Thresh", "Blitzcrank"
}

class DynamicBuildAdvisor:
    @staticmethod
    def advise_next_item(
        my_champion: str,
        my_items: list,
        enemy_players: list,
        game_time_sec: float
    ) -> dict:
        """次に購入すべき最適なアイテムとその理由を判定"""
        my_item_names = {it.get("displayName", "") for it in my_items}
        my_item_ids = {it.get("itemID", 0) for it in my_items}
        has_boots = any(it.get("itemID") in [3047, 3111, 3158, 3020, 3006, 3009, 1001] for it in my_items)
        has_completed_boots = any(it.get("itemID") in [3047, 3111, 3158, 3020, 3006, 3009] for it in my_items)

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

        blueprint = CHAMPION_CORE_BLUEPRINTS.get(my_champion, {
            "class": "ad_fighter",
            "first_core": "SunderedSky",
            "second_cores": ["Eclipse", "BlackCleaver"],
            "boots_default": "PlatedSteelcaps"
        })

        champ_class = blueprint.get("class", "ad_fighter")
        completed_core_count = sum(1 for it in my_items if it.get("price", 0) >= 2600)

        # --- 判定1: 回復阻害（重傷）が最優先で必要か？ ---
        has_heal_cut = any(it.get("itemID") in [3123, 3916, 3076, 3033, 3165, 3075] for it in my_items)
        if enemy_has_heal and not has_heal_cut and completed_core_count >= 1:
            if "ap" in champ_class:
                return {
                    "item_name": "忘却のオーブ",
                    "price": 800,
                    "tag": "🩸 重傷必須",
                    "reason": "敵に強回復持ち（Vlad/Soraka/Aatrox等）がいます。800G素材で回復を半減させましょう！",
                    "priority": "HIGH",
                }
            elif "tank" in champ_class:
                return {
                    "item_name": "ブランブル ベスト",
                    "price": 800,
                    "tag": "🩸 重傷反射",
                    "reason": "敵の通常攻撃・回復持ちに対抗するため、800Gブランブルを挟みましょう！",
                    "priority": "HIGH",
                }
            else:
                return {
                    "item_name": "処刑人の劫罰",
                    "price": 800,
                    "tag": "🩸 重傷必須",
                    "reason": "敵の回復量が激しいため、800Gの処刑人を早期購入してキルラインを下げましょう！",
                    "priority": "HIGH",
                }

        # --- 判定2: 靴のアップグレード ---
        if not has_completed_boots and completed_core_count >= 1:
            if cc_count >= 2:
                return {
                    "item_name": "マーキュリー ブーツ",
                    "price": 1200,
                    "tag": "👟 CC耐性靴",
                    "reason": f"敵にハードCC持ちが{cc_count}人います。行動不能時間を30%短縮して生き残りを優先！",
                    "priority": "HIGH",
                }
            elif enemy_ap_count >= 3:
                return {
                    "item_name": "マーキュリー ブーツ",
                    "price": 1200,
                    "tag": "👟 魔法防御靴",
                    "reason": "敵チームはAPダメージが主体です。魔法防御を稼ぎましょう！",
                    "priority": "MID",
                }
            else:
                return {
                    "item_name": "プレート スチールキャップ",
                    "price": 1100,
                    "tag": "👟 物理防御靴",
                    "reason": "敵の通常攻撃ダメージを12%軽減。対面との殴り合いで圧倒的優位に！",
                    "priority": "MID",
                }

        # --- 判定3: 敵タンク多数・高AR時の貫通アイテム ---
        has_armor_pen = any(it.get("itemID") in [3071, 3036, 6694] for it in my_items)
        if enemy_armor_count >= 3 and not has_armor_pen and completed_core_count >= 2:
            if "ad" in champ_class:
                return {
                    "item_name": "ブラック クリーバー",
                    "price": 3000,
                    "tag": "🛡️ 物理破砕",
                    "reason": "敵前衛が硬化中。味方全員の物理与ダメージを引き上げる黒斧を推奨！",
                    "priority": "HIGH",
                }

        # --- 判定4: 敵APバーストが育っている時の防魔アイテム ---
        has_mr_item = any(it.get("itemID") in [3156, 2504, 3001] for it in my_items)
        if enemy_ap_count >= 3 and not has_mr_item and completed_core_count >= 2:
            if "ad" in champ_class:
                return {
                    "item_name": "マルモティウスの胃袋",
                    "price": 3100,
                    "tag": "🛡️ 対APバリア",
                    "reason": "敵APのバースト対策。HP低下時に巨大な魔法シールドを展開！",
                    "priority": "HIGH",
                }
            else:
                return {
                    "item_name": "カイーニック ルーケーン",
                    "price": 2900,
                    "tag": "🛡️ 最強対AP盾",
                    "reason": "常時魔法ダメージシールドを付与し、敵メイジのポーク・コンボを無効化！",
                    "priority": "HIGH",
                }

        # --- 判定5: 1stコア / 2ndコアの基本進行 ---
        if completed_core_count == 0:
            core1_key = blueprint.get("first_core", "SunderedSky")
            core1_info = ITEM_DB.get(core1_key, {"name": "サンダード スカイ", "price": 3100})
            return {
                "item_name": core1_info["name"],
                "price": core1_info["price"],
                "tag": "👑 1st コア",
                "reason": f"{my_champion} のパワースパイクの核。完成時のサステインと火力が劇的向上！",
                "priority": "HIGH",
            }
        elif completed_core_count == 1:
            core2_key = blueprint.get("second_cores", ["Eclipse"])[0]
            core2_info = ITEM_DB.get(core2_key, {"name": "エクリプス", "price": 2800})
            return {
                "item_name": core2_info["name"],
                "price": core2_info["price"],
                "tag": "⚔️ 2nd コア",
                "reason": "1stコアとの相乗効果で集団戦の生存率とバースト火力を最大化！",
                "priority": "HIGH",
            }
        else:
            return {
                "item_name": "ステラックの篭手",
                "price": 3200,
                "tag": "🛡️ 3rd 集団戦耐久",
                "reason": "集団戦でのフォーカス集中を耐え抜く巨大シールドを確保！",
                "priority": "MID",
            }
