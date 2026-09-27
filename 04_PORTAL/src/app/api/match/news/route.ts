import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { callGeminiWithRetry } from '../../../../lib/geminiClient';

export const dynamic = 'force-dynamic';

const TASK_TYPE = 'ktm_match_news';

export interface MatchNewsArticle {
  headline: string;
  subheadline: string;
  lead: string;
  mvp: {
    name: string;
    champion?: string;
    kda: string;
    role: string;
    comment: string;
  };
  turningPoint: string;
  interviewQuote: string;
  sideStory: string;
}

/**
 * 試合データからスポーツ新聞風の面白いハイライトニュースをGeminiで生成
 */
export async function generateMatchNews(matchData: {
  matchId: string | number;
  winningTeam: 'BLUE' | 'RED';
  gameDuration?: number;
  participants: Array<{
    name: string;
    team: 'BLUE' | 'RED';
    role: string;
    champion_name?: string;
    kills: number;
    deaths: number;
    assists: number;
    mmrDelta?: number;
  }>;
}): Promise<MatchNewsArticle> {
  const { winningTeam, gameDuration, participants } = matchData;
  const minutes = gameDuration ? Math.round(gameDuration / 60) : 25;

  const winnerParts = participants.filter((p) => p.team === winningTeam);
  const loserParts = participants.filter((p) => p.team !== winningTeam);

  // MVP候補（最高KDA or キル関与）
  const sortedByKda = [...winnerParts].sort((a, b) => {
    const kdaA = (a.kills + a.assists) / Math.max(1, a.deaths);
    const kdaB = (b.kills + b.assists) / Math.max(1, b.deaths);
    return kdaB - kdaA;
  });
  const bestPlayer = sortedByKda[0] || winnerParts[0];

  const participantSummary = participants
    .map((p) => {
      const delta = p.mmrDelta ? (p.mmrDelta > 0 ? `+${p.mmrDelta}` : `${p.mmrDelta}`) : '±0';
      return `- [${p.team}] [${p.role}] ${p.name} (${p.champion_name || 'チャンプ未定'}) KDA: ${p.kills}/${p.deaths}/${p.assists} (MMR変動: ${delta})`;
    })
    .join('\n');

  const prompt = `あなたは「月刊KTMスポーツ」「東スポ風eスポーツ速報」の敏腕デスクです。
以下のLoL内戦カスタム（KTM公式マッチ）の試合結果データをもとに、ユーモアと熱狂あふれる面白いスポーツ新聞の1面風ダイジェスト記事を作成してください。

【試合情報】
・勝利陣営: ${winningTeam} TEAM
・試合時間: 約${minutes}分
・参加者スコアボード:
${participantSummary}

【記事作成のルール】
1. スポーツ報知や東スポ、Number風のキャッチーで大げさな見出しをつけてください。
2. 活躍した選手（${bestPlayer?.name}選手など）を「豪快なプレイ」「神がかりなガンク/集団戦」として称賛。
3. 惜しくも敗れた側の奮闘や、珍プレイ・ドラマチックな展開も温かいユーモアを交えて拾ってください。
4. すべて日本語、以下のJSONオブジェクト【のみ】を出力してください（Markdownコードブロックや前置きは厳禁）。

{
  "headline": "思わず二度見する大見出し（35文字以内、例: 【KTM内戦】〇〇が神Ult炸裂！〇分決着でBLUE軍団を粉砕）",
  "subheadline": "緊迫感を伝える小見出し（30文字以内）",
  "lead": "試合全体の流れをドラマチックかつ面白くまとめたリード文（100〜140文字程度）",
  "mvp": {
    "name": "${bestPlayer?.name || '注目選手'}",
    "champion": "${bestPlayer?.champion_name || 'メインチャンプ'}",
    "kda": "${bestPlayer?.kills || 0}/${bestPlayer?.deaths || 0}/${bestPlayer?.assists || 0}",
    "role": "${bestPlayer?.role || 'MID'}",
    "comment": "MVP選出の寸評・称賛コメント（60文字以内）"
  },
  "turningPoint": "勝負を決定づけた運命の集団戦やターニングポイント（80文字以内）",
  "interviewQuote": "試合直後のMVP選手または敗軍の将の架空の熱いコメント（「〜〜！」と叫んだ、等、50文字以内）",
  "sideStory": "対面マッチアップの小ネタや、MMR急上昇/急降下の裏話（60文字以内）"
}`;

  const raw = await callGeminiWithRetry(prompt, {
    model: 'gemini-3.5-flash-lite',
    temperature: 0.7,
    maxOutputTokens: 1024,
    maxRetries: 2,
  });

  let cleaned = (raw || '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
  }
  const s = cleaned.indexOf('{');
  const e = cleaned.lastIndexOf('}');
  if (s < 0 || e <= s) {
    throw new Error('AIニュースの生成に失敗しました。');
  }

  return JSON.parse(cleaned.slice(s, e + 1));
}

// GET: 最新のニュース一覧を取得（ポータルトップや履歴画面で使用）
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(20, Math.max(1, Number(searchParams.get('limit')) || 5));
    const matchId = searchParams.get('matchId');

    let query = supabase
      .from('edge_tasks')
      .select('id, payload, created_at')
      .eq('task_type', TASK_TYPE)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (matchId) {
      query = supabase
        .from('edge_tasks')
        .select('id, payload, created_at')
        .eq('task_type', TASK_TYPE)
        .eq('status', 'completed')
        .filter('payload->>matchId', 'eq', matchId)
        .limit(1);
    }

    const { data, error } = await query;
    if (error) throw error;

    const newsList = (data || []).map((row: any) => ({
      id: row.id,
      matchId: row.payload?.matchId,
      createdAt: row.created_at,
      article: row.payload?.article,
      winningTeam: row.payload?.winningTeam,
    }));

    return NextResponse.json({ success: true, news: newsList });
  } catch (error: any) {
    console.error('[match/news GET] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: 特定のmatchIdに対するニュースを手動再生成または即時生成
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { matchId } = body;

    if (!matchId) {
      return NextResponse.json({ error: 'matchIdが必要です。' }, { status: 400 });
    }

    // 試合と参加者データを取得
    const { data: match, error: mError } = await supabase
      .from('ktm_matches')
      .select(`
        id, winning_team, game_duration,
        ktm_match_participants (
          player_name, team, role, champion_name, kills, deaths, assists, mmr_delta
        )
      `)
      .eq('id', matchId)
      .single();

    if (mError || !match) {
      return NextResponse.json({ error: '該当の試合データが見つかりません。' }, { status: 404 });
    }

    const participants = (match.ktm_match_participants || []).map((p: any) => ({
      name: p.player_name,
      team: p.team,
      role: p.role,
      champion_name: p.champion_name,
      kills: p.kills || 0,
      deaths: p.deaths || 0,
      assists: p.assists || 0,
      mmrDelta: p.mmr_delta || 0,
    }));

    const article = await generateMatchNews({
      matchId: match.id,
      winningTeam: match.winning_team,
      gameDuration: match.game_duration,
      participants,
    });

    // edge_tasks へ保存
    await supabase.from('edge_tasks').insert({
      task_type: TASK_TYPE,
      payload: {
        matchId: match.id,
        winningTeam: match.winning_team,
        article,
      },
      status: 'completed',
    });

    return NextResponse.json({ success: true, article });
  } catch (error: any) {
    console.error('[match/news POST] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
