import { NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../lib/adminAuth';

interface LanePriority {
  lane: string;
  myChampion: string;
  enemyChampion: string;
  priorityScore: number; // 1 (完全に押し込まれる) ~ 5 (完全に押し込む)
  advantageLabel: '有利' | '微有利' | '互角' | '微不利' | '不利';
  advice: string;
}

export async function POST(request: Request) {
  try {
    const authResult = await verifyAdminSession(request);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      topMy = 'Aatrox', topEnemy = 'Darius',
      jgMy = 'Graves', jgEnemy = 'Lee Sin',
      midMy = 'Ahri', midEnemy = 'Sylas',
      adcMy = 'KaiSa', adcEnemy = 'Jinx',
      supMy = 'Nautilus', supEnemy = 'Thresh',
    } = body;

    // レーン主導権の算出サンプル
    const lanePriorities: LanePriority[] = [
      {
        lane: 'TOP',
        myChampion: topMy,
        enemyChampion: topEnemy,
        priorityScore: 2,
        advantageLabel: '微不利',
        advice: '序盤Lv2オールインに注意。ウェーブを引き込んでフリーズし、JGのガンクを待つのが安全。',
      },
      {
        lane: 'JUNGLE',
        myChampion: jgMy,
        enemyChampion: jgEnemy,
        priorityScore: 4,
        advantageLabel: '微有利',
        advice: '高速クリアでテンポを獲得。MIDの主導権を活かして8分ヴォイドグラヴを積極的に狙える。',
      },
      {
        lane: 'MID',
        myChampion: midMy,
        enemyChampion: midEnemy,
        priorityScore: 4,
        advantageLabel: '微有利',
        advice: 'レベル3以降のPush & Roamが有効。サイドレーンへの介入とリバーの視界確保を優先。',
      },
      {
        lane: 'BOT (ADC)',
        myChampion: adcMy,
        enemyChampion: adcEnemy,
        priorityScore: 3,
        advantageLabel: '互角',
        advice: 'レベル2先行を争うトレード。サポーターのエンゲージに合わせてブリンクで合わせる。',
      },
      {
        lane: 'SUPPORT',
        myChampion: supMy,
        enemyChampion: supEnemy,
        priorityScore: 3,
        advantageLabel: '互角',
        advice: 'フック系のミラー対決。相手のQCD中に強気にハラス・ポジションを取る。',
      },
    ];

    return NextResponse.json({
      lanePriorities,
      gamePrediction: {
        earlyGameFocus: 'MID/JUNGLEラインに主導権あり。8分ヴォイドグラヴ争奪戦で優勢を確保可能。',
        dragonPriority: 'BOTが互角のため、MIDロームに合わせてドラゴン前の視界を制圧するのが勝利鍵。',
        teamfightStyle: 'Nautilus + Aatrox の決定的なエンゲージから集団戦で一気に勝利を狙える構成。',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lane priority simulation failed' }, { status: 500 });
  }
}
