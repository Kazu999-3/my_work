import { NextResponse } from 'next/server';
import { calculateNemesisClash, TeamMember, LaneClash, FeaturedClash, GoldenDuo } from '../../../../lib/nemesisClash';

export type { LaneClash, FeaturedClash, GoldenDuo };

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const teamBlue: TeamMember[] = Array.isArray(body?.teamBlue) ? body.teamBlue : [];
    const teamRed: TeamMember[] = Array.isArray(body?.teamRed) ? body.teamRed : [];

    const result = await calculateNemesisClash(teamBlue, teamRed);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('[balancer/clash] Error:', error);
    return NextResponse.json({ error: error.message || '因縁データの取得に失敗しました。' }, { status: 500 });
  }
}
