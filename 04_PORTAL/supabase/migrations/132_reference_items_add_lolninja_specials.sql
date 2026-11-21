-- Migration: 132_reference_items_add_lolninja_specials.sql
-- Description: LoL忍者重要記事2件（E18: Bo3セッション法, E19: LoLalytics統計読解バイアス）の新規追加

INSERT INTO public.reference_items (
    code, title, author, url, category, summary, content, has_fulltext, source_group, created_at, updated_at
)
VALUES 
(
    'E18',
    'みるみるランクが上がる「Bo3セッション法」（Coach Curtis提唱）',
    'LoL忍者 🥷 @LOLNinjaBlog',
    'https://lolninja.net/2021/03/02/26554/',
    'LoL上達・戦術',
    'Coach Curtis提唱のランク管理法。1セッションをBo3（2本先取、最大3戦）に区切り、0-2になったらティルト連敗防止のため即座に終了する。2-0でも慢心を防ぎ休憩を挟むことでプレイの質を最大化する。',
    'Coach Curtis提唱のBo3（2本先取）セッション法まとめ。無目的に回すのではなく、1日最大2ブロック（計6戦以内）に制限。0-2で即終了することで連敗によるLP喪失を防ぎ、集中力を維持して勝率を急上昇させる。',
    true,
    'E',
    now(),
    now()
),
(
    'E19',
    '統計サイト「LoLalytics」でデータの間違った見方を正しく解説',
    'LoL忍者 🥷 @LOLNinjaBlog',
    'https://lolninja.net/2024/02/09/44075/',
    'LoL上達・戦術',
    'LoLalyticsの「平均勝率インフレ現象（Average Win Rateが52.5%等になる仕様）」とサバイバーバイアス（完成コア勝率の歪み）を正しく読み解くための解説記事。E3と対になる統計読解の正本。',
    'LoLalyticsの正しい見方まとめ。エメラルド＋では上位層が下位層に勝ち越すため平均勝率が50%ではなく52%以上にインフレする。そのため画面右上のAverage Win Rateを基準に引き算して評価する必要がある。また完成アイテム勝率は勝っている時ほど完成しやすいサバイバーバイアスがかかるため相対勝率差で見るべきである。',
    true,
    'E',
    now(),
    now()
)
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
