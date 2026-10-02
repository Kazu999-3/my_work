import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { supabase } from '@/lib/supabaseClient';

const CUSTOM_ROLES_PATH = path.resolve(process.cwd(), 'src/data/custom_roles.json');

function loadCustomRoles(): Record<string, string[]> {
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

function saveCustomRoles(data: Record<string, string[]>) {
  try {
    fs.writeFileSync(CUSTOM_ROLES_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('custom_roles.json 保存失敗:', err);
  }
}

export async function GET() {
  const fileData = loadCustomRoles();
  return NextResponse.json({ success: true, customRoles: fileData });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const current = loadCustomRoles();

    if (body.bulk && typeof body.bulk === 'object') {
      // 一括更新
      for (const [champ, roles] of Object.entries(body.bulk)) {
        if (Array.isArray(roles)) {
          current[champ] = roles;
        }
      }
    } else if (body.champion && Array.isArray(body.roles)) {
      // 単一チャンピオン更新
      current[body.champion] = body.roles;

      // Supabase champion_lane_roles へも非同期で反映（可能な場合）
      if (supabase) {
        try {
          // 既存ロールを削除して新しいロールを挿入
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
        } catch (dbErr) {
          console.warn('Supabase champion_lane_roles 更新スキップ:', dbErr);
        }
      }
    } else {
      return NextResponse.json({ error: '無効なリクエストパラメータです' }, { status: 400 });
    }

    saveCustomRoles(current);
    return NextResponse.json({ success: true, customRoles: current });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '保存に失敗しました' }, { status: 500 });
  }
}
