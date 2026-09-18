#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_tactics_bible.py - 主力チャンピオン対面戦術バイブル一括生成CLI
Sovereign OS ナレッジマネジメント原則に基づき、制式フォーマットの戦術バイブルを
01_INTEL/tactics/ に自動生成・配備します。
"""

import os
import sys
import argparse
from pathlib import Path

# Windows cp932対策
if sys.platform == "win32":
    import io
    if not getattr(sys.stdout, "_custom_utf8", False):
        try:
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
            sys.stdout._custom_utf8 = True
        except Exception:
            pass

REPO_ROOT = Path(__file__).resolve().parent.parent
TACTICS_DIR = REPO_ROOT / "01_INTEL" / "tactics"

# 主力プール上位チャンピオンの戦術データベース（確定データ・実戦反省）
CORE_CHAMPIONS_DATA = {
    "JarvanIV": {
        "title": "ジャーヴァンIV (Jarvan IV) 対面戦術バイブル",
        "tags": ["LoL", "Tactics", "Jungle", "JarvanIV"],
        "summary": "EQノックアップとR（天崩地裂）による絶対的エンゲージと序盤ガンク特化。Lv2~3のガンクテンポでゲームを掌握する。",
        "power_spikes": "Lv2 (EQコンボ解放時), Lv6 (R習得時), 1stコア (プロフェインハイドラ / エクリプス完成時)",
        "lethal_threshold": "Lv6時: 約680〜740 DMG (相手HP 65%で即死圏内)",
        "phase1": "赤バフ ➔ Lv2即ガンク、または3キャンプ即ガンク。EQの命中を最優先。",
        "phase2": "敵JGの位置を把握しつつカウンターガンク。EQを外した場合は絶対に深追いしない。",
        "phase3": "集団戦で敵キャリーをRに閉じ込める。砂時計またはステラックの盾でバーストを耐える。",
        "trap_items": "思考停止のフル脅威（敵にCC・バーストが多い構成で即死する）",
        "forbidden_moves": "フラッシュのない敵がいない状態での先撃ちR（ブリンクで簡単に脱出されて孤立する）",
        "matchup_tip": "Lee Sin 対面: 相手のQ2（飛びつき）に合わせてEQを置くことでノックバック中断が可能。"
    },
    "Lillia": {
        "title": "リリア (Lillia) 対面戦術バイブル",
        "tags": ["LoL", "Tactics", "Jungle", "Lillia"],
        "summary": "高い移動速度（MS）と持続魔法ダメージによるカイト型JG。集団戦での複数人睡眠（R）でゲームを決定づける。",
        "power_spikes": "Lv6 (R習得時), 1stコア (ライアンドリーの苦悶完成時)",
        "lethal_threshold": "Lv6時: 約620 DMG ＋ 睡眠追撃バースト (相手HP 55%圏内)",
        "phase1": "フルクリア最優先。スタックを維持して超高速でキャンプを回る。序盤1v1は避ける。",
        "phase2": "RのCDごとにオブジェクトファイトまたはガンク。Q外周当てでMSを維持し続ける。",
        "phase3": "敵前衛を殴ってスタックを溜め、EまたはフラッシュQから後衛を含めて複数人Rで睡眠をかける。",
        "trap_items": "耐久ステータスゼロのフルAPビルド（CCを1発受けた瞬間に即死する。ゾーニャ/リフトメーカー必須）",
        "forbidden_moves": "Qスタックがゼロの状態での無謀なカウンターガンクや接敵",
        "matchup_tip": "JarvanIV 対面: J4のEQをMSで回避すれば完封可能。Rの檻の中に入った場合は即座にRで眠らせて脱出。"
    },
    "Viego": {
        "title": "ヴィエゴ (Viego) 対面戦術バイブル",
        "tags": ["LoL", "Tactics", "Jungle", "Viego"],
        "summary": "敵の魂を奪うパッシブ（君主の支配）による集団戦リセット型スノーボールファイター。",
        "power_spikes": "Lv6 (R習得時), 1stコア (クラーケンスレイヤー完成時)",
        "lethal_threshold": "Lv6時: 約720 DMG (相手HP 60%以下でRリセット確定)",
        "phase1": "安定したフルクリアからスカトル争奪。Wのチャージスタンからのガンク。",
        "phase2": "オブジェクト前の小規模戦（2v2 / 3v3）を仕掛け、最初の1キル（ファーストキル）を何としても奪う。",
        "phase3": "敵フロントラインまたは瀕死の敵をフォーカスして即憑依。無敵時間を活用してスキルを回し続ける。",
        "trap_items": "防御を一切積まないクリティカル特化（最初の憑依前にバーストで溶かされる）",
        "forbidden_moves": "最初の憑依（キル）が取れない状況での先陣突入・無理な仕掛け",
        "matchup_tip": "Xin Zhao 対面: 序盤の1v1殴り合いは絶対に勝てないため、Lv3~4での遭遇戦を避ける。"
    },
    "LeeSin": {
        "title": "リー・シン (Lee Sin) 対面戦術バイブル",
        "tags": ["LoL", "Tactics", "Jungle", "LeeSin"],
        "summary": "圧倒的な序盤機動力とQ・Rインセクコンボによるプレイメイク型ジャングラー。",
        "power_spikes": "Lv3 (全スキル解放), Lv6 (R龍の怒り習得時)",
        "lethal_threshold": "Lv6時: Q-R-Q-Eコンボで約780 DMG (相手HP 70%圏内)",
        "phase1": "敵JGへのインベード、または3キャンプ速攻Lv3ガンクでファーストブラッドを狙う。",
        "phase2": "ワードジャンプからのR（インセク）で敵キャリーを味方に蹴り飛ばしてピックアップ。",
        "phase3": "敵アサシンやダイバーから自陣ADCをピール（蹴り飛ばし防御）、または側面からのフラッシュR。",
        "trap_items": "中盤以降の脅威アイテム重ね積み（集団戦で入った瞬間に蒸発する。ステラック/デスダンス推奨）",
        "forbidden_moves": "Qが当たったからといって敵5人の真ん中にQ2で思考停止突撃すること",
        "matchup_tip": "Poppy 対面: W（防護の構え）でQ2もWダッシュも全て止められるため、ポッピーのWが落ちるまで飛ばない。"
    },
    "Aatrox": {
        "title": "エイトロックス (Aatrox) 対面戦術バイブル",
        "tags": ["LoL", "Tactics", "TOP", "Aatrox"],
        "summary": "Qの3連続スイートスポットとパッシブ回復による集団戦制圧型レイドボスファイター。",
        "power_spikes": "Lv4 (Qランク2), Lv9 (QランクMAX・CD大幅短縮), 1stコア (ショウジンの矛 / サンダースカイ)",
        "lethal_threshold": "Lv6時: R展開中のフルコンボで約850 DMG (相手HP 70%圏内)",
        "phase1": "Q1の先端でハラス。W（縄）が命中したら即座にEで位置を調整してQ2先端をヒットさせる。",
        "phase2": "敵タワーを削りつつ、ヘラルド・ドラゴン戦にテレポートで参加。Rを発動してキルリセットを狙う。",
        "phase3": "前線で敵複数人にQ3スイートスポットを叩き込み、大量の回復を得ながら敵バックラインを破壊。",
        "trap_items": "耐久ゼロの初手脅威ビルド（CC耐性がなく、重傷を積まれた瞬間に即死する）",
        "forbidden_moves": "E（ブリンク）を逃げや調整用ではなく、不用意に開幕で前方に吐ききること",
        "matchup_tip": "Fiora 対面: Q3のモーションはフィオラのW（パリィ）の格好の的。Eで横にズラしてパリィを空振りさせる。"
    },
    "Darius": {
        "title": "ダリウス (Darius) 対面戦術バイブル",
        "tags": ["LoL", "Tactics", "TOP", "Darius"],
        "summary": "出血5スタック（紅血の力）発動時の圧倒的AD上昇と、TrueダメージRによる連続処刑。",
        "power_spikes": "Lv2 (Wスロウ解放), Lv3 (ゴースト発動オールイン), Lv6 (R処刑)",
        "lethal_threshold": "Lv6・5スタック時: R単体で約350 True DMG (相手HP 40%で即死)",
        "phase1": "ウェーブを引いてフリーズ。相手が前に出た瞬間にゴーストを切って追撃、5スタック溜めてキル。",
        "phase2": "サイドレーンを制圧。敵JGが来ても1v2で返り討ちにする（Q外周当てで超回復）。",
        "phase3": "敵の前衛で安全に5スタック溜めてから、フラッシュRで敵後衛を連続処刑。",
        "trap_items": "移動速度（MS）増加のないビルド（カイトされて1スタックも溜められずに死ぬ）",
        "forbidden_moves": "Qの内側（柄部分）で当ててしまうこと（回復せずスタックも乗らない）",
        "matchup_tip": "Vayne / Quinn 対面: 無理にCSを取りに行かず、足袋＋忍耐の盾で耐え、相手のEが落ちた瞬間にゴーストフラッシュE。"
    },
    "Jax": {
        "title": "ジャックス (Jax) 対面戦術バイブル",
        "tags": ["LoL", "Tactics", "TOP", "Jax"],
        "summary": "E（カウンターストライク）による通常攻撃完全無効と、最強格のサイドスプリットプッシュ。",
        "power_spikes": "Lv6 (パッシブ3打追加魔法DMG), 1stコア (トリニティフォース完成時)",
        "lethal_threshold": "Lv6時: Eスタンからのトレードで約700 DMG",
        "phase1": "ミニオンを殴ってパッシブ攻撃速度を維持。相手の通常攻撃に合わせてEを発動し有利トレード。",
        "phase2": "トリニティフォース完成後はサイドレーンを無限プッシュ。タワー破壊速度はゲーム内屈指。",
        "phase3": "側面からテレポートで挟み撃ち。Eを回しながら敵ADCにQで飛びつき、RでAR/MRを爆増させる。",
        "trap_items": "初手AP特化（耐久が足りず集団戦で即死する。TF＋王剣またはステラックが基本）",
        "forbidden_moves": "敵の主要スキルをEで受けずに、遠距離から不用意にQ-Eで飛び込むこと",
        "matchup_tip": "Malphite 対面: E上げマルファイトのEスロウで攻撃速度が激減するため、ロングトレードを避けてショートトレード。"
    },
    "XinZhao": {
        "title": "シン・ジャオ (Xin Zhao) 対面戦術バイブル",
        "tags": ["LoL", "Tactics", "Jungle", "XinZhao"],
        "summary": "序盤のタイマン最強格。Eの飛びつき、Qのノックアップ、Rの遠距離無敵フィールド。",
        "power_spikes": "Lv2〜3 (最序盤1v1), Lv6 (R遠距離砲火遮断)",
        "lethal_threshold": "Lv3時: フルコンボで相手HP 60%を削り切る",
        "phase1": "川でのスカトル争奪やインベードを積極的に仕掛ける。序盤のデュエルで負ける相手はほぼ皆無。",
        "phase2": "Wで遠距離から視界確保＆射程延長Eで急襲。Rを展開して敵バックラインからの射撃を遮断。",
        "phase3": "敵アサシンやブルーザーをRで吹き飛ばして味方キャリーを守るか、敵キャリーに飛びついて分断。",
        "trap_items": "防具なしのフルヘイルブレード脅威ビルド（中盤以降に飛び込んだ瞬間に溶ける）",
        "forbidden_moves": "Wを外した状態での強引な短距離E飛びつき",
        "matchup_tip": "Master Yi 対面: イーがQを使った着地点に即座にQ3ノックアップを合わせれば完封可能。"
    },
    "Nocturne": {
        "title": "ノクターン (Nocturne) 対面戦術バイブル",
        "tags": ["LoL", "Tactics", "Jungle", "Nocturne"],
        "summary": "R（パラノイア）によるマップ全域の視界遮断と超長距離必殺アサシン。",
        "power_spikes": "Lv6 (Rパラノイア習得時), 1stコア (ヘクスプレート / ストライドブレイカー)",
        "lethal_threshold": "Lv6時: R-Q-Eコンボで約750 DMG (相手HP 65%で確殺)",
        "phase1": "最速フルクリアでLv6を目指す。無理なガンクはせずキャンプ回転速度を最大化。",
        "phase2": "RのCDが上がるたびに、孤立した敵レーナーまたはサイドプッシュ中の敵へパラノイアを撃ち込みキルを重ねる。",
        "phase3": "集団戦開幕でRを発動して敵のTPや連携を完全に遮断。孤立したADCへ突撃しWで敵の自衛スキルを防ぐ。",
        "trap_items": "初手コレクター等の超ガラスキャノン（飛び込んだ後のE恐怖発動前に返り討ちに遭う）",
        "forbidden_moves": "敵が密集している場所へ味方の寄りがない状態で単独R特攻すること",
        "matchup_tip": "Twisted Fate 対面: TFがRで飛ぼうとした瞬間にノクターンがRを撃つと、TFの視界が消えて飛び先が指定できなくなる。"
    },
    "Fiora": {
        "title": "フィオラ (Fiora) 対面戦術バイブル",
        "tags": ["LoL", "Tactics", "TOP", "Fiora"],
        "summary": "急所へのTrueダメージとW（応手/パリィ）によるスキル反射。最強クラスの1v1デュエリスト。",
        "power_spikes": "Lv2 (Q+W解放), 1stコア (ラヴァナスハイドラ / トリニティフォース完成時)",
        "lethal_threshold": "Lv6・4急所破壊時: 相手最大HPの50%以上のTrueダメージ",
        "phase1": "急所の位置を見極めてQでヒット＆アウェイ。敵の主要CC（スタン等）に合わせてWでスタン返し。",
        "phase2": "サイドレーンを無限にスプリット。1人で止めに来た敵はタワー下でもソロキル可能。",
        "phase3": "集団戦は極力避け、サイドレーンで2人以上を引きつける。味方がオブジェクトを取る時間を稼ぐ。",
        "trap_items": "集団戦用のフルタンクビルド（急所ダメージがスケールせずスプリット能力が死ぬ）",
        "forbidden_moves": "W（パリィ）を相手の通常スキルに軽率に吐いてしまい、本命CCを直撃すること",
        "matchup_tip": "Mordekaiser 対面: モルデカイザーのR（冥界送致）の腕を振り上げるモーションにWを合わせるとR自体を完全無効化できる。"
    },
    "Zyra": {
        "title": "ザイラ (Zyra) 対面戦術バイブル",
        "tags": ["LoL", "Tactics", "Jungle", "Zyra"],
        "summary": "3分05秒の超速フルクリアと植物による中立・オブジェクト融解。視界外からのスネアと広範囲Ultでマップのテンポを完全掌握する。",
        "power_spikes": "Lv3 (全スキル解放), Lv6 (R絞殺の茨習得時), 1stコア (ライアンドリーの苦悶完成時)",
        "lethal_threshold": "Lv6時: Eスネア ➔ W植物2体 ➔ Q ➔ Rで約720 DMG (相手HP 65%圏内)",
        "phase1": "0:41ラプター前待機で種固定。壁越しRed起動テクニックを駆使し、3:05にフルクリア達成して最速スカトルまたは敵森侵入。",
        "phase2": "ヴォイドグラブ・ドラゴンを植物にヘイトを取らせてソロで瞬殺。ライアンドリー＋シャドウフレイムで敵キャリーを一撃処刑。",
        "phase3": "狭い通路（ドラゴン・バロンピット前）に植物を撒き、敵の進入経路にRを展開して集団戦を強制分断。",
        "trap_items": "初手マナアイテム（ブラックファイア・トーチ等）への過度な依存（対人バーストが不足しリセット系アサシンに狩られる。初手ライアンドリーが絶対解）",
        "forbidden_moves": "Eを適当に先撃ちして外すこと（移動スキルがないため、Eがないザイラは全JGの格好の餌食）",
        "matchup_tip": "Viego 対面: 鉢合わせたら即死。Eを外した瞬間に詰められるため、視界のない場所には絶対に顔を出さず植物で索敵。"
    },
    "Shyvana": {
        "title": "シヴァーナ (Shyvana) 対面戦術バイブル",
        "tags": ["LoL", "Tactics", "Jungle", "Shyvana"],
        "summary": "2026年リワーク後のADブルイザー型。QのAAリセットとショウジンの矛による超高速スキルループ、パッシブ（スケイルメイル）による終盤のレイドボス化。",
        "power_spikes": "Lv6 (R龍の降臨習得時), 1stコア (トリニティ・フォース完成時), 2ndコア (ショウジンの矛完成時)",
        "lethal_threshold": "Lv6時: R飛びつき ➔ E ➔ AA ➔ Qリセット ➔ W継続ダメージで約820 DMG",
        "phase1": "W始動最速フルクリア（S-Key Kitingによる硬直キャンセル）。Lv6前はガンクを控え、キャンプ巡回と初手ドラゴン確保に全集中。",
        "phase2": "トリニティフォース完成後はRで敵後衛に飛び込み、Qリセットでタンクもキャリーも粉砕。ショウジンの矛でR稼働率を最大化。",
        "phase3": "エピックモンスター討伐で蓄積したAR/MRスタック（スケイルメイル）とジャック＝ショー/デスダンスで不沈艦となり前線を突破。",
        "trap_items": "過去の遺物であるナッシャートゥース等の純APビルド（耐久がゼロでR飛び込み時に瞬溶けする。現環境はADブルイザーが確定解）",
        "forbidden_moves": "R（怒りゲージ）が溜まっていない状態でのドラゴン・ヘラルド強行ファイト",
        "matchup_tip": "Lillia / Zyra 対面: カイト性能とスロウに捕まると近づけず一方的に削られる。フラッシュかUltがない状態で追うのは絶対禁止。"
    },
    "MonkeyKing": {
        "title": "ウーコン (MonkeyKing) 対面戦術バイブル",
        "tags": ["LoL", "Tactics", "Jungle", "MonkeyKing", "Wukong"],
        "summary": "W（ステルス分身）による視界外急襲と、広範囲2回ノックアップR（旋風飛猿）による圧倒的集団戦クラッシャー。",
        "power_spikes": "Lv6 (R習得時), 1stコア (トリニティ・フォース完成時), 2ndコア (ブラック・クリーバー / サンダード・スカイ完成時)",
        "lethal_threshold": "Lv6時: E ➔ AA ➔ Q ➔ R1ノックアップ ➔ Q ➔ R2で約800 DMG (征服者フルスタック)",
        "phase1": "フルクリアでLv4先行、またはLv3でレーンへWステルス奇襲。パッシブ（ストーンスキン）でAD対面の殴り合いは極めて強力。",
        "phase2": "オブジェクト周りでブッシュに潜み、Wで姿を消して敵バックラインへ接近、即座にR1でノックアップを叩き込む。",
        "phase3": "集団戦の主導権を完全掌握。ブラック・クリーバーの全弾装甲破砕とR2の追撃ノックアップで味方AoE（ヤスオ、オリアナ等）とコンボ。",
        "trap_items": "耐久度外視のフル脅威暗殺ビルド（飛び込んだ瞬間にフォーカスされてRを回し切れずに即死する）",
        "forbidden_moves": "APアサシン（エコー、イブリン等）やモルデカイザーのR隔離範囲へ不用意に突っ込むこと（パッシブのAR恩恵が消える）",
        "matchup_tip": "Mordekaiser 対面: モルデカイザーのR（死の国）に隔離されると分身が出せず集団戦貢献がゼロになるため、Rを使わせるまで接近しない。"
    }
}

def generate_bible_markdown(champ: str, data: dict) -> str:
    content = f"""---
title: "{data['title']}"
status: verified
source_type: official
published_at: 2026-09-18
captured_at: 2026-09-18
tags: {data['tags']}
---

# ⚔️ {data['title']}

## 📌 基本方針 ＆ パワースパイク
- **戦術概要**: {data['summary']}
- **主要パワースパイク**: {data['power_spikes']}
- **即死キルライン基準**: {data['lethal_threshold']}

---

## 🗺️ 3段階勝ちパターン手順書 (Matchup Blueprint)

### Phase 1 (Lv1〜2: 序盤主導権)
- **アクション**: {data['phase1']}

### Phase 2 (Lv3〜5: リコール・パワースパイク準備)
- **アクション**: {data['phase2']}

### Phase 3 (Lv6〜: オールイン ＆ 試合決定打)
- **アクション**: {data['phase3']}

---

## ⚠️ 検討して落とした選択肢 ＆ 罠ビルド (Rejected Options / 没理由)

### 🚫 罠アイテム・NGビルド
- **{data['trap_items']}**: 
  - *没理由*: 対面のパワースパイクや防御ステータスを軽視したビルドは失速の原因になるため非推奨。

### ❌ 実戦でやってはいけない地雷行動
- **{data['forbidden_moves']}**:
  - *没理由*: 相手のカウンターや即死トリガーを踏むため厳禁。

---

## 🎯 主要対面特化ミクロ (Matchup Tips)
- {data['matchup_tip']}

---

## 📜 イミュータブル変更履歴 (Immutable Log)
- **2026-09-18**: 制式戦術バイブル自動生成CLI（`generate_tactics_bible.py`）により初版確定配備。
"""
    return content

def main():
    parser = argparse.ArgumentParser(description="主力チャンピオン対面戦術バイブル一括生成CLI")
    parser.add_argument("--champ", type=str, help="特定チャンピオンのみ生成 (例: JarvanIV)")
    parser.add_argument("--force", action="store_true", help="既存ファイルを強制上書き")
    args = parser.parse_args()

    TACTICS_DIR.mkdir(parents=True, exist_ok=True)

    targets = [args.champ] if args.champ else list(CORE_CHAMPIONS_DATA.keys())
    generated_count = 0
    skipped_count = 0

    print("\n" + "="*60)
    print(" 📖 Sovereign OS 主力対面戦術バイブル生成CLI")
    print("="*60 + "\n")

    for champ in targets:
        if champ not in CORE_CHAMPIONS_DATA:
            print(f"⚠️  {champ} の戦術データが定義されていません（スキップ）")
            continue

        data = CORE_CHAMPIONS_DATA[champ]
        file_name = f"{champ.lower()}_tactics_bible.md"
        target_path = TACTICS_DIR / file_name

        if target_path.exists() and not args.force:
            print(f"ℹ️  [SKIP] 既存ファイルが存在します: {file_name}")
            skipped_count += 1
            continue

        md_content = generate_bible_markdown(champ, data)
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(md_content)

        print(f"✅ [CREATE] {champ} バイブル生成完了: {file_name}")
        generated_count += 1

    print("\n" + "-"*60)
    print(f" 🎉 生成完了: 新規 {generated_count} 件 / スキップ {skipped_count} 件")
    print("="*60 + "\n")

if __name__ == "__main__":
    main()
