import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { normalizeChampionName } from '../../../../lib/championNames';
import { recordRevision } from '../../../../lib/knowledgeRevisions';

/**
 * 試合後ディープ解析で得た教訓を、対面ナレッジ(matchup_sentinel)へ追記する。
 *
 * ★ 2026-09-22: このAPIは以前、Supabaseのimportすら無く**DB書き込みを一切行わない
 * 全23行のスタブ**だったにもかかわらず、「チャンピオン辞典・対面メモへ自動同期しました！
 * 次回プレイ前の攻略手順書に反映されます」という成功メッセージを返していた。
 * ユーザーは試合の教訓が永久保存されたと信じるが、実際には1件も保存されていない
 * (サイレントなデータ消失)。さらに引数が空の場合は 'Aatrox' 'Darius'
 * 「Lv3で敵のE空振りに合わせた…」という架空の教訓をでっち上げて返していた。
 * TODO.md上ではこの経路を含む「ナレッジ自動更新ループ」が完了扱いになっていた。
 *
 * 保存方式は soloq/reflections の対面メモ同期と同一の規則に揃えている
 * (matchup_id の命名、既存行への追記、変更履歴の記録)。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { myChampion, enemyChampion, keyLearning, bottleneck } = body;

    // ★ 架空データで補完しない。必須項目が無ければ正直に失敗を返す。
    if (!myChampion || !enemyChampion || !keyLearning) {
      return NextResponse.json(
        {
          success: false,
          error: '同期に必要な情報（自分/対面チャンピオン・教訓）が不足しているため保存できませんでした。',
        },
        { status: 400 }
      );
    }

    const normalizedChampion = normalizeChampionName(myChampion);
    const normalizedEnemy = normalizeChampionName(enemyChampion);
    const matchupId = `${normalizedChampion}_vs_${normalizedEnemy}`;

    const memoBody = bottleneck ? `${keyLearning}（ボトルネック: ${bottleneck}）` : String(keyLearning);
    const memoToAppend = `\n\n【試合後ディープ解析の教訓 (${new Date().toLocaleDateString('ja-JP')})】\n${memoBody}`;

    const { data: existing } = await supabaseAdmin
      .from('matchup_sentinel')
      .select('strategy')
      .eq('matchup_id', matchupId)
      .maybeSingle();

    if (existing) {
      const updatedStrategy = (existing.strategy || '') + memoToAppend;
      const { error } = await supabaseAdmin
        .from('matchup_sentinel')
        .update({ strategy: updatedStrategy })
        .eq('matchup_id', matchupId);
      if (error) throw error;

      await recordRevision({
        targetType: 'matchup_sentinel',
        targetKey: matchupId,
        field: 'strategy',
        before: existing.strategy || '',
        after: updatedStrategy,
        sourceTitle: `試合後ディープ解析の教訓 (${normalizedChampion} vs ${normalizedEnemy})`,
      }).catch(() => {});
    } else {
      const { error } = await supabaseAdmin.from('matchup_sentinel').insert({
        matchup_id: matchupId,
        champion: normalizedChampion,
        enemy: normalizedEnemy,
        title: `${normalizedChampion} vs ${normalizedEnemy} 対策`,
        strategy: memoBody,
        raw_data: { source: 'postgame_deep_analytics', created_at: new Date().toISOString() },
      });
      if (error) throw error;

      await recordRevision({
        targetType: 'matchup_sentinel',
        targetKey: matchupId,
        field: 'strategy',
        before: '',
        after: memoBody,
        sourceTitle: `試合後ディープ解析の教訓 (${normalizedChampion} vs ${normalizedEnemy})`,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      message: `⚔️ ${normalizedChampion} vs ${normalizedEnemy} の教訓を対面メモ（matchup_sentinel）へ保存しました。次回この対面を開いた際に表示されます。`,
      syncedData: {
        matchupId,
        myChampion: normalizedChampion,
        enemyChampion: normalizedEnemy,
        keyLearning: memoBody,
        syncedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[sync-match-feedback] 保存に失敗:', error);
    return NextResponse.json(
      { success: false, error: `対面メモへの保存に失敗しました: ${error.message}` },
      { status: 500 }
    );
  }
}
