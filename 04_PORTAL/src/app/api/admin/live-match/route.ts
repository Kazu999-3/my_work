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
    const geminiApiKey = process.env.GEMINI_API_KEY;

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
      enemyJg = enemyParticipants[0];
    }

    const enemyName = enemyJg.riotIdGameName || enemyJg.summonerName || 'Unknown';
    const enemyTag = enemyJg.riotIdTagline || '';
    const enemyChampName = await getChampionNameById(enemyJg.championId);

    // 4. 敵ジャングラーの過去ソロキュー履歴を取得してプレイスタイルを分析 (直近10試合)
    let enemyPlaystyle = null;
    let enemyMatches: any[] = [];
    try {
      const enemyMatchIds = await fetchRecentMatchIds(enemyJg.puuid, apiKey, 10, 420); // Solo/Duo
      
      const batchSize = 3;
      for (let i = 0; i < enemyMatchIds.length; i += batchSize) {
        const batchIds = enemyMatchIds.slice(i, i + batchSize);
        const promises = batchIds.map(async (id) => {
          try {
            const detail = await fetchMatchDetails(id, apiKey);
            const detailMe = detail.participants.find(p => 
              (p.riotIdName && p.riotIdName.toLowerCase() === enemyName.toLowerCase()) || 
              p.championName === enemyChampName
            );
            
            let gold_diff_9 = 0, xp_diff_9 = 0, cs_diff_9 = 0;
            if (i === 0) {
              try {
                const timeline = await fetchMatchTimeline(id, apiKey);
                const frame = timeline.info?.frames?.[9];
                if (frame && detailMe) {
                  const myPartIdx = detail.participants.findIndex(p => p.riotIdName?.toLowerCase() === detailMe.riotIdName?.toLowerCase());
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

    if (!enemyPlaystyle) {
      enemyPlaystyle = {
        sliders: { aggressive: 55, farming: 45, supportive: 40 },
        tags: [{ id: 'balanced-player', name: 'バランス型', description: '標準的なプレイスタイル。', reason: 'データ制限のため' }],
        diffs: { goldDiff: 50, xpDiff: 20, csDiff: 0.8 },
        lastUpdated: new Date().toISOString()
      };
    }

    // OTP ＆ ティルト判定
    let isOtp = false;
    let otpChampion = "";
    let isTilted = false;
    let consecutiveLosses = 0;

    if (enemyMatches.length > 0) {
      const champCounts: Record<string, number> = {};
      enemyMatches.forEach((m: any) => {
        const cName = m.championName || enemyChampName;
        champCounts[cName] = (champCounts[cName] || 0) + 1;
      });
      const topChamp = Object.entries(champCounts).sort((a, b) => b[1] - a[1])[0];
      if (topChamp && topChamp[1] >= 7) {
        isOtp = true;
        otpChampion = topChamp[0];
      }

      for (let i = 0; i < enemyMatches.length; i++) {
        if (enemyMatches[i].win === false) {
          consecutiveLosses++;
        } else {
          break;
        }
      }
      if (consecutiveLosses >= 3) {
        isTilted = true;
      }
    }

    // 鬼コーチ対策3箇条の生成
    const enemyPlaystyleTag = enemyPlaystyle.tags?.[0] || { id: 'balanced-player', name: 'バランス型', description: '標準的' };
    
    let coachAdvice: any[] = [];
    if (geminiApiKey) {
      coachAdvice = await generateCoachAdviceWithGemini(enemyChampName, enemyPlaystyleTag, geminiApiKey);
    } else {
      coachAdvice = generateMockCoachAdvice(enemyChampName, enemyPlaystyleTag);
    }

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
      isOtp,
      otpChampion,
      isTilted,
      consecutiveLosses,
      coachAdvice,
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

async function getChampionNameById(id: number): Promise<string> {
  const mapping: Record<number, string> = {
    64: 'LeeSin', 121: 'Khazix', 76: 'Nidalee', 20: 'Nunu', 59: 'JarvanIV',
    35: 'Shaco', 24: 'Jax', 104: 'Graves', 254: 'Vi', 11: 'MasterYi',
    56: 'Nocturne', 113: 'Sejuani', 77: 'Udyr', 200: 'Belveth', 555: 'Pyke'
  };
  return mapping[id] || 'LeeSin';
}

async function generateCoachAdviceWithGemini(champ: string, tag: any, apiKey: string): Promise<any[]> {
  try {
    const prompt = `
あなたはLeague of Legendsの「鬼コーチ」です。厳しい口調（「〜しなさい」「〜は厳禁だ」）だが、勝利のための具体的かつ愛のある対面対策アドバイスを授けます。
対戦相手の情報は以下の通りです：
- 敵のチャンピオン: ${champ}
- 敵のプレイスタイル傾向: ${tag.name} (${tag.description})

上記を踏まえ、ジャングラー対面時に絶対に実践すべき【対面対策3箇条】を、スライド形式（JSON配列。3つの要素）で生成してください。
各箇条は必ず以下の構造にしてください：
- title: 箇条のタイトル（例: 「1. Lv3インベイドを徹底警戒せよ」）
- detail: 具体的な理由と取るべき行動（例: 「相手は序盤の戦闘狂タグを持っています。Lv3で自陣の青バフに侵入してくる可能性が極めて高いため、味方レーナーにリバーの視界を置かせるか、逆サイドからスタートして衝突を回避しなさい。」）

JSONの出力フォーマットは必ず以下の通りにしてください。解説やマークダウンの \`\`\`json などの装飾は一切含めないでください：
[
  { "title": "1. ...", "detail": "..." },
  { "title": "2. ...", "detail": "..." },
  { "title": "3. ...", "detail": "..." }
]
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json"
        }
      })
    });
    
    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return JSON.parse(text.trim());
      }
    }
  } catch (e) {
    console.error("Gemini API call failed for coach advice:", e);
  }
  return generateMockCoachAdvice(champ, tag);
}

function generateMockCoachAdvice(champ: string, tag: any): any[] {
  const isEarlyJg = ['LeeSin', 'Khazix', 'JarvanIV', 'Shaco', 'Vi'].includes(champ);
  if (isEarlyJg) {
    return [
      {
        title: "1. LV3の早期インベイドを厳密に警戒せよ",
        detail: `相手は ${champ} を使用し、${tag.name} の傾向があります。LV3時点でこちらのジャングルに侵入して小規模戦を仕掛けてくる可能性が高いため、味方にリバーの視界を置かせなさい。`
      },
      {
        title: "2. レーンへの早期Gankルートを予測しカウンターを狙え",
        detail: "相手は開始3分前後にトップまたはミッドへ仕掛けてきます。自軍のクリア速度を調整し、相手の仕掛けの瞬間にカバーが入れる位置をキープしなさい。"
      },
      {
        title: "3. リバーでの孤立したタイマンは絶対に避けよ",
        detail: "序盤のタイマンは相手に分があります。スカトル争いは味方レーナーのプッシュ状況を確認し、寄りの早い側が勝つと心得て動きなさい。"
      }
    ];
  } else {
    return [
      {
        title: "1. 相手のフルクリア周回にカウンターを合わせよ",
        detail: `相手は成長優先のファーム型です。こちらのジャングルを素早くクリアし、相手がファームしている隙に反対側のレーンへ仕掛けてテンポ差を作りなさい。`
      },
      {
        title: "2. ディープワードで敵キャンプを特定し続けよ",
        detail: "相手の位置が分かればレーナーは安全にプッシュできます。敵ジャングルのラプターやウルフの前に視界を残し、居場所を露にし続けなさい。"
      },
      {
        title: "3. 中盤以降のオブジェクト争いに備えよ",
        detail: "相手は装備が揃うと集団戦でキャリーします。最初のヴォイドグラブやドラゴンはフリーで渡さず、レーンの優位をオブジェクトに還元しなさい。"
      }
    ];
  }
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

  const mockAdvice = [
    {
      title: "1. 3分前後のLV3インベイドを絶対防御せよ",
      detail: "相手は攻撃的なLee Sin使いです。自陣バフへの侵入ルートに早期ワードを置き、衝突が起きたら味方ミッドを即座に寄らせてカウンターキルを狙いなさい。"
    },
    {
      title: "2. サイドレーンの無駄なプッシュは厳禁だ",
      detail: "相手は戦闘関与率が高いです。ガンクを受けやすい状況を自ら作らず、ウェーブコントロールを徹底してタワー下で安全に受け流しなさい。"
    },
    {
      title: "3. ドラゴン周辺の視界確保を怠るな",
      detail: "中盤以降のオブジェクト戦への移行スピードが早いです。最初のドラゴン出現前にリバーの支配権を必ず確保し、相手に先手を取らせないようにしなさい。"
    }
  ];

  return {
    isGameActive: true,
    gameLength: 540,
    mapId: 11,
    championName: 'LeeSin',
    enemyJgName: 'EnemyDemon#KR1',
    playstyle: mockPlaystyle,
    startBuffPrediction: '青バフ (バフ3キャンプ速攻) スタート予測 [デモ]',
    firstGankTarget: 'トップまたはミッドへのLV3早期Gank [デモ]',
    tips: '【デモアドバイス】敵ジャングラーは戦闘狂 Lee Sin です。開始3分前後にインベイドまたはトップへのLV3ガンクを行う可能性が80%以上あります。リバーに視界を置き、敵の位置を特定してからアクションを起こしましょう。',
    isOtp: true,
    otpChampion: 'LeeSin',
    isTilted: true,
    consecutiveLosses: 4,
    coachAdvice: mockAdvice,
    allParticipants: [
      { name, championId: 64, teamId: 100 },
      { name: 'AllyTop', championId: 24, teamId: 100 },
      { name: 'EnemyDemon', championId: 64, teamId: 200 },
      { name: 'EnemyTop', championId: 77, teamId: 200 }
    ]
  };
}
