import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { callGeminiWithRetry } from '../../../../lib/geminiClient';

// 辞典まわりのAI支援。
//  - summarize   : 対面メモの自動要約（散らばったメモを「このチャンプの要点」に集約）
//  - contradiction: 辞典の主張 vs 実戦データ の矛盾検出
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MIN_GAMES = 3; // 矛盾判定に必要な最低試合数（少数サンプルで断定しない）

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { kind, champion } = await req.json();

    // ===== 1. 対面メモの自動要約 =====
    if (kind === 'summarize') {
      if (!champion) return NextResponse.json({ error: 'champion が必要です。' }, { status: 400 });

      const { data: memos } = await supabase
        .from('matchup_sentinel')
        .select('enemy, role, strategy, raw_data')
        .eq('champion', champion)
        .neq('enemy', 'GLOBAL')
        .limit(60);

      if (!memos || memos.length === 0) {
        return NextResponse.json({ error: `${champion} の対面メモがまだありません。` }, { status: 400 });
      }

      const memoText = memos.map((m: any) => {
        const rd = m.raw_data || {};
        const parts = [m.strategy, rd.winCondition, rd.earlyGame, rd.powerSpikes].filter(Boolean);
        return `【vs ${m.enemy}${m.role ? `/${m.role}` : ''}】${parts.join(' / ').slice(0, 400)}`;
      }).join('\n');

      const prompt = `以下は「${champion}」の対面メモ${memos.length}件です。重複や言い回しの揺れを整理し、要点を日本語で集約してください。
特定の対面だけの話ではなく、**このチャンピオンを使う上で共通して言える要点**を抽出することを重視してください。

必ず以下のJSONのみ出力（コードブロック禁止）:
{"summary":"<全体の要点をMarkdownの箇条書きで。5〜8項目、1項目60字以内>","commonMistakes":"<繰り返し出てくる失敗パターン120字以内>","keyTips":["<特に重要な指針3つ>"]}

メモ:
${memoText.slice(0, 12000)}`;

      const raw = await callGeminiWithRetry(prompt, { temperature: 0.3, maxOutputTokens: 2048, maxRetries: 2 });
      let cleaned = (raw || '').trim().replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
      const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
      if (s < 0 || e <= s) throw new Error('AI出力の解析に失敗しました');
      return NextResponse.json({ success: true, champion, memoCount: memos.length, ...JSON.parse(cleaned.slice(s, e + 1)) });
    }

    // ===== 2. 辞典の矛盾検出 =====
    if (kind === 'contradiction') {
      // 辞典（主張）と matchup_log（実戦）を突き合わせる
      const { data: facts } = await supabase
        .from('champion_facts')
        .select('champion, strengths, weaknesses, counter_champions, must_ban_champions');

      const { data: logs } = await supabase
        .from('matchup_log')
        .select('my_champion, enemy_champion, is_win')
        .limit(3000);

      if (!facts || facts.length === 0) {
        return NextResponse.json({ error: '辞典データがありません。' }, { status: 400 });
      }

      // ペアごとの実戦勝率を集計
      const pair: Record<string, { games: number; wins: number }> = {};
      (logs || []).forEach((l: any) => {
        if (!l.my_champion || !l.enemy_champion) return;
        const k = `${l.my_champion}|${l.enemy_champion}`;
        if (!pair[k]) pair[k] = { games: 0, wins: 0 };
        pair[k].games++;
        if (l.is_win) pair[k].wins++;
      });

      const issues: any[] = [];
      for (const f of facts) {
        // 「苦手（counter_champions）」と書いてあるのに実戦では勝ち越している
        const counters = String(f.counter_champions || '').split(/[,、\/\s]+/).map(s => s.trim()).filter(Boolean);
        for (const c of counters) {
          const st = pair[`${f.champion}|${c}`];
          if (st && st.games >= MIN_GAMES) {
            const wr = Math.round((st.wins / st.games) * 100);
            if (wr >= 60) {
              issues.push({
                champion: f.champion, enemy: c, type: 'counter_but_winning',
                message: `辞典では「${c}が苦手」とあるが、実戦では ${st.games}戦 勝率${wr}% と勝ち越している`,
                games: st.games, winRate: wr,
              });
            }
          }
        }
        // 「BAN推奨（must_ban）」なのに実戦で圧勝している
        const bans = String(f.must_ban_champions || '').split(/[,、\/\s]+/).map(s => s.trim()).filter(Boolean);
        for (const b of bans) {
          const st = pair[`${f.champion}|${b}`];
          if (st && st.games >= MIN_GAMES) {
            const wr = Math.round((st.wins / st.games) * 100);
            if (wr >= 70) {
              issues.push({
                champion: f.champion, enemy: b, type: 'ban_but_dominating',
                message: `辞典では「${b}をBAN推奨」だが、実戦では ${st.games}戦 勝率${wr}% と圧倒している`,
                games: st.games, winRate: wr,
              });
            }
          }
        }
      }

      // 逆パターン: 辞典に記載がないのに実戦で大きく負け越している対面
      for (const [k, st] of Object.entries(pair)) {
        if (st.games < MIN_GAMES + 1) continue;
        const wr = Math.round((st.wins / st.games) * 100);
        if (wr > 30) continue;
        const [my, enemy] = k.split('|');
        const f = facts.find((x: any) => x.champion === my);
        const mentioned = f && String(f.counter_champions || '').includes(enemy);
        if (!mentioned) {
          issues.push({
            champion: my, enemy, type: 'losing_but_unlisted',
            message: `実戦で ${st.games}戦 勝率${wr}% と苦戦しているが、辞典に苦手対面として記載がない`,
            games: st.games, winRate: wr,
          });
        }
      }

      issues.sort((a, b) => b.games - a.games);
      return NextResponse.json({ success: true, issues: issues.slice(0, 30), checked: facts.length });
    }

    return NextResponse.json({ error: 'kind は summarize / contradiction のいずれかです。' }, { status: 400 });
  } catch (e: any) {
    console.error('[dict-insights] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
