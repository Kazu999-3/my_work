import { NextResponse } from 'next/server';
import { fetchPuuidByRiotId, fetchActiveGameByPuuid, fetchRecentMatchIds, fetchMatchDetails, fetchMatchTimeline } from '../../../../lib/riot';
import { calculatePlaystyle } from '../../../../lib/playstyle';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { riotId } = body; // "Name#Tag" 形式

    if (!riotId || !riotId.includes('#')) {
      return NextResponse.json({ error: 'Riot IDは「名前#タグ」の形式で入力してください。' }, { status: 400 });
    }

    const [gameName, tagLine] = riotId.split('#');
    const apiKey = process.env.RIOT_API_KEY;

    // APIキーが無い場合はテスト用のダミーライブゲームデータを返す (開発用モック)
    if (!apiKey) {
      console.warn("⚠️ RIOT_API_KEY が未設定のため、デモ用ライブゲーム情報を返却します。");
      const mockGameData = generateMockLiveGame(gameName);
      return NextResponse.json(mockGameData);
    }

    // 1. PUUID の解決
    let myPuuid = '';
    try {
      myPuuid = await fetchPuuidByRiotId(gameName, tagLine, apiKey);
    } catch (err: any) {
      return NextResponse.json({ error: `Riot ID の検索に失敗しました: ${err.message}` }, { status: 404 });
    }

    // 2. 進行中ゲーム (Active Game) の取得
    let activeGame: any = null;
    try {
      activeGame = await fetchActiveGameByPuuid(myPuuid, apiKey);
    } catch (err: any) {
      if (err.message === 'ACTIVE_GAME_NOT_FOUND') {
        return NextResponse.json({ 
          isGameActive: false, 
          message: `${gameName}#${tagLine} は現在ゲーム中ではありません。` 
        });
      }
      return NextResponse.json({ error: `ライブゲーム取得エラー: ${err.message}` }, { status: 502 });
    }

    // 3. 参加者データから自分と敵ジャングラーを特定
    const myParticipant = activeGame.participants.find((p: any) => p.puuid === myPuuid);
    if (!myParticipant) {
      return NextResponse.json({ error: 'ゲーム情報に自身のサモナー情報が見つかりませんでした。' }, { status: 500 });
    }

    const myTeamId = myParticipant.teamId;
    const enemyParticipants = activeGame.participants.filter((p: any) => p.teamId !== myTeamId);

    // 敵ジャングラーの特定 (スペルに Smite [SummonerSmite=11] を持っているプレイヤーを優先)
    let enemyJg = enemyParticipants.find((p: any) => p.spell1Id === 11 || p.spell2Id === 11);
    if (!enemyJg) {
      // 見つからなければ暫定的にランダムに1名選定
      enemyJg = enemyParticipants[0];
    }

    const enemyName = enemyJg.riotIdGameName || enemyJg.summonerName || 'Unknown';
    const enemyTag = enemyJg.riotIdTagline || '';
    const enemyChampName = await getChampionNameById(enemyJg.championId);

    // 4. 敵ジャングラーの過去ソロキュー履歴を取得してプレイスタイルを分析 (直近10試合)
    let enemyPlaystyle = null;
    try {
      const enemyMatchIds = await fetchRecentMatchIds(enemyJg.puuid, apiKey, 10, 420); // Solo/Duo
      const enemyMatches: any[] = [];

      // バッチ処理でフェッチ (429回避)
      const batchSize = 3;
      for (let i = 0; i < enemyMatchIds.length; i += batchSize) {
        const batchIds = enemyMatchIds.slice(i, i + batchSize);
        const promises = batchIds.map(async (id) => {
          try {
            const detail = await fetchMatchDetails(id, apiKey);
            const detailMe = detail.participants.find(p => p.riotIdName.toLowerCase() === enemyName.toLowerCase() || p.championName === enemyChampName);
            
            // タイムラインも一部フェッチ
            let gold_diff_9 = 0, xp_diff_9 = 0, cs_diff_9 = 0;
            if (i === 0) { // 最初の数試合だけタイムラインを取得
              try {
                const timeline = await fetchMatchTimeline(id, apiKey);
                const frame = timeline.info?.frames?.[9];
                if (frame && detailMe) {
                  const myPartIdx = detail.participants.findIndex(p => p.riotIdName.toLowerCase() === detailMe.riotIdName.toLowerCase());
                  const myPartId = myPartIdx !== -1 ? myPartIdx + 1 : -1;
                  const oppPartIdx = detail.participants.findIndex(p => p.lane === detailMe.lane && p.teamId !== detailMe.teamId);
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
              } catch (te) {}
            }

            if (detailMe) {
              return {
                ...detailMe,
                game_duration: detail.gameDuration,
                win: detailMe.win,
                gold_diff_9,
                xp_diff_9,
                cs_diff_9
              };
            }
          } catch (e) {}
          return null;
        });

        const batchResults = await Promise.all(promises);
        batchResults.forEach(r => { if (r) enemyMatches.push(r); });
        await new Promise(res => setTimeout(res, 100));
      }

      if (enemyMatches.length > 0) {
        enemyPlaystyle = calculatePlaystyle(enemyMatches);
      }
    } catch (err) {
      console.warn("敵ジャングラーの過去戦績分析に失敗しました:", err);
    }

    // デフォルト値
    if (!enemyPlaystyle) {
      enemyPlaystyle = {
        sliders: { aggressive: 55, farming: 45, supportive: 40 },
        tags: [{ id: 'balanced-player', name: 'バランス型', description: '標準的なプレイスタイル。', reason: 'データ制限のため' }],
        diffs: { goldDiff: 50, xpDiff: 20, csDiff: 0.8 },
        lastUpdated: new Date().toISOString()
      };
    }

    // 5. 敵の攻略アドバイス・開始バフ・最初の関与レーン予測を生成
    const enemyPlaystyleTag = enemyPlaystyle.tags?.[0] || { id: 'balanced-player', name: 'バランス型' };
    const analysis = generateLiveAnalysis(enemyChampName, enemyPlaystyleTag);

    return NextResponse.json({
      isGameActive: true,
      gameLength: activeGame.gameLength,
      mapId: activeGame.mapId,
      championName: enemyChampName,
      enemyJgName: `${enemyName}#${enemyTag}`,
      playstyle: enemyPlaystyle,
      startBuffPrediction: analysis.startBuff,
      firstGankTarget: analysis.firstGank,
      tips: analysis.tips,
      allParticipants: activeGame.participants.map((p: any) => ({
        name: p.riotIdGameName || p.summonerName,
        championId: p.championId,
        teamId: p.teamId
      }))
    });

  } catch (error: any) {
    console.error('Live Match API Error:', error);
    return NextResponse.json({ error: error.message || 'ライブゲームのロードに失敗しました。' }, { status: 500 });
  }
}

// IDからチャンピオン名へのマッピング (主要のみ簡易)
async function getChampionNameById(id: number): Promise<string> {
  const mapping: Record<number, string> = {
    64: 'LeeSin', 121: 'Khazix', 76: 'Nidalee', 20: 'Nunu', 59: 'JarvanIV',
    35: 'Shaco', 24: 'Jax', 104: 'Graves', 254: 'Vi', 11: 'MasterYi',
    56: 'Nocturne', 113: 'Sejuani', 77: 'Udyr', 200: 'Belveth', 555: 'Pyke'
  };
  return mapping[id] || 'LeeSin';
}

function generateLiveAnalysis(champ: string, tag: any) {
  const isEarlyJg = ['LeeSin', 'Khazix', 'JarvanIV', 'Shaco', 'Vi'].includes(champ);
  const isBrawler = tag.id === 'early-brawler';

  let startBuff = '赤バフ (RED Side) スタート予測';
  let firstGank = 'ボットレーン (下側) レーン関与';
  let tips = '';

  if (isEarlyJg) {
    startBuff = '青バフ (バフ3キャンプ速攻) スタート予測';
    firstGank = 'トップまたはミッドへのLV3早期Gank';
    tips = '相手は序盤が非常に強力なチャンピオンです。LV2またはLV3の早い段階でプレッシャーをかけてくるため、サイドレーンは開始3分前後にリバーの視界を確保してください。自軍ジャングルへのインベイドにも注意し、孤立した戦闘を避けましょう。';
  } else if (isBrawler) {
    startBuff = 'ボット側リーシュあり赤バフスタート';
    firstGank = '対面レーンでのLV3小規模戦の発生';
    tips = '相手プレイヤーは戦闘意欲が極めて高い戦闘狂タグを持っています。フルクリアよりも遭遇戦や強引なガンクを好むため、相手ジャングルの位置が割れるまではレーンでの深追いは禁物です。味方ジャングラーはカウンターガンクの意識を強めましょう。';
  } else {
    // ファーム型など
    startBuff = '赤バフ (フルクリア周回) スタート';
    firstGank = 'LV4以降のスカトル（川のカニ）争い、または最初のオブジェクト';
    tips = '相手はファームを重視して周回速度を優先する傾向があります。序盤のアクションは控えめですが、中盤以降CSと装備差でキャリーしてくるため、こちらはレーンへのGankを決めてテンポ差を作るか、相手のキャンプへディープワードを置いて位置を特定し続けましょう。';
  }

  return { startBuff, firstGank, tips };
}

function generateMockLiveGame(name: string) {
  const mockPlaystyle = {
    sliders: { aggressive: 78, farming: 35, supportive: 42 },
    tags: [{
      id: 'early-brawler',
      name: '序盤の戦闘狂 (Early Brawler) [デモ]',
      description: 'ゲーム序盤からキル関与やインベイドを好み、積極的仕掛けをするプレイヤー。',
      reason: 'モックデータ判定 (FB率 35%, 平均キル 7.5)'
    }],
    diffs: { goldDiff: 180, xpDiff: 60, csDiff: 1.2 },
    lastUpdated: new Date().toISOString()
  };

  return {
    isGameActive: true,
    gameLength: 540, // 9分
    mapId: 11,
    championName: 'LeeSin',
    enemyJgName: 'EnemyDemon#KR1',
    playstyle: mockPlaystyle,
    startBuffPrediction: '青バフ (バフ3キャンプ速攻) スタート予測 [デモ]',
    firstGankTarget: 'トップまたはミッドへのLV3早期Gank [デモ]',
    tips: '【デモアドバイス】敵ジャングラーは戦闘狂 Lee Sin です。開始3分前後にインベイドまたはトップへのLV3ガンクを行う可能性が80%以上あります。リバーに視界を置き、敵の位置を特定してからアクションを起こしましょう。',
    allParticipants: [
      { name, championId: 64, teamId: 100 },
      { name: 'AllyTop', championId: 24, teamId: 100 },
      { name: 'EnemyDemon', championId: 64, teamId: 200 },
      { name: 'EnemyTop', championId: 77, teamId: 200 }
    ]
  };
}
