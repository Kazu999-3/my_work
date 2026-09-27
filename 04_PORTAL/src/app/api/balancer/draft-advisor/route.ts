import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { callGeminiWithRetry } from '../../../../lib/geminiClient';

export const dynamic = 'force-dynamic';

interface TeamMember {
  name: string;
  assignedRole: string;
  mmr?: number;
  highest_rank?: string;
  mainLane?: string;
  pref1?: string;
}

export async function POST(req: Request) {
  try {
    const { teamBlue, teamRed, mode } = await req.json();

    if (!Array.isArray(teamBlue) || !Array.isArray(teamRed) || teamBlue.length === 0 || teamRed.length === 0) {
      return NextResponse.json({ error: '両チームのメンバー情報が必要です。' }, { status: 400 });
    }

    const allNames = Array.from(new Set([
      ...teamBlue.map((p: TeamMember) => p.name),
      ...teamRed.map((p: TeamMember) => p.name)
    ]));

    // プレイヤーの得意チャンピオン・プール・プレイスタイルを ktm_players から取得
    const { data: dbPlayers } = await supabase
      .from('ktm_players')
      .select('name, champion_pool, playstyle, highest_rank, role_preferences')
      .in('name', allNames);

    const playerMetaMap: Record<string, any> = {};
    if (dbPlayers) {
      dbPlayers.forEach((p: any) => {
        playerMetaMap[p.name] = p;
      });
    }

    // 直近マッチでのピック傾向や高勝率チャンプを補強 (ktm_match_participants)
    const { data: recentMatchStats } = await supabase
      .from('ktm_match_participants')
      .select('player_name, champion_name, kills, deaths, assists, role')
      .in('player_name', allNames)
      .not('champion_name', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);

    const playerChampsCount: Record<string, Record<string, number>> = {};
    if (recentMatchStats) {
      recentMatchStats.forEach((row: any) => {
        const pName = row.player_name;
        const cName = row.champion_name;
        if (!pName || !cName) return;
        if (!playerChampsCount[pName]) playerChampsCount[pName] = {};
        playerChampsCount[pName][cName] = (playerChampsCount[pName][cName] || 0) + 1;
      });
    }

    const formatTeamInfo = (team: TeamMember[], teamName: string) => {
      return team.map((p) => {
        const meta = playerMetaMap[p.name] || {};
        const pool = Array.isArray(meta.champion_pool) ? meta.champion_pool.join(', ') : (meta.champion_pool || '未登録');
        const recentChamps = Object.entries(playerChampsCount[p.name] || {})
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([c, count]) => `${c}(${count}戦)`)
          .join(', ');

        return `- [${p.assignedRole || p.mainLane || 'FLEX'}] ${p.name} (Rank: ${p.highest_rank || meta.highest_rank || 'UNRANKED'} / MMR: ${p.mmr || 1200})
  * 登録プール: ${pool}
  * 最近の主な使用: ${recentChamps || 'なし'}
  * スタイル: ${meta.playstyle || 'バランス'}`;
      }).join('\n');
    };

    const bluePromptText = formatTeamInfo(teamBlue, 'BLUE TEAM');
    const redPromptText = formatTeamInfo(teamRed, 'RED TEAM');

    const prompt = `あなたはLeague of Legends(LoL)の内戦・競技カスタムにおける専属ヘッドコーチ（ドラフト軍師）です。
以下のチーム分け情報と参加者の得意チャンピオン・実力データをもとに、両チームのバンピック戦略、推奨構成、勝敗の鍵となるマッチアップを分析してください。

【BLUE TEAM】
${bluePromptText}

【RED TEAM】
${redPromptText}

以下のJSONフォーマット【のみ】を出力してください。前置きやMarkdownコードブロック、注釈は一切不要です。
必ず有効なJSONオブジェクトとして出力してください。

{
  "summary": "100文字以内の試合全体の展望と注目ポイント（ワクワクする実況トーン）",
  "blueStrategy": {
    "theme": "BLUEチーム推奨コンセプト（例: Bot中心の集団戦構成 / TOPスプリットプッシュ等）",
    "recommendedBans": [
      {"champion": "チャンピオン英語名(例: Darius)", "reason": "BANすべき理由（相手の〇〇選手が得意・構成的に刺さるなど）"},
      {"champion": "チャンピオン英語名", "reason": "理由"}
    ],
    "keySynergyPicks": [
      {"role": "TOP", "champion": "チャンピオン英語名", "reason": "おすすめ理由"},
      {"role": "JG", "champion": "チャンピオン英語名", "reason": "おすすめ理由"},
      {"role": "MID", "champion": "チャンピオン英語名", "reason": "おすすめ理由"},
      {"role": "ADC", "champion": "チャンピオン英語名", "reason": "おすすめ理由"},
      {"role": "SUP", "champion": "チャンピオン英語名", "reason": "おすすめ理由"}
    ],
    "winCondition": "BLUEチームの明確な勝ち筋（60文字以内）"
  },
  "redStrategy": {
    "theme": "REDチーム推奨コンセプト",
    "recommendedBans": [
      {"champion": "チャンピオン英語名", "reason": "理由"},
      {"champion": "チャンピオン英語名", "reason": "理由"}
    ],
    "keySynergyPicks": [
      {"role": "TOP", "champion": "チャンピオン英語名", "reason": "おすすめ理由"},
      {"role": "JG", "champion": "チャンピオン英語名", "reason": "おすすめ理由"},
      {"role": "MID", "champion": "チャンピオン英語名", "reason": "おすすめ理由"},
      {"role": "ADC", "champion": "チャンピオン英語名", "reason": "おすすめ理由"},
      {"role": "SUP", "champion": "チャンピオン英語名", "reason": "おすすめ理由"}
    ],
    "winCondition": "REDチームの明確な勝ち筋（60文字以内）"
  },
  "keyMatchups": [
    {
      "lane": "TOP",
      "focus": "対面の注目ポイントと有利を握る鍵（80文字以内）"
    },
    {
      "lane": "BOT",
      "focus": "対面の注目ポイントと有利を握る鍵（80文字以内）"
    }
  ]
}`;

    const raw = await callGeminiWithRetry(prompt, {
      model: 'gemini-3.5-flash-lite',
      temperature: 0.4,
      maxOutputTokens: 2048,
      maxRetries: 2,
    });

    let cleaned = (raw || '').trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
    }
    const s = cleaned.indexOf('{');
    const e = cleaned.lastIndexOf('}');
    if (s < 0 || e <= s) {
      throw new Error('AI軍師の出力を解析できませんでした。もう一度お試しください。');
    }

    const advice = JSON.parse(cleaned.slice(s, e + 1));
    return NextResponse.json({ success: true, advice });
  } catch (error: any) {
    console.error('[balancer/draft-advisor] error:', error);
    return NextResponse.json({ error: error.message || 'ドラフト分析に失敗しました。' }, { status: 500 });
  }
}
