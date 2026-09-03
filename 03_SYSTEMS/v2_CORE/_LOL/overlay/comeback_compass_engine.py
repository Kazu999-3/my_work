"""
Sovereign HUD - 完全流動型 劣勢逆転コンパスエンジン (Comeback Compass Engine)
============================================================================
【最上位誓約準拠】: 定型文を廃止し、自チャンピオン特性・時間帯・ゴールド差・敵構成から
「今この瞬間に最も勝率が高い逆転ルート」をリアルタイムに動的判定する。
"""

from typing import Dict, Any, Optional

# チャンピオンごとの逆転適性プロファイル
CHAMPION_COMEBACK_PROFILES = {
    # スプリットプッシュ特化型
    "Fiora": "SPLIT", "Jax": "SPLIT", "Camille": "SPLIT", "Tryndamere": "SPLIT",
    "Yorick": "SPLIT", "Nasus": "SPLIT", "Gwen": "SPLIT", "Illaoi": "SPLIT",
    
    # ピックオフ（暗殺・キャッチ）特化型
    "Ahri": "PICKOFF", "Zed": "PICKOFF", "Blitzcrank": "PICKOFF", "Thresh": "PICKOFF",
    "LeBlanc": "PICKOFF", "Pyke": "PICKOFF", "Rengar": "PICKOFF", "Evelynn": "PICKOFF",
    
    # レイトゲーム集団戦・ファーム遅延型
    "Aatrox": "TURTLE_TEAMFIGHT", "Orianna": "TURTLE_TEAMFIGHT", "Jinx": "TURTLE_TEAMFIGHT",
    "Malphite": "TURTLE_TEAMFIGHT", "Kayle": "TURTLE_TEAMFIGHT", "Viktor": "TURTLE_TEAMFIGHT",
    "Aphelios": "TURTLE_TEAMFIGHT", "Vladimir": "TURTLE_TEAMFIGHT", "Smolder": "TURTLE_TEAMFIGHT"
}

class ComebackCompassEngine:
    @staticmethod
    def evaluate_comeback_strategy(
        my_champion: str,
        gold_diff: int,
        game_time_sec: float,
        enemy_team: list = None
    ) -> Optional[Dict[str, Any]]:
        """
        ゴールド差が劣勢（-2,000G以下）の際、チャンピオン特性と時間帯に応じた最適な逆転ルートを動的生成。
        """
        if gold_diff > -2000:
            return None  # 互角または優勢時は表示不要

        gold_deficit = abs(gold_diff)
        profile = CHAMPION_COMEBACK_PROFILES.get(my_champion, "TURTLE_TEAMFIGHT")
        is_late_game = game_time_sec > 1500.0  # 25分以降

        if profile == "SPLIT":
            strategy = "スプリット ＆ 敵2人拘束ルート ⚔️"
            advice = f"正面5v5は {gold_deficit:,}G 差で即全滅。サイドレーンを深押しして敵キャリー2人を引きつけ、味方にオブジェクト/タワー防衛のスペースを作れ！"
            tag = "SPLIT_PUSH"
            priority_action = "逆サイドのミニオンウェーブを押し込み、1v1の有利を押し付ける"

        elif profile == "PICKOFF":
            strategy = "シャットダウン暗殺 ＆ 5v4強制作成ルート 🎯"
            advice = f"正面当たりは不利。ピンクワードで視界を消し、甘えてサイドファームに来る敵キャリーを1体暗殺して懸賞金回収 ＆ 5v4の数的優位を作れ！"
            tag = "PICKOFF"
            priority_action = "川のデッドゾーンで待ち伏せし、敵ADC/MIDをキャッチ"

        else: # TURTLE_TEAMFIGHT (集団戦レイトスケール)
            if not is_late_game:
                strategy = "タワー下防衛 ＆ パワースパイク遅延ルート 🛡️"
                advice = f"川での野戦は全拒否。タワー下でミニオンを消し続け、{my_champion} の3コア完成/Lv16まで試合を安全に引き延ばせ！"
                tag = "TURTLE_FARM"
                priority_action = "視界のない川には出ず、自陣ジャングルとタワー下でファーム徹底"
            else:
                strategy = "一発逆転 チョークポイント集団戦ルート 👑"
                advice = f"レイトゲーム到達。バロン/ドラゴン前の狭い通路（チョークポイント）に敵を誘い込み、範囲CC ＆ Ult一撃で壊滅させろ！"
                tag = "CHOKEPOINT_FIGHT"
                priority_action = "狭い地形でUltを複数人にヒットさせるフォーカスを徹底"

        return {
            "active": True,
            "strategy": strategy,
            "advice": advice,
            "tag": tag,
            "priority_action": priority_action,
            "gold_deficit": gold_deficit,
        }
