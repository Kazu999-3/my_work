import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { supabase } from '@/lib/supabaseClient';

const CUSTOM_ROLES_PATH = path.resolve(process.cwd(), 'src/data/custom_roles.json');

function loadLocalCustomRoles(): Record<string, string[]> {
  try {
    if (fs.existsSync(CUSTOM_ROLES_PATH)) {
      const raw = fs.readFileSync(CUSTOM_ROLES_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('custom_roles.json 読み込み失敗:', err);
  }
  return {};
}

function saveLocalCustomRoles(data: Record<string, string[]>) {
  try {
    fs.writeFileSync(CUSTOM_ROLES_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    // Vercel等の読み取り専用ファイルシステム環境ではエラーを無視
  }
}

export async function GET() {
  try {
    // 1. Supabase champion_lane_roles を最優先取得 (SSoT)
    if (supabase) {
      const { data: dbData, error } = await supabase
        .from('champion_lane_roles')
        .select('champion, role, rank')
        .order('rank', { ascending: true });

      if (!error && dbData && dbData.length > 0) {
        const customRoles: Record<string, string[]> = {};
        for (const row of dbData) {
          if (!customRoles[row.champion]) {
            customRoles[row.champion] = [];
          }
          const role = row.role === 'BOT' ? 'ADC' : row.role;
          if (!customRoles[row.champion].includes(role)) {
            customRoles[row.champion].push(role);
          }
        }
        return NextResponse.json({ success: true, customRoles });
      }
    }
  } catch (err) {
    console.warn('champion_lane_roles 取得フォールバック:', err);
  }

  // 2. DB未接続または空の場合のローカルファイルフォールバック
  const fileData = loadLocalCustomRoles();
  return NextResponse.json({ success: true, customRoles: fileData });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const current = loadLocalCustomRoles();

    if (body.bulk && typeof body.bulk === 'object') {
      // 一括更新
      const bulkData = body.bulk as Record<string, string[]>;
      for (const [champ, roles] of Object.entries(bulkData)) {
        if (Array.isArray(roles)) {
          current[champ] = roles;
        }
      }

      if (supabase) {
        for (const [champ, roles] of Object.entries(bulkData)) {
          if (!Array.isArray(roles)) continue;
          await supabase.from('champion_lane_roles').delete().eq('champion', champ);
          if (roles.length > 0) {
            const rows = roles.map((role: string, idx: number) => ({
              champion: champ,
              role: role === 'BOT' ? 'ADC' : role,
              rank: idx + 1,
              source: 'user_custom',
              updated_at: new Date().toISOString(),
            }));
            await supabase.from('champion_lane_roles').insert(rows);
          }
        }
      }
    } else if (body.champion && Array.isArray(body.roles)) {
      // 単一チャンピオン更新
      current[body.champion] = body.roles;

      if (supabase) {
        await supabase.from('champion_lane_roles').delete().eq('champion', body.champion);
        if (body.roles.length > 0) {
          const rows = body.roles.map((role: string, idx: number) => ({
            champion: body.champion,
            role: role === 'BOT' ? 'ADC' : role,
            rank: idx + 1,
            source: 'user_custom',
            updated_at: new Date().toISOString(),
          }));
          await supabase.from('champion_lane_roles').insert(rows);
        }
      }
    } else {
      return NextResponse.json({ error: '無効なリクエストパラメータです' }, { status: 400 });
    }

    saveLocalCustomRoles(current);
    return NextResponse.json({ success: true, customRoles: current });
  } catch (err: any) {
    console.error('roles POST エラー:', err);
    return NextResponse.json({ error: err.message || '保存に失敗しました' }, { status: 500 });
  }
}
