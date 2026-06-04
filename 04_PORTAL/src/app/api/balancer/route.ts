import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';
import { 
  Player, 
  Role, 
  BalanceContext, 
  selectPlayersWithPity, 
  coreBalanceTeams 
} from '../../../lib/balancer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { participants } = body;
    
    if (!participants || !Array.isArray(participants) || participants.length < 10) {
      return NextResponse.json({ error: '参加者は最低10人必要です。' }, { status: 400 });
    }

    // participants: { name: string, isFixed?: boolean, fixedRole?: Role }[]

    // 1. ktm_players から該当プレイヤーの情報を取得
    const names = participants.map(p => p.name);
    const { data: playersData, error: pError } = await supabase
      .from('ktm_players')
      .select('*')
      .in('name', names);

    if (pError || !playersData) {
      return NextResponse.json({ error: 'プレイヤー情報の取得に失敗しました。' }, { status: 500 });
    }

    // 2. Player インタフェースへマッピング
    const allPlayers: Player[] = participants.map(input => {
      const dbPlayer = playersData.find(p => p.name === input.name);
      if (!dbPlayer) throw new Error(`プレイヤーが見つかりません: ${input.name}`);
      
      const roleMap: Record<string, Role | 'ALL'> = {
        'JUNGLE': 'JG',
        'SUPPORT': 'SUP',
        'TOP': 'TOP',
        'MID': 'MID',
        'ADC': 'ADC',
        'ALL': 'ALL'
      };

      const rawPref1 = dbPlayer.role_preferences?.primary || 'ALL';
      const rawPref2 = dbPlayer.role_preferences?.secondary || 'ALL';
      const rawNg1 = dbPlayer.ng_lane_1 || '';
      const rawNg2 = dbPlayer.ng_lane_2 || '';

      return {
        name: dbPlayer.name,
        discordId: dbPlayer.discord_id,
        rank: 'UNRANKED', // 必要に応じてマッピング
        pref1: roleMap[rawPref1] || rawPref1,
        pref2: roleMap[rawPref2] || rawPref2,
        ng1: roleMap[rawNg1] || rawNg1,
        ng2: roleMap[rawNg2] || rawNg2,
        pity: dbPlayer.pity || 0,
        weight: dbPlayer.weight || 2,
        allowHigher: dbPlayer.allow_higher || false,
        rates: {
          TOP: dbPlayer.mmr_top || 1200,
          JG: dbPlayer.mmr_jg || 1200,
          MID: dbPlayer.mmr_mid || 1200,
          ADC: dbPlayer.mmr_adc || 1200,
          SUP: dbPlayer.mmr_sup || 1200
        },
        games: 0, // 仮 (後で集計またはDBから取得)
        winRate: 50.0, // 仮
        isFixed: input.isFixed,
        fixedRole: input.fixedRole
      };
    });

    // 3. Pity選抜
    const { selected, spectators } = selectPlayersWithPity(allPlayers);

    if (selected.length !== 10) {
      return NextResponse.json({ error: '選抜されたプレイヤーが10人になりませんでした。' }, { status: 500 });
    }

    // 4. コンテキストデータ(履歴)の構築
    // 今回はマイグレーション直後でDBに履歴がないため空で初期化
    // ※実運用では ktm_match_participants を検索して構築する
    const ctx: BalanceContext = {
      history: new Set<string>(),
      teammateHistory: new Map<string, number>(),
      winStreakTeam: null,
      sideHistory: {}
    };

    // 5. バランス実行
    const result = coreBalanceTeams(selected, ctx);
    
    // スピルした（選ばれなかった）プレイヤー名を観戦者として追加
    result.spectators = spectators.map(p => p.name);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Balancer API Error:', error);
    return NextResponse.json({ error: error.message || '内部エラーが発生しました。' }, { status: 500 });
  }
}
