import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});


async function main() {
  console.log('Inserting test pupil mentorship profiles into production DB...');

  const testProfiles = [
    {
      discord_id: 'test_pupil_poromaru',
      player_name: 'ぽろ丸🔰 (テスト弟子)',
      role_type: 'PUPIL',
      lanes: ['MID', 'BOT'],
      champions: ['Ahri', 'Jinx', 'Lux', 'Ezreal'],
      current_rank: 'SILVER',
      target_rank: 'GOLD',
      tags: ['VC可能', 'キャリー立ち位置・カイト', 'ウェーブ管理・フリーズ', '画面共有ライブ指導', 'エンゲージ・仕掛けの判断'],
      bio: '今シーズン中にゴールド昇格を目指して練習中です！レーン戦のウェーブ管理と、集団戦で生き残って火力を出す立ち位置・カイトをご指導いただきたいです。VC通話可能です。よろしくお願いします！',
      active_hours: '平日 21:00〜24:00 / 休日 昼〜夜',
      status: 'OPEN',
    },
    {
      discord_id: 'test_pupil_rookie_top',
      player_name: 'ルーキー@TOP特訓中 (テスト弟子)',
      role_type: 'PUPIL',
      lanes: ['TOP'],
      champions: ['Garen', 'Darius', 'Mordekaiser', 'Malphite'],
      current_rank: 'BRONZE',
      target_rank: 'SILVER',
      tags: ['聞き専OK', 'トレード・キルライン見極め', 'サイドプッシュ・スプリット', '録画・リプレイ添削', '1on1マッチアップ特訓'],
      bio: 'TOPレーンで対面に負けない安全なトレードのコツや、サイドプッシュの引き際を基礎から学びたいです！聞き専での参加も可能です。優しく教えてくださる師匠を募集中です！',
      active_hours: '土日・祝日 メイン',
      status: 'OPEN',
    },
  ];

  for (const p of testProfiles) {
    // 既存の同一 discord_id があれば更新、なければ挿入
    const { data: existing } = await supabase
      .from('mentorship_profiles')
      .select('id')
      .eq('discord_id', p.discord_id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('mentorship_profiles')
        .update({ ...p, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) console.error(`Failed to update ${p.player_name}:`, error);
      else console.log(`✓ Updated: ${p.player_name}`);
    } else {
      const { error } = await supabase
        .from('mentorship_profiles')
        .insert(p);
      if (error) console.error(`Failed to insert ${p.player_name}:`, error);
      else console.log(`✓ Created: ${p.player_name}`);
    }
  }

  console.log('Seeding finished successfully!');
}

main().catch(console.error);
