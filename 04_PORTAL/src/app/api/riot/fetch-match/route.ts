import { NextResponse } from 'next/server';
import { fetchPuuidByRiotId, fetchRecentCustomMatchId, fetchMatchDetails } from '../../../../lib/riot';

export async function POST(request: Request) {
  try {
    const { ign } = await request.json(); // e.g. "Name#TAG"

    if (!ign || !ign.includes('#')) {
      return NextResponse.json({ error: '豁｣縺励＞Riot IGN (Name#TAG) 繧呈欠螳壹＠縺ｦ縺上□縺輔＞縲・ }, { status: 400 });
    }

    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: '繧ｵ繝ｼ繝舌・縺ｫRIOT_API_KEY縺瑚ｨｭ螳壹＆繧後※縺・∪縺帙ｓ縲・ }, { status: 500 });
    }

    const [gameName, tagLine] = ign.split('#');

    // 1. PUUID 蜿門ｾ・    const puuid = await fetchPuuidByRiotId(gameName, tagLine, apiKey);

    // 2. 譛霑代・繧ｫ繧ｹ繧ｿ繝繧ｲ繝ｼ繝ID蜿門ｾ・    const matchId = await fetchRecentCustomMatchId(puuid, apiKey);

    // 3. 隧ｦ蜷郁ｩｳ邏ｰ蜿門ｾ・    const matchDetails = await fetchMatchDetails(matchId, apiKey);

    return NextResponse.json(matchDetails);
  } catch (error: any) {
    console.error('Riot API Fetch Error:', error);
    return NextResponse.json({ error: error.message || 'Riot API縺九ｉ縺ｮ蜿門ｾ励↓螟ｱ謨励＠縺ｾ縺励◆縲・ }, { status: 500 });
  }
}
