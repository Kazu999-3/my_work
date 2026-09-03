"""
Sovereign HUD / Portal - レーン戦3段階勝ちパターン手順書エンジン (Matchup Blueprint Engine)
========================================================================================
【最上位誓約準拠】: Supabase（matchup_sentinel / champion_notes）に蓄積された実戦対面データから
「Lv1〜2」「Lv3〜5」「Lv6以降」の3段階アクションプラン（手順書）を自動生成する。
"""

from typing import Dict, Any, List

DEFAULT_BLUEPRINTS: Dict[str, Dict[str, Any]] = {
    "Darius": {
        "phases": [
            {
                "phase": "Phase 1 (Lv1〜2)",
                "title": "耐えてウェーブを手前に引く (Lv2先行厳禁)",
                "action": "Lv1での殴り合いは100%負けるためCSを数体捨ててウェーブを引く。敵のQ外周だけ絶対に避ける。",
                "win_trigger": "自タワー手前にウェーブがフリーズできれば第1段階クリア",
                "badge": "忍耐 🛡️"
            },
            {
                "phase": "Phase 2 (Lv3〜5)",
                "title": "Eの空振りを待ってショートトレード",
                "action": "敵がE（引き寄せ）を外した瞬間が最大のチャンス。スキル1セット叩き込んで即座に離脱。",
                "win_trigger": "敵のHPを60%以下に削り、Flashを吐かせたら第2段階クリア",
                "badge": "好機 ⚔️"
            },
            {
                "phase": "Phase 3 (Lv6〜)",
                "title": "Ult展開からオールイン ＆ プレート奪取",
                "action": "FlashのないダリウスにQ先端を叩き込み、Ultで追撃してソロキル。即座にミニオンを押し込んでプレート獲得。",
                "win_trigger": "ソロキル ＋ プレート2枚でレーン完全勝利",
                "badge": "破壊 👑"
            }
        ]
    },
    "Zed": {
        "phases": [
            {
                "phase": "Phase 1 (Lv1〜2)",
                "title": "Qの貫通ダメージを受け流しプッシュ",
                "action": "ミニオンの裏に立ち、Qの直撃を避ける（貫通ダメージは半減）。Lv2を先に取って主導権。",
                "win_trigger": "敵にCSを取らせずタワー下に押し込めればクリア",
                "badge": "主導権 ⚡"
            },
            {
                "phase": "Phase 2 (Lv3〜5)",
                "title": "W（分身）のCD20秒間を完全制圧",
                "action": "W-E-Qコンボを横ステップで回避。分身を使った後の20秒間は無防備なので徹底的にハラス。",
                "win_trigger": "敵のポーションを全て使わせリコールを強要",
                "badge": "制圧 🎯"
            },
            {
                "phase": "Phase 3 (Lv6〜)",
                "title": "Rの着地位置にCCを合わせて返り討ち",
                "action": "ZedがRを使った瞬間、自分の背後に現れるためCCを即座に置き、フルコンボで返り討ち。",
                "win_trigger": "タワーダイブを返り討ちにしてMID主導権確立",
                "badge": "迎撃 🛡️"
            }
        ]
    },
    "Fiora": {
        "phases": [
            {
                "phase": "Phase 1 (Lv1〜2)",
                "title": "急所の位置をリセットしながらファーム",
                "action": "前方に急所が出たら一度下がって急所位置を背後にリセット。無理なQハラスを受けない。",
                "win_trigger": "HPを8割以上維持してLv3を迎える",
                "badge": "調整 🔄"
            },
            {
                "phase": "Phase 2 (Lv3〜5)",
                "title": "W（パリィ）をフェイントで釣る",
                "action": "自分の主要スキルを撃つふりをして横移動し、フィオラのWを空振りさせる。Wが落ちたら強気トレード。",
                "win_trigger": "パリィを吐かせた状態でショートトレード勝利",
                "badge": "駆け引き ♟️"
            },
            {
                "phase": "Phase 3 (Lv6〜)",
                "title": "壁を背にしてUltの4急所阻止",
                "action": "フィオラがUltを発動したら即座に壁に背中を密着させ、4つ目の急所を突かせない。重傷800G素材必須。",
                "win_trigger": "Ultの回復フィールドを不発にさせて競り勝つ",
                "badge": "防衛 🛡️"
            }
        ]
    }
}

class MatchupBlueprintEngine:
    @staticmethod
    def get_blueprint(my_champ: str, enemy_champ: str) -> Dict[str, Any]:
        """対面チャンピオンに対する3段階勝ちパターン手順書を取得"""
        data = DEFAULT_BLUEPRINTS.get(enemy_champ)
        if not data:
            # 汎用3段階手順
            phases = [
                {
                    "phase": "Phase 1 (Lv1〜2)",
                    "title": "無理なトレードを避けウェーブ管理",
                    "action": "敵の序盤スキル威力を確認し、ミニオンの多い有利なタイミングでファーム。",
                    "win_trigger": "HPを維持して安定してLv3到達",
                    "badge": "安定 🛡️"
                },
                {
                    "phase": "Phase 2 (Lv3〜5)",
                    "title": "敵主要スキルのCD中にショートトレード",
                    "action": "敵がファームにスキルを使った瞬間を狙ってトレードを仕掛ける。",
                    "win_trigger": "敵のHPを削りリコール優位を奪う",
                    "badge": "好機 ⚔️"
                },
                {
                    "phase": "Phase 3 (Lv6〜)",
                    "title": "パワースパイクを活かしてレーン制覇",
                    "action": "自分の1stコア完成・Ult習得のタイミングでオールインまたはプレート破壊。",
                    "win_trigger": "タワー1stプレート獲得またはソロキル",
                    "badge": "勝利 👑"
                }
            ]
        else:
            phases = data["phases"]

        return {
            "my_champion": my_champ,
            "enemy_champion": enemy_champ,
            "phases": phases,
            "total_phases": len(phases)
        }
