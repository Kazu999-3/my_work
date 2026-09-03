import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { myChampion, enemyChampion, keyLearning, bottleneck } = body;

    // Supabaseへの対面ナレッジ自動保存シミュレーション/書き込み
    return NextResponse.json({
      success: true,
      message: `⚔️ ${myChampion || 'Aatrox'} vs ${enemyChampion || 'Darius'} の教訓をチャンピオン辞典・対面メモへ自動同期しました！次回プレイ前の攻略手順書に反映されます。`,
      syncedData: {
        myChampion: myChampion || 'Aatrox',
        enemyChampion: enemyChampion || 'Darius',
        keyLearning: keyLearning || 'Lv3で敵のE空振りに合わせたショートトレードが極めて有効だった',
        bottleneck: bottleneck || '視界スコア',
        syncedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
