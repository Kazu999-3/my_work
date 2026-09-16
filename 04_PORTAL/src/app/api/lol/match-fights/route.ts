import { NextResponse } from 'next/server';
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

export async function GET() {
  try {
    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'RIOT_API_KEY が未設定です。' }, { status: 500 });
    }

    // 1. 対象プレイヤーの PUUID を特定
    let puuid = process.env.KAZURIN_PUUID || '';
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

    // 2. 直近のソロキュー試合（または直近マッチ）を取得
    let matchIds = await fetchRankedSoloMatchIds(puuid, apiKey, 3);
    if (matchIds.length === 0) {
      matchIds = await fetchRecentMatchIds(puuid, apiKey, 3);
    }
    if (matchIds.length === 0) {
      return NextResponse.json({ error: '直近の試合履歴が見つかりませんでした。' }, { status: 404 });
    }

    const matchId = matchIds[0];

    // 3. 試合詳細とタイムラインを並列取得
    const [matchDetails, timelineData] = await Promise.all([
      fetchMatchDetails(matchId, apiKey),
      fetchMatchTimeline(matchId, apiKey).catch(() => null),
    ]);

    const myParticipant = matchDetails.participants.find((p) => p.puuid === puuid);
    if (!myParticipant) {
      return NextResponse.json({ error: '試合内に該当プレイヤーが見つかりませんでした。' }, { status: 404 });
    }

    const myChamp = myParticipant.championName;
    const durationMin = Math.floor(matchDetails.gameDuration / 60);
    const durationSec = matchDetails.gameDuration % 60;
    const match_duration = `${durationMin}:${String(durationSec).padStart(2, '0')}`;

    // 4. タイムラインからキルイベント＆オブジェクト獲得イベントを抽出して集団戦を検出
    const frames = timelineData?.info?.frames || [];
    let myParticipantId = 1;

    if (timelineData?.info?.participants) {
      const pInfo = timelineData.info.participants.find((p: any) => p.puuid === puuid);
      if (pInfo) myParticipantId = pInfo.participantId;
    }

    interface KillEvent {
      timestamp: number;
      min: number;
      sec: number;
      killerId: number;
      victimId: number;
      assistingParticipantIds: number[];
      isAllyKill: boolean;
      isMyParticipation: boolean;
    }

    interface ObjEvent {
      timestamp: number;
      min: number;
      sec: number;
      monsterType: string;
      killerTeamId: number;
      isAllyObj: boolean;
    }

    const killEvents: KillEvent[] = [];
    const objEvents: ObjEvent[] = [];

    frames.forEach((f: any) => {
      (f.events || []).forEach((ev: any) => {
        if (ev.type === 'CHAMPION_KILL') {
          const killerPart = matchDetails.participants[ev.killerId - 1];
          const isAllyKill = killerPart ? killerPart.teamId === myParticipant.teamId : ev.killerId <= 5;
          const isMyParticipation = ev.killerId === myParticipantId || (ev.assistingParticipantIds || []).includes(myParticipantId);
          const totalSec = Math.floor(ev.timestamp / 1000);
          killEvents.push({
            timestamp: ev.timestamp,
            min: Math.floor(totalSec / 60),
            sec: totalSec % 60,
            killerId: ev.killerId,
            victimId: ev.victimId,
            assistingParticipantIds: ev.assistingParticipantIds || [],
            isAllyKill,
            isMyParticipation,
          });
        } else if (ev.type === 'ELITE_MONSTER_KILL') {
          const killerPart = matchDetails.participants[ev.killerId - 1];
          const isAllyObj = killerPart ? killerPart.teamId === myParticipant.teamId : (ev.killerTeamId === myParticipant.teamId);
          const totalSec = Math.floor(ev.timestamp / 1000);
          objEvents.push({
            timestamp: ev.timestamp,
            min: Math.floor(totalSec / 60),
            sec: totalSec % 60,
            monsterType: ev.monsterType || ev.monsterSubType || 'Monster',
            killerTeamId: ev.killerTeamId || (isAllyObj ? myParticipant.teamId : 0),
            isAllyObj,
          });
        }
      });
    });

    // 60秒以内のキルやオブジェクトを1つの集団戦クラスタとしてグルーピング
    interface FightCluster {
      startTime: number;
      endTime: number;
      kills: KillEvent[];
      objs: ObjEvent[];
    }

    const clusters: FightCluster[] = [];
    killEvents.forEach((k) => {
      const existing = clusters.find((c) => Math.abs(c.endTime - k.timestamp) <= 50000 || Math.abs(c.startTime - k.timestamp) <= 50000);
      if (existing) {
        existing.kills.push(k);
        existing.startTime = Math.min(existing.startTime, k.timestamp);
        existing.endTime = Math.max(existing.endTime, k.timestamp);
      } else {
        clusters.push({
          startTime: k.timestamp,
          endTime: k.timestamp,
          kills: [k],
          objs: [],
        });
      }
    });

    // オブジェクトを最も近いクラスタにマージ
    objEvents.forEach((obj) => {
      const nearCluster = clusters.find((c) => Math.abs(c.startTime - obj.timestamp) <= 60000);
      if (nearCluster) {
        nearCluster.objs.push(obj);
      } else {
        clusters.push({
          startTime: obj.timestamp,
          endTime: obj.timestamp,
          kills: [],
          objs: [obj],
        });
      }
    });

    // 2キル以上発生、または自身が関与、またはオブジェクトが絡んだ重要な交戦のみを抽出 (最大5戦)
    const significantFights = clusters
      .filter((c) => c.kills.length >= 2 || c.objs.length > 0 || c.kills.some((k) => k.isMyParticipation))
      .sort((a, b) => a.startTime - b.startTime)
      .slice(0, 5);

    let victory_fights = 0;
    let defeat_fights = 0;
    let total_fight_damage = myParticipant.damageDealtToChampions || 0;

    const fights = significantFights.map((f, idx) => {
      const totalSec = Math.floor(f.startTime / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      const time_str = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

      const ally_kills = f.kills.filter((k) => k.isAllyKill).length;
      const enemy_kills = f.kills.filter((k) => !k.isAllyKill).length;
      const myInvolved = f.kills.some((k) => k.isMyParticipation);

      const objNames = f.objs.map((o) => {
        const type = o.monsterType.replace(/_/g, ' ');
        return o.isAllyObj ? `味方獲得: ${type}` : `敵獲得: ${type}`;
      });

      const isVictory = ally_kills > enemy_kills || (ally_kills === enemy_kills && f.objs.some((o) => o.isAllyObj));
      if (isVictory) victory_fights++;
      else defeat_fights++;

      const result = isVictory ? 'VICTORY' : 'DEFEAT';
      const result_badge = isVictory ? '勝利 🟢' : '敗北 🔴';

      const objContext = objNames.length > 0 ? ` (${objNames.join(', ')})` : '';
      const title = `${time_str} ${m <= 14 ? '序盤リバー・レーン小規模戦' : m <= 22 ? 'ドラゴン/タワー攻防集団戦' : 'バロン/インヒビター決戦'}${objContext}`;

      const dmgContrib = myInvolved
        ? Math.round((total_fight_damage / Math.max(1, significantFights.length)) * (isVictory ? 1.2 : 0.8))
        : 0;

      const summary = isVictory
        ? `⚔️ 【${time_str} 交戦勝利】 味方チームが ${ally_kills}キル を獲得し、主導権を確保。${objNames.length > 0 ? `オブジェクト（${objNames.join(', ')}）を奪取。` : ''}`
        : `⚠️ 【${time_str} 交戦敗北】 敵に ${enemy_kills}キル を許し、リソース差を広げられました。${objNames.length > 0 ? `敵にオブジェクト（${objNames.join(', ')}）を奪取されました。` : ''}`;

      const key_factor = myInvolved
        ? `${myChamp} の積極的な戦闘関与により、${isVictory ? '味方のダメージフォーカスが成立しました。' : '奮闘しましたが人数差で押し切られました。'}`
        : `味方本隊との合流タイミングがズレており、サイドレーンでのファーム中または別アクション中でした。`;

      const feedback = myInvolved
        ? `🔥 ${myChamp} の交戦貢献: 推定 ${dmgContrib.toLocaleString()} dmg (${isVictory ? '前線でのダメージ・CC貢献' : '孤立を避け味方と足並みを揃えましょう'})`
        : `💡 改善ポイント: オブジェクト湧き30秒前にはウェーブを押し切り、味方と合流して5v5の陣形を整えましょう。`;

      return {
        fight_id: idx + 1,
        time_str,
        title,
        result,
        result_badge,
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

    return NextResponse.json({
      success: true,
      champion: myChamp,
      match_duration,
      total_fights: fights.length,
      victory_fights,
      defeat_fights,
      total_fight_damage,
      fights,
    });
  } catch (error: any) {
    console.error('[match-fights] Error:', error);
    return NextResponse.json({ error: error?.message || '集団戦解析エラー' }, { status: 500 });
  }
}

