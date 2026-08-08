import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../lib/supabaseAdmin';
import {
  Player,
  Role,
  BalanceContext,
  selectPlayersWithPity,
  coreBalanceProposals
} from '../../../lib/balancer';
import { fetchAllRows } from '../../../lib/fetchAll';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { participants } = body;
    
    if (!participants || !Array.isArray(participants) || participants.length < 10) {
      return NextResponse.json({ error: '参加者は最低10人必要です。' }, { status: 400 });
    }

    // 1. ktm_players から該当プレイヤーの情報を取得
    const names = participants.map(p => p.name);
    const { data: playersData, error: pError } = await supabase
      .from('ktm_players')
      .select('*')
      .in('name', names);

    if (pError || !playersData) {
      return NextResponse.json({ error: 'プレイヤー情報の取得に失敗しました。' }, { status: 500 });
    }

    // 各参加者の実際の戦績（試合数・勝率）を Supabase から取得・集計 (大文字小文字の揺れに対応するため、検索クエリ用リストを拡張)
    const namesQuery = Array.from(new Set([
      ...names,
      ...names.map(n => n.toLowerCase()),
      ...names.map(n => n.toUpperCase())
    ]));
    const { data: participantsStats, error: statsError } = await fetchAllRows((from, to) =>
      supabase
        .from('ktm_match_participants')
        .select('player_name, team, ktm_matches!inner(winning_team)')
        .in('player_name', namesQuery)
        .range(from, to)
    );

    // プレイヤー名ごとに 試合数 (games) と 勝利数 (wins) をマップ (すべて小文字で比較保持)
    const playerStatsMap: Record<string, { games: number; wins: number }> = {};
    names.forEach(name => {
      playerStatsMap[name.toLowerCase()] = { games: 0, wins: 0 };
    });

    // 高速照合用の Map インデックスを事前生成 (O(1) ルックアップ)
    const nameLookupMap = new Map<string, string>();
    names.forEach(n => nameLookupMap.set(n.toLowerCase(), n));

    if (participantsStats && !statsError) {
      participantsStats.forEach((row: any) => {
        const rowNameLower = row.player_name.toLowerCase();
        // 完全一致を優先して O(1) で取得し、失敗時のみ部分一致フォールバック
        let matchedName = nameLookupMap.get(rowNameLower);
        if (!matchedName) {
          matchedName = names.find(n => {
            const nLower = n.toLowerCase();
            return rowNameLower.includes(nLower) || nLower.includes(rowNameLower);
          });
        }
        
        if (matchedName) {
          const key = matchedName.toLowerCase();
          playerStatsMap[key].games++;
          
          const winningTeam = Array.isArray(row.ktm_matches)
            ? (row.ktm_matches[0] as any)?.winning_team
            : (row.ktm_matches as any)?.winning_team;
            
          if (row.team === winningTeam) {
            playerStatsMap[key].wins++;
          }
        }
      });
    }

    // 2. Player インタフェースへマッピング
    // 名簿未登録の参加者が1人でも混ざると即例外でリクエスト全体が失敗し、しかも
    // 最初に見つかった1人分の名前しかエラーに出ないため管理者が原因を特定しづらかった
    // (2026-08-08発覚)。未登録者を全員集めてから、まとめて分かりやすい400エラーで返す。
    const missingNames = participants
      .map(input => input.name)
      .filter(name => !playersData.some((p: any) => p.name === name));
    if (missingNames.length > 0) {
      return NextResponse.json({
        error: `名簿に登録されていないプレイヤーがいます: ${missingNames.join(', ')}（管理ダッシュボードで登録してから再度実行してください）`
      }, { status: 400 });
    }

    const allPlayers: Player[] = participants.map(input => {
      const dbPlayer = playersData.find((p: any) => p.name === input.name)!;

      const roleMap: Record<string, Role | 'ALL'> = {
        'JUNGLE': 'JG',
        'SUPPORT': 'SUP',
        'TOP': 'TOP',
        'MID': 'MID',
        'ADC': 'ADC',
        'ALL': 'ALL'
      };

      const rawPref1 = dbPlayer.role_preferences?.primary || 'ALL';
      const rawPref2 = dbPlayer.role_preferences?.secondary || 'ALL';
      const rawNg1 = dbPlayer.ng_lane_1 || '';
      const rawNg2 = dbPlayer.ng_lane_2 || '';

      const statsKey = dbPlayer.name.toLowerCase();
      const pGames = playerStatsMap[statsKey]?.games || 0;
      const pWinRate = pGames > 0 
        ? Number(((playerStatsMap[statsKey].wins / pGames) * 100).toFixed(1)) 
        : 50.0;

      return {
        name: dbPlayer.name,
        discordId: dbPlayer.discord_id,
        rank: dbPlayer.highest_rank || 'UNRANKED',
        pref1: roleMap[rawPref1] || rawPref1,
        pref2: roleMap[rawPref2] || rawPref2,
        ng1: roleMap[rawNg1] || rawNg1,
        ng2: roleMap[rawNg2] || rawNg2,
        pity: dbPlayer.pity || 0,
        spectator_pity: dbPlayer.spectator_pity || 0,
        off_role_pity: dbPlayer.off_role_pity || 0,
        weight: dbPlayer.weight || 2,
        allowHigher: dbPlayer.allow_higher || false,
        // ハンデ参加者は計算上のMMRを一律で下げる（DBの実MMR・戦績は一切変更しない）。
        // 強い人が下位帯に混ざる日に、チーム分け上の格差を緩和するための仕組み。
        rates: (() => {
          const pen = input.handicap ? (Number(body.handicapPenalty) || 150) : 0;
          const adj = (v: number) => Math.max(100, (v || 1200) - pen);
          return {
            TOP: adj(dbPlayer.mmr_top),
            JG: adj(dbPlayer.mmr_jg),
            MID: adj(dbPlayer.mmr_mid),
            ADC: adj(dbPlayer.mmr_adc),
            SUP: adj(dbPlayer.mmr_sup),
          };
        })(),
        isHandicap: !!input.handicap,
        games: pGames,
        winRate: pWinRate,
        isFixed: input.isFixed,
        isSpectatorFixed: input.isSpectatorFixed,
        fixedRole: input.fixedRole
      };
    });

    // 3. Pity選抜と組み合わせ生成
    // 見学固定のプレイヤーを事前に除外して spectators 確定枠とする
    const forcedSpectators = allPlayers.filter(p => p.isSpectatorFixed);
    const balanceCandidates = allPlayers.filter(p => !p.isSpectatorFixed);

    // 見学固定で対象が10人未満になると、この後のrunBalanceSearchが「ちょうど10人必要」の
    // 例外を投げて500エラーになり、原因が分かりにくかった(2026-08-08発覚)。
    // ここで先に検知し、あと何人必要かが分かる400エラーとして返す。
    if (balanceCandidates.length < 10) {
      return NextResponse.json({
        error: `見学固定を除くとチーム分け対象が${balanceCandidates.length}人しかいません。あと${10 - balanceCandidates.length}人必要です（見学固定を減らすか参加者を増やしてください）。`
      }, { status: 400 });
    }

    let selectedPatterns: { selected: Player[]; spectators: Player[] }[] = [];

    if (balanceCandidates.length <= 10) {
      selectedPatterns.push({ selected: balanceCandidates, spectators: forcedSpectators });
    } else {
      // Pity順（固定枠 > 待機Pity降順 > レーンPity降順 > ランダム）でソート
      const fixedPlayers = balanceCandidates.filter(p => p.isFixed);
      const candidatesPool = balanceCandidates.filter(p => !p.isFixed);
      
      const candidateInfo = candidatesPool.map(p => ({
        player: p,
        pity: p.pity || 0,
        spectator_pity: p.spectator_pity || 0,
        rand: Math.random()
      }));

      candidateInfo.sort((a, b) => {
        if (b.spectator_pity !== a.spectator_pity) return b.spectator_pity - a.spectator_pity;
        if (b.pity !== a.pity) return b.pity - a.pity;
        return b.rand - a.rand;
      });

      // 待機Pity（spectator_pity）が高い人を「強制選出」にする
      const highPityCandidates = candidateInfo.filter(c => c.spectator_pity >= 10).map(c => c.player);
      const otherCandidates = candidateInfo.filter(c => c.spectator_pity < 10).map(c => c.player);

      // 対面に必要な残り人数
      const needed = Math.max(0, 10 - fixedPlayers.length - highPityCandidates.length);

      if (needed === 0) {
        const selected = [...fixedPlayers, ...highPityCandidates].slice(0, 10);
        const selectedNames = new Set(selected.map(p => p.name));
        const spectators = [...forcedSpectators, ...balanceCandidates.filter(p => !selectedNames.has(p.name))];
        selectedPatterns.push({ selected, spectators });
      } else {
        // 残り枠を otherCandidates から選ぶ組み合わせを生成する（最大20通りに制限するため上位候補に絞る）
        const poolToChooseFrom = otherCandidates.slice(0, Math.min(otherCandidates.length, needed + 4));
        
        const getCombinations = (array: Player[], r: number): Player[][] => {
          const result: Player[][] = [];
          const helper = (start: number, combo: Player[]) => {
            if (combo.length === r) {
              result.push([...combo]);
              return;
            }
            for (let i = start; i < array.length; i++) {
              combo.push(array[i]);
              helper(i + 1, combo);
              combo.pop();
            }
          };
          helper(0, []);
          return result;
        };

        const combos = getCombinations(poolToChooseFrom, needed);

        // 各組み合わせに対してパターンを作成（最大20パターン）
        for (const combo of combos.slice(0, 20)) {
          const selected = [...fixedPlayers, ...highPityCandidates, ...combo];
          const selectedNames = new Set(selected.map(p => p.name));
          const spectators = [...forcedSpectators, ...balanceCandidates.filter(p => !selectedNames.has(p.name))];
          selectedPatterns.push({ selected, spectators });
        }
      }
    }

    if (selectedPatterns.length === 0) {
      return NextResponse.json({ error: '選抜されたプレイヤーパターンが生成できませんでした。' }, { status: 500 });
    }

    // 4. コンテキストデータ(履歴)の構築
    const ctx: BalanceContext = {
      history: new Set<string>(),
      teammateHistory: new Map<string, number>(),
      winStreakTeam: null,
      sideHistory: {}
    };

    // 禁止ペア（同チーム不可）をDB設定(ktm_settings)から読み込む。#30: 従来のコード直書きを廃止。
    try {
      const { data: setting } = await supabase
        .from('ktm_settings')
        .select('value')
        .eq('key', 'balancer_forbidden_pairs')
        .maybeSingle();
      const pairs = setting?.value;
      if (Array.isArray(pairs)) {
        ctx.forbiddenPairs = pairs.filter((p: any) => Array.isArray(p) && p.length === 2);
      }
    } catch (e) {
      console.warn('[balancer] 禁止ペア設定の読み込みに失敗（制約なしで続行）:', e);
    }

    // 同チーム固定ペアをDB設定(ktm_settings)から読み込む(2026-08-08追加)。
    // forbiddenPairsと対になる設定で、balancer.tsのrequiredPairs制約に渡す。
    try {
      const { data: setting } = await supabase
        .from('ktm_settings')
        .select('value')
        .eq('key', 'balancer_required_pairs')
        .maybeSingle();
      const pairs = setting?.value;
      if (Array.isArray(pairs)) {
        ctx.requiredPairs = pairs.filter((p: any) => Array.isArray(p) && p.length === 2);
      }
    } catch (e) {
      console.warn('[balancer] 同チーム固定ペア設定の読み込みに失敗（制約なしで続行）:', e);
    }

    try {
      // 直近15試合を取得（サイド履歴用には広く、対面履歴用には直近のみ使うため）
      const { data: recentMatches } = await supabase
        .from('ktm_matches')
        .select('id, winning_team, team_red_win')
        .order('created_at', { ascending: false })
        .limit(15);

      if (recentMatches && recentMatches.length > 0) {
        const matchIds = recentMatches.map((m: any) => m.id);
        const recent5MatchIds = recentMatches.slice(0, 5).map((m: any) => m.id);

        const { data: participantsHistory } = await supabase
          .from('ktm_match_participants')
          .select('match_id, player_name, role, team') // discord_id ではなく player_name を取得
          .in('match_id', matchIds);

        if (participantsHistory) {
          const pByMatchId: Record<number, any[]> = {};
          participantsHistory.forEach((ph: any) => {
            if (!pByMatchId[ph.match_id]) pByMatchId[ph.match_id] = [];
            pByMatchId[ph.match_id].push(ph);
          });

          // 直近2連勝した5人を特定するロジック (winStreakTeam)
          if (recentMatches && recentMatches.length >= 2) {
            const m1 = recentMatches[0];
            const m2 = recentMatches[1];
            const wTeam1 = m1.winning_team || (m1.team_red_win ? 'RED' : 'BLUE');
            const wTeam2 = m2.winning_team || (m2.team_red_win ? 'RED' : 'BLUE');

            const parts1 = pByMatchId[m1.id] || [];
            const parts2 = pByMatchId[m2.id] || [];

            const winners1 = parts1.filter((p: any) => p.team === wTeam1).map((p: any) => p.player_name).filter(Boolean);
            const winners2 = parts2.filter((p: any) => p.team === wTeam2).map((p: any) => p.player_name).filter(Boolean);

            if (winners1.length === 5 && winners2.length === 5) {
              const set1 = new Set(winners1);
              const isSame = winners2.every((name: any) => set1.has(name));
              if (isSame) {
                ctx.winStreakTeam = set1;
              }
            }
          }

          for (const matchId of matchIds) {
            const matchParts = pByMatchId[matchId] || [];
            
            // Side History の構築 (直近15試合すべてを使用、player_nameベース)
            matchParts.forEach((p: any) => {
              const pName = p.player_name;
              if (!pName) return;
              if (!ctx.sideHistory[pName]) ctx.sideHistory[pName] = { BLUE: 0, RED: 0 };
              if (p.team === 'BLUE') ctx.sideHistory[pName].BLUE++;
              if (p.team === 'RED') ctx.sideHistory[pName].RED++;
            });

            // Teammate History & Matchup History の構築 (直近5試合のみ使用、player_nameベース)
            if (recent5MatchIds.includes(matchId)) {
              for (let i = 0; i < matchParts.length; i++) {
                const p1 = matchParts[i];
                const p1Name = p1.player_name;
                if (!p1Name) continue;

                for (let j = i + 1; j < matchParts.length; j++) {
                  const p2 = matchParts[j];
                  const p2Name = p2.player_name;
                  if (!p2Name) continue;

                  if (p1.team === p2.team) {
                    const key1 = `${p1Name}<=>${p2Name}`;
                    const key2 = `${p2Name}<=>${p1Name}`;
                    ctx.teammateHistory.set(key1, (ctx.teammateHistory.get(key1) || 0) + 1);
                    ctx.teammateHistory.set(key2, (ctx.teammateHistory.get(key2) || 0) + 1);
                  } else {
                    if (p1.role === p2.role) {
                      const matchupHistKey = [p1Name, p2Name].sort().join("<=>") + ":" + p1.role;
                      ctx.history.add(matchupHistKey);
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("履歴取得エラー:", e);
    }

    // 5. 各選抜パターンについてバランス実行
    const proposalsGrouped: Record<string, any[]> = {
      'A': [],
      'B': [],
      'C': [],
      'D': [],
      'E': []
    };

    // BL-02: 探索強度（40=速い/100=標準/200=精密）をリクエストから受け取る
    ctx.searchDepth = [40, 100, 200].includes(Number(body.searchDepth)) ? Number(body.searchDepth) : 100;

    for (const pattern of selectedPatterns) {
      const proposalsForPattern = coreBalanceProposals(pattern.selected, ctx);
      
      const spectatorNames = pattern.spectators.map(p => p.name);
      proposalsForPattern.forEach(prop => {
        prop.spectators = spectatorNames;
        if (proposalsGrouped[prop.id]) {
          proposalsGrouped[prop.id].push(prop);
        }
      });
    }

    // 6. 各コンセプト（A, B, C, D, E）ごとに最も良い提案を1つずつ抽出
    const finalProposals: any[] = [];
    const seenSignatures = new Set<string>();

    const sortProposals = (list: any[]) => {
      list.sort((a, b) => {
        const diffA = Math.abs(a.mmrDiff);
        const diffB = Math.abs(b.mmrDiff);
        if (Math.abs(diffA - diffB) > 50) {
          return diffA - diffB;
        }
        const mainA = a.teamBlue.filter((p: any) => p.currentRole === p.mainLane).length +
                      a.teamRed.filter((p: any) => p.currentRole === p.mainLane).length;
        const mainB = b.teamBlue.filter((p: any) => p.currentRole === p.mainLane).length +
                      b.teamRed.filter((p: any) => p.currentRole === p.mainLane).length;
        if (mainB !== mainA) {
          return mainB - mainA;
        }
        return diffA - diffB;
      });
    };

    const conceptIds = ['A', 'B', 'C', 'D', 'E'];
    conceptIds.forEach(id => {
      const group = proposalsGrouped[id] || [];
      sortProposals(group);
      
      for (const prop of group) {
        const blueNames = prop.teamBlue.map((p: any) => p.name).sort().join(',');
        const redNames = prop.teamRed.map((p: any) => p.name).sort().join(',');
        const sig = [blueNames, redNames].sort().join('<=>');
        
        const sigWithId = `${id}:${sig}`;
        if (!seenSignatures.has(sigWithId)) {
          seenSignatures.add(sigWithId);
          finalProposals.push(prop);
          break; // 1つ選出できたので、次のグループへ
        }
      }
    });

    // ID順にソート（A, B, C, D, Eの順）
    finalProposals.sort((a, b) => a.id.localeCompare(b.id));

    // 7. レート格差判定（環境分析のシビア化）
    let analysisData = null;
    if (selectedPatterns.length > 0 && selectedPatterns[0].selected.length === 10) {
      const selectedPlayers = selectedPatterns[0].selected;
      const mmrs = selectedPlayers.map(p => {
        if (p.avgMMR !== undefined) return p.avgMMR;
        const mainRole = p.pref1 as Role;
        const hasMainRole = mainRole && ['TOP', 'JG', 'MID', 'ADC', 'SUP'].includes(mainRole);
        return hasMainRole ? p.rates[mainRole] : (Object.values(p.rates).reduce((s, v) => s + v, 0) / 5);
      });
      
      const sum = mmrs.reduce((s, v) => s + v, 0);
      const avg = Math.round(sum / 10);
      const min = Math.min(...mmrs);
      const max = Math.max(...mmrs);
      const range = max - min;
      
      let level = 'STANDARD';
      let message = 'ℹ️ 本日のレート差は標準的な範囲に収まっています。「案A（バランス）」または「案C（希望優先）」の採用がおすすめです。';
      
      if (range >= 500) {
        level = 'HIGH_DIFFERENCE';
        message = `⚠️ 本日は実力差（最大MMR差: ${range}）が大きく格差が発生しやすい環境です。対面戦力を平準化する「案B」、低レート層を優遇する「案D」、またはハンデを加味した「案E（ハンデ調整）」の採用を強く推奨します。`;
      } else if (range < 250) {
        level = 'CLOSE';
        message = `✨ 本日は実力差が非常に小さく（最大MMR差: ${range}）、白熱した接戦カードが期待できる日です。お好みのコンセプト案で自由に楽しめます！`;
      }
      
      analysisData = {
        averageMMR: avg,
        minMMR: min,
        maxMMR: max,
        mmrRange: range,
        level,
        message
      };
    }

    return NextResponse.json({ proposals: finalProposals, analysis: analysisData });

  } catch (error: any) {
    console.error('Balancer API Error:', error);
    return NextResponse.json({ error: error.message || '内部エラーが発生しました。' }, { status: 500 });
  }
}
