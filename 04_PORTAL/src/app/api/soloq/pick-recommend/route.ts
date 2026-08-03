import { NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../lib/adminAuth';

interface ChampionRecommend {
  champion: string;
  role: string;
  reason: string;
  synergyScore: number;
  counterScore: number;
}

export async function POST(request: Request) {
  try {
    const authResult = await verifyAdminSession(request);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { myTeam = [], enemyTeam = [], role = 'MID' } = body;

    // 簡易的なデータ駆動推薦ロジック（後ほどGemini AIまたは統計データと連動可能）
    const samplePool: Record<string, ChampionRecommend[]> = {
      TOP: [
        { champion: 'Aatrox', role: 'TOP', reason: '強力なサステインと集団戦エンゲージ。敵構成のメイジ・AD双方に対応可能。', synergyScore: 85, counterScore: 90 },
        { champion: 'Darius', role: 'TOP', reason: '近接対面に対する圧倒的ライン戦主導権。レーンソロキルからスノーボール可能。', synergyScore: 80, counterScore: 95 },
        { champion: 'Ornn', role: 'TOP', reason: '集団戦での確定ハードCCと味方装備強化。チームのタンクロールを完全カバー。', synergyScore: 95, counterScore: 85 },
      ],
      JUNGLE: [
        { champion: 'Graves', role: 'JUNGLE', reason: '高速ジャングルクリアと高いキャリー能力。序盤のインベードで敵JGのテンポを破壊。', synergyScore: 90, counterScore: 88 },
        { champion: 'Lee Sin', role: 'JUNGLE', reason: '序盤の圧倒的ガンク圧力とソロQ特有のカオスな展開での機動力。', synergyScore: 85, counterScore: 92 },
        { champion: 'Sejuani', role: 'JUNGLE', reason: '近接味方との相性抜群。豊富なCCで確定ガンクとオブジェクト主導権を獲得。', synergyScore: 95, counterScore: 80 },
      ],
      MID: [
        { champion: 'Ahri', role: 'MID', reason: '高機動ロームとPickオフ性能。サイドレーン支援と安全なウェーブクリアを両立。', synergyScore: 90, counterScore: 90 },
        { champion: 'Sylas', role: 'MID', reason: '敵チームのウルトを奪って戦況を覆すカウンターアサシン。集団戦で大爆発。', synergyScore: 85, counterScore: 95 },
        { champion: 'Orianna', role: 'MID', reason: '安定したレーンフェーズと集団戦での決定的なショックウェーブ。', synergyScore: 92, counterScore: 85 },
      ],
      ADC: [
        { champion: 'KaiSa', role: 'ADC', reason: 'ダイブ構成・カイティング双方に対応可能な万能キャリー。後半の火力が圧倒的。', synergyScore: 92, counterScore: 88 },
        { champion: 'Jinx', role: 'ADC', reason: 'パッシブ発動時の集団戦スノーボール。フロントラインが硬いチームで真価を発揮。', synergyScore: 90, counterScore: 85 },
        { champion: 'Ezreal', role: 'ADC', reason: '高い安全性能とポーク力。サポーターの自由なロームを可能にする。', synergyScore: 85, counterScore: 90 },
      ],
      SUPPORT: [
        { champion: 'Nautilus', role: 'SUPPORT', reason: '確定ターゲットQ/Rによる確実なエンゲージ。レーン戦でのオールインで圧勝。', synergyScore: 95, counterScore: 92 },
        { champion: 'Thresh', role: 'SUPPORT', reason: 'ランタンによる味方の救出と強力なローム性能。ソロQでの汎用性最高峰。', synergyScore: 90, counterScore: 90 },
        { champion: 'Lulu', role: 'SUPPORT', reason: 'ハイパーキャリーの守護と敵アサシンへのピール（変身術）。', synergyScore: 92, counterScore: 88 },
      ],
    };

    const recommends = samplePool[role.toUpperCase()] || samplePool.MID;

    return NextResponse.json({
      role,
      recommendations: recommends,
      analysisSummary: `【サンプル表示】入力された敵構成 (${enemyTeam.join(', ') || '未特定'}) には未連動の固定サンプルです。`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Pick recommendation failed' }, { status: 500 });
  }
}
