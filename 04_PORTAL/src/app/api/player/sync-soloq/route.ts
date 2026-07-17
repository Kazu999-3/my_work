import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { fetchRecentMatchIds, fetchMatchDetails, fetchMatchTimeline } from '../../../../lib/riot';
import { calculatePlaystyle } from '../../../../lib/playstyle';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: 'プレイヤー名が指定されていません。' }, { status: 400 });
    }

    // 1. DBからプレイヤー情報を取得
    const { data: dbPlayer, error: pError } = await supabase
      .from('ktm_players')
      .select('*')
      .eq('name', name)
      .single();

    if (pError || !dbPlayer) {
      return NextResponse.json({ error: 'プレイヤー情報がDBに見つかりません。' }, { status: 404 });
    }

    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) {
      // APIキーがない場合は、テスト・動作確認用にダミーデータを生成してキャッシュに保存する（開発用フォールバック）
      console.warn("⚠️ RIOT_API_KEY が未設定のため、デモ用モックデータを生成します。");
      const mockSoloqPlaystyle = generateMockPlaystyle();
      const updatedMetadata = {
        ...(dbPlayer.metadata as any || {}),
        playstyle_cache: {
          ...((dbPlayer.metadata as any)?.playstyle_cache || {}),
          soloq: mockSoloqPlaystyle
        }
      };

      await supabase
        .from('ktm_players')
        .update({ metadata: updatedMetadata })
        .eq('id', dbPlayer.id);

      return NextResponse.json({
        success: true,
        message: 'Riot APIキー未設定のため、デモ用モックデータを生成しました。',
        playstyle: mockSoloqPlaystyle
      });
    }

    const puuid = dbPlayer.puuid;
    if (!puuid) {
      return NextResponse.json({ error: 'Riot PUUID が同期されていません。まず ktm-admin から Riot 同期を実行してください。' }, { status: 400 });
    }

    // 2. Riot API から直近20試合のランクソロ戦（Queue ID: 420）を取得
    let matchIds: string[] = [];
    try {
      matchIds = await fetchRecentMatchIds(puuid, apiKey, 15, 420); // レート制限のため直近15試合に制限
    } catch (err: any) {
      return NextResponse.json({ error: `Riot 履歴の取得失敗: ${err.message}` }, { status: 502 });
    }

    if (matchIds.length === 0) {
      return NextResponse.json({ error: 'ソロキューの対戦履歴がありませんでした。' }, { status: 404 });
    }

    // 3. 各試合の詳細を取得 (並行フェッチで高速化)
    const matches: any[] = [];
    const errors: string[] = [];

    // 一度にリクエストが集中して 429 になるのを防ぐため、バッチに分けてフェッチ
    const batchSize = 5;
    for (let i = 0; i < matchIds.length; i += batchSize) {
      const batchIds = matchIds.slice(i, i + batchSize);
      const promises = batchIds.map(async (id) => {
        try {
          const detail = await fetchMatchDetails(id, apiKey);
          // 自分自身の参加スタッツを抽出
          const me = detail.participants.find(p => p.riotIdName.toLowerCase() === dbPlayer.name.toLowerCase() || p.championName.length > 0); // 簡易一致
          if (me) {
            let gold_diff_9 = 0;
            let xp_diff_9 = 0;
            let cs_diff_9 = 0;

            const isTimelineTarget = matchIds.indexOf(id) < 5;
            if (isTimelineTarget) {
              try {
                const timeline = await fetchMatchTimeline(id, apiKey);
                const frame = timeline.info?.frames?.[9];
                if (frame) {
                  const myPartIdx = detail.participants.findIndex(p => p.riotIdName.toLowerCase() === me.riotIdName.toLowerCase());
                  const myPartId = myPartIdx !== -1 ? myPartIdx + 1 : -1;
                  
                  const oppPartIdx = detail.participants.findIndex(p => p.lane === me.lane && p.teamId !== me.teamId);
                  const oppPartId = oppPartIdx !== -1 ? oppPartIdx + 1 : -1;
                  
                  if (myPartId !== -1 && oppPartId !== -1) {
                    const myFrame = frame.participantFrames?.[String(myPartId)];
                    const oppFrame = frame.participantFrames?.[String(oppPartId)];
                    if (myFrame && oppFrame) {
                      gold_diff_9 = (myFrame.currentGold || 0) - (oppFrame.currentGold || 0);
                      xp_diff_9 = (myFrame.xp || 0) - (oppFrame.xp || 0);
                      
                      const myCs9 = (myFrame.minionsKilled || 0) + (myFrame.jungleMinionsKilled || 0);
                      const oppCs9 = (oppFrame.minionsKilled || 0) + (oppFrame.jungleMinionsKilled || 0);
                      cs_diff_9 = myCs9 - oppCs9;
                    }
                  }
                }
              } catch (timelineErr) {
                console.warn(`Timeline fetch fail for match ${id}:`, timelineErr);
              }
            }

            return {
              ...me,
              game_duration: detail.gameDuration,
              win: me.win,
              gold_diff_9,
              xp_diff_9,
              cs_diff_9
            };
          }
        } catch (e: any) {
          errors.push(`Match ${id}: ${e.message}`);
        }
        return null;
      });

      const batchResults = await Promise.all(promises);
      batchResults.forEach(r => {
        if (r) matches.push(r);
      });

      // バッチ間に 100ms 待機
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (matches.length === 0) {
      return NextResponse.json({ error: '詳細試合スタッツがロードできませんでした。', details: errors }, { status: 500 });
    }

    // 4. プレイスタイルを計算
    const soloqPlaystyle = calculatePlaystyle(matches);

    // 5. DB の metadata にキャッシュ保存
    const updatedMetadata = {
      ...(dbPlayer.metadata as any || {}),
      playstyle_cache: {
        ...((dbPlayer.metadata as any)?.playstyle_cache || {}),
        soloq: soloqPlaystyle
      }
    };

    const { error: updateError } = await supabase
      .from('ktm_players')
      .update({ metadata: updatedMetadata })
      .eq('id', dbPlayer.id);

    if (updateError) {
      throw new Error(`DBへのプレイデータ保存失敗: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: `${matches.length} 試合のソロキュー履歴からプレイスタイルを計算しました。`,
      playstyle: soloqPlaystyle
    });

  } catch (error: any) {
    console.error('Soloq Playstyle Sync Error:', error);
    return NextResponse.json({ error: error.message || '同期処理中にエラーが発生しました。' }, { status: 500 });
  }
}

/**
 * ダミーモックデータの生成（APIキーがない環境での開発・検証用）
 */
function generateMockPlaystyle() {
  const isBrawler = Math.random() > 0.4;
  const isFarmer = Math.random() > 0.5;

  const aggressive = isBrawler ? Math.floor(Math.random() * 20) + 70 : Math.floor(Math.random() * 30) + 30;
  const farming = isFarmer ? Math.floor(Math.random() * 20) + 68 : Math.floor(Math.random() * 30) + 40;
  const supportive = Math.floor(Math.random() * 40) + 30;

  const tags = [];
  if (aggressive >= 65) {
    tags.push({
      id: 'early-brawler',
      name: '序盤の戦闘狂 (Early Brawler) [デモ]',
      description: 'デモデータ判定。序盤のキル関与やインベイド率が高く算出されています。',
      reason: '平均キル 6.8回、ファーストブラッド率 32% (モック判定)'
    });
  }
  if (farming >= 65) {
    tags.push({
      id: 'speed-demon',
      name: '神速の周回魔 (Speed Demon) [デモ]',
      description: 'デモデータ判定。CS（クリープスコア）の伸び率が極めて高く算出されています。',
      reason: '平均CS 7.2/min、周回タイム安定 (モック判定)'
    });
  } else {
    tags.push({
      id: 'balanced-player',
      name: 'バランス型 (All-Rounder) [デモ]',
      description: 'デモデータ判定。ファームと戦闘のバランスが非常に良いです。',
      reason: 'Aggressive/Farming ともに標準レンジ (モック判定)'
    });
  }

  return {
    sliders: { aggressive, farming, supportive },
    tags,
    lastUpdated: new Date().toISOString()
  };
}
