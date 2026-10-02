"""
pick_guide_generator.py - チャンピオン辞典へ「先出し/後出し/こういう時にピック」のピック判断ガイドを注入するモジュール
"""
import os
import sys
import json
import logging
from pathlib import Path

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parents[3]
MAP_PATH = ROOT_DIR / "05_PILOT" / "src" / "data" / "champions_detail_map.json"

# 主要JGチャンピオンの実戦確定ピックガイド辞書
JG_PICK_GUIDES = {
    "LeeSin": {
        "blindPick": {
            "rating": "A",
            "label": "先出し安定",
            "reason": "高い機動力と自己防衛スキルを持ち、カウンタージャングルを受けても逃げ切れるためブラインドピック耐性が高い。"
        },
        "counterPick": {
            "targets": ["Karthus", "Nidalee", "Evelynn", "MasterYi"],
            "situation": "敵JGが序盤虚弱なファーム型、またはインベード耐性が低いアサシンの時に侵入して圧倒できる。"
        },
        "whenToPick": {
            "teamSynergy": "味方レーン（特にMID/TOP）が序盤主導権を取れる構成、または味方に確定CC持ちがいる時。",
            "winCondition": "序盤2〜6分のリバー主導権からスノーボールし、20分までに試合を決定づける。"
        }
    },
    "Viego": {
        "blindPick": {
            "rating": "A",
            "label": "先出し安定",
            "reason": "クリア速度が速く、アイテムビルドの幅が広いためどんな構成相手でも腐りにくい。"
        },
        "counterPick": {
            "targets": ["Sejuani", "Zac", "Amumu"],
            "situation": "敵にタンクが多くキル関与から憑依連鎖を狙いやすい時、または敵の瞬間火力が低い時。"
        },
        "whenToPick": {
            "teamSynergy": "味方にエンゲージ役（CC持ちタンクやイニシエーター）がおり、自分が後入りでリセットを狙える構成。",
            "winCondition": "集団戦で最初の1キルを取り、パッシブ憑依でスキルを使い回して殲滅する。"
        }
    },
    "Elise": {
        "blindPick": {
            "rating": "B",
            "label": "条件付き先出し",
            "reason": "タワーダイブ能力は最強だが、試合が長引くと失速するため後半スケール型の敵構成にはリスクがある。"
        },
        "counterPick": {
            "targets": ["Kayn", "Shyvana", "Karthus"],
            "situation": "敵JGが序盤無力でLv6まで引きこもりたい構成に対し、3分タワーダイブと敵陣荒らしで試合を壊す。"
        },
        "whenToPick": {
            "teamSynergy": "味方TOPやBOTが強力な確定スタン・スロウを持ち、Lv3タワーダイブを仕掛けられる構成。味方がAD過多の時のAP枠。",
            "winCondition": "序盤10分以内にダイブで2レーンを完全崩壊させ、ヘラルドでタワーを割り切る。"
        }
    },
    "Lillia": {
        "blindPick": {
            "rating": "B",
            "label": "状況見てピック",
            "reason": "序盤のインベードに弱く、確定CCを持つアサシンJG（Jarvan, Vi）に捕まると脆い。"
        },
        "counterPick": {
            "targets": ["Udyr", "Skarner", "Trundle", "Volibear"],
            "situation": "敵がスキルショット依存や近接メレー過多で、移動速度差によるカイトが刺さる時。"
        },
        "whenToPick": {
            "teamSynergy": "味方TOP/MIDがAD偏重でAPダメージが不足している時、かつ敵にタンク・ブルーザーが多い時。",
            "winCondition": "中盤以降の集団戦でQパッシブの超高機動からR（子守唄）で敵複数体を眠らせて壊滅させる。"
        }
    },
    "Zac": {
        "blindPick": {
            "rating": "A",
            "label": "先出し安定",
            "reason": "画面外からの理不尽なEエンゲージにより、どんなレーン状況からでもガンクを成立させられる。"
        },
        "counterPick": {
            "targets": ["Graves", "Nidalee", "Kindred"],
            "situation": "敵にピール（引き剥がし）スキルやノックバックが少なく、飛び込みを止められない時。"
        },
        "whenToPick": {
            "teamSynergy": "味方にCC後のバーストダメージ（アサシン・メイジ）が豊富で、フロントライン（盾）が不在の時。",
            "winCondition": "視界外からのEイニシエートで敵キャリーをキャッチし、集団戦を完勝する。"
        }
    },
    "Vi": {
        "blindPick": {
            "rating": "S",
            "label": "先出し最安定",
            "reason": "R（不可避エンゲージ）により、どんな対面・どんな敵構成に対してもキャリーを無力化できる。"
        },
        "counterPick": {
            "targets": ["Zeri", "Kalista", "Lucian", "Kassadin"],
            "situation": "敵に超高機動力のワンマンキャリー（ブリンク持ちADCやアサシン）がいる時の絶対的回答。"
        },
        "whenToPick": {
            "teamSynergy": "味方MIDがローム型アサシンやバーストメイジ（Ahri, Syndra等）で、Rの拘束時間中に即死させられる時。",
            "winCondition": "敵の最重要キャリーにRを直撃させてワンコンボで落とし、数的有利を作る。"
        }
    },
    "Graves": {
        "blindPick": {
            "rating": "A",
            "label": "先出し安定",
            "reason": "高いアーマー（Eパッシブ）と高速クリアにより、ADアサシンJG相手に極めて強固。"
        },
        "counterPick": {
            "targets": ["JarvanIV", "XinZhao", "Viego", "Nocturne"],
            "situation": "敵JGがAD主体で、インベードを受けてもEのスタックで返り討ちにできる時。"
        },
        "whenToPick": {
            "teamSynergy": "味方にCCが十分あり、JGに継続火力・オブジェクト破壊速度が求められる時。",
            "winCondition": "圧倒的なファーム速度と敵キャンプの収奪（カウンターJG）でレベル・ゴールド差をつけ圧殺。"
        }
    },
    "JarvanIV": {
        "blindPick": {
            "rating": "S",
            "label": "先出し最安定",
            "reason": "Lv2〜Lv3から強力なガンクが可能で、タンクビルド・ファイタービルドの融通が利く。"
        },
        "counterPick": {
            "targets": ["Varus", "Jinx", "Ashe", "KogMaw"],
            "situation": "敵キャリーにブリンク（壁抜け）手段がなく、R（天崩地裂）に閉じ込めれば必殺となる時。"
        },
        "whenToPick": {
            "teamSynergy": "味方にAoE（範囲攻撃）やエンゲージ合わせ（Rumble, Orianna, Miss Fortune）がいる時。",
            "winCondition": "序盤の高速ガンクで味方レーンを勝ち越させ、集団戦で敵キャリーを檻に閉じ込める。"
        }
    },
    "Nocturne": {
        "blindPick": {
            "rating": "S",
            "label": "先出し最安定",
            "reason": "高速フルクリアとLv6の確定視界遮断Rにより、SoloQの連携不足を最も咎めやすい。"
        },
        "counterPick": {
            "targets": ["TwistedFate", "Shen", "Soraka"],
            "situation": "敵のグローバル支援スキル（TF・シェンのR等）を自身のR（パラノイア）の視界遮断で無力化できる時。"
        },
        "whenToPick": {
            "teamSynergy": "サイドレーンで孤立しやすい敵が多い時、または味方にダイブ追従役がいる時。",
            "winCondition": "Lv6以降、Rが上がるたびにCDごとに敵の押し込みレーンや孤立キャリーを暗殺する。"
        }
    },
    "XinZhao": {
        "blindPick": {
            "rating": "A",
            "label": "先出し安定",
            "reason": "序盤の1v1・2v2タイマンがトップクラスに強く、R（三日月守護）で敵遠距離火力を遮断できる。"
        },
        "counterPick": {
            "targets": ["Diana", "MasterYi", "Amumu"],
            "situation": "序盤のスカトル勝負で絶対に負けたくない時、または敵の集団戦メイジの砲撃をRで弾きたい時。"
        },
        "whenToPick": {
            "teamSynergy": "味方レーナーが序盤主導権を握り、リバーでのファイトを起こしやすい構成の時。",
            "winCondition": "序盤のスカトル・インベードで敵JGを叩き潰し、主導権を握り続ける。"
        }
    },
    "Kindred": {
        "blindPick": {
            "rating": "B",
            "label": "条件付き先出し",
            "reason": "マーク回収が必要なため、味方レーンがプッシュ負けしていると敵陣に入れず腐るリスクがある。"
        },
        "counterPick": {
            "targets": ["Zac", "Sejuani", "Sion", "ChoGath"],
            "situation": "敵にタンクが多く割合ダメージが刺さる時、またはR（羊の安息）で敵の即死コンボ（Zed, Syndra）を無効化できる時。"
        },
        "whenToPick": {
            "teamSynergy": "味方レーン（特にMID/TOP）がプッシュ主導権を取れる構成、かつチームにADマークスマン火力が不足している時。",
            "winCondition": "マークを重ねて射程を伸ばし、後半の第2ADCとして集団戦を制圧する。"
        }
    },
    "Sejuani": {
        "blindPick": {
            "rating": "A",
            "label": "先出し安定",
            "reason": "パッシブのアーマー・スロウ無効によりインベードに強く、長射程Rでエンゲージ・ディスエンゲージ両対応。"
        },
        "counterPick": {
            "targets": ["KhaZix", "Rengar", "Talon"],
            "situation": "敵にアサシンが多く、味方キャリーを守り切れば勝てる構成の時。"
        },
        "whenToPick": {
            "teamSynergy": "味方のTOP・MID・SUPに近接メレー（Yone, Yasuo, Renekton, Nautilus等）が多く、Eの氷結スタックを爆速で溜められる時。",
            "winCondition": "近接味方とのシナジーで敵を瞬時にスタンさせ、集団戦の主導権を握る。"
        }
    }
}

def generate_default_guide(champ_data):
    tags = champ_data.get("tags", [])
    jp_name = champ_data.get("jpName", champ_data.get("id"))
    
    if "Tank" in tags:
        return {
            "blindPick": {
                "rating": "A",
                "label": "先出し安定",
                "reason": f"防具ビルドの安定感とCCによる集団戦貢献が高く、対面を選ばずに役割を果たせる。"
            },
            "counterPick": {
                "targets": ["アサシン全般", "低耐久キャリー"],
                "situation": "敵にアサシンや瞬間火力職が多く、味方キャリーを守るピールが必要な時。"
            },
            "whenToPick": {
                "teamSynergy": "味方にフロントライン（前衛）やイニシエーター（仕掛け役）が不在の時。",
                "winCondition": "集団戦で敵の攻撃を受け止めつつCCを叩き込み、味方キャリーにダメージを出させる。"
            }
        }
    elif "Assassin" in tags:
        return {
            "blindPick": {
                "rating": "B",
                "label": "状況見てピック",
                "reason": f"敵にハードCCや耐久タンクを固められると失速しやすいため、後出しの方が真価を発揮しやすい。"
            },
            "counterPick": {
                "targets": ["逃げ場のないマークスマン", "低機動力メイジ"],
                "situation": "敵のキャリーラインが薄く、一瞬のバーストで人数有利を作りやすい時。"
            },
            "whenToPick": {
                "teamSynergy": "敵に柔らかいキャリーが多く、味方にダメージの追従手段がある時。",
                "winCondition": "視界の隙間から敵キャリーを暗殺し、オブジェクト戦の前に人数差を作る。"
            }
        }
    elif "Mage" in tags:
        return {
            "blindPick": {
                "rating": "B",
                "label": "状況見てピック",
                "reason": f"序盤の孤立戦や高機動アサシンの侵入に注意が必要。"
            },
            "counterPick": {
                "targets": ["近接メレー過多", "低射程構成"],
                "situation": "敵が近寄ってくる構成に対し、射程外からポークやAoE（範囲攻撃）で削れる時。"
            },
            "whenToPick": {
                "teamSynergy": "味方チームにAP魔法ダメージが不足している時のダメージバランス補正枠。",
                "winCondition": "オブジェクト前の視界戦で敵を遠距離から削り、有利な集団戦を展開する。"
            }
        }
    else:
        return {
            "blindPick": {
                "rating": "A" if "Fighter" in tags else "B",
                "label": "先出し安定" if "Fighter" in tags else "状況見てピック",
                "reason": f"タイマン能力とファーム速度のバランスが良く、標準的なSoloQ構成に対応可能。"
            },
            "counterPick": {
                "targets": ["特定対面"],
                "situation": "敵の弱点スキルを突けるマッチアップ、または小規模戦で有利を取れる時。"
            },
            "whenToPick": {
                "teamSynergy": "小規模戦（2v2 / 3v3）を起こしやすく、味方と連携してリバーを制圧できる時。",
                "winCondition": "序盤〜中盤の有利を広げ、パワースパイクを活かしてオブジェクトを制圧する。"
            }
        }

def inject_pick_guides():
    if not MAP_PATH.exists():
        print(f"Error: {MAP_PATH} not found")
        return

    data = json.loads(MAP_PATH.read_text(encoding="utf-8"))
    updated_count = 0

    for champ_id, c_data in data.items():
        if champ_id in JG_PICK_GUIDES:
            c_data["pickGuide"] = JG_PICK_GUIDES[champ_id]
            updated_count += 1
        else:
            c_data["pickGuide"] = generate_default_guide(c_data)
            updated_count += 1

    MAP_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"✅ Successfully injected pickGuide into {updated_count} champions in champions_detail_map.json")

if __name__ == "__main__":
    inject_pick_guides()
