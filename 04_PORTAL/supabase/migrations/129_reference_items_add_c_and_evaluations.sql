-- ============================================================
-- 129: 参考資料ライブラリ C群(開発・ツール12件)追加 ＆ 一次評価(29件)反映
--
-- 指示文16: 05_PILOT/docs/specs/16-reference-items-add-dev-tools-instruction.md
-- 指示文17: 05_PILOT/docs/specs/17-reference-items-evaluation-instruction.md
-- ============================================================

-- 1. 評価用カラムの追加（既存テーブルに安全に追加）
ALTER TABLE reference_items ADD COLUMN IF NOT EXISTS verdict text;
ALTER TABLE reference_items ADD COLUMN IF NOT EXISTS target_project text;
ALTER TABLE reference_items ADD COLUMN IF NOT EXISTS adoption_note text;

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_reference_items_verdict ON reference_items (verdict);

-- 2. C群（12件）の追加・更新（冪等性確保のため ON CONFLICT (code) DO UPDATE）
INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, verdict, target_project, adoption_note, updated_at)
VALUES ('C1', 'LoL戦績ツールの制作記', 'むぅ☁️ @peryton_girl', 'https://x.com/peryton_girl/status/2123237482057908224', '開発事例・競合', 'OTPが作った超個人的なLoL戦績ツールの制作記（note記事へのリンク）。個人開発の同路線事例', 'オタク／OTPがLOLの超個人的すぎる戦績ツールを作った話｜mu https://note.com/peryton_girl/n/n74b055ed9422?sub_rt=share_pb', true, 'C', '参考', 'Pilot・Portal', '個人開発の同路線事例。note本文を読めば見せ方の参考になりうる', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    verdict = EXCLUDED.verdict,
    target_project = EXCLUDED.target_project,
    adoption_note = EXCLUDED.adoption_note,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, verdict, target_project, adoption_note, updated_at)
VALUES ('C2', 'スキルCD表示の規約論点', 'LoL Guide @lol_guide_jp', 'https://x.com/lol_guide_jp/status/2121165245033107527', '開発事例・競合', 'スキルCDを画面に出しながらプレイするのは規約上ありか、という論点。CDはDataDragon API＋統計的スキルレベル推定、Live Client APIからは相手チャンピオン・ロール・レベルを取得する方式で「統計サイトを別モニターで見るのと本質的に変わらないのでOKでは」という見解。PilotのHUD設計に直結する論点。詳細画像3枚あり', 'これを画面上に出しながらプレイするのは、規約的にありかなしか。出ているクールダウンは、ゲーム内の情報から取得しているわけではなく、通常のDataDragonのAPIから、出ているアイテムの候補とレベルに対してのスキルレベルは、統計情報の最も選択率が高いもの。ゲーム内のLive Client APIから取得しているのは、相手のチャンピオンとロール名とレベル。サブモニターがある人なら、別のモニターで、いろんな統計サイトのチャンピオンのページを見て、スキルのCDを把握とかはしてる人はいると思う。それと本質的には変わらないのでOKな気もするのだが。', true, 'C', '取り込み候補', 'Pilot', '最優先。スキルCD表示の実装方式（DataDragon＋統計推定＋Live Client API）と規約解釈は、作業中のHUD刷新の判断材料に直結', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    verdict = EXCLUDED.verdict,
    target_project = EXCLUDED.target_project,
    adoption_note = EXCLUDED.adoption_note,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, verdict, target_project, adoption_note, updated_at)
VALUES ('C3', '学祭系システム制作報告', 'ぽーと @sangikousenuser', 'https://x.com/sangikousenuser/status/2117527184831283666', '開発事例・競合', '学祭系システムを作ったという制作報告。詳細は添付画像内（本文は短文のみ）', '学祭系システム まあまあ頑張った', true, 'C', '参考', '―', '詳細が添付画像のみ', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    verdict = EXCLUDED.verdict,
    target_project = EXCLUDED.target_project,
    adoption_note = EXCLUDED.adoption_note,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, verdict, target_project, adoption_note, updated_at)
VALUES ('C4', 'ワンクリック最適ビルド推薦', 'Coachless.gg @CoachlessGG', 'https://x.com/CoachlessGG/status/2113630443085987884', '開発事例・競合', '勝率貢献度（Win Probability Added）ベースで最適ビルドをワンクリック推薦する新機能。ルーン・サモナースペル・アイテムセットをクライアントへコピペ可能。海外の競合サービス', 'Coachless Builds in 1 Click 🆕 Recommended Builds are here - quickly find the strongest setups for your champion based on Win Probability Added, taking into account sample size and item/rune synergies. Runes, Summoner Spells, and an optimized Item Set with situational options that you can directly copy paste into your client. Let us know any feedback & the best builds that you find!', true, 'C', '参考', 'Pilot', '競合ベンチマーク。ビルド推薦の見せ方はコーチ機能の比較材料', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    verdict = EXCLUDED.verdict,
    target_project = EXCLUDED.target_project,
    adoption_note = EXCLUDED.adoption_note,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, verdict, target_project, adoption_note, updated_at)
VALUES ('C5', '個人開発ツールのリリース告知', 'PEAK/zac @chavah_lol', 'https://x.com/chavah_lol/status/2106687563872498098', '開発事例・競合', 'ChatGPTサイト上でLoLツールをリリースしたという告知（リンクのみの自己リプライ）', 'https://lol.peak-kit.chatgpt.site/ ここでリリースしました！', true, 'C', NULL, NULL, NULL, now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    verdict = EXCLUDED.verdict,
    target_project = EXCLUDED.target_project,
    adoption_note = EXCLUDED.adoption_note,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, verdict, target_project, adoption_note, updated_at)
VALUES ('C6', 'Discord最適化設定', 'Kuta @KutaTweaks', 'https://x.com/KutaTweaks/status/2098107609240793124', 'ツール・設定', 'Discordが引き起こす入力遅延とFPS低下を減らす最適化・軽量化設定の紹介。具体的な設定手順は添付動画内', 'Discord is causing MASSIVE Input Delay and FPS drops while your Gaming and Streaming. Do these Settings to Optimize and Debloat Discord for Maximum Performance on Windows 10/11. (Increased FPS + Reduced Latency) Info Below!', true, 'C', '参考', 'KTMコミュニティ', '環境設定の話。コミュニティ向け「快適設定」の共有材料になる', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    verdict = EXCLUDED.verdict,
    target_project = EXCLUDED.target_project,
    adoption_note = EXCLUDED.adoption_note,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, verdict, target_project, adoption_note, updated_at)
VALUES ('C7', 'LoLデータベースサイトの機能追加', 'ズリセンコキ務長官 @kokimu_', 'https://x.com/kokimu_/status/2090634342271996056', '開発事例・競合', '自作LoLデータベースサイト（nunune.pages.dev）に、チャンピオンごとの時間帯別スケーリング表示機能を追加。個人開発の競合事例', 'LoLのデータベースサイトに、各キャラの時間帯ごとのスケーリングが一目でわかる機能を追加しました。「スケール良くて序盤もそこまで弱くないキャラを使いたいなあ」みたいなキャラ選びの指針に役立てて欲しいです。ホーム画面の右上から行けます。https://nunune.pages.dev', true, 'C', '参考', 'Pilot', '時間帯別スケーリング表示はチャンピオン図鑑の見せ方の候補。現時点は競合事例として保持', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    verdict = EXCLUDED.verdict,
    target_project = EXCLUDED.target_project,
    adoption_note = EXCLUDED.adoption_note,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, verdict, target_project, adoption_note, updated_at)
VALUES ('C8', 'Stream Deck×Twitchツール設定', '可能性のケモノフレンズ @Y918Boss', 'https://x.com/Y918Boss/status/2086828683629859326', 'ツール・設定', 'Stream DeckのプラグインからTwitchツールを使う設定手順。Channel Nameには見たい人のIDを入れる。具体手順は添付画像内', '字読まなくてもなるべくわかるようにまとめました。StreamDeckのプラグインからTwitchツールを選んで あとは画像の通り！ Channel Nameのところは、見たい人の"ID"じゃなきゃダメよ！', true, 'C', '参考', '―', '配信まわりの設定メモ。配信が本格化したら使う', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    verdict = EXCLUDED.verdict,
    target_project = EXCLUDED.target_project,
    adoption_note = EXCLUDED.adoption_note,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, verdict, target_project, adoption_note, updated_at)
VALUES ('C9', 'チャンネルモニターの使い方', '可能性のケモノフレンズ @Y918Boss', 'https://x.com/Y918Boss/status/2086624636683608409', 'ツール・設定', 'チャンネルモニターに見たい人のIDを入れるだけ、という回答ポスト（C8と対）', '@gegetanV ここのチャンネルモニターで見たい人のID入れとくだけです！', true, 'C', '参考', '―', 'C8と対の設定メモ', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    verdict = EXCLUDED.verdict,
    target_project = EXCLUDED.target_project,
    adoption_note = EXCLUDED.adoption_note,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, verdict, target_project, adoption_note, updated_at)
VALUES ('C10', 'Microsoft PC Manager', 'mizugame @mizugame_VRC', 'https://x.com/mizugame_VRC/status/2084476117831110822', 'ツール・設定', 'PCのカクつきはメモリキャッシュが原因のことがあり、Microsoft PC Managerで対処できるという推奨ポスト', 'なんか俺最近いろんなフレンドがPCカクつくとか言ってるから「それメモリのキャッシュ溜まってんじゃない？Microsoft PC Manager使いな」ってめっちゃ宣伝してる人になってる ちなみにMicrosoft PC Managerは神です', true, 'C', '参考', '―', '個人PCメンテの話。プロジェクトへの取り込みなし', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    verdict = EXCLUDED.verdict,
    target_project = EXCLUDED.target_project,
    adoption_note = EXCLUDED.adoption_note,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, verdict, target_project, adoption_note, updated_at)
VALUES ('C11', '対面別トレードパターン学習サービス', 'WARDEX @wardex_jp', 'https://x.com/wardex_jp/status/2069107429682696263', '開発事例・競合', 'チャンピオンごとの対面別トレードパターンを学ぶサービスWARDEXへの投稿告知（セラフィーン対面なしLv1の例）。Pilotと同領域の学習サービス', 'セラフィーン vs 対面なし Lv1 のトレードパターンが #WARDEX で投稿されました！「アッシュの隣のときはEを取ろう」by @shimako34343 https://wardex.app/scene/49d7d8b5-5cc7-4bc3-b562-b5a95e7591b6', true, 'C', '参考', 'Pilot', '「シーン単位」で対面パターンを出す提示方法は、コーチ・対面タブの見せ方候補', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    verdict = EXCLUDED.verdict,
    target_project = EXCLUDED.target_project,
    adoption_note = EXCLUDED.adoption_note,
    updated_at = now();

INSERT INTO reference_items (code, title, author, url, category, summary, content, has_fulltext, source_group, verdict, target_project, adoption_note, updated_at)
VALUES ('C12', 'Discordのハードウェアアクセラレーション', 'BANDAL ゲーミングPCストア @BANDAL_PC', 'https://x.com/BANDAL_PC/status/1999781347565469779', 'ツール・設定', 'DiscordのハードウェアアクセラレーションをOFFにするとグラボがゲーム専用になりFPSが安定する、という設定注意喚起。デメリット（Discordの動作・画面共有の画質）も明記', 'Discordがあなたの「グラボ」を勝手に使ってます。「ゲーム中、Discordが重い」「FPSが安定しない」その原因、この設定がONのまま放置されているからかもしれません。🚫 ハードウェアアクセラレーション設定（歯車）＞ 詳細設定 ＞ 「ハードウェアアクセラレーション」をOFF。これでグラボが「ゲーム専用」になりますが、デメリットもあります。⚠️ オフにするデメリット ・Discord自体の動きが少しモッサリするかも ・「画面共有 (Go Live)」のカクつき・画質低下の原因になる。「画面共有の綺麗さ」より「自分の撃ち合いの強さ」を優先したい人は、迷わずOFFにしてください！', true, 'C', '参考', 'KTMコミュニティ', 'C6と同じく環境設定。コミュニティ共有の材料', now())
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    verdict = EXCLUDED.verdict,
    target_project = EXCLUDED.target_project,
    adoption_note = EXCLUDED.adoption_note,
    updated_at = now();


-- 3. 既存A群・B群への一次評価データの反映（codeをキーにUPDATE）

UPDATE reference_items SET
    verdict = '取り込み候補',
    target_project = '開発フロー',
    adoption_note = 'SPEC・指示文のチェックリストに転用可（前提検証・条件明確化・自己レビュー）。未決事項の明記など一部は実践済み',
    updated_at = now()
WHERE code = 'A1';

UPDATE reference_items SET
    verdict = '取り込み候補',
    target_project = '開発フロー（運用）',
    adoption_note = '定期棚卸しルーチンの型。サブスク棚卸しは実施済みで、登録サイト洗い出しも同じ手順で可能',
    updated_at = now()
WHERE code = 'A2';

UPDATE reference_items SET
    verdict = '参考',
    target_project = '開発フロー',
    adoption_note = 'ADR＝Markdownは現行SPEC運用と同型。人間向け資料のHTML化は朝刊で一部実践済み',
    updated_at = now()
WHERE code = 'A3';

UPDATE reference_items SET
    verdict = '参考',
    target_project = '―',
    adoption_note = '大規模行政のMCP事例。発想のみ参考',
    updated_at = now()
WHERE code = 'A4';

UPDATE reference_items SET
    verdict = '参考',
    target_project = 'note・Brain販売',
    adoption_note = '「中高年×AI習得」市場の材料として',
    updated_at = now()
WHERE code = 'A7';

UPDATE reference_items SET
    verdict = '参考',
    target_project = 'note・Brain販売',
    adoption_note = '型だけ取り入れる方針が確定済み。数字は未検証',
    updated_at = now()
WHERE code = 'A8';

UPDATE reference_items SET
    verdict = '取り込み候補',
    target_project = 'Pilot',
    adoption_note = '敵JGの習慣を記録・可視化する機能はHUD／コーチと同路線。機能アイデアとしてSPEC候補。中身の追加調査が要る',
    updated_at = now()
WHERE code = 'A9';

UPDATE reference_items SET
    verdict = '参考',
    target_project = 'Pilot',
    adoption_note = '競合ベンチマーク。機能比較を作れば改善材料になる',
    updated_at = now()
WHERE code = 'A10';

UPDATE reference_items SET
    verdict = '取り込み候補',
    target_project = '開発フロー（運用）',
    adoption_note = '実施済み。メルマガ解除リスト化とサブスク棚卸しを実際にやった',
    updated_at = now()
WHERE code = 'B1';

UPDATE reference_items SET
    verdict = '取り込み候補',
    target_project = 'note・Brain販売',
    adoption_note = '取り込み済み。型ファイルに保存し、Brain第1弾の設計に反映する方針が確定',
    updated_at = now()
WHERE code = 'B2';

UPDATE reference_items SET
    verdict = '取り込み候補',
    target_project = '開発フロー',
    adoption_note = '自動化の設計シート（4行）と週次点検の型。週次メモリ整理cronは一部実践。SPEC作成時の設計チェックに採用可',
    updated_at = now()
WHERE code = 'B3';

UPDATE reference_items SET
    verdict = '参考',
    target_project = '開発フロー',
    adoption_note = '現行運用（人格・記憶・指示ファイル）とほぼ一致',
    updated_at = now()
WHERE code = 'B4';

UPDATE reference_items SET
    verdict = '取り込み候補',
    target_project = '開発フロー',
    adoption_note = '取り込み進行中。週次メモリ整理cronの着想元',
    updated_at = now()
WHERE code = 'B5';

UPDATE reference_items SET
    verdict = '参考',
    target_project = '開発フロー',
    adoption_note = 'ツール候補のメモ。個別ツールの要否は未検討',
    updated_at = now()
WHERE code = 'B6';

UPDATE reference_items SET
    verdict = '取り込み候補',
    target_project = 'Pilot・開発フロー',
    adoption_note = '一部実施済み（Whisper→SPEC 11、Ollama→導入済み）。残り（n8n等）は未評価',
    updated_at = now()
WHERE code = 'B7';

UPDATE reference_items SET
    verdict = '参考',
    target_project = 'note・Brain販売',
    adoption_note = '低価格入口→高価格導線の型はBrainの段階価格設計と同型で反映済み。数字は未検証',
    updated_at = now()
WHERE code = 'B8';

UPDATE reference_items SET
    verdict = '参考',
    target_project = 'note・Brain販売',
    adoption_note = '「AI産のままでは売れない」は品質方針の裏付け。方針確認済み',
    updated_at = now()
WHERE code = 'B9';

UPDATE reference_items SET
    verdict = '取り込み候補',
    target_project = 'note・Brain販売',
    adoption_note = '段階価格はBrain設計に一部反映済み。X長文＋短尺動画＋「保存して」締めの投稿型は未実施で候補',
    updated_at = now()
WHERE code = 'B12';
