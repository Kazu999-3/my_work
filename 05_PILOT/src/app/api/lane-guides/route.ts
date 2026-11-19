import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

const BASE_LANES = [
  { key: 'COMMON', label: '🌐 全レーン共通マクロバイブル', roleKey: 'COMMON' },
  { key: 'TOP', label: '⚔️ TOP レーン攻略バイブル', roleKey: 'TOP' },
  { key: 'JG', label: '🌲 JG ジャングル攻略バイブル', roleKey: 'JG' },
  { key: 'MID', label: '⚡ MID レーン攻略バイブル', roleKey: 'MID' },
  { key: 'ADC', label: '🏹 BOT (ADC) レーン攻略バイブル', roleKey: 'BOT' },
  { key: 'SUP', label: '🛡️ SUP サポート攻略バイブル', roleKey: 'SUP' },
];

export async function GET() {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    }

    // 正本 champions_summary.json からロール別チャンピオン数を集計（正本基準に統一）
    const summaryPath = path.resolve(process.cwd(), 'src/data/champions_summary.json');
    let summaryChampions: any[] = [];
    if (fs.existsSync(summaryPath)) {
      try {
        summaryChampions = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      } catch (_) {}
    }
    const totalCanonicalChampions = summaryChampions.length || 173;

    const roleCounts: Record<string, number> = { TOP: 0, JG: 0, MID: 0, BOT: 0, SUP: 0 };
    for (const c of summaryChampions) {
      const roles: string[] = Array.isArray(c.roles) ? c.roles : [];
      for (const r of roles) {
        if (r === 'TOP') roleCounts.TOP++;
        else if (r === 'JG' || r === 'JUNGLE') roleCounts.JG++;
        else if (r === 'MID' || r === 'MIDDLE') roleCounts.MID++;
        else if (r === 'BOT' || r === 'BOTTOM' || r === 'ADC') roleCounts.BOT++;
        else if (r === 'SUP' || r === 'UTILITY' || r === 'SUPPORT') roleCounts.SUP++;
      }
    }

    const { data, error } = await supabase
      .from('lane_guides')
      .select('lane, title, body, source_count, updated_at');

    if (error) throw error;

    const lanes = BASE_LANES.map((l) => ({
      key: l.key,
      label: l.label,
      targetChampionsCount: l.roleKey === 'COMMON' ? totalCanonicalChampions : (roleCounts[l.roleKey] || 0),
    }));

    return NextResponse.json({
      success: true,
      totalCanonicalChampions,
      guides: data || [],
      lanes,
    });
  } catch (e: any) {
    console.error('lane_guides APIエラー:', e);
    return NextResponse.json({ error: e.message || '内部エラー' }, { status: 500 });
  }
}
