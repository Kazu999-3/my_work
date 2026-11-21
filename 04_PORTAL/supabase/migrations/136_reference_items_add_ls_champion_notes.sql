-- Migration: 136_reference_items_add_ls_champion_notes.sql
-- Description: LS氏による全175ページ超特大資料『LS's Champion Notes』（E20）の新規追加

INSERT INTO public.reference_items (
    code, title, author, url, category, summary, content, has_fulltext, source_group, created_at, updated_at
)
VALUES 
(
    'E20',
    'LS''s Champion Notes（全175ページ・全ロール主要チャンピオン完全攻略バイブル）',
    'LS (Nick De Cesare) @LSXYZ9',
    'https://drive.google.com/file/d/1ZrgpoDGe9igedde98L4mc8GTKp_KVgad/view?usp=sharing',
    'LoL上達・戦術',
    '元C9ヘッドコーチ・名物アナリストのLS氏が作成した全175ページに及ぶチャンピオンノート集。全主要チャンピオンの扉絵、マッチアップ、推奨ビルド、ルーン、スキルオーダー、パワースパイク、数理的メタ理解を網羅。',
    '元Cloud9ヘッドコーチ・世界最高峰のアナリストLS（Nick De Cesare）氏による全175ページの超大作チャンピオンノート集（Champion notes.pdf）。
Aatroxから始まり、アルファベット順に全ロール・全主要チャンピオンの扉絵・マッチアップ・推奨ビルド・ルーン・スキルオーダー・パワースパイク・アイテム効率計算を完全網羅。
数理的アプローチによる過小評価アイテム・チャンピオンの掘り起こしや、競技シーン・高レートソロランクでの最適化メタ構築の正本資料。',
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
