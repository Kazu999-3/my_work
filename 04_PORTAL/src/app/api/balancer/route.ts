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
      return NextResponse.json({ error: '蜿ょ刈閠・・譛菴・0莠ｺ蠢・ｦ√〒縺吶・ }, { status: 400 });
    }

    // participants: { name: string, isFixed?: boolean, fixedRole?: Role }[]

    // 1. ktm_players 縺九ｉ隧ｲ蠖薙・繝ｬ繧､繝､繝ｼ縺ｮ諠・ｱ繧貞叙蠕・    const names = participants.map(p => p.name);
    const { data: playersData, error: pError } = await supabase
      .from('ktm_players')
      .select('*')
      .in('name', names);

    if (pError || !playersData) {
      return NextResponse.json({ error: '繝励Ξ繧､繝､繝ｼ諠・ｱ縺ｮ蜿門ｾ励↓螟ｱ謨励＠縺ｾ縺励◆縲・ }, { status: 500 });
    }

    // 2. Player 繧､繝ｳ繧ｿ繝輔ぉ繝ｼ繧ｹ縺ｸ繝槭ャ繝斐Φ繧ｰ
    const allPlayers: Player[] = participants.map(input => {
      const dbPlayer = playersData.find(p => p.name === input.name);
      if (!dbPlayer) throw new Error(`繝励Ξ繧､繝､繝ｼ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ: ${input.name}`);
      
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
        rank: 'UNRANKED', // 蠢・ｦ√↓蠢懊§縺ｦ繝槭ャ繝斐Φ繧ｰ
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
        games: 0, // 莉ｮ (蠕後〒髮・ｨ医∪縺溘・DB縺九ｉ蜿門ｾ・
        winRate: 50.0, // 莉ｮ
        isFixed: input.isFixed,
        fixedRole: input.fixedRole
      };
    });

    // 3. Pity驕ｸ謚・    const { selected, spectators } = selectPlayersWithPity(allPlayers);

    if (selected.length !== 10) {
      return NextResponse.json({ error: '驕ｸ謚懊＆繧後◆繝励Ξ繧､繝､繝ｼ縺・0莠ｺ縺ｫ縺ｪ繧翫∪縺帙ｓ縺ｧ縺励◆縲・ }, { status: 500 });
    }

    // 4. 繧ｳ繝ｳ繝・く繧ｹ繝医ョ繝ｼ繧ｿ(螻･豁ｴ)縺ｮ讒狗ｯ・    // 莉雁屓縺ｯ繝槭う繧ｰ繝ｬ繝ｼ繧ｷ繝ｧ繝ｳ逶ｴ蠕後〒DB縺ｫ螻･豁ｴ縺後↑縺・◆繧∫ｩｺ縺ｧ蛻晄悄蛹・    // 窶ｻ螳滄°逕ｨ縺ｧ縺ｯ ktm_match_participants 繧呈､懃ｴ｢縺励※讒狗ｯ峨☆繧・    const ctx: BalanceContext = {
      history: new Set<string>(),
      teammateHistory: new Map<string, number>(),
      winStreakTeam: null,
      sideHistory: {}
    };

    // 5. 繝舌Λ繝ｳ繧ｹ螳溯｡・    const result = coreBalanceTeams(selected, ctx);
    
    // 繧ｹ繝斐Ν縺励◆・磯∈縺ｰ繧後↑縺九▲縺滂ｼ峨・繝ｬ繧､繝､繝ｼ蜷阪ｒ隕ｳ謌ｦ閠・→縺励※霑ｽ蜉
    result.spectators = spectators.map(p => p.name);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Balancer API Error:', error);
    return NextResponse.json({ error: error.message || '蜀・Κ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆縲・ }, { status: 500 });
  }
}
