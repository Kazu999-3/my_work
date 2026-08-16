import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { recordMatchupSentinelRevision } from '../../../../../lib/matchupSentinelRevisions';
import { resolveToRosterChampion } from '../../../../../lib/dictFactCheck';
import { detectLane, classifyLaneGeneralContent, mergeContentIntoLane } from '../../../../../lib/laneGuideMerge';

// ============================================================
// 攻略ライブラリ(personal_knowledge)の1記事を、選択されたチャンピオンの
// 辞典(matchup_sentinel)へ統合する（LibraryTabContent.tsxの「保存する」から呼ばれる）。
//
// 従来はブラウザ(anon)からmatchup_sentinelへ直接select/upsertし、
// personal_knowledgeも直接updateしていたが、書き込み系はservice role経由に統一する
// (Supabase直接アクセスのAPI経由化)。ロジック自体は既存のクライアント側実装をそのまま移設。
// ============================================================
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // champion-facts/mergeのAI呼び出しを含むため延長

function mergeContent(existingText: string, newText: string, title: string): string {
  const ext = existingText || "";
  if (!ext.trim()) return newText;
  if (newText.trim() === ext.trim()) return ext;
  const header = `## 【記事】${title}`;
  if (ext.includes(header)) {
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`## 【記事】${escapeRegExp(title)}\\s*\\n[\\s\\S]*?(?=\\n---|$)`);
    const newContent = ext.replace(pattern, `${header}\n\n${newText}`);
    if (newContent !== ext) return newContent;
  }
  if (ext.includes(newText)) return ext;
  return `${ext}\n\n---\n\n${header}\n\n${newText}`;
}

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { articleId, title, content, editChampions, dryRun, sendLaneGeneralToLane, laneGeneralExcerpt } = await req.json();
    if (!articleId || !title || typeof content !== 'string') {
      return NextResponse.json({ error: 'articleId, title, content が必要です' }, { status: 400 });
    }
    const rawList: string[] = Array.isArray(editChampions) ? editChampions : [];

    // 「実在チャンピオンかどうか」だけを判定基準にする(resolveToRosterChampion)。
    // 手作りの除外リスト(FAKE_CHAMPIONS)は他の書き込み経路と食い違いやすく、
    // 正規化もnormalizeChampionNameだけでは表記ゆれが正規IDまで揃わなかったため統一する。
    const resolvedList = await Promise.all(rawList.map((c) => resolveToRosterChampion((c || '').trim())));
    const validChampions = Array.from(new Set(resolvedList.filter((c): c is string => !!c)));

    if (validChampions.length === 0) {
      return NextResponse.json({ success: true, merged: false, champions: [] });
    }

    // dryRun: 実際の書き込みは一切行わず、チャンピオンごとに「どのフィールドへ」
    // 「マージ後どうなるか」だけを計算して返す。LibraryTabContent.tsxの「保存する」で、
    // 辞典へ即マージされる前に内容を確認できるプレビュー画面のために追加した
    // (2026-08-16、「攻略ライブラリから保存した時にチャンピオン辞典割り振りする際の
    // プレビューが出ない」への対応。従来この経路にはプレビュー自体が存在しなかった)。
    if (dryRun) {
      const previews = await Promise.all(validChampions.map(async (championName) => {
        const matchupId = `champ_${championName}_global`;
        const { data: existingData } = await supabase
          .from('matchup_sentinel')
          .select('raw_data')
          .eq('matchup_id', matchupId)
          .maybeSingle();

        const rawData = existingData?.raw_data || {};
        const customFields = rawData.customFields || {};
        const isNoteDraft = title.includes("HONKI_BIBLE") || title.includes("ARTICLE");
        const fieldName = isNoteDraft ? 'note_draft' : title.replace(`${championName}_`, "").replace(`_${championName}`, "");
        const existingContent = isNoteDraft ? (rawData.note_draft || '') : (customFields[fieldName] || '');
        const mergedContentText = mergeContent(existingContent, content, title);

        return {
          champion: championName,
          fieldName,
          isNewField: !existingContent.trim(),
          existingExcerpt: existingContent.slice(0, 500),
          mergedExcerpt: mergedContentText.slice(0, 1500),
        };
      }));

      // 記事本文の中に「特定チャンピオンに限らないレーン一般論」が混じっていないか
      // AIで検出する。検出できても辞典統合自体は止めず、失敗時は無視して続行する
      // (2026-08-16、「レーン全体の攻略情報は優先的に確保したい」という要望への対応)。
      let laneGeneralInsights: { title: string; summary: string }[] = [];
      let detectedLaneKey = 'COMMON';
      try {
        detectedLaneKey = detectLane({ champion: validChampions.join(', '), title, content });
        laneGeneralInsights = await classifyLaneGeneralContent(title, content, validChampions.join(', '));
      } catch (laneDetectErr) {
        console.warn('[merge-article] レーン一般論の判定に失敗(無視して続行):', laneDetectErr);
      }

      return NextResponse.json({
        success: true,
        dryRun: true,
        champions: validChampions,
        previews,
        laneGeneralInsights,
        detectedLane: detectedLaneKey,
      });
    }

    let mergedNote = '';

    for (const championName of validChampions) {
      const matchupId = `champ_${championName}_global`;
      const { data: existingData } = await supabase
        .from('matchup_sentinel')
        .select('*')
        .eq('matchup_id', matchupId)
        .maybeSingle();

      let rawData = existingData?.raw_data || {};
      let customFields = rawData.customFields || {};

      if (title.includes("HONKI_BIBLE") || title.includes("ARTICLE")) {
        rawData.note_draft = mergeContent(rawData.note_draft || "", content, title);
      } else {
        const fieldName = title.replace(`${championName}_`, "").replace(`_${championName}`, "");
        customFields[fieldName] = mergeContent(customFields[fieldName] || "", content, title);
      }
      rawData.customFields = customFields;
      rawData.source = "champ_db";
      rawData.role = "GLOBAL";

      // 辞典一覧の「更新日」は created_at を見ているため、更新時も明示的に現在時刻を入れる
      const dictData = {
        matchup_id: matchupId,
        champion: championName,
        enemy: "GLOBAL",
        title: existingData?.title || `${championName} 基本戦略・トレンド`,
        strategy: existingData?.strategy || "",
        raw_data: rawData,
        created_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabase
        .from('matchup_sentinel')
        .upsert(dictData, { onConflict: 'matchup_id' });
      if (upsertError) throw upsertError;

      await recordMatchupSentinelRevision(
        matchupId,
        existingData ?? null,
        { title: dictData.title, strategy: dictData.strategy, raw_data: dictData.raw_data },
        title,
        articleId,
      );
    }

    // 段階2 dual-write: 構造化テーブル champion_notes にも同じ記事を1行追加する（#29）。
    // 失敗しても本筋(辞典統合)は止めない。
    try {
      const origin = new URL(req.url).origin;
      await fetch(`${origin}/api/admin/champion-notes/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') || '' },
        body: JSON.stringify({
          champions: validChampions,
          title,
          body: content,
          source: 'article',
          source_article_id: articleId,
        }),
      });
    } catch (dualErr) {
      console.warn('[merge-article] champion_notesへのdual-write失敗（辞典統合自体は成功）:', dualErr);
    }

    // 構造化項目（強み/弱み/パワースパイク/ビルド）も記事の内容でマージ更新する。
    // 上書きではなく「既存に無い知見だけ追記」なので、手書きの内容は消えない。
    try {
      const origin = new URL(req.url).origin;
      const mergeRes = await fetch(`${origin}/api/admin/champion-facts/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') || '' },
        body: JSON.stringify({ champions: validChampions, title, body: content, articleId }),
      });
      const mergeData = await mergeRes.json();
      if (mergeRes.ok) {
        const added = (mergeData.results || []).flatMap((r: any) => r.added || []);
        if (added.length > 0) mergedNote = `／辞典項目に${added.length}件を追記`;
      }
    } catch (mergeErr) {
      console.warn('[merge-article] champion_factsのマージ更新に失敗（辞典統合自体は成功）:', mergeErr);
    }

    // プレビューで確認された「レーン一般論」の抜粋を、選択されたレーンガイドにも統合する。
    // チャンピオン辞典への統合は上のループで既に完了しているため、失敗しても本筋は止めない。
    if (sendLaneGeneralToLane && typeof laneGeneralExcerpt === 'string' && laneGeneralExcerpt.trim()) {
      try {
        await mergeContentIntoLane(sendLaneGeneralToLane, title, laneGeneralExcerpt, articleId);
        mergedNote += (mergedNote ? '／' : '') + 'レーンガイドにも統合';
      } catch (laneErr: any) {
        console.warn('[merge-article] レーンガイドへの統合に失敗（辞典統合自体は成功）:', laneErr);
      }
    }

    // ライブラリから削除（__DELETED__ タグを付けて非表示化。物理削除ではない）
    const { error: deleteError } = await supabase
      .from('personal_knowledge')
      .update({ tags: ['__DELETED__'] })
      .eq('id', articleId);
    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true, merged: true, champions: validChampions, mergedNote });
  } catch (e: any) {
    console.error('[merge-article] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
