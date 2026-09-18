"""
Sovereign HUD / Portal - レーン戦3段階勝ちパターン手順書 ＆ 没理由エンジン (Matchup Blueprint Engine)
========================================================================================
【最上位誓約準拠】: 確定戦術バイブル（01_INTEL/tactics/）に蓄積された実戦対面データから
「Lv1〜2」「Lv3〜5」「Lv6以降」の3段階アクションプランおよび「⚠️ 罠・NG行動（没理由）」を自動抽出・提供する。
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
        ],
        "trap_items": "移動速度（MS）のないビルド（カイトされて1スタックも溜まらず死ぬ）",
        "forbidden_moves": "相手のCCやフラッシュが残っている状態での無謀なタワーダイブ"
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
        ],
        "trap_items": "防具なしのフル火力積み（Lv6のRバーストで即死）",
        "forbidden_moves": "W（分身）の影の位置を確認せずに接近すること"
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
        ],
        "trap_items": "集団戦用のフルタンクビルド（急所Trueダメージで溶かされる）",
        "forbidden_moves": "主要CCスキルをパリィの構えが見えている正面から撃ち込むこと"
    },
    "JarvanIV": {
        "phases": [
            {
                "phase": "Phase 1 (Lv1〜2)",
                "title": "Lv2先行即ガンクの警戒 ＆ EQ回避",
                "action": "J4のEQノックアップを横移動で回避。EQが外れたJ4は無防備なので反撃。",
                "win_trigger": "最序盤ガンクを回避しレーン主導権維持",
                "badge": "回避 🏃"
            },
            {
                "phase": "Phase 2 (Lv3〜5)",
                "title": "カウンターガンクでEQ後のJ4をフォーカス",
                "action": "J4が味方にEQで飛び込んだ直後にカウンターガンク。ブリンクの切れたJ4を集中砲火。",
                "win_trigger": "2v2小規模戦でファーストキル奪取",
                "badge": "迎撃 ⚔️"
            },
            {
                "phase": "Phase 3 (Lv6〜)",
                "title": "Rの檻からの脱出フラッシュ確保",
                "action": "R（天崩地裂）に閉じ込められた際の脱出スキルまたはフラッシュを温存。砂時計も有効。",
                "win_trigger": "Rを空振りさせて集団戦を逆転勝利",
                "badge": "脱出 🛡️"
            }
        ],
        "trap_items": "フラッシュなし・ブリンクなし構成でのガラスキャノンビルド",
        "forbidden_moves": "J4のEQの軌道上に直線的に逃げること（必ず横ステップ）"
    },
    "LeeSin": {
        "phases": [
            {
                "phase": "Phase 1 (Lv1〜2)",
                "title": "ミニオンの影に隠れてQ直撃を遮断",
                "action": "音波（Q）をミニオンで防ぐ。Qが当たらない限りリーシンは仕掛けられない。",
                "win_trigger": "序盤インベード・ガンクを無力化",
                "badge": "遮断 🛡️"
            },
            {
                "phase": "Phase 2 (Lv3〜5)",
                "title": "Q2の飛びつき着地点にCCを合わせる",
                "action": "敵がQ2で飛びついてきた瞬間にスタン・ノックバックを合わせて空中で止める。",
                "win_trigger": "飛び込みを返り討ちにしてキル奪取",
                "badge": "迎撃 🎯"
            },
            {
                "phase": "Phase 3 (Lv6〜)",
                "title": "インセク蹴りの死角をワードで潰す",
                "action": "背後からのワードジャンプRを警戒し、視界のないブッシュに近づかない。",
                "win_trigger": "ピールを徹底し自陣ADCを守り切る",
                "badge": "警戒 👁️"
            }
        ],
        "trap_items": "物理防御（AR）なしの初手フル火力積み（Q-R-Qで瞬殺）",
        "forbidden_moves": "Qが直撃した状態で味方密集地点に逃げて巻き込みRを食らうこと"
    },
    "Aatrox": {
        "phases": [
            {
                "phase": "Phase 1 (Lv1〜2)",
                "title": "Q1先端のスイートスポットを避けてファーム",
                "action": "Q1・Q2の外周先端を歩きで避ける。Q3は懐（内側）に飛び込むとスイートスポットを回避可能。",
                "win_trigger": "HPを削られずに安定してLv3到達",
                "badge": "ポジショニング 📍"
            },
            {
                "phase": "Phase 2 (Lv3〜5)",
                "title": "重傷800G（忘却のオーブ/処刑人）早期購入",
                "action": "パッシブとEの回復を重傷で半減させ、リコール後のショートトレードで圧倒。",
                "win_trigger": "重傷を付与してトレード勝利",
                "badge": "対策 ⚔️"
            },
            {
                "phase": "Phase 3 (Lv6〜)",
                "title": "R発動時のキルリセット（延長）を阻止",
                "action": "エイトロックスがRを発動したら味方とフォーカスを合わせ即座にバーストで落とし切る。",
                "win_trigger": "Rリセットを許さずに集団戦勝利",
                "badge": "制圧 👑"
            }
        ],
        "trap_items": "重傷（回復阻害）なしの初手コアビルド（殴り合いで絶対に勝てなくなる）",
        "forbidden_moves": "W（縄）に捕まった際に後方に直線移動して引き戻されること（斜め横に脱出）"
    }
}

class MatchupBlueprintEngine:
    @staticmethod
    def get_blueprint(my_champ: str, enemy_champ: str) -> Dict[str, Any]:
        """対面チャンピオンに対する3段階勝ちパターン手順書 ＆ 没理由（罠・NG行動）を取得"""
        data = DEFAULT_BLUEPRINTS.get(enemy_champ)
        if not data:
            # 汎用3段階手順 ＆ 汎用罠
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
            trap_items = "思考停止の初手フル火力積み（対面の防具やバーストで失速）"
            forbidden_moves = "敵のCCやフラッシュが残っている状態での無謀なタワーダイブ"
        else:
            phases = data["phases"]
            trap_items = data.get("trap_items", "思考停止の初手フル火力積み（対面防具で失速）")
            forbidden_moves = data.get("forbidden_moves", "防具完成前の無謀なタワーダイブ")

        return {
            "my_champion": my_champ,
            "enemy_champion": enemy_champ,
            "phases": phases,
            "total_phases": len(phases),
            "rejected": {
                "trap_items": trap_items,
                "forbidden_moves": forbidden_moves
            }
        }
