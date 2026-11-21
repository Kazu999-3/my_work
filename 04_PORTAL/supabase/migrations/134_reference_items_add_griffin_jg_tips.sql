-- Migration: 134_reference_items_add_griffin_jg_tips.sql
-- Description: Griffin氏による今シーズンJG必須マクロ（D114）の新規追加

INSERT INTO public.reference_items (
    code, title, author, url, category, summary, content, has_fulltext, source_group, created_at, updated_at
)
VALUES 
(
    'D114',
    '今シーズンの全ジャングラーへ贈る鉄則（Griffin提唱：ラプター処刑・5:30スマイト・初手ドラ）',
    'Griffin @GriffinHQ_',
    'https://x.com/GriffinHQ_/status/2028991766662398097',
    'LoL上達・戦術',
    'ラプタースタート処刑（3:20待ち伏せ）、5:30スマイト強化タイマー合わせ、Lv1スカトル軽視と初手ドラ優先、敵3キャンプ即ガンクへのフルクリア対抗など今シーズンJGの勝率直結マクロ。',
    '今シーズンのジャングル必須鉄則まとめ。
1. ラプタースタートは悪手。敵がラプタースタートした場合は蟹に行かず即リコールして装備を買い、3:20-3:25の敵ラプター再湧きに敵陣で待ち伏せキルすればGG。
2. 5:30スマイト強化タイマー：2フルクリア+1蟹で餌21個。毎分:30（5:30）にボーナス餌がもらえるため、2周目の最後のキャンプを5:30まで待って狩ると、ちょうど2回目スカトル戦の瞬間に強化スマイトが完成してスカトルを確定奪取できる。
3. Lv1スカトルは最弱キャンプ。敵がカニに長居したら敵キャンプ荒らしを優先。ただし2周目以降のスカトルはスケールするため最重要。
4. クリスタルタワー仕様によりグラブより初手ドラゴンが優先。2周目フルクリア直後に湧くため主導権があれば即狩りして20分ソウル圧をかける。
5. 敵の3キャンプ即ガンクには釣られてインベードせず自陣フルクリアを完了させてレベル差・テンポ差をつけ、後から湧いた敵キャンプを奪う。',
    true,
    'D',
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
