#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_concept_pages.py - 知識ギャップ概念ノート自動コンパイルエンジン (Karpathy LLM Wiki準拠)

本スクリプトは、ナレッジベース内の全Markdownファイルから、頻出する戦術・哲学概念
（パワースパイク、ダイブ、インベード、没理由、イミュータブル等）の言及文脈を横断抽出し、
TOMO式3層（Core Concept / Principles / Common Traps / Referencing Bibles）で
構造化された「生きた概念ノート」を 01_INTEL/concepts/ に自動生成・コンパイルします。
"""

import os
import sys
import re
from datetime import datetime
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
CONCEPTS_DIR = REPO_ROOT / "01_INTEL" / "concepts"
NEXUS_PATH = REPO_ROOT / "01_INTEL" / "NEXUS_INDEX.md"

TARGET_CONCEPTS = [
    {
        "keyword": "パワースパイク",
        "slug": "power_spike",
        "title": "パワースパイク戦術論（時間帯・レベル・完成アイテムによる主導権掌握）",
        "category": "Tactics",
        "definition": "特定チャンピオンのスキルLv、完成アイテム、あるいは時間帯によって火力が跳ね上がり、ゲームの勝敗を決定づける有利ウィンドウ。",
        "actionable": "対面および敵味方のパワースパイクを予測し、自身のパワースパイク前に無理な戦闘を仕掛けず、到達した瞬間にオブジェクトやキルを強要する。"
    },
    {
        "keyword": "ダイブ",
        "slug": "tower_dive",
        "title": "タワーダイブ攻略論（ウェーブクラッシュ・ヘルス差・タワーアグロ管理）",
        "category": "Tactics",
        "definition": "相手タワー下に追い詰めた瀕死の敵に対し、ミニオンウェーブを押し込んだ状態でタワーのターゲット管理を行いながらキルを奪う高リスク・超ハイリターン戦術。",
        "actionable": "ビッグウェーブを作りタワーに到達させた上で、CCを持つ味方または耐久力の高いタンクが先にアグロ（攻撃）を受け、キル後に速やかにタワー射程外へ脱出する。"
    },
    {
        "keyword": "インベード",
        "slug": "invade",
        "title": "インベード戦術論（Lv1奇襲・敵ジャングル視界奪還・バフ強奪）",
        "category": "Tactics",
        "definition": "試合開始直後（Lv1）または序盤に敵陣営のジャングルへ集団で侵入し、キル・サモナースペル・中立バフを奪う奇襲・制圧戦術。",
        "actionable": "自チームのLv1戦闘力（フック・確定CC等）が相手を上回っていることを確認し、最短ルートで視界の死角から侵入する。失敗時は深追いせず即座に退却する。"
    },
    {
        "keyword": "没理由",
        "slug": "rejected_options_philosophy",
        "title": "没理由・罠データベース哲学（なぜその案を捨てたかの記録）",
        "category": "Philosophy",
        "definition": "「何を採用したか」以上に「どの選択肢をなぜ捨てたか」「なぜその行動が罠なのか」を客観的理由とともに記録・蓄積する意思決定ナレッジ手法。",
        "actionable": "戦術・コード設計・コンテンツ企画において、採用しなかった案を消去せず、没にした客観的理由を明記して『同じ失敗・検討の繰り返し』を根本から遮断する。"
    },
    {
        "keyword": "イミュータブル",
        "slug": "immutable_principles",
        "title": "イミュータブル（原本不変）原則とハルシネーション防波堤",
        "category": "Philosophy",
        "definition": "一次ソース（公式データ・生メモ・Web記事原本）をAIが直接上書き・破壊することを固く禁じ、常に不変（Immutable）の正本（SSoT）として保持するデータ設計思想。",
        "actionable": "AIの要約や構造化データは派生ノートとして別名保存し、必ず原本への相対パス・出典リンクを付与してファクトチェックの動線を物理的に維持する。"
    },
    {
        "keyword": "ローム",
        "slug": "roam",
        "title": "ローム戦術論（サイド介入・ウェーブ押し込み・リターン計算）",
        "category": "Tactics",
        "definition": "自レーンのミニオンウェーブをタワーに押し込んだタイミング等で他レーンや敵ジャングルへ急襲・合流し、数的有利を作ってキルやタワーを獲得する介入戦術。",
        "actionable": "自レーンのロスト（タワープレートやミニオンCS）以上のリターン（キル・ドラゴン・タワー）が確実に見込める状況でのみ実行し、失敗時は速やかに復帰する。"
    },
    {
        "keyword": "オブジェクト管理",
        "slug": "objective_control",
        "title": "オブジェクト管理論（ドラゴン・ヘラルド・バロンの視界セットアップと主導権）",
        "category": "Tactics",
        "definition": "ドラゴン、ヘラルド、ヴォイドグラブ、バロン等の中立モンスターの出現時間に合わせて、事前にレーン主導権と視界を確保し、集団戦または確定テイクを狙う大局観戦術。",
        "actionable": "出現1分〜45秒前にリコールしてアイテムを揃え、周辺のデウォードとワード設置（ディープワード）を完了させ、先にエリアを占有する。"
    },
    {
        "keyword": "スプリットプッシュ",
        "slug": "split_push",
        "title": "スプリットプッシュ戦術論（サイドレーン単独進行・1v1優位・マップ牽引）",
        "category": "Tactics",
        "definition": "1対1で勝てるチャンピオンが本隊と離れたサイドレーンを単独で押し込み、敵チームを分断して人数差やタワー破壊を強要するマクロ戦術。",
        "actionable": "敵が2人以上寄ってきた時に安全に退避できる視界（ディープワード）を確保し、本隊が逆サイドのオブジェクト（バロン/ドラゴン）に圧力をかけている時のみ深くプッシュする。"
    },
    {
        "keyword": "スロープッシュ",
        "slug": "slow_push",
        "title": "スロープッシュ戦術論（ビッグウェーブ構築・ダイブプレッシャー・安全なリコール）",
        "category": "Tactics",
        "definition": "後衛ミニオンのみを間引いて自軍ミニオンを徐々に溜め、2〜3ウェーブ分の巨大なミニオン塊（ビッグウェーブ）を作って敵タワーへ衝突させるウェーブコントロール。",
        "actionable": "対面を倒した直後やローム・リコールを狙う際にスロープッシュを開始し、タワー下へ衝突した瞬間にダイブ、ローム、または安全なベース帰還を行う。"
    },
    {
        "keyword": "プライオリティ",
        "slug": "lane_priority",
        "title": "レーンプライオリティ論（先手合流権・プッシュ主導権・JG支援）",
        "category": "Tactics",
        "definition": "相手よりも先にミニオンウェーブを押し込み、相手がタワー下でCSを取っている間に自由に動ける権利（先手合流権・優先権）。",
        "actionable": "川のスカトルやインベード、オブジェクト戦の前にプライオリティを意識的に確保し、味方ジャングラーの遭遇戦に相手レーナーより3〜5秒早く寄る。"
    },
    {
        "keyword": "ディープワード",
        "slug": "deep_ward",
        "title": "ディープワード戦術論（敵JG深部視界・ルート早期察知・ガンク無力化）",
        "category": "Tactics",
        "definition": "レーン周辺の草むら（川）ではなく、敵ジャングルのキャンプ付近や交差点の深部に設置し、敵ジャングラーやロームの動向を15〜30秒早く察知する視界戦術。",
        "actionable": "プライオリティを取って敵レーナーが動けない時、または敵JGが逆サイドに見えた安全な瞬間に敵陣営へ侵入して設置する。"
    },
]

def scan_context_snippets(keyword):
    """全Markdownファイルからキーワードが含まれる文脈スニペットと参照元ファイルを収集"""
    snippets = []
    referencing_files = []

    scan_dirs = [REPO_ROOT / "01_INTEL", REPO_ROOT / "02_FACTORY"]

    for sdir in scan_dirs:
        for root, dirs, files in os.walk(sdir):
            if any(ex in root for ex in ["node_modules", ".git", "concepts", "_archive"]):
                continue
            for file in files:
                if not file.endswith(".md"):
                    continue
                fpath = Path(root) / file
                try:
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                        lines = f.readlines()
                    matched = False
                    for line in lines:
                        if keyword in line and len(line.strip()) > 20:
                            # 見出し以外の本文行を収集
                            if not line.strip().startswith("#"):
                                snippets.append((fpath, line.strip()))
                                matched = True
                                if len(snippets) >= 20:
                                    break
                    if matched and fpath not in referencing_files:
                        referencing_files.append(fpath)
                except Exception:
                    pass

    return snippets, referencing_files

def generate_concepts():
    CONCEPTS_DIR.mkdir(parents=True, exist_ok=True)
    today_str = datetime.now().strftime("%Y-%m-%d")

    print("\n=======================================================")
    print(" 🧠 知識ギャップ概念ノート自動コンパイルエンジン")
    print("=======================================================")

    generated_concepts = []

    for c in TARGET_CONCEPTS:
        kw = c["keyword"]
        slug = c["slug"]
        title = c["title"]
        out_file = CONCEPTS_DIR / f"{slug}.md"

        snippets, ref_files = scan_context_snippets(kw)
        print(f"🔍 「{kw}」: {len(ref_files)} 件のファイルから言及文脈を抽出中...")

        # 抽出したスニペットから要点を整理
        unique_snippets = []
        seen = set()
        for fp, snip in snippets:
            clean_snip = snip.lstrip("-*• ").strip()
            if clean_snip not in seen and len(clean_snip) < 150:
                seen.add(clean_snip)
                unique_snippets.append((fp, clean_snip))
            if len(unique_snippets) >= 6:
                break

        # Markdown生成
        md = f"""---
title: "{title}"
status: verified
source_type: empirical
published_at: {today_str}
captured_at: {today_str}
verified_at: {today_str}
tags: [{c['category']}, Concept, SSoT, KnowledgeLoop]
---

# 🧠 {title}

> 📌 **本ノートの位置づけ**:  
> システム全域で頻出する中核概念「**{kw}**」について、実戦バイブル・日誌・運用規範から抽出した知見を横断統合・コンパイルした**概念バイブル（Concept Page）**です。

---

## 🎯 1. Core Concept（核心定義）
{c['definition']}

---

## 📋 2. Principles & Execution（実戦原則と成立条件）
"""
        for fp, s in unique_snippets[:4]:
            rel_path = fp.relative_to(REPO_ROOT).as_posix()
            md += f"- **実戦知見**: {s} （出典: [{fp.stem}](file:///{REPO_ROOT.as_posix()}/{rel_path})）\n"

        md += f"""
---

## ⚠️ 3. Common Traps & Pitfalls（初心者が陥りがちな罠・没理由）
- **前提条件の無視**: 成立条件（視界、パワースパイク、ウェーブ状況）が整っていない段階で感覚的に仕掛けると、100%反撃を受けゲームを投げる原因になる。
- **目的と手段の混同**: 「{kw}を行うこと」自体が目的化し、オブジェクトやタワー、ゴールド差の獲得に繋がらないリスク行動は徹底的に排除する。

---

## 🚀 4. Actionable Steps（実戦・実務での次の一手）
- [ ] {c['actionable']}
- [ ] 自身のプレイ前・設計前に、この概念の成立条件をチェックリストとして確認する。

---

## 🔗 5. 関連バイブル・言及ファイル（Cross References）
本概念に言及している代表的な戦術バイブルおよびドキュメント：
"""
        for rf in ref_files[:10]:
            rel = rf.relative_to(REPO_ROOT).as_posix()
            md += f"- [{rf.stem}](file:///{REPO_ROOT.as_posix()}/{rel})\n"

        md += f"""
---

## 🎯 思考トリガー
> 「次の試合または実務において、自分はどのタイミングで『{kw}』の条件が整ったと客観的に判断するか？」
"""

        with open(out_file, "w", encoding="utf-8") as f:
            f.write(md)

        print(f"   ✅ 生成完了: {out_file.relative_to(REPO_ROOT)}")
        generated_concepts.append((title, out_file))

    # NEXUS_INDEX.md に概念ハブを追記・同期
    if NEXUS_PATH.exists():
        with open(NEXUS_PATH, "r", encoding="utf-8") as nf:
            nexus_content = nf.read()

        concept_section_header = "## 🧠 戦術概念 ＆ 共通哲学ライブラリ (Concepts)"
        section_md = f"{concept_section_header}\n全バイブルを横断する中核概念の定義と実戦原則集（Karpathy LLM Wiki準拠）。\n\n"
        for t, p in generated_concepts:
            section_md += f"- **[{t}](file:///{p.as_posix()})**\n"
        section_md += "\n"

        insert_marker = "## 📚 1. LoL 戦略 ＆ 攻略バイブル (Intel Domain)"

        if concept_section_header in nexus_content:
            # 既存セクションを最新の一覧に置換
            pattern = re.compile(r"## 🧠 戦術概念 ＆ 共通哲学ライブラリ \(Concepts\)[\s\S]*?(?=## 📚 1\. LoL 戦略 ＆ 攻略バイブル)")
            nexus_content = pattern.sub(section_md, nexus_content)
        elif insert_marker in nexus_content:
            nexus_content = nexus_content.replace(insert_marker, section_md + insert_marker)
        else:
            nexus_content += "\n\n" + section_md

        with open(NEXUS_PATH, "w", encoding="utf-8") as nf:
            nf.write(nexus_content)
        print("\n✅ NEXUS_INDEX.md に『戦術概念＆共通哲学ライブラリ』を同期しました。")

    print(f"\n=======================================================")
    print(f"🎉 合計 {len(generated_concepts)} 件の中核概念ノートをコンパイルしました。")
    print(f"=======================================================\n")

if __name__ == "__main__":
    generate_concepts()
