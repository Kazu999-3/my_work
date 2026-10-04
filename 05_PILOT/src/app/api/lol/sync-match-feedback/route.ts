import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { resolveRosterChampion } from '@/lib/championRoster';

export const dynamic = 'force-dynamic';

// 試合後ディープ分析の教訓を対面メモ(matchup_sentinel の <自分>_vs_<対面>)へ追記する。
// 旧ポータル /api/lol/sync-match-feedback の移植（2026-10-04）。旧版の経緯:
// 2026-09-22 まではDBに一切書かずに成功メッセージだけ返すスタブで、引数が空だと架空の教訓を返していた。
// 架空データで補完せず、必須項目が無ければ失敗を返す。

async function recordRevision(key: string, before: string, after: string, sourceTitle: string) {
  if (!supabase || before === after) return;
  try {
    await supabase.from('knowledge_revisions').insert({
      target_type: 'matchup_sentinel', target_key: key, field: 'strategy',
      before_text: before, after_text: after, source_title: sourceTitle, source_id: null,
    });
  } catch (e) {
    console.warn('[sync-match-feedback] 履歴の保存に失敗:', e);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!supabase) return NextResponse.json({ success: false, error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    const { myChampion, enemyChampion, keyLearning, bottleneck } = await request.json().catch(() => ({}));
    if (!myChampion || !enemyChampion || !keyLearning) {
      return NextResponse.json(
        { success: false, error: '同期に必要な情報（自分/対面チャンピオン・教訓）が不足しているため保存できませんでした。' },
        { status: 400 },
      );
    }

    // 実在しないチャンピオン名で行を作らない（matchup_sentinel にゴミ行が溜まった前例がある）
    const champion = await resolveRosterChampion(myChampion);
    const enemy = await resolveRosterChampion(enemyChampion);
    if (!champion || !enemy) {
      return NextResponse.json({ success: false, error: `チャンピオン名を解決できませんでした（${myChampion} / ${enemyChampion}）。` }, { status: 400 });
    }

    const matchupId = `${champion}_vs_${enemy}`;
    const memoBody = bottleneck ? `${keyLearning}（ボトルネック: ${bottleneck}）` : String(keyLearning);
    const dateStr = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const sourceTitle = `試合後ディープ解析の教訓 (${champion} vs ${enemy})`;

    const { data: existing, error: selErr } = await supabase
      .from('matchup_sentinel').select('strategy').eq('matchup_id', matchupId).maybeSingle();
    if (selErr) throw selErr;

    if (existing) {
      const before = existing.strategy || '';
      const after = `${before}\n\n【試合後ディープ解析の教訓 (${dateStr})】\n${memoBody}`;
      const { error } = await supabase.from('matchup_sentinel').update({ strategy: after }).eq('matchup_id', matchupId);
      if (error) throw error;
      await recordRevision(matchupId, before, after, sourceTitle);
    } else {
      const { error } = await supabase.from('matchup_sentinel').insert({
        matchup_id: matchupId,
        champion,
        enemy,
        title: `${champion} vs ${enemy} 対策`,
        strategy: memoBody,
        raw_data: { source: 'postgame_deep_analytics', created_at: new Date().toISOString() },
      });
      if (error) throw error;
      await recordRevision(matchupId, '', memoBody, sourceTitle);
    }

    return NextResponse.json({
      success: true,
      message: `⚔️ ${champion} vs ${enemy} の教訓を対面メモへ保存しました。次回この対面を開いた時に表示されます。`,
      syncedData: { matchupId, myChampion: champion, enemyChampion: enemy, keyLearning: memoBody, syncedAt: new Date().toISOString() },
    });
  } catch (e: any) {
    console.error('[sync-match-feedback] 保存に失敗:', e);
    return NextResponse.json({ success: false, error: `対面メモへの保存に失敗しました: ${e.message}` }, { status: 500 });
  }
}
