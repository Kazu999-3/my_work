#!/usr/bin/env python3
"""参考資料ライブラリ（AI活用・副業・開発・ツール）初期データ投入・照会・管理スクリプト

指示文15: 05_PILOT/docs/specs/15-reference-library-instruction.md
指示文16: 05_PILOT/docs/specs/16-reference-items-add-dev-tools-instruction.md
指示文17: 05_PILOT/docs/specs/17-reference-items-evaluation-instruction.md

全34件の参考資料（A群: 10件、B群: 12件、C群: 12件）と
一次評価データ（29件: 取り込み候補 10件、参考 19件、評価なし 5件）を管理。

使い方:
  py -3 scripts/seed_reference_items.py                  # 集計表示 ＆ マイグレーションSQL生成
  py -3 scripts/seed_reference_items.py --list           # 全34件の一覧テーブル表示
  py -3 scripts/seed_reference_items.py --get A1         # 指定コードの詳細・本文・評価表示
  py -3 scripts/seed_reference_items.py --search "キーワード" # キーワード検索
"""

import os
import sys
import json
import argparse
from typing import List, Dict, Any, Optional

# 全34件のマスターデータ定義
REFERENCE_ITEMS: List[Dict[str, Any]] = [
    # ========================================================
    # A群: Xブックマークから（全文取得済み: 10件）
    # ========================================================
    {
        "code": "A1",
        "title": "プロンプト技法「ランクA／ランクS」",
        "author": "かねき @kaneki_aiafi",
        "url": "https://twitter.com/kaneki_aiafi/status/2117723996074705182",
        "category": "AI活用",
        "summary": "質問の前提検証・条件明確化・自己レビュー等の18技法。SPEC作成に転用可",
        "content": """すぐ使えるチェックリストとして今回一番実用的。

ランクA（ガチで使える）：
- 回答前に評価基準を決めて（品質安定）
- 最も重要な論点を特定して（本質理解）
- この回答の弱点を3つ挙げて（精度改善）
- 見落としがちな条件を洗い出して（盲点発見）
- 専門家の視点でレビューして（質を高める）
- 反対意見を踏まえて再回答して（思考深化）
- 実行難易度と効果で優先順位をつけて（効率化）
- 回答を80点と仮定して改善して（完成度UP）

ランクS（神レベル）：
- そもそも質問の立て方が正しいか検証して（前提改善）
- 回答に必要な情報が揃うまで確認して（条件明確化）
- この結論が成立しない条件を探して（誤判断防止）
- 最初の回答を批判的に検証して（自己レビュー）
- 別の切り口から最適解を3つ出して（視野拡張）
- 回答の根拠と不確実な部分を分けて（信頼性UP）
- 一流の専門家なら何を追加で調べるか（深掘り）
- 理想解と現実的な次善策を提示して（実行力UP）
- 判断基準を作って回答を採点して（品質可視化）
- この目的を達成する最強の質問文に書き直して（プロンプト最適化）

活かしどころ：SPEC作成や調査依頼の前に「前提改善」「条件明確化」を挟む、など今のワークフローにそのまま差し込める。""",
        "has_fulltext": True,
        "source_group": "A",
        "verdict": "取り込み候補",
        "target_project": "開発フロー",
        "adoption_note": "SPEC・指示文のチェックリストに転用可（前提検証・条件明確化・自己レビュー）。未決事項の明記など一部は実践済み",
    },
    {
        "code": "A2",
        "title": "Muse×Gmailで放置アカウント洗い出し",
        "author": "ごろとん @goroton_ai",
        "url": "https://twitter.com/goroton_ai/status/2123345284293914781",
        "category": "AI活用",
        "summary": "コネクター連携で会員登録メールから登録サイトを一覧化（①のみ取得）",
        "content": """親ポスト：「丸パクリでいいやつ。昔登録して放置してるサイト。Claudeに全部洗い出させて、片っ端から退会してる。使ってないアカウントほど、乗っ取られても気づけない。放置アカウントを消す4ステップ」
①「登録したサイトを、Museに洗い出させる。設定 → コネクター → Gmailをつないで、『過去のメールから、会員登録や登録完了のメールが来ているサイトを全部一覧にして』と頼む。自分じゃ思い出せない数が出てくる」
※②〜④は後続リプライにあり未取得。
活かしどころ：先日のサブスク棚卸し（Gmail領収書ベースで実施済み）と同じ発想。登録サイト一覧は未実施なので、セキュリティ棚卸しとして一度やる価値あり。""",
        "has_fulltext": True,
        "source_group": "A",
        "verdict": "取り込み候補",
        "target_project": "開発フロー（運用）",
        "adoption_note": "定期棚卸しルーチンの型。サブスク棚卸しは実施済みで、登録サイト洗い出しも同じ手順で可能",
    },
    {
        "code": "A3",
        "title": "AI駆動開発の型：資料はHTMLサイト化",
        "author": "K e n T a @kenta_feels_ayu",
        "url": "https://twitter.com/kenta_feels_ayu/status/2121125122866315702",
        "category": "AI活用",
        "summary": "ADRはMarkdown、人間向け資料はHTMLサイト化して触って理解する",
        "content": """引用元ポスト：「最近、自分のなかのAI駆動開発の型として、ADRはMarkdownとして溜めつつ、人間が読む資料は全てWebサイトベース(HTML)で作ってて、かなり開発が安定してきてる。仕様書もマークダウンで書くより仕様解説の動的なWebサイト作って図解してもらったほうが判断精度が上がった気がする」
本文：「Markdown上の膨大な仕様書コンテキストであーだこーだ言われても全く頭に入ってこんのだけど、実際に解説サイトを作らせて自分で触ってみると『あ～そういうことね』ってなることが多い」（動画付き）
活かしどころ：SPEC運用（MarkdownでGitHub受け渡し）の先の話として、大きなSPECは「触れる解説ページ」化するとレビュー精度が上がる、という方向性。Pilot/Portalの仕様確認に使える。""",
        "has_fulltext": True,
        "source_group": "A",
        "verdict": "参考",
        "target_project": "開発フロー",
        "adoption_note": "ADR＝Markdownは現行SPEC運用と同型。人間向け資料のHTML化は朝刊で一部実践済み",
    },
    {
        "code": "A4",
        "title": "MCPで行政データ7.5万件を自然言語分析（公式）",
        "author": "デジタル庁 @digital_jpn",
        "url": "https://twitter.com/digital_jpn/status/2087788744502075801",
        "category": "AI活用",
        "summary": "公式の技術検証。AIの誤った補完を減らす設計、MCP Apps試作",
        "content": """「Techブログ：行政手続等調査データ（約75,000件）をMCPで自然言語分析可能に。MCP（Model Context Protocol）を活用して対話形式で分析を行える、技術検証目的の簡易的な実装をご紹介。AIの誤った補完・推測を減らしつつ、MCP AppsによるチャットUI表示も試作」
本文はリンク先のnote記事：https://digital-gov.note.jp/n/n56aaf580bfb6
活かしどころ：公式の実装事例として信頼できる技術参考。「AIの誤った補完・推測を減らす」設計は、Pilotの解析精度の考え方にも通じる。""",
        "has_fulltext": True,
        "source_group": "A",
        "verdict": "参考",
        "target_project": "―",
        "adoption_note": "大規模行政のMCP事例。発想のみ参考",
    },
    {
        "code": "A5",
        "title": "「Omniroute」紹介（著者の主張・未検証）",
        "author": "ルカ @ruka_affi",
        "url": "https://twitter.com/ruka_affi/status/2088254064782172559",
        "category": "AI活用",
        "summary": "Claude Code無料・無制限をうたう非公式ツール（主張・未検証、リスク注意、記録のみ）",
        "content": """「Claude Codeがほぼ無制限で無料で使えるようになりました。海外の人が作った『Omniroute（オムニルート）』という無料ツールがあるんですが、これで何ができるかというと、↓」（続きはリプライにあり未取得）
注意：非公式のルーティングツールで「無料・無制限」をうたうものは、アカウントや利用規約、セキュリティ面のリスクがあり得る。使う前提ではなく、存在の記録のみ。""",
        "has_fulltext": True,
        "source_group": "A",
        "verdict": None,
        "target_project": None,
        "adoption_note": None,
    },
    {
        "code": "A6",
        "title": "X Articleへのリンクのみ",
        "author": "かい @K_AI_Work",
        "url": "https://twitter.com/K_AI_Work/status/2123204523560997074",
        "category": "AI活用",
        "summary": "記事本文は未取得",
        "content": """本文はX Articleへのリンクのみで、記事本文は取得できなかった。""",
        "has_fulltext": True,
        "source_group": "A",
        "verdict": None,
        "target_project": None,
        "adoption_note": None,
    },
    {
        "code": "A7",
        "title": "40〜60代向けChatGPT講座の告知",
        "author": "AI業務効率化委員会 @ai_info0207",
        "url": "https://twitter.com/ai_info0207/status/2116240858525945890",
        "category": "AI活用",
        "summary": "「中高年×AI習得」市場の材料",
        "content": """「そろそろ本気でChatGPT学ばないとヤバい…AI活用についていけてない40代・50代・60代へ。2.5時間で、仕事に使えるレベルまで習得できます」という有料講座の告知ポスト（インプレッション434万）。
活かしどころ：内容そのものより、「中高年×AI習得」という市場の大きさを示す材料。自分の発信の読者像を考える際の参考。""",
        "has_fulltext": True,
        "source_group": "A",
        "verdict": "参考",
        "target_project": "note・Brain販売",
        "adoption_note": "「中高年×AI習得」市場の材料として",
    },
    {
        "code": "A8",
        "title": "楽天放置アフィ主張（著者の主張・未検証）",
        "author": "こけぞう @gaget12090105",
        "url": "https://twitter.com/gaget12090105/status/2121354727002935610",
        "category": "副業・販売の型",
        "summary": "ChatGPT丸投げ型（主張・未検証）。方針は「型だけ取り入れる」で確定済み",
        "content": """本文：「マｯｯｯｯｯｯジで忙しい社会人は楽天放置アフィだけやってくださぁぁぁぁぁぁーーーーーい！！！！！」
引用元：「楽天アフィで3日で18万稼げたけど、月20万ぐらいなら初心者でも余裕です。スマホにChatGPTとXを入れて、『教えてチャッピー』って丸投げするだけ。プロンプトごとそのままパクってください↓↓（保存推奨）」（プロンプト自体は後続リプライにあり未取得）
位置づけ：とら記事・くろねこの「AI×アフィ」系と同じ型。あなたの方針は「型だけ取り入れる」で確定済み（2026-11-20）。数字は著者の主張として割り引くこと。""",
        "has_fulltext": True,
        "source_group": "A",
        "verdict": "参考",
        "target_project": "note・Brain販売",
        "adoption_note": "型だけ取り入れる方針が確定済み。数字は未検証",
    },
    {
        "code": "A9",
        "title": "敵JG習慣トラッカー自作（著者の主張）",
        "author": "Beora @_Beora",
        "url": "https://twitter.com/_Beora/status/2075341944147111944",
        "category": "開発事例・競合",
        "summary": "自作ツールで約800LP上昇と報告（主張）。Pilotオーバーレイ改善の同路線事例",
        "content": """敵JGの習慣を記録する自作サイトを使い約800LP上がったと報告。Pilotのオーバーレイ改善と同じ「自作ツールで競技力を上げる」路線の事例。""",
        "has_fulltext": True,
        "source_group": "A",
        "verdict": "取り込み候補",
        "target_project": "Pilot",
        "adoption_note": "敵JGの習慣を記録・可視化する機能はHUD／コーチと同路線。機能アイデアとしてSPEC候補。中身の追加調査が要る",
    },
    {
        "code": "A10",
        "title": "無料LoL解析ボット",
        "author": "GL iReaz @i_reaz",
        "url": "https://twitter.com/i_reaz/status/2096605377320091798",
        "category": "開発事例・競合",
        "summary": "Pilotの競合参考。続き1件取得済み",
        "content": """全試合を自動分析してミスや移動を指摘する無料ボット。スレッド続き編に続き1件あり。Pilotの競合参考。""",
        "has_fulltext": True,
        "source_group": "A",
        "verdict": "参考",
        "target_project": "Pilot",
        "adoption_note": "競合ベンチマーク。機能比較を作れば改善材料になる",
    },
    # ========================================================
    # B群: チャットで共有された記事（要点のみ: 12件）
    # ========================================================
    {
        "code": "B1",
        "title": "Museの初心者向け活用法7選（2026-11-19）",
        "author": "あさひ @asahi_ai_x",
        "url": "チャット共有（URL未記録）",
        "category": "AI活用",
        "summary": "メルマガ解除リスト化とサブスク棚卸しの着想元（実際にGmail棚卸しを実施）",
        "content": "メルマガ解除リスト化とサブスク棚卸しの着想元（実際にGmail棚卸しを実施）",
        "has_fulltext": False,
        "source_group": "B",
        "verdict": "取り込み候補",
        "target_project": "開発フロー（運用）",
        "adoption_note": "実施済み。メルマガ解除リスト化とサブスク棚卸しを実際にやった",
    },
    {
        "code": "B2",
        "title": "Muse自動×海外アフィ（2026-11-19）",
        "author": "とら @3Imzdo3",
        "url": "チャット共有（URL未記録）",
        "category": "副業・販売の型",
        "summary": "ユーザー判断「型だけ取り入れる」。6つの型は note目標の `参考-とら記事から取り入れる型.md` に保存済み",
        "content": "ユーザー判断「型だけ取り入れる」。6つの型は note目標の `参考-とら記事から取り入れる型.md` に保存済み",
        "has_fulltext": False,
        "source_group": "B",
        "verdict": "取り込み候補",
        "target_project": "note・Brain販売",
        "adoption_note": "取り込み済み。型ファイルに保存し、Brain第1弾の設計に反映する方針が確定",
    },
    {
        "code": "B3",
        "title": "Muse自動化の教科書2026年11月版",
        "author": "プルぽち @nana39051ma",
        "url": "チャット共有（URL未記録）",
        "category": "AI活用",
        "summary": "自動化レベル1〜5、止まる5原因、週次点検。4行設計シートが借りられる型",
        "content": "自動化レベル1〜5、止まる5原因、週次点検。4行設計シートが借りられる型",
        "has_fulltext": False,
        "source_group": "B",
        "verdict": "取り込み候補",
        "target_project": "開発フロー",
        "adoption_note": "自動化の設計シート（4行）と週次点検の型。週次メモリ整理cronは一部実践。SPEC作成時の設計チェックに採用可",
    },
    {
        "code": "B4",
        "title": "Claude Codeカスタマイズ論",
        "author": "ガガロット @gagarot200",
        "url": "チャット共有（URL未記録）",
        "category": "AI活用",
        "summary": "人格・記憶・整理・仕事・説明書のファイルを積み上げる運用論。現行運用とほぼ一致",
        "content": "人格・記憶・整理・仕事・説明書のファイルを積み上げる運用論。現行運用とほぼ一致",
        "has_fulltext": False,
        "source_group": "B",
        "verdict": "参考",
        "target_project": "開発フロー",
        "adoption_note": "現行運用（人格・記憶・指示ファイル）とほぼ一致",
    },
    {
        "code": "B5",
        "title": "MEMORY.md圧縮論（2026-11-18）",
        "author": "梶谷健人 @kajikent",
        "url": "チャット共有（URL未記録）",
        "category": "AI活用",
        "summary": "超重要事項＋シーン別ファイルへの目次化。週次メモリ整理の着想元",
        "content": "超重要事項＋シーン別ファイルへの目次化。週次メモリ整理の着想元",
        "has_fulltext": False,
        "source_group": "B",
        "verdict": "取り込み候補",
        "target_project": "開発フロー",
        "adoption_note": "取り込み進行中。週次メモリ整理cronの着想元",
    },
    {
        "code": "B6",
        "title": "今週GitHubで急上昇したAIツール10選（2026-11-19）",
        "author": "そう @so_ainsight",
        "url": "チャット共有（URL未記録）",
        "category": "AI活用",
        "summary": "コーディングAIのWeb誘導リポジトリ、文章の人間味仕上げ等",
        "content": "コーディングAIのWeb誘導リポジトリ、文章の人間味仕上げ等",
        "has_fulltext": False,
        "source_group": "B",
        "verdict": "参考",
        "target_project": "開発フロー",
        "adoption_note": "ツール候補のメモ。個別ツールの要否は未検討",
    },
    {
        "code": "B7",
        "title": "違法っぽく見えて合法なGitHubリポジトリ10選（2026-11-17）",
        "author": "sanzida @abir35627",
        "url": "チャット共有（URL未記録）",
        "category": "AI活用",
        "summary": "yt-dlp、Ollama、Whisper等。Pilot SPEC 11（Whisper実働検証）のきっかけ",
        "content": "yt-dlp、Ollama、Whisper等。Pilot SPEC 11（Whisper実働検証）のきっかけ",
        "has_fulltext": False,
        "source_group": "B",
        "verdict": "取り込み候補",
        "target_project": "Pilot・開発フロー",
        "adoption_note": "一部実施済み（Whisper→SPEC 11、Ollama→導入済み）。残り（n8n等）は未評価",
    },
    {
        "code": "B8",
        "title": "300円note×AI全自動メソッド（2026-11-16）",
        "author": "くろねこ @kuro_affi",
        "url": "https://x.com/kuro_affi/status/2122434535786733776",
        "category": "副業・販売の型",
        "summary": "テーマ選定が9割、実績ある型に流し込む、低価格入口→高価格導線（収益数字は主張・未検証）",
        "content": "テーマ選定が9割、実績ある型に流し込む、低価格入口→高価格導線（収益数字は主張・未検証）",
        "has_fulltext": False,
        "source_group": "B",
        "verdict": "参考",
        "target_project": "note・Brain販売",
        "adoption_note": "低価格入口→高価格導線の型はBrainの段階価格設計と同型で反映済み。数字は未検証",
    },
    {
        "code": "B9",
        "title": "AI×note の対照的な2投稿",
        "author": "シン @sin_brain1",
        "url": "https://x.com/sin_brain1/status/2122535885027549498 / https://x.com/sin_brain1/status/2121810603291431174",
        "category": "副業・販売の型",
        "summary": "「AIに作らせたnoteはそのまま公開してもほとんど売れません」が品質重視の自説と一致",
        "content": "「AIに作らせたnoteはそのまま公開してもほとんど売れません」が品質重視の自説と一致",
        "has_fulltext": False,
        "source_group": "B",
        "verdict": "参考",
        "target_project": "note・Brain販売",
        "adoption_note": "「AI産のままでは売れない」は品質方針の裏付け。方針確認済み",
    },
    {
        "code": "B10",
        "title": "Claude自動化×note販売の引用投稿",
        "author": "はと @hato_sns",
        "url": "https://x.com/hato_sns/status/2121536681119785357",
        "category": "副業・販売の型",
        "summary": "長文記事本体は未取得",
        "content": "長文記事本体は未取得",
        "has_fulltext": False,
        "source_group": "B",
        "verdict": None,
        "target_project": None,
        "adoption_note": None,
    },
    {
        "code": "B11",
        "title": "同上の引用投稿（食パン）",
        "author": "食パン @take_ai_mkt",
        "url": "https://x.com/take_ai_mkt/status/2121528575434350825",
        "category": "副業・販売の型",
        "summary": "長文記事本体は未取得",
        "content": "長文記事本体は未取得",
        "has_fulltext": False,
        "source_group": "B",
        "verdict": None,
        "target_project": None,
        "adoption_note": None,
    },
    {
        "code": "B12",
        "title": "複数AIによるSNS自動化の販売ファネル",
        "author": "テンペ @HimazinProducer",
        "url": "https://x.com/himazinproducer",
        "category": "副業・販売の型",
        "summary": "X長文＋短尺動画＋「保存して」締め、段階価格（5,000円→50,000円）、自社LP＋Stripe。数字は本人の主張",
        "content": "X長文＋短尺動画＋「保存して」締め、段階価格（5,000円→50,000円）、自社LP＋Stripe。数字は本人の主張",
        "has_fulltext": False,
        "source_group": "B",
        "verdict": "取り込み候補",
        "target_project": "note・Brain販売",
        "adoption_note": "段階価格はBrain設計に一部反映済み。X長文＋短尺動画＋「保存して」締めの投稿型は未実施で候補",
    },
    # ========================================================
    # C群: 開発・ツールから（全文取得済み: 12件）
    # ========================================================
    {
        "code": "C1",
        "title": "LoL戦績ツールの制作記",
        "author": "むぅ☁️ @peryton_girl",
        "url": "https://x.com/peryton_girl/status/2123237482057908224",
        "category": "開発事例・競合",
        "summary": "OTPが作った超個人的なLoL戦績ツールの制作記（note記事へのリンク）。個人開発の同路線事例",
        "content": "オタク／OTPがLOLの超個人的すぎる戦績ツールを作った話｜mu https://note.com/peryton_girl/n/n74b055ed9422?sub_rt=share_pb",
        "has_fulltext": True,
        "source_group": "C",
        "verdict": "参考",
        "target_project": "Pilot・Portal",
        "adoption_note": "個人開発の同路線事例。note本文を読めば見せ方の参考になりうる",
    },
    {
        "code": "C2",
        "title": "スキルCD表示の規約論点",
        "author": "LoL Guide @lol_guide_jp",
        "url": "https://x.com/lol_guide_jp/status/2121165245033107527",
        "category": "開発事例・競合",
        "summary": "スキルCDを画面に出しながらプレイするのは規約上ありか、という論点。CDはDataDragon API＋統計的スキルレベル推定、Live Client APIからは相手チャンピオン・ロール・レベルを取得する方式で「統計サイトを別モニターで見るのと本質的に変わらないのでOKでは」という見解。PilotのHUD設計に直結する論点。詳細画像3枚あり",
        "content": "これを画面上に出しながらプレイするのは、規約的にありかなしか。出ているクールダウンは、ゲーム内の情報から取得しているわけではなく、通常のDataDragonのAPIから、出ているアイテムの候補とレベルに対してのスキルレベルは、統計情報の最も選択率が高いもの。ゲーム内のLive Client APIから取得しているのは、相手のチャンピオンとロール名とレベル。サブモニターがある人なら、別のモニターで、いろんな統計サイトのチャンピオンのページを見て、スキルのCDを把握とかはしてる人はいると思う。それと本質的には変わらないのでOKな気もするのだが。",
        "has_fulltext": True,
        "source_group": "C",
        "verdict": "取り込み候補",
        "target_project": "Pilot",
        "adoption_note": "最優先。スキルCD表示の実装方式（DataDragon＋統計推定＋Live Client API）と規約解釈は、作業中のHUD刷新の判断材料に直結",
    },
    {
        "code": "C3",
        "title": "学祭系システム制作報告",
        "author": "ぽーと @sangikousenuser",
        "url": "https://x.com/sangikousenuser/status/2117527184831283666",
        "category": "開発事例・競合",
        "summary": "学祭系システムを作ったという制作報告。詳細は添付画像内（本文は短文のみ）",
        "content": "学祭系システム まあまあ頑張った",
        "has_fulltext": True,
        "source_group": "C",
        "verdict": "参考",
        "target_project": "―",
        "adoption_note": "詳細が添付画像のみ",
    },
    {
        "code": "C4",
        "title": "ワンクリック最適ビルド推薦",
        "author": "Coachless.gg @CoachlessGG",
        "url": "https://x.com/CoachlessGG/status/2113630443085987884",
        "category": "開発事例・競合",
        "summary": "勝率貢献度（Win Probability Added）ベースで最適ビルドをワンクリック推薦する新機能。ルーン・サモナースペル・アイテムセットをクライアントへコピペ可能。海外の競合サービス",
        "content": "Coachless Builds in 1 Click 🆕 Recommended Builds are here - quickly find the strongest setups for your champion based on Win Probability Added, taking into account sample size and item/rune synergies. Runes, Summoner Spells, and an optimized Item Set with situational options that you can directly copy paste into your client. Let us know any feedback & the best builds that you find!",
        "has_fulltext": True,
        "source_group": "C",
        "verdict": "参考",
        "target_project": "Pilot",
        "adoption_note": "競合ベンチマーク。ビルド推薦の見せ方はコーチ機能の比較材料",
    },
    {
        "code": "C5",
        "title": "個人開発ツールのリリース告知",
        "author": "PEAK/zac @chavah_lol",
        "url": "https://x.com/chavah_lol/status/2106687563872498098",
        "category": "開発事例・競合",
        "summary": "ChatGPTサイト上でLoLツールをリリースしたという告知（リンクのみの自己リプライ）",
        "content": "https://lol.peak-kit.chatgpt.site/ ここでリリースしました！",
        "has_fulltext": True,
        "source_group": "C",
        "verdict": None,
        "target_project": None,
        "adoption_note": None,
    },
    {
        "code": "C6",
        "title": "Discord最適化設定",
        "author": "Kuta @KutaTweaks",
        "url": "https://x.com/KutaTweaks/status/2098107609240793124",
        "category": "ツール・設定",
        "summary": "Discordが引き起こす入力遅延とFPS低下を減らす最適化・軽量化設定の紹介。具体的な設定手順は添付動画内",
        "content": "Discord is causing MASSIVE Input Delay and FPS drops while your Gaming and Streaming. Do these Settings to Optimize and Debloat Discord for Maximum Performance on Windows 10/11. (Increased FPS + Reduced Latency) Info Below!",
        "has_fulltext": True,
        "source_group": "C",
        "verdict": "参考",
        "target_project": "KTMコミュニティ",
        "adoption_note": "環境設定の話。コミュニティ向け「快適設定」の共有材料になる",
    },
    {
        "code": "C7",
        "title": "LoLデータベースサイトの機能追加",
        "author": "ズリセンコキ務長官 @kokimu_",
        "url": "https://x.com/kokimu_/status/2090634342271996056",
        "category": "開発事例・競合",
        "summary": "自作LoLデータベースサイト（nunune.pages.dev）に、チャンピオンごとの時間帯別スケーリング表示機能を追加。個人開発の競合事例",
        "content": "LoLのデータベースサイトに、各キャラの時間帯ごとのスケーリングが一目でわかる機能を追加しました。「スケール良くて序盤もそこまで弱くないキャラを使いたいなあ」みたいなキャラ選びの指針に役立てて欲しいです。ホーム画面の右上から行けます。https://nunune.pages.dev",
        "has_fulltext": True,
        "source_group": "C",
        "verdict": "参考",
        "target_project": "Pilot",
        "adoption_note": "時間帯別スケーリング表示はチャンピオン図鑑の見せ方の候補。現時点は競合事例として保持",
    },
    {
        "code": "C8",
        "title": "Stream Deck×Twitchツール設定",
        "author": "可能性のケモノフレンズ @Y918Boss",
        "url": "https://x.com/Y918Boss/status/2086828683629859326",
        "category": "ツール・設定",
        "summary": "Stream DeckのプラグインからTwitchツールを使う設定手順。Channel Nameには見たい人のIDを入れる。具体手順は添付画像内",
        "content": "字読まなくてもなるべくわかるようにまとめました。StreamDeckのプラグインからTwitchツールを選んで あとは画像の通り！ Channel Nameのところは、見たい人の\"ID\"じゃなきゃダメよ！",
        "has_fulltext": True,
        "source_group": "C",
        "verdict": "参考",
        "target_project": "―",
        "adoption_note": "配信まわりの設定メモ。配信が本格化したら使う",
    },
    {
        "code": "C9",
        "title": "チャンネルモニターの使い方",
        "author": "可能性のケモノフレンズ @Y918Boss",
        "url": "https://x.com/Y918Boss/status/2086624636683608409",
        "category": "ツール・設定",
        "summary": "チャンネルモニターに見たい人のIDを入れるだけ、という回答ポスト（C8と対）",
        "content": "@gegetanV ここのチャンネルモニターで見たい人のID入れとくだけです！",
        "has_fulltext": True,
        "source_group": "C",
        "verdict": "参考",
        "target_project": "―",
        "adoption_note": "C8と対の設定メモ",
    },
    {
        "code": "C10",
        "title": "Microsoft PC Manager",
        "author": "mizugame @mizugame_VRC",
        "url": "https://x.com/mizugame_VRC/status/2084476117831110822",
        "category": "ツール・設定",
        "summary": "PCのカクつきはメモリキャッシュが原因のことがあり、Microsoft PC Managerで対処できるという推奨ポスト",
        "content": "なんか俺最近いろんなフレンドがPCカクつくとか言ってるから「それメモリのキャッシュ溜まってんじゃない？Microsoft PC Manager使いな」ってめっちゃ宣伝してる人になってる ちなみにMicrosoft PC Managerは神です",
        "has_fulltext": True,
        "source_group": "C",
        "verdict": "参考",
        "target_project": "―",
        "adoption_note": "個人PCメンテの話。プロジェクトへの取り込みなし",
    },
    {
        "code": "C11",
        "title": "対面別トレードパターン学習サービス",
        "author": "WARDEX @wardex_jp",
        "url": "https://x.com/wardex_jp/status/2069107429682696263",
        "category": "開発事例・競合",
        "summary": "チャンピオンごとの対面別トレードパターンを学ぶサービスWARDEXへの投稿告知（セラフィーン対面なしLv1の例）。Pilotと同領域の学習サービス",
        "content": "セラフィーン vs 対面なし Lv1 のトレードパターンが #WARDEX で投稿されました！「アッシュの隣のときはEを取ろう」by @shimako34343 https://wardex.app/scene/49d7d8b5-5cc7-4bc3-b562-b5a95e7591b6",
        "has_fulltext": True,
        "source_group": "C",
        "verdict": "参考",
        "target_project": "Pilot",
        "adoption_note": "「シーン単位」で対面パターンを出す提示方法は、コーチ・対面タブの見せ方候補",
    },
    {
        "code": "C12",
        "title": "Discordのハードウェアアクセラレーション",
        "author": "BANDAL ゲーミングPCストア @BANDAL_PC",
        "url": "https://x.com/BANDAL_PC/status/1999781347565469779",
        "category": "ツール・設定",
        "summary": "DiscordのハードウェアアクセラレーションをOFFにするとグラボがゲーム専用になりFPSが安定する、という設定注意喚起。デメリット（Discordの動作・画面共有の画質）も明記",
        "content": "Discordがあなたの「グラボ」を勝手に使ってます。「ゲーム中、Discordが重い」「FPSが安定しない」その原因、この設定がONのまま放置されているからかもしれません。🚫 ハードウェアアクセラレーション設定（歯車）＞ 詳細設定 ＞ 「ハードウェアアクセラレーション」をOFF。これでグラボが「ゲーム専用」になりますが、デメリットもあります。⚠️ オフにするデメリット ・Discord自体の動きが少しモッサリするかも ・「画面共有 (Go Live)」のカクつき・画質低下の原因になる。「画面共有の綺麗さ」より「自分の撃ち合いの強さ」を優先したい人は、迷わずOFFにしてください！",
        "has_fulltext": True,
        "source_group": "C",
        "verdict": "参考",
        "target_project": "KTMコミュニティ",
        "adoption_note": "C6と同じく環境設定。コミュニティ共有の材料",
    },
]

def generate_migration_sql() -> str:
    """マイグレーション用 SQL (129_reference_items_add_c_and_evaluations.sql) を生成"""
    sql_lines = [
        "-- ============================================================",
        "-- 129: 参考資料ライブラリ C群(開発・ツール12件)追加 ＆ 一次評価(29件)反映",
        "--",
        "-- 指示文16: 05_PILOT/docs/specs/16-reference-items-add-dev-tools-instruction.md",
        "-- 指示文17: 05_PILOT/docs/specs/17-reference-items-evaluation-instruction.md",
        "-- ============================================================",
        "",
        "-- 1. 評価用カラムの追加（既存テーブルに安全に追加）",
        "ALTER TABLE reference_items ADD COLUMN IF NOT EXISTS verdict text;",
        "ALTER TABLE reference_items ADD COLUMN IF NOT EXISTS target_project text;",
        "ALTER TABLE reference_items ADD COLUMN IF NOT EXISTS adoption_note text;",
        "",
        "-- インデックス作成",
        "CREATE INDEX IF NOT EXISTS idx_reference_items_verdict ON reference_items (verdict);",
        "",
        "-- 2. C群（12件）の追加・更新（冪等性確保のため ON CONFLICT (code) DO UPDATE）",
    ]

    c_items = [item for item in REFERENCE_ITEMS if item["source_group"] == "C"]
    for item in c_items:
        code = item["code"].replace("'", "''")
        title = item["title"].replace("'", "''")
        author = item["author"].replace("'", "''")
        url = item["url"].replace("'", "''")
        category = item["category"].replace("'", "''")
        summary = item["summary"].replace("'", "''")
        content = item["content"].replace("'", "''")
        has_fulltext = "true" if item["has_fulltext"] else "false"
        source_group = item["source_group"].replace("'", "''")
        verdict = f"'{item['verdict'].replace("'", "''")}'" if item["verdict"] else "NULL"
        target_project = f"'{item['target_project'].replace("'", "''")}'" if item["target_project"] else "NULL"
        adoption_note = f"'{item['adoption_note'].replace("'", "''")}'" if item["adoption_note"] else "NULL"

        sql_lines.append(
            f"INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, verdict, target_project, adoption_note, updated_at)\n"
            f"VALUES ('{code}', '{title}', '{author}', '{url}', '{category}', '{summary}', '{content}', {has_fulltext}, '{source_group}', {verdict}, {target_project}, {adoption_note}, now())\n"
            f"ON CONFLICT (code) DO UPDATE SET\n"
            f"    title = EXCLUDED.title,\n"
            f"    author = EXCLUDED.author,\n"
            f"    url = EXCLUDED.url,\n"
            f"    category = EXCLUDED.category,\n"
            f"    summary = EXCLUDED.summary,\n"
            f"    content = EXCLUDED.content,\n"
            f"    has_fulltext = EXCLUDED.has_fulltext,\n"
            f"    source_group = EXCLUDED.source_group,\n"
            f"    verdict = EXCLUDED.verdict,\n"
            f"    target_project = EXCLUDED.target_project,\n"
            f"    adoption_note = EXCLUDED.adoption_note,\n"
            f"    updated_at = now();\n"
        )

    sql_lines.append("\n-- 3. 既存A群・B群への一次評価データの反映（codeをキーにUPDATE）\n")
    evaluated_non_c = [item for item in REFERENCE_ITEMS if item["source_group"] != "C" and item["verdict"] is not None]
    for item in evaluated_non_c:
        code = item["code"].replace("'", "''")
        verdict = f"'{item['verdict'].replace("'", "''")}'" if item["verdict"] else "NULL"
        target_project = f"'{item['target_project'].replace("'", "''")}'" if item["target_project"] else "NULL"
        adoption_note = f"'{item['adoption_note'].replace("'", "''")}'" if item["adoption_note"] else "NULL"

        sql_lines.append(
            f"UPDATE reference_items SET\n"
            f"    verdict = {verdict},\n"
            f"    target_project = {target_project},\n"
            f"    adoption_note = {adoption_note},\n"
            f"    updated_at = now()\n"
            f"WHERE code = '{code}';\n"
        )

    return "\n".join(sql_lines)

def print_summary():
    """データ内訳の集計表示"""
    total = len(REFERENCE_ITEMS)
    fulltext_count = sum(1 for item in REFERENCE_ITEMS if item["has_fulltext"])
    summary_only_count = sum(1 for item in REFERENCE_ITEMS if not item["has_fulltext"])
    
    categories = {}
    for item in REFERENCE_ITEMS:
        cat = item["category"]
        categories[cat] = categories.get(cat, 0) + 1

    groups = {}
    for item in REFERENCE_ITEMS:
        grp = item["source_group"]
        groups[grp] = groups.get(grp, 0) + 1

    eval_counts = {
        "取り込み候補": sum(1 for item in REFERENCE_ITEMS if item["verdict"] == "取り込み候補"),
        "参考": sum(1 for item in REFERENCE_ITEMS if item["verdict"] == "参考"),
        "評価なし(NULL)": sum(1 for item in REFERENCE_ITEMS if item["verdict"] is None),
    }

    print("=" * 65)
    print(f"📚 参考資料マスターデータ集計 (合計: {total} 件)")
    print(f"  - グループ内訳: A群(X-AI/副業)={groups.get('A', 0)}件, B群(チャット)={groups.get('B', 0)}件, C群(X-開発/ツール)={groups.get('C', 0)}件")
    print(f"  - 本文有無: 全文あり={fulltext_count}件, 要点のみ={summary_only_count}件")
    print("  - カテゴリ内訳:")
    for cat, count in categories.items():
        print(f"    * {cat}: {count} 件")
    print("  - 一次評価内訳:")
    for v, count in eval_counts.items():
        print(f"    * {v}: {count} 件")
    print("=" * 65)

def list_items():
    """全34件の一覧を表示"""
    print(f"{'コード':<5} | {'カテゴリ':<12} | {'本文':<4} | {'判定':<8} | {'行き先':<14} | タイトル")
    print("-" * 90)
    for item in REFERENCE_ITEMS:
        ft = "全文" if item["has_fulltext"] else "要点"
        v = item["verdict"] or "―"
        tp = item["target_project"] or "―"
        print(f"{item['code']:<5} | {item['category']:<10} | {ft:<4} | {v:<6} | {tp:<12} | {item['title']}")

def get_item(code: str):
    """指定コードの詳細を表示"""
    match = next((item for item in REFERENCE_ITEMS if item["code"].upper() == code.upper()), None)
    if not match:
        print(f"❌ コード '{code}' は見つかりませんでした。")
        return
    print(f"[{match['code']}] {match['title']}")
    print(f"著者: {match['author']}")
    print(f"URL: {match['url']}")
    print(f"カテゴリ: {match['category']} (全文有無: {'全文あり' if match['has_fulltext'] else '要点のみ'})")
    print(f"一次評価判定: {match['verdict'] or '未評価'}")
    print(f"行き先: {match['target_project'] or '―'}")
    print(f"取り込み方メモ: {match['adoption_note'] or '―'}")
    print(f"要点: {match['summary']}")
    print("-" * 65)
    print("【本文・内容】")
    print(match["content"])
    print("-" * 65)

def search_items(query: str):
    """キーワード検索"""
    q = query.lower()
    matches = [
        item for item in REFERENCE_ITEMS
        if q in item["title"].lower() or q in item["summary"].lower() or q in item["content"].lower() or q in item["author"].lower()
        or (item["adoption_note"] and q in item["adoption_note"].lower())
        or (item["target_project"] and q in item["target_project"].lower())
    ]
    print(f"🔍 検索キーワード: '{query}' ({len(matches)} 件ヒット)")
    print("-" * 80)
    for m in matches:
        ft = "全文" if m["has_fulltext"] else "要点"
        v = m["verdict"] or "―"
        print(f"[{m['code']}] ({m['category']}/{ft} | 評価:{v}) {m['title']} - {m['author']}")
        print(f"   要点: {m['summary']}")
        if m["adoption_note"]:
            print(f"   取り込み方: {m['adoption_note']}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="参考資料ライブラリ管理スクリプト")
    parser.add_argument("--list", action="store_true", help="全件一覧表示")
    parser.add_argument("--get", type=str, help="指定コードの詳細・本文・評価表示 (例: A1, C2)")
    parser.add_argument("--search", type=str, help="キーワード検索")
    args = parser.parse_args()

    if args.list:
        list_items()
    elif args.get:
        get_item(args.get)
    elif args.search:
        search_items(args.search)
    else:
        print_summary()
        sql_content = generate_migration_sql()
        target_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "04_PORTAL", "supabase", "migrations", "129_reference_items_add_c_and_evaluations.sql"
        )
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(sql_content)
        print(f"✅ マイグレーションファイルを生成しました: {target_path}")
