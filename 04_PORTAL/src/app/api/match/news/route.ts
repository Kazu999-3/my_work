import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { callGeminiWithRetry } from '../../../../lib/geminiClient';
import { cachedJson } from '../../../../lib/apiCache';

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
  fighterOfTheMatch?: {
    name: string;
    champion?: string;
    kda: string;
    role: string;
    comment: string;
  };
  turningPoint: string;
  keyMatchup: string;
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
    penta_kills?: number;
    mmrDelta?: number;
  }>;
}): Promise<MatchNewsArticle> {
  const { winningTeam, gameDuration, participants } = matchData;

  const winnerParts = participants.filter((p) => p.team === winningTeam);
  const loserParts = participants.filter((p) => p.team !== winningTeam);

  // チーム総キル数
  const winnerTotalKills = winnerParts.reduce((s, p) => s + (p.kills || 0), 0);
  const loserTotalKills = loserParts.reduce((s, p) => s + (p.kills || 0), 0);

  // MVP候補（最高KDA or キル関与率 or ペンタキル達成）
  const scorePlayer = (p: typeof participants[0], totalKills: number) => {
    const kda = (p.kills + p.assists) / Math.max(1, p.deaths);
    const kp = totalKills > 0 ? (p.kills + p.assists) / totalKills : 0;
    const penta = (p.penta_kills || 0) * 10;
    return kda * 2 + kp * 5 + penta;
  };

  const sortedWinners = [...winnerParts].sort((a, b) => scorePlayer(b, winnerTotalKills) - scorePlayer(a, winnerTotalKills));
  const bestWinner = sortedWinners[0] || winnerParts[0];

  // 敗戦側の敢闘賞（Fighter of the Match: 敗軍の中で最も高いKDAやキル関与）
  const sortedLosers = [...loserParts].sort((a, b) => scorePlayer(b, loserTotalKills) - scorePlayer(a, loserTotalKills));
  const bestLoser = sortedLosers[0] || loserParts[0];

  // 各レーンの対面比較サマリー（KDA・チャンピオン対面）
  const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
  const matchupSummary = roles.map((role) => {
    const w = winnerParts.find((p) => p.role === role);
    const l = loserParts.find((p) => p.role === role);
    if (!w || !l) return null;
    return `・${role}: 【勝】${w.name} (${w.champion_name || '未定'} / ${w.kills}/${w.deaths}/${w.assists}) vs 【負】${l.name} (${l.champion_name || '未定'} / ${l.kills}/${l.deaths}/${l.assists})`;
  }).filter(Boolean).join('\n');

  const participantSummary = participants
    .map((p) => {
      const delta = p.mmrDelta ? (p.mmrDelta > 0 ? `+${p.mmrDelta}` : `${p.mmrDelta}`) : '±0';
      const extraStats = p.penta_kills ? ` [🔥ペンタキル:${p.penta_kills}回]` : '';
      return `- [${p.team}] [${p.role}] ${p.name} (${p.champion_name || '未定'}) KDA: ${p.kills}/${p.deaths}/${p.assists}${extraStats} (MMR変動: ${delta})`;
    })
    .join('\n');

  const durationText = gameDuration && gameDuration > 0 ? `・試合時間: 約${Math.round(gameDuration / 60)}分` : '';

  const prompt = `あなたは「月刊KTMスポーツ」の戦術デスク兼eスポーツ実況解説者です。
以下のLoLカスタム（KTM公式マッチ）の【実数値スコアボード】に基づき、プロ解説者（LJL実況）の視点を取り入れた、熱狂的で解像度の高いスポーツ新聞風ダイジェスト号外を作成してください。

【厳格な執筆ルール（捏造厳禁・ファクト至上主義）】
1. **架空のセリフ（捏造インタビュー）は絶対に禁止**です。「〇〇と叫んだ」「〜とコメント」等の本人が言っていない発言は作らないでください。
2. **提供されたスコアデータ（KDA、チャンプ名、ロール、勝敗、ペンタキル、MMR増減）にない出来事（神Ult、バロン強奪等）を勝手に創作しないでください**。
3. 称賛・分析はすべて【実数値の根拠】に基づいて行ってください（例: 「デスを〇に抑えたレーン戦の盤石さ」「キル関与率〇%を誇るキャリー」「敗戦側でも孤軍奮闘の〇キル」「怒涛のペンタキル達成」など）。
4. **【最重要】試合時間に関する捏造禁止**: 試合情報の欄に「試合時間: 約〇分」が明記されていない場合は、見出しや本文、寸評に「25分」「25分決着」「スピード決着」など試合時間に関する単語・数字を一切出さないでください。
5. 勝者側MVPだけでなく、敗戦側で最も輝いていた奮闘選手（敢闘賞）の健闘も称えてください。
6. すべて日本語、以下のJSONオブジェクト【のみ】を出力してください（Markdownコードブロックや前置きは厳禁）。

【試合情報】
・勝利陣営: ${winningTeam} TEAM（総キル: ${winnerTotalKills} vs ${loserTotalKills}）
${durationText}

【対面マッチアップ比較】
${matchupSummary}

【全参加者スタッツ】
${participantSummary}

{
  "headline": "実数値に基づくキャッチーな1面大見出し（35文字以内、例: 【KTM速報】〇〇の〇〇が驚異の〇キル！〇〇TEAMが快勝）",
  "subheadline": "勝負の分かれ目となったレーンや数値を要約した小見出し（30文字以内）",
  "lead": "スコアボードの実数値（KDAやキル数、ロール対決の差）を交え、試合の流れと勝者を的確に解説するリード文（100〜140文字程度）",
  "mvp": {
    "name": "${bestWinner?.name || '注目選手'}",
    "champion": "${bestWinner?.champion_name || 'メインチャンプ'}",
    "kda": "${bestWinner?.kills || 0}/${bestWinner?.deaths || 0}/${bestWinner?.assists || 0}",
    "role": "${bestWinner?.role || 'MID'}",
    "comment": "スタッツ（KDAやキル関与率等）に基づくMVP選出寸評（60文字以内）"
  },
  "fighterOfTheMatch": {
    "name": "${bestLoser?.name || '奮闘選手'}",
    "champion": "${bestLoser?.champion_name || 'チャンプ'}",
    "kda": "${bestLoser?.kills || 0}/${bestLoser?.deaths || 0}/${bestLoser?.assists || 0}",
    "role": "${bestLoser?.role || 'TOP'}",
    "comment": "敗戦側で孤軍奮闘した選手を称える敢闘寸評（60文字以内）"
  },
  "turningPoint": "対面マッチアップやダメージ差から読み取れる試合の決定打（80文字以内）",
  "keyMatchup": "最も激戦となった対面レーンのスタッツ比較と寸評（70文字以内）",
  "sideStory": "MMR変動（大幅UPや悔しい降格）やサポートの視界・タンクの被ダメ等の隠れた貢献（60文字以内）"
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

    // 試合記録時にしか増えないため60秒のCDNキャッシュで十分（トップページ表示ごとに約1秒のDB問い合わせが走っていた）
    return cachedJson({ success: true, news: newsList }, 60);
  } catch (error: any) {
    console.error('[match/news GET] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: 特定のmatchIdに対するニュースを手動再生成または即時生成
export async function POST(req: Request) {
  try {
    // ⚠️ 2026-09-29 セキュリティ修正:
    // このPOSTは**無認証・クールダウンなし・重複防止なし**でGeminiを呼べる状態だった。
    // 有効な matchId（現在126件存在）を1つ知っていれば、同じ試合に対して何度でも
    // 再生成を要求でき、**Geminiの日次クォータを枯渇させられる**。
    // このプロジェクトはクォータ枯渇で複数時間の障害を実際に起こしている
    // （HANDOVER §2 の 2026-08-09〜10。辞典・ソロQコーチ・動画解析が全滅した）。
    //
    // 重複防止(既存ニュースがあればスキップ)は **GET側にしか無かった**。
    //
    // 調査の結果、この**HTTP POSTには呼び出し元が1つも無い**:
    //   - 正規の生成経路は `match/record` が `generateMatchNews()` を直接import して呼ぶ
    //   - 画面側(`MatchNewsTicker.tsx`)は GET しか使わない
    // つまり手動再生成用に残されていた口なので、管理者セッションまたはBot経由のみに絞る。
    const { verifyAdminSession } = await import('../../../../lib/adminAuth');
    const { verifyBotSecretStrict } = await import('../../../../lib/botAuth');
    const adminAuth = await verifyAdminSession(req);
    if (!adminAuth.ok && !verifyBotSecretStrict(req).ok) {
      return NextResponse.json(
        { error: 'ニュースの再生成は管理者のみ実行できます。' },
        { status: 401 }
      );
    }

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
