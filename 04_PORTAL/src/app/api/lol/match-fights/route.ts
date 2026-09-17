import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import {
  fetchPuuidByRiotId,
  fetchRankedSoloMatchIds,
  fetchRecentMatchIds,
  fetchMatchDetails,
  fetchMatchTimeline,
} from '../../../../lib/riot';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'RIOT_API_KEY が未設定です。' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const requestedMatchId = searchParams.get('matchId') || '';
    const matchIndex = Math.max(0, parseInt(searchParams.get('index') || '0', 10));
    const requestedSummoner = searchParams.get('summoner') || '';
    const requestedPuuid = searchParams.get('puuid') || '';

    // 1. 対象プレイヤーの PUUID を特定
    let puuid = requestedPuuid;
    if (!puuid && requestedSummoner) {
      const parts = requestedSummoner.split('#');
      const gName = parts[0]?.trim() || '';
      const tLine = parts[1]?.trim() || 'JP1';
      puuid = await fetchPuuidByRiotId(gName, tLine, apiKey);
    }

    if (!puuid) {
      puuid = process.env.KAZURIN_PUUID || '';
    }

    if (!puuid) {
      const { data: player } = await supabase
        .from('ktm_players')
        .select('puuid, ign, name')
        .eq('name', 'かずき')
        .maybeSingle();

      if (player && player.puuid) {
        puuid = player.puuid;
      } else if (player && player.ign && player.ign.includes('#')) {
        const [gName, tLine] = player.ign.split('#');
        puuid = await fetchPuuidByRiotId(gName.trim(), tLine.trim(), apiKey);
      }
    }

    if (!puuid) {
      return NextResponse.json({ error: '対象プレイヤーの PUUID が見つかりませんでした。' }, { status: 404 });
    }

    // 2. 直近のソロキュー試合（または直近マッチ）を最大6件取得
    let matchIds = await fetchRankedSoloMatchIds(puuid, apiKey, 6);
    if (matchIds.length === 0) {
      matchIds = await fetchRecentMatchIds(puuid, apiKey, 6);
    }
    if (matchIds.length === 0) {
      return NextResponse.json({ error: '直近の試合履歴が見つかりませんでした。' }, { status: 404 });
    }

    const isAllMode = requestedMatchId === 'all';
    let targetMatchId = isAllMode
      ? 'all'
      : requestedMatchId && matchIds.includes(requestedMatchId)
      ? requestedMatchId
      : matchIds[matchIndex] || matchIds[0];

    const targetIds = matchIds.slice(0, 6);

    // 3. 直近複数試合の詳細メタデータとタイムラインを並列取得
    const [allDetailsList, allTimelinesList] = await Promise.all([
      Promise.all(
        targetIds.map(async (mId) => {
          try {
            return await fetchMatchDetails(mId, apiKey);
          } catch {
            return null;
          }
        })
      ),
      Promise.all(
        targetIds.map(async (mId) => {
          try {
            return await fetchMatchTimeline(mId, apiKey);
          } catch {
            return null;
          }
        })
      ),
    ]);

    // 直近マッチ一覧の整形（UIのセレクター用）
    const recentMatches = targetIds.map((mId, idx) => {
      const d = allDetailsList[idx];
      if (!d) return null;
      const me = d.participants.find((p) => p.puuid === puuid);
      if (!me) return null;

      const durM = Math.floor(d.gameDuration / 60);
      const durS = d.gameDuration % 60;
      const durStr = `${durM}:${String(durS).padStart(2, '0')}`;
      const startTs = d.gameStartTimestamp || Date.now();

      return {
        matchId: mId,
        championName: me.championName,
        isWin: me.win,
        kdaStr: `${me.kills}/${me.deaths}/${me.assists}`,
        kills: me.kills,
        deaths: me.deaths,
        assists: me.assists,
        damage: me.damageDealtToChampions || 0,
        gameDurationStr: durStr,
        gameStartTimestamp: startTs,
      };
    }).filter(Boolean);

    // 集団戦抽出ヘルパー関数
    const extractFights = (details: any, timeline: any, matchIndexLabel?: string) => {
      if (!details) return { fights: [], victoryCount: 0, defeatCount: 0, totalDmg: 0 };
      const me = details.participants.find((p: any) => p.puuid === puuid);
      if (!me) return { fights: [], victoryCount: 0, defeatCount: 0, totalDmg: 0 };

      const myChamp = me.championName;
      const totalDmg = me.damageDealtToChampions || 0;
      const frames = timeline?.info?.frames || [];
      let myPId = 1;
      if (timeline?.info?.participants) {
        const pInfo = timeline.info.participants.find((p: any) => p.puuid === puuid);
        if (pInfo) myPId = pInfo.participantId;
      }

      interface KillEv {
        timestamp: number;
        min: number;
        sec: number;
        killerId: number;
        victimId: number;
        isAllyKill: boolean;
        isMyParticipation: boolean;
      }
      interface ObjEv {
        timestamp: number;
        min: number;
        sec: number;
        monsterType: string;
        isAllyObj: boolean;
      }

      const killEvents: KillEv[] = [];
      const objEvents: ObjEv[] = [];

      frames.forEach((f: any) => {
        (f.events || []).forEach((ev: any) => {
          if (ev.type === 'CHAMPION_KILL') {
            const killerPart = details.participants[ev.killerId - 1];
            const isAllyKill = killerPart ? killerPart.teamId === me.teamId : ev.killerId <= 5;
            const isMyParticipation = ev.killerId === myPId || (ev.assistingParticipantIds || []).includes(myPId);
            const totalSec = Math.floor(ev.timestamp / 1000);
            killEvents.push({
              timestamp: ev.timestamp,
              min: Math.floor(totalSec / 60),
              sec: totalSec % 60,
              killerId: ev.killerId,
              victimId: ev.victimId,
              isAllyKill,
              isMyParticipation,
            });
          } else if (ev.type === 'ELITE_MONSTER_KILL') {
            const killerPart = details.participants[ev.killerId - 1];
            const isAllyObj = killerPart ? killerPart.teamId === me.teamId : (ev.killerTeamId === me.teamId);
            const totalSec = Math.floor(ev.timestamp / 1000);
            objEvents.push({
              timestamp: ev.timestamp,
              min: Math.floor(totalSec / 60),
              sec: totalSec % 60,
              monsterType: ev.monsterType || ev.monsterSubType || 'Monster',
              isAllyObj,
            });
          }
        });
      });

      interface Cluster {
        startTime: number;
        endTime: number;
        kills: KillEv[];
        objs: ObjEv[];
      }
      const clusters: Cluster[] = [];
      const TIME_WINDOW_MS = 25000;

      killEvents.forEach((k) => {
        const last = clusters[clusters.length - 1];
        if (last && k.timestamp - last.endTime <= TIME_WINDOW_MS) {
          last.endTime = Math.max(last.endTime, k.timestamp);
          last.kills.push(k);
        } else {
          clusters.push({ startTime: k.timestamp, endTime: k.timestamp, kills: [k], objs: [] });
        }
      });
      objEvents.forEach((obj) => {
        const matched = clusters.find(
          (c) => Math.abs(c.startTime - obj.timestamp) <= 30000 || Math.abs(c.endTime - obj.timestamp) <= 30000
        );
        if (matched) {
          matched.objs.push(obj);
        } else {
          clusters.push({ startTime: obj.timestamp, endTime: obj.timestamp, kills: [], objs: [obj] });
        }
      });

      const significant = clusters
        .filter((c) => c.kills.length >= 2 || c.objs.length > 0 || c.kills.some((k) => k.isMyParticipation))
        .sort((a, b) => a.startTime - b.startTime);

      let vic = 0;
      let def = 0;
      const parsedFights = significant.map((f, idx) => {
        const totalSec = Math.floor(f.startTime / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        const time_str = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        const ally_kills = f.kills.filter((k) => k.isAllyKill).length;
        const enemy_kills = f.kills.filter((k) => !k.isAllyKill).length;
        const myInvolved = f.kills.some((k) => k.isMyParticipation);
        const hasAllyObj = f.objs.some((o) => o.isAllyObj);
        const hasEnemyObj = f.objs.some((o) => !o.isAllyObj);

        const objNames = f.objs.map((o) => {
          const type = o.monsterType.replace(/_/g, ' ');
          return o.isAllyObj ? `味方獲得: ${type}` : `敵獲得: ${type}`;
        });

        const isVictory = ally_kills > enemy_kills || (ally_kills === enemy_kills && hasAllyObj);
        if (isVictory) vic++;
        else def++;

        const objContext = objNames.length > 0 ? ` (${objNames.join(', ')})` : '';
        const matchPrefix = matchIndexLabel ? `[${matchIndexLabel}] ` : '';
        const title = `${matchPrefix}${time_str} ${m <= 14 ? '序盤リバー小規模戦' : m <= 22 ? 'ドラゴン/タワー攻防戦' : 'バロン/インヒビター決戦'}${objContext}`;
        const dmgContrib = myInvolved
          ? Math.round((totalDmg / Math.max(1, significant.length)) * (isVictory ? 1.2 : 0.8))
          : 0;

        const summary = isVictory
          ? `⚔️ 【${time_str} 交戦勝利】 味方チームが ${ally_kills}キル を獲得し、主導権を確保。${objNames.length > 0 ? `（${objNames.join(', ')}）を奪取。` : ''}`
          : `⚠️ 【${time_str} 交戦敗北】 敵に ${enemy_kills}キル を許しました。${objNames.length > 0 ? `敵に（${objNames.join(', ')}）を奪取されました。` : ''}`;

        // 🌟 状況・チャンピオンに応じた動的レビューテキスト生成
        let key_factor = '';
        let feedback = '';

        if (myInvolved) {
          // 戦闘参加時
          if (isVictory) {
            if (m <= 14) {
              key_factor = `${myChamp} の素早いリバー・レーン寄りにより、序盤の人数有利を活かして敵を撃破。`;
              feedback = `🔥 序盤のアクション大成功: 推定 ${dmgContrib.toLocaleString()} dmg。この有利をもとにドラゴン・ヴォイドグラブへ繋げましょう。`;
            } else if (hasAllyObj) {
              key_factor = `${myChamp} が前線でプレッシャーを与え、敵の妨害を排除してオブジェクト（${objNames.join(', ')}）獲得を確定させました。`;
              feedback = `👑 オブジェクト戦勝利: 前線でのゾーンコントロールとフォーカスが機能しました。`;
            } else {
              key_factor = `${myChamp} のスキル回転とダメージフォーカスが成立し、敵キャリー陣を崩壊させました。`;
              feedback = `⚔️ 集団戦制圧: 推定 ${dmgContrib.toLocaleString()} dmg。味方との足並みが揃った理想的なエンゲージでした。`;
            }
          } else {
            // 敗北時
            if (hasEnemyObj) {
              key_factor = `オブジェクト（${objNames.join(', ')}）周りの視界確保で敵に先手を打たれ、狭い地形でダメージを受け切りました。`;
              feedback = `💡 改善点: 視界のない暗闇フェイスチェックを避け、味方のCCやULTに合わせてカウンターエンゲージを狙いましょう。`;
            } else if (m <= 14) {
              key_factor = `序盤の小規模戦で敵の寄りが1テンポ早く、人数差または体力差の不利を背負って交戦しました。`;
              feedback = `⚠️ 序盤の注意: レーンのプッシュ主導権がない時は無理に争わず、ピンを出して自陣ファームを優先しましょう。`;
            } else {
              key_factor = `${myChamp} も戦闘に関与しましたが、敵の集中フォーカスまたはCCチェーンを受け、ダメージを出し切る前に前線が崩壊しました。`;
              feedback = `🛡️ 立ち位置改善: 敵の主要CCやULTの吐き出しを確認してから、2手目で飛び込む意識を持ちましょう。`;
            }
          }
        } else {
          // 戦闘不参加時（別アクション中など）
          if (hasAllyObj) {
            key_factor = `${myChamp} が別サイドでオブジェクト獲得またはファームを進行中。本隊が上手く時間を稼ぎました。`;
            feedback = `🎯 クロスプレイ成功: 戦闘不参加でもマップ逆側でリソースを獲得し、チーム全体の損害を最小限に抑えました。`;
          } else if (hasEnemyObj) {
            key_factor = `オブジェクト（${objNames.join(', ')}）周りの本隊と離れており、4v5の人数不利を突かれて交戦・オブジェクト奪取を許しました。`;
            feedback = `💡 重要改善ポイント: オブジェクト湧き30秒前にはファームを切り上げ、${myChamp} のULTや強みを活かして陣形を組みましょう。`;
          } else if (m <= 14) {
            key_factor = `マップ反対側のレーンで小規模戦が発生。距離が遠く合流が物理的に困難なシチュエーションでした。`;
            feedback = `🧭 マクロ判断: 遠方の戦闘時は自レーンのミニオンを押し切ってタワープレートや相手ジャングルを荒らすのがベストです。`;
          } else {
            if (isVictory) {
              key_factor = `味方4人が的確な連携で敵を圧倒。${myChamp} はサイドレーンのプッシュアドバンテージを維持しました。`;
              feedback = `✨ 本隊の勝利: サイドレーンをさらに深くまで押し込んで敵タワーへのプレッシャーをかけましょう。`;
            } else {
              key_factor = `サイドレーン進行中に味方本隊が敵の強襲を受けました。敵のエンゲージ射程に対して味方の警戒が遅れました。`;
              feedback = `⚠️ スプリット時の注意: 本隊に『引いて時間を稼ぐ』ピンを鳴らし、敵の姿が消えたら即座に後退またはTP・合流の準備を。`;
            }
          }
        }

        // チャンピオン個別フレーバー
        if (myChamp === 'Shyvana') {
          if (!myInvolved && hasEnemyObj) {
            feedback = `💡 シヴァーナ戦術: ドラゴン獲得はパッシブ防御力アップに直結します。フューリーゲージ（ULT）を満タンにしてドラゴン周りに待機しましょう。`;
          } else if (myInvolved && isVictory) {
            feedback += ` 🐉 ドラゴンフォーム（ULT）の範囲ダメージが決定打となりました。`;
          }
        }

        return {
          fight_id: idx + 1,
          time_str,
          title,
          result: isVictory ? 'VICTORY' : 'DEFEAT',
          result_badge: isVictory ? '勝利 🟢' : '敗北 🔴',
          ally_kills,
          enemy_kills,
          objectives: objNames,
          my_damage_dealt: dmgContrib,
          gold_swing: (ally_kills - enemy_kills) * 400 + (f.objs.some((o) => o.isAllyObj) ? 600 : -600),
          summary,
          key_factor,
          feedback,
        };
      });

      return { fights: parsedFights, victoryCount: vic, defeatCount: def, totalDmg };
    };

    // ==========================================
    // A: 複数試合合算モード (isAllMode)
    // ==========================================
    if (isAllMode) {
      let combinedFights: any[] = [];
      let totalVic = 0;
      let totalDef = 0;
      let combinedTotalDmg = 0;

      targetIds.forEach((mId, idx) => {
        const d = allDetailsList[idx];
        const t = allTimelinesList[idx];
        if (!d) return;
        const me = d.participants.find((p: any) => p.puuid === puuid);
        if (!me) return;

        const matchLabel = `第${idx + 1}戦 ${me.championName}`;
        const res = extractFights(d, t, matchLabel);
        totalVic += res.victoryCount;
        totalDef += res.defeatCount;
        combinedTotalDmg += res.totalDmg;
        combinedFights = combinedFights.concat(res.fights);
      });

      // 重要な交戦を最大10件表示
      const sortedFights = combinedFights.slice(0, 10).map((f, idx) => ({ ...f, fight_id: idx + 1 }));

      const champCounts: { [name: string]: number } = {};
      recentMatches.forEach((m: any) => {
        champCounts[m.championName] = (champCounts[m.championName] || 0) + 1;
      });
      const poolStr = Object.entries(champCounts).map(([name, count]) => `${name} (${count}戦)`).join(' / ');

      return NextResponse.json({
        success: true,
        selected_match_id: 'all',
        recent_matches: recentMatches,
        champion: poolStr || '直近プール',
        match_duration: `直近全${recentMatches.length}試合 統合集団戦レビュー`,
        total_fights: totalVic + totalDef,
        victory_fights: totalVic,
        defeat_fights: totalDef,
        total_fight_damage: combinedTotalDmg,
        fights: sortedFights,
      });
    }

    // ==========================================
    // B: 単一試合の個別精密解析モード
    // ==========================================
    const targetIdx = targetIds.indexOf(targetMatchId);
    let matchDetails = targetIdx >= 0 ? allDetailsList[targetIdx] : null;
    let timelineData = targetIdx >= 0 ? allTimelinesList[targetIdx] : null;

    if (!matchDetails) {
      try {
        matchDetails = await fetchMatchDetails(targetMatchId, apiKey);
        timelineData = await fetchMatchTimeline(targetMatchId, apiKey).catch(() => null);
      } catch (e) {
        matchDetails = allDetailsList[0];
        timelineData = allTimelinesList[0];
        targetMatchId = matchIds[0];
      }
    }
    if (!matchDetails) {
      return NextResponse.json({ error: '選択された試合詳細を取得できませんでした。' }, { status: 404 });
    }

    const myParticipant = matchDetails.participants.find((p: any) => p.puuid === puuid);
    if (!myParticipant) {
      return NextResponse.json({ error: '試合内に該当プレイヤーが見つかりませんでした。' }, { status: 404 });
    }

    const myChamp = myParticipant.championName;
    const durationMin = Math.floor(matchDetails.gameDuration / 60);
    const durationSec = matchDetails.gameDuration % 60;
    const match_duration = `${durationMin}:${String(durationSec).padStart(2, '0')}`;

    const singleRes = extractFights(matchDetails, timelineData);

    return NextResponse.json({
      success: true,
      selected_match_id: targetMatchId,
      recent_matches: recentMatches,
      champion: myChamp,
      match_duration,
      total_fights: singleRes.fights.length,
      victory_fights: singleRes.victoryCount,
      defeat_fights: singleRes.defeatCount,
      total_fight_damage: singleRes.totalDmg,
      fights: singleRes.fights.slice(0, 6),
    });
  } catch (error: any) {
    console.error('[match-fights] Error:', error);
    return NextResponse.json({ error: error?.message || '集団戦解析エラー' }, { status: 500 });
  }
}
