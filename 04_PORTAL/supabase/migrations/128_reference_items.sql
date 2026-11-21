-- ============================================================
-- 128: 参考資料ライブラリ (AI活用・副業) 専用テーブル作成 ＆ 初期データ投入
--
-- 指示文15: 05_PILOT/docs/specs/15-reference-library-instruction.md
-- personal_knowledge (LoL知見) とは分離し、参考資料専用のテーブルとして運用する。
-- ============================================================

-- 1. テーブル作成
CREATE TABLE IF NOT EXISTS reference_items (
    id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    code text UNIQUE NOT NULL,
    title text NOT NULL,
    author text,
    url text,
    category text NOT NULL,
    summary text,
    content text,
    has_fulltext boolean NOT NULL DEFAULT false,
    source_group text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. インデックス作成
CREATE INDEX IF NOT EXISTS idx_reference_items_category ON reference_items (category);
CREATE INDEX IF NOT EXISTS idx_reference_items_code ON reference_items (code);

-- 3. RLS の有効化とポリシー設定
ALTER TABLE reference_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reference_items' AND policyname = 'Allow read for all') THEN
        CREATE POLICY "Allow read for all" ON reference_items FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reference_items' AND policyname = 'Allow insert for admin') THEN
        CREATE POLICY "Allow insert for admin" ON reference_items FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reference_items' AND policyname = 'Allow update for admin') THEN
        CREATE POLICY "Allow update for admin" ON reference_items FOR UPDATE TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reference_items' AND policyname = 'Allow delete for admin') THEN
        CREATE POLICY "Allow delete for admin" ON reference_items FOR DELETE TO authenticated USING (true);
    END IF;
END $$;

-- 4. 初期データ投入（全22件: 冪等性確保のため ON CONFLICT (code) DO UPDATE）
INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, updated_at)
VALUES ('A1', 'プロンプト技法「ランクA／ランクS」', 'かねき @kaneki_aiafi', 'https://twitter.com/kaneki_aiafi/status/2117723996074705182', 'AI活用', '質問の前提検証・条件明確化・自己レビュー等の18技法。SPEC作成に転用可', 'すぐ使えるチェックリストとして今回一番実用的。

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

活かしどころ：SPEC作成や調査依頼の前に「前提改善」「条件明確化」を挟む、など今のワークフローにそのまま差し込める。', true, 'A', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, updated_at)
VALUES ('A2', 'Muse×Gmailで放置アカウント洗い出し', 'ごろとん @goroton_ai', 'https://twitter.com/goroton_ai/status/2123345284293914781', 'AI活用', 'コネクター連携で会員登録メールから登録サイトを一覧化（①のみ取得）', '親ポスト：「丸パクリでいいやつ。昔登録して放置してるサイト。Claudeに全部洗い出させて、片っ端から退会してる。使ってないアカウントほど、乗っ取られても気づけない。放置アカウントを消す4ステップ」
①「登録したサイトを、Museに洗い出させる。設定 → コネクター → Gmailをつないで、『過去のメールから、会員登録や登録完了のメールが来ているサイトを全部一覧にして』と頼む。自分じゃ思い出せない数が出てくる」
※②〜④は後続リプライにあり未取得。
活かしどころ：先日のサブスク棚卸し（Gmail領収書ベースで実施済み）と同じ発想。登録サイト一覧は未実施なので、セキュリティ棚卸しとして一度やる価値あり。', true, 'A', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, updated_at)
VALUES ('A3', 'AI駆動開発の型：資料はHTMLサイト化', 'K e n T a @kenta_feels_ayu', 'https://twitter.com/kenta_feels_ayu/status/2121125122866315702', 'AI活用', 'ADRはMarkdown、人間向け資料はHTMLサイト化して触って理解する', '引用元ポスト：「最近、自分のなかのAI駆動開発の型として、ADRはMarkdownとして溜めつつ、人間が読む資料は全てWebサイトベース(HTML)で作ってて、かなり開発が安定してきてる。仕様書もマークダウンで書くより仕様解説の動的なWebサイト作って図解してもらったほうが判断精度が上がった気がする」
本文：「Markdown上の膨大な仕様書コンテキストであーだこーだ言われても全く頭に入ってこんのだけど、実際に解説サイトを作らせて自分で触ってみると『あ～そういうことね』ってなることが多い」（動画付き）
活かしどころ：SPEC運用（MarkdownでGitHub受け渡し）の先の話として、大きなSPECは「触れる解説ページ」化するとレビュー精度が上がる、という方向性。Pilot/Portalの仕様確認に使える。', true, 'A', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, updated_at)
VALUES ('A4', 'MCPで行政データ7.5万件を自然言語分析（公式）', 'デジタル庁 @digital_jpn', 'https://twitter.com/digital_jpn/status/2087788744502075801', 'AI活用', '公式の技術検証。AIの誤った補完を減らす設計、MCP Apps試作', '「Techブログ：行政手続等調査データ（約75,000件）をMCPで自然言語分析可能に。MCP（Model Context Protocol）を活用して対話形式で分析を行える、技術検証目的の簡易的な実装をご紹介。AIの誤った補完・推測を減らしつつ、MCP AppsによるチャットUI表示も試作」
本文はリンク先のnote記事：https://digital-gov.note.jp/n/n56aaf580bfb6
活かしどころ：公式の実装事例として信頼できる技術参考。「AIの誤った補完・推測を減らす」設計は、Pilotの解析精度の考え方にも通じる。', true, 'A', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, updated_at)
VALUES ('A5', '「Omniroute」紹介（著者の主張・未検証）', 'ルカ @ruka_affi', 'https://twitter.com/ruka_affi/status/2088254064782172559', 'AI活用', 'Claude Code無料・無制限をうたう非公式ツール（主張・未検証、リスク注意、記録のみ）', '「Claude Codeがほぼ無制限で無料で使えるようになりました。海外の人が作った『Omniroute（オムニルート）』という無料ツールがあるんですが、これで何ができるかというと、↓」（続きはリプライにあり未取得）
注意：非公式のルーティングツールで「無料・無制限」をうたうものは、アカウントや利用規約、セキュリティ面のリスクがあり得る。使う前提ではなく、存在の記録のみ。', true, 'A', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, updated_at)
VALUES ('A6', 'X Articleへのリンクのみ', 'かい @K_AI_Work', 'https://twitter.com/K_AI_Work/status/2123204523560997074', 'AI活用', '記事本文は未取得', '本文はX Articleへのリンクのみで、記事本文は取得できなかった。', true, 'A', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, updated_at)
VALUES ('A7', '40〜60代向けChatGPT講座の告知', 'AI業務効率化委員会 @ai_info0207', 'https://twitter.com/ai_info0207/status/2116240858525945890', 'AI活用', '「中高年×AI習得」市場の材料', '「そろそろ本気でChatGPT学ばないとヤバい…AI活用についていけてない40代・50代・60代へ。2.5時間で、仕事に使えるレベルまで習得できます」という有料講座の告知ポスト（インプレッション434万）。
活かしどころ：内容そのものより、「中高年×AI習得」という市場の大きさを示す材料。自分の発信の読者像を考える際の参考。', true, 'A', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, updated_at)
VALUES ('A8', '楽天放置アフィ主張（著者の主張・未検証）', 'こけぞう @gaget12090105', 'https://twitter.com/gaget12090105/status/2121354727002935610', '副業・販売の型', 'ChatGPT丸投げ型（主張・未検証）。方針は「型だけ取り入れる」で確定済み', '本文：「マｯｯｯｯｯｯジで忙しい社会人は楽天放置アフィだけやってくださぁぁぁぁぁぁーーーーーい！！！！！」
引用元：「楽天アフィで3日で18万稼げたけど、月20万ぐらいなら初心者でも余裕です。スマホにChatGPTとXを入れて、『教えてチャッピー』って丸投げするだけ。プロンプトごとそのままパクってください↓↓（保存推奨）」（プロンプト自体は後続リプライにあり未取得）
位置づけ：とら記事・くろねこの「AI×アフィ」系と同じ型。あなたの方針は「型だけ取り入れる」で確定済み（2026-11-20）。数字は著者の主張として割り引くこと。', true, 'A', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, updated_at)
VALUES ('A9', '敵JG習慣トラッカー自作（著者の主張）', 'Beora @_Beora', 'https://twitter.com/_Beora/status/2075341944147111944', '開発事例・競合', '自作ツールで約800LP上昇と報告（主張）。Pilotオーバーレイ改善の同路線事例', '敵JGの習慣を記録する自作サイトを使い約800LP上がったと報告。Pilotのオーバーレイ改善と同じ「自作ツールで競技力を上げる」路線の事例。', true, 'A', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, updated_at)
VALUES ('A10', '無料LoL解析ボット', 'GL iReaz @i_reaz', 'https://twitter.com/i_reaz/status/2096605377320091798', '開発事例・競合', 'Pilotの競合参考。続き1件取得済み', '全試合を自動分析してミスや移動を指摘する無料ボット。スレッド続き編に続き1件あり。Pilotの競合参考。', true, 'A', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, updated_at)
VALUES ('B1', 'Museの初心者向け活用法7選（2026-11-19）', 'あさひ @asahi_ai_x', 'チャット共有（URL未記録）', 'AI活用', 'メルマガ解除リスト化とサブスク棚卸しの着想元（実際にGmail棚卸しを実施）', 'メルマガ解除リスト化とサブスク棚卸しの着想元（実際にGmail棚卸しを実施）', false, 'B', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, updated_at)
VALUES ('B2', 'Muse自動×海外アフィ（2026-11-19）', 'とら @3Imzdo3', 'チャット共有（URL未記録）', '副業・販売の型', 'ユーザー判断「型だけ取り入れる」。6つの型は note目標の `参考-とら記事から取り入れる型.md` に保存済み', 'ユーザー判断「型だけ取り入れる」。6つの型は note目標の `参考-とら記事から取り入れる型.md` に保存済み', false, 'B', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, updated_at)
VALUES ('B3', 'Muse自動化の教科書2026年11月版', 'プルぽち @nana39051ma', 'チャット共有（URL未記録）', 'AI活用', '自動化レベル1〜5、止まる5原因、週次点検。4行設計シートが借りられる型', '自動化レベル1〜5、止まる5原因、週次点検。4行設計シートが借りられる型', false, 'B', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, updated_at)
VALUES ('B4', 'Claude Codeカスタマイズ論', 'ガガロット @gagarot200', 'チャット共有（URL未記録）', 'AI活用', '人格・記憶・整理・仕事・説明書のファイルを積み上げる運用論。現行運用とほぼ一致', '人格・記憶・整理・仕事・説明書のファイルを積み上げる運用論。現行運用とほぼ一致', false, 'B', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, updated_at)
VALUES ('B5', 'MEMORY.md圧縮論（2026-11-18）', '梶谷健人 @kajikent', 'チャット共有（URL未記録）', 'AI活用', '超重要事項＋シーン別ファイルへの目次化。週次メモリ整理の着想元', '超重要事項＋シーン別ファイルへの目次化。週次メモリ整理の着想元', false, 'B', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, updated_at)
VALUES ('B6', '今週GitHubで急上昇したAIツール10選（2026-11-19）', 'そう @so_ainsight', 'チャット共有（URL未記録）', 'AI活用', 'コーディングAIのWeb誘導リポジトリ、文章の人間味仕上げ等', 'コーディングAIのWeb誘導リポジトリ、文章の人間味仕上げ等', false, 'B', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, updated_at)
VALUES ('B7', '違法っぽく見えて合法なGitHubリポジトリ10選（2026-11-17）', 'sanzida @abir35627', 'チャット共有（URL未記録）', 'AI活用', 'yt-dlp、Ollama、Whisper等。Pilot SPEC 11（Whisper実働検証）のきっかけ', 'yt-dlp、Ollama、Whisper等。Pilot SPEC 11（Whisper実働検証）のきっかけ', false, 'B', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, updated_at)
VALUES ('B8', '300円note×AI全自動メソッド（2026-11-16）', 'くろねこ @kuro_affi', 'https://x.com/kuro_affi/status/2122434535786733776', '副業・販売の型', 'テーマ選定が9割、実績ある型に流し込む、低価格入口→高価格導線（収益数字は主張・未検証）', 'テーマ選定が9割、実績ある型に流し込む、低価格入口→高価格導線（収益数字は主張・未検証）', false, 'B', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, updated_at)
VALUES ('B9', 'AI×note の対照的な2投稿', 'シン @sin_brain1', 'https://x.com/sin_brain1/status/2122535885027549498 / https://x.com/sin_brain1/status/2121810603291431174', '副業・販売の型', '「AIに作らせたnoteはそのまま公開してもほとんど売れません」が品質重視の自説と一致', '「AIに作らせたnoteはそのまま公開してもほとんど売れません」が品質重視の自説と一致', false, 'B', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, updated_at)
VALUES ('B10', 'Claude自動化×note販売の引用投稿', 'はと @hato_sns', 'https://x.com/hato_sns/status/2121536681119785357', '副業・販売の型', '長文記事本体は未取得', '長文記事本体は未取得', false, 'B', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, updated_at)
VALUES ('B11', '同上の引用投稿（食パン）', '食パン @take_ai_mkt', 'https://x.com/take_ai_mkt/status/2121528575434350825', '副業・販売の型', '長文記事本体は未取得', '長文記事本体は未取得', false, 'B', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, updated_at)
VALUES ('B12', '複数AIによるSNS自動化の販売ファネル', 'テンペ @HimazinProducer', 'https://x.com/himazinproducer', '副業・販売の型', 'X長文＋短尺動画＋「保存して」締め、段階価格（5,000円→50,000円）、自社LP＋Stripe。数字は本人の主張', 'X長文＋短尺動画＋「保存して」締め、段階価格（5,000円→50,000円）、自社LP＋Stripe。数字は本人の主張', false, 'B', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    updated_at = now();
