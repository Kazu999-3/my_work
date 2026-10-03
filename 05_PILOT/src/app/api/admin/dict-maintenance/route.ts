import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(req: Request) {
  try {
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const champion = searchParams.get('champion');

    if (!champion) {
      return NextResponse.json({ success: false, error: 'championパラメータが必要です' }, { status: 400 });
    }

    // 1. champion_facts
    const { data: facts } = await supabase
      .from('champion_facts')
      .select('*')
      .ilike('champion', champion)
      .maybeSingle();

    // 2. matchup_sentinel (enemy = 'GLOBAL')
    const { data: globalSentinel } = await supabase
      .from('matchup_sentinel')
      .select('*')
      .ilike('champion', champion)
      .eq('enemy', 'GLOBAL')
      .maybeSingle();

    // 3. champion_lane_roles
    const { data: laneRoles } = await supabase
      .from('champion_lane_roles')
      .select('role, rank')
      .ilike('champion', champion)
      .order('rank', { ascending: true });

    // 4. knowledge_revisions (直近10件)
    const { data: revisions } = await supabase
      .from('knowledge_revisions')
      .select('*')
      .eq('target_key', champion)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      success: true,
      data: {
        champion,
        facts: facts || null,
        globalGuide: globalSentinel ? {
          id: globalSentinel.id,
          title: globalSentinel.title || '',
          strategy: globalSentinel.strategy || '',
          raw_data: globalSentinel.raw_data || null,
          created_at: globalSentinel.created_at,
        } : null,
        roles: (laneRoles || []).map(r => r.role === 'BOT' ? 'ADC' : r.role),
        revisions: revisions || [],
      }
    });
  } catch (err: any) {
    console.error('dict-maintenance GET エラー:', err);
    return NextResponse.json({ success: false, error: err.message || 'データ取得に失敗しました' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    }

    const body = await req.json();
    const { action, champion } = body;

    if (!champion) {
      return NextResponse.json({ success: false, error: 'championが指定されていません' }, { status: 400 });
    }

    // 1. 統合戦術マスター教本 (enemy=GLOBAL) の保存
    if (action === 'save_global') {
      const { title, strategy, source_title } = body;

      // 既存レコードを取得してリビジョンに退避
      const { data: current } = await supabase
        .from('matchup_sentinel')
        .select('*')
        .ilike('champion', champion)
        .eq('enemy', 'GLOBAL')
        .maybeSingle();

      const beforeText = current?.strategy || null;

      if (beforeText && beforeText !== strategy) {
        try {
          await supabase.from('knowledge_revisions').insert({
            target_type: 'champion_sentinel_global',
            target_key: champion,
            field: 'strategy',
            before_text: beforeText,
            after_text: strategy,
            source_title: source_title || '手動メンテ編集',
            source_id: current?.id ? String(current.id) : null,
            created_at: new Date().toISOString(),
          });
        } catch (revErr) {
          console.warn('リビジョン保存スキップ:', revErr);
        }
      }

      if (current) {
        // 更新
        const { error: updateErr } = await supabase
          .from('matchup_sentinel')
          .update({
            title: title || `${champion} 基本戦略・トレンド`,
            strategy: strategy || '',
          })
          .eq('id', current.id);

        if (updateErr) throw updateErr;
      } else {
        // 新規作成
        const { error: insertErr } = await supabase
          .from('matchup_sentinel')
          .insert({
            champion,
            enemy: 'GLOBAL',
            title: title || `${champion} 基本戦略・トレンド`,
            strategy: strategy || '',
            created_at: new Date().toISOString(),
          });

        if (insertErr) throw insertErr;
      }

      return NextResponse.json({ success: true, message: '統合マスター教本を保存しました' });
    }

    // 2. 基本情報 (champion_facts) の保存
    if (action === 'save_facts') {
      const { strengths, weaknesses, counter_champions, must_ban_champions, strategy, power_spikes } = body;

      const payload: any = {
        champion,
        strengths,
        weaknesses,
        counter_champions,
        must_ban_champions,
        strategy,
        power_spikes,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertErr } = await supabase
        .from('champion_facts')
        .upsert(payload, { onConflict: 'champion' });

      if (upsertErr) throw upsertErr;

      return NextResponse.json({ success: true, message: '基本戦術情報を保存しました' });
    }

    // 3. ロールバック（指定リビジョンへ復元）
    if (action === 'rollback') {
      const { revision_id } = body;
      const { data: rev } = await supabase
        .from('knowledge_revisions')
        .select('*')
        .eq('id', revision_id)
        .maybeSingle();

      if (!rev) {
        return NextResponse.json({ success: false, error: '指定されたリビジョンが見つかりません' }, { status: 404 });
      }

      const restoreText = rev.before_text;
      if (!restoreText) {
        return NextResponse.json({ success: false, error: '復元対象のテキストが存在しません' }, { status: 400 });
      }

      const { data: current } = await supabase
        .from('matchup_sentinel')
        .select('*')
        .ilike('champion', champion)
        .eq('enemy', 'GLOBAL')
        .maybeSingle();

      if (current) {
        await supabase
          .from('matchup_sentinel')
          .update({ strategy: restoreText })
          .eq('id', current.id);
      }

      return NextResponse.json({ success: true, message: '過去バージョンへ復元しました' });
    }

    return NextResponse.json({ success: false, error: `未対応のアクションです: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('dict-maintenance POST エラー:', err);
    return NextResponse.json({ success: false, error: err.message || '保存に失敗しました' }, { status: 500 });
  }
}
