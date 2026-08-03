'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Trophy, Swords, Zap, Activity, ShieldAlert, Award, Compass, RefreshCw, ChevronLeft, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { getChampIcon } from '../../../lib/ddragonClient';

// ==========================================
// Types
// ==========================================
interface PlayerInfo {
  name: string;
  discord_id: string;
  lol_ign: string;
  main_lane: string;
  sub_lane: string;
  pity: number;
  top_mmr: number | null;
  jg_mmr: number | null;
  mid_mmr: number | null;
  adc_mmr: number | null;
  sup_mmr: number | null;
  is_active: boolean;
}

interface MatchHistory {
  id: string;
  match_id: string;
  role: string;
  team: string;
  kills: number;
  deaths: number;
  assists: number;
  kda_score: number;
  mmr_delta: number;
  created_at: string;
  champion_name: string;
  matches: {
    winning_team: string;
    game_duration: number;
  };
  opponent_champion?: string; // 対面相手のチャンピオン
}

interface NemesisStat {
  championName: string;
  games: number;
  losses: number;
  winRate: number;
}

interface PageProps {
  params: Promise<{ discord_id: string }>;
}

export default function PlayerStatsPage({ params }: PageProps) {
  const unwrappedParams = use(params);
  const discordId = unwrappedParams.discord_id;
  
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [history, setHistory] = useState<MatchHistory[]>([]);
  const [nemesisList, setNemesisList] = useState<NemesisStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      if (!discordId) return;

      const res = await fetch(`/api/stats/discord?id=${encodeURIComponent(discordId)}`);
      const data = await res.json();

      if (!res.ok || !data.player) {
        setError('プレイヤーが見つかりませんでした。');
        setLoading(false);
        return;
      }

      setPlayer(data.player);
      setHistory(data.history || []);
      setNemesisList(data.nemesisList || []);
      setLoading(false);
    }

    fetchStats();
  }, [discordId]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-background">
        <RefreshCw className="w-8 h-8 animate-spin text-[#c89b3c] mb-4" />
        <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">スタッツをスキャン中...</span>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="flex-1 min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="glass-panel border border-red-500/20 p-8 rounded-3xl max-w-md w-full text-center space-y-6">
          <div className="text-5xl text-red-500 flex justify-center"><ShieldAlert className="w-12 h-12" /></div>
          <h1 className="text-xl font-extrabold text-stone-900">エラーが発生しました</h1>
          <p className="text-gray-400 text-sm leading-relaxed">{error}</p>
          <Link href="/leaderboard" className="px-6 py-2.5 bg-stone-100 border border-black/10 text-stone-700 rounded-xl hover:bg-[#c89b3c] hover:text-black font-bold transition-all text-xs inline-block">
            リーダーボードに戻る
          </Link>
        </div>
      </div>
    );
  }

  // ==========================================
  // 統計データの算出
  // ==========================================
  const totalGames = history.length;
  const wins = history.filter(h => h.team === h.matches.winning_team).length;
  const losses = totalGames - wins;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  const totalKills = history.reduce((sum, h) => sum + h.kills, 0);
  const totalDeaths = history.reduce((sum, h) => sum + h.deaths, 0);
  const totalAssists = history.reduce((sum, h) => sum + h.assists, 0);

  const avgKills = totalGames > 0 ? (totalKills / totalGames).toFixed(1) : '0.0';
  const avgDeaths = totalGames > 0 ? (totalDeaths / totalGames).toFixed(1) : '0.0';
  const avgAssists = totalGames > 0 ? (totalAssists / totalGames).toFixed(1) : '0.0';
  const avgKda = totalDeaths > 0 
    ? ((totalKills + totalAssists) / totalDeaths).toFixed(2) 
    : (totalKills + totalAssists).toFixed(2);

  // 連勝・連敗数 (Streak)
  let streakCount = 0;
  let streakType: 'WIN' | 'LOSS' | null = null;
  if (history.length > 0) {
    const firstIsWin = history[0].team === history[0].matches.winning_team;
    streakType = firstIsWin ? 'WIN' : 'LOSS';
    for (let i = 0; i < history.length; i++) {
      const isWin = history[i].team === history[i].matches.winning_team;
      if (isWin === firstIsWin) {
        streakCount++;
      } else {
        break;
      }
    }
  }

  // モストプレイチャンピオン Top3
  interface ChampStat {
    championName: string;
    games: number;
    wins: number;
    kills: number;
    deaths: number;
    assists: number;
  }
  const champMap: Record<string, ChampStat> = {};
  history.forEach(h => {
    const isWin = h.team === h.matches.winning_team;
    if (!champMap[h.champion_name]) {
      champMap[h.champion_name] = {
        championName: h.champion_name,
        games: 0,
        wins: 0,
        kills: 0,
        deaths: 0,
        assists: 0
      };
    }
    const stat = champMap[h.champion_name];
    stat.games += 1;
    if (isWin) stat.wins += 1;
    stat.kills += h.kills;
    stat.deaths += h.deaths;
    stat.assists += h.assists;
  });

  const sortedMostPlayed = Object.values(champMap)
    .sort((a, b) => b.games - a.games || b.wins - a.wins)
    .slice(0, 3);

  // レーン別の総試合数と勝率を計算（直近20戦の簡易集計）
  const roleStats: Record<string, { games: number; wins: number }> = {
    TOP: { games: 0, wins: 0 },
    JG: { games: 0, wins: 0 },
    MID: { games: 0, wins: 0 },
    ADC: { games: 0, wins: 0 },
    SUP: { games: 0, wins: 0 },
  };

  history.forEach(h => {
    const isWin = h.team === h.matches.winning_team;
    if (roleStats[h.role]) {
      roleStats[h.role].games += 1;
      if (isWin) roleStats[h.role].wins += 1;
    }
  });

  function getKdaColor(kdaVal: number): string {
    if (kdaVal >= 4.5) return 'text-[#c89b3c] drop-shadow-[0_0_8px_rgba(200,155,60,0.5)]'; // レジェンダリーゴールド
    if (kdaVal >= 3.5) return 'text-[#a855f7] drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]'; // エピックパープル
    if (kdaVal >= 2.5) return 'text-[#3b82f6]'; // レアブルー
    return 'text-gray-400';
  }

  return (
    <div className="flex-1 min-h-screen bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-surface-hover via-background to-[#e2dabf] text-foreground py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* ナビゲーション */}
        <div className="flex justify-between items-center">
          <Link 
            href="/leaderboard" 
            className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-900 bg-black/5 px-3 py-1.5 rounded-xl border border-black/10 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>リーダーボードへ戻る</span>
          </Link>
        </div>

        {/* ヘッダー・プロフィール */}
        <div className="glass-panel border border-black/10 rounded-3xl overflow-hidden relative shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
          {/* 🎨 機能 5: モストチャンプのスプラッシュ背景ヘッダー */}
          <div 
            className="h-36 relative bg-cover bg-center border-b border-black/10"
            style={{
              backgroundImage: sortedMostPlayed[0] ? `url(https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${sortedMostPlayed[0].championName}_0.jpg)` : undefined
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-[#0d0f16] via-black/60 to-black/30"></div>
          </div>
          <div className="px-6 sm:px-10 pb-8 relative">
            <div className="flex flex-col sm:flex-row items-center sm:items-end -mt-14 sm:-mt-12 gap-6 mb-6">
              <div className="w-24 h-24 bg-white p-1 rounded-2xl border-2 border-[#c89b3c] shadow-[0_0_20px_rgba(200,155,60,0.3)] flex-shrink-0 flex items-center justify-center text-4xl overflow-hidden relative group">
                {sortedMostPlayed[0] ? (
                  <Image src={getChampIcon(sortedMostPlayed[0].championName)} alt={sortedMostPlayed[0].championName} fill className="object-cover rounded-xl" />
                ) : (
                  <span>👤</span>
                )}
              </div>
              <div className="text-center sm:text-left flex-grow space-y-1">
                <h1 className="text-3xl font-extrabold text-stone-900 flex items-center justify-center sm:justify-start gap-2">
                  <span>{player.name}</span>
                </h1>
                <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                  <span className="bg-black/5 border border-black/10 text-gold px-3 py-1 rounded-lg text-xs font-mono font-bold tracking-wider">
                    {player.lol_ign || 'IGN未登録'}
                  </span>
                  {player.is_active ? (
                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded border border-emerald-200 uppercase tracking-widest">Active</span>
                  ) : (
                    <span className="text-[10px] font-black text-gray-400 bg-black/5 px-2.5 py-0.5 rounded border border-black/10 uppercase tracking-widest">Inactive</span>
                  )}
                </div>

                {/* 🤖 機能 3: 週刊 AI アナリストプロファイル (7日間キャッシュ) */}
                <div className="bg-[#c89b3c]/10 border border-[#c89b3c]/30 p-3 rounded-xl mt-3 flex items-start gap-2 max-w-xl">
                  <Sparkles className="text-[#c89b3c] shrink-0 mt-0.5" size={14} />
                  <div className="text-xs text-amber-200 font-medium leading-relaxed text-left">
                    {(player as any)?.metadata?.ai_profile || `『${player.name} の直近戦績からプレイスタイルを分析中... 次回の定期アナリティクスで週刊プロファイルが生成されます！』`}
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="bg-black/5 px-4 py-2 rounded-2xl border border-black/10 text-center">
                  <div className="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-wider">メイン希望</div>
                  <div className="font-bold text-[#c89b3c] text-sm">{player.main_lane}</div>
                </div>
                <div className="bg-black/5 px-4 py-2 rounded-2xl border border-black/10 text-center">
                  <div className="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-wider">サブ希望</div>
                  <div className="font-bold text-stone-700 text-sm">{player.sub_lane || '-'}</div>
                </div>
                <div className="bg-orange-500/10 px-4 py-2 rounded-2xl border border-orange-500/20 text-center">
                  <div className="text-[10px] text-orange-600 font-bold mb-1 uppercase tracking-wider">不運度 PITY</div>
                  <div className="font-bold text-orange-600 text-sm">{player.pity}</div>
                </div>
              </div>
            </div>

            {/* 🎮 機能 2 & 📊 勝ちパターン分析 & Hextech 5軸レーダーチャート */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
              {/* 勝ちパターン分析 (2列) */}
              <div className="lg:col-span-2 bg-black/5 border border-[#c89b3c]/30 p-5 rounded-2xl relative overflow-hidden shadow-[0_0_20px_rgba(200,155,60,0.1)]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-black text-[#c89b3c] flex items-center gap-1.5 uppercase tracking-wider">
                    <Award size={16} /> 📊 勝ちパターン分析 (Victory Blueprint)
                  </h3>
                  <span className="text-[9px] font-mono text-gray-400 bg-black/5 px-2 py-0.5 rounded border border-black/10">AIアナリティクス</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-black/5 border border-black/10 p-3 rounded-xl flex items-center gap-3">
                    {sortedMostPlayed[0] ? (
                      <>
                        <Image src={getChampIcon(sortedMostPlayed[0].championName)} alt={sortedMostPlayed[0].championName} width={40} height={40} className="w-10 h-10 rounded-xl border border-[#c89b3c] shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[9px] text-gray-400 font-bold uppercase truncate">👑 勝負チャンプ</div>
                          <div className="text-xs font-black text-stone-900 truncate">{sortedMostPlayed[0].championName}</div>
                          <div className="text-[10px] font-mono text-[#c89b3c]">勝率 {Math.round((sortedMostPlayed[0].wins / sortedMostPlayed[0].games) * 100)}% ({sortedMostPlayed[0].games}戦)</div>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-gray-400">データ蓄積中...</div>
                    )}
                  </div>
                  <div className="bg-black/5 border border-black/10 p-3 rounded-xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-lg shrink-0">🎯</div>
                    <div className="min-w-0">
                      <div className="text-[9px] text-gray-400 font-bold uppercase truncate">🎯 最高適性レーン</div>
                      <div className="text-xs font-black text-stone-900 truncate">{player.main_lane}</div>
                      <div className="text-[10px] font-mono text-indigo-600">期待勝率 {winRate}% ({totalGames}戦)</div>
                    </div>
                  </div>
                  <div className="bg-black/5 border border-black/10 p-3 rounded-xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-lg shrink-0">🔥</div>
                    <div className="min-w-0">
                      <div className="text-[9px] text-gray-400 font-bold uppercase truncate">⚡ 貢献スタイル</div>
                      <div className="text-xs font-black text-stone-900 truncate">{Number(avgKda) >= 3.0 ? '高KDAキャリー' : Number(avgAssists) >= 8.0 ? '集団戦エンゲージャー' : '主力ファイター'}</div>
                      <div className="text-[10px] font-mono text-emerald-600">KDA {avgKda} ({avgKills}/{avgDeaths}/{avgAssists})</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 🎮 機能 2: Hextech 5軸レーダーチャート (1列) */}
              <div className="bg-black/5 border border-indigo-500/30 p-4 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden">
                <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                  <Activity size={12} /> Hextech 能力パラメーター
                </div>
                {/* 5軸ステータス可視化プログラミング SVG */}
                {(() => {
                  const carry = Math.min(100, Math.round(Number(avgKills) * 10 + winRate * 0.5));
                  const teamfight = Math.min(100, Math.round(Number(avgAssists) * 9 + Number(avgKda) * 8));
                  const stability = Math.max(10, Math.min(100, Math.round(100 - Number(avgDeaths) * 12)));
                  const pool = Math.min(100, Math.round((sortedMostPlayed.length || 1) * 20));
                  const luck = Math.min(100, Math.round(player.pity * 20 + 30));

                  return (
                    <div className="w-full h-32 flex items-center justify-center relative">
                      <svg viewBox="0 0 100 100" className="w-28 h-28 overflow-visible">
                        <polygon points="50,10 90,38 75,82 25,82 10,38" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                        <polygon points="50,25 75,44 67,70 33,70 25,44" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
                        {/* データポリゴン */}
                        <polygon 
                          points={`
                            ${50},${50 - (carry * 0.4)}, 
                            ${50 + (teamfight * 0.4)},${50 - (teamfight * 0.12)}, 
                            ${50 + (stability * 0.25)},${50 + (stability * 0.32)}, 
                            ${50 - (pool * 0.25)},${50 + (pool * 0.32)}, 
                            ${50 - (luck * 0.4)},${50 - (luck * 0.12)}
                          `} 
                          fill="rgba(99, 102, 241, 0.3)" 
                          stroke="#6366f1" 
                          strokeWidth="1.5" 
                        />
                      </svg>
                      <span className="absolute top-0 text-[8px] font-mono text-gray-400">キャリー ({carry})</span>
                      <span className="absolute right-0 top-6 text-[8px] font-mono text-gray-400">集団戦 ({teamfight})</span>
                      <span className="absolute right-2 bottom-1 text-[8px] font-mono text-gray-400">安定度 ({stability})</span>
                      <span className="absolute left-2 bottom-1 text-[8px] font-mono text-gray-400">プール ({pool})</span>
                      <span className="absolute left-0 top-6 text-[8px] font-mono text-gray-400">運 ({luck})</span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* MMR 一覧 */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 border-t border-black/10 pt-6">
              {[
                { role: 'TOP', icon: '🛡️', mmr: player.top_mmr },
                { role: 'JG', icon: '⚔️', mmr: player.jg_mmr },
                { role: 'MID', icon: '🧙', mmr: player.mid_mmr },
                { role: 'ADC', icon: '🏹', mmr: player.adc_mmr },
                { role: 'SUP', icon: '🩹', mmr: player.sup_mmr },
              ].map(r => (
                <div key={r.role} className="bg-black/5 border border-black/10 rounded-2xl p-4 text-center space-y-1">
                  <div className="text-xs font-bold text-gray-400 mb-1 flex justify-center items-center gap-1.5">
                    <span>{r.icon}</span> {r.role}
                  </div>
                  <div className="text-2xl font-black text-stone-900">{(r.mmr ?? 1200).toLocaleString()}</div>
                  {roleStats[r.role].games > 0 && (
                    <div className="text-[10px] text-gray-500 font-mono">
                      {roleStats[r.role].games}戦 Win:{Math.round((roleStats[r.role].wins / roleStats[r.role].games) * 100)}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 【NEW】直近20戦 総合戦績サマリーパネル */}
        <div className="glass-panel border border-black/10 rounded-3xl p-6 shadow-xl space-y-5 bg-gradient-to-r from-black/2 via-transparent to-black/2">
          <div className="flex items-center justify-between border-b border-black/10 pb-3">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Award className="w-4 h-4 text-[#c89b3c]" />
              <span>直近 {totalGames} 試合の総合スタッツ</span>
            </h2>
            {streakCount > 0 && streakType && (
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded border uppercase tracking-wider animate-pulse ${
                streakType === 'WIN' 
                  ? 'text-emerald-700 bg-emerald-100 border-emerald-200'
                  : 'text-rose-700 bg-rose-100 border-rose-200'
              }`}>
                🔥 {streakCount} {streakType === 'WIN' ? '連勝中' : '連敗中'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* 勝率円形サマリー */}
            <div className="flex items-center gap-4 bg-black/3 p-4 rounded-2xl border border-black/10">
              <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-black/10"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={winRate >= 50 ? 'text-blue-500' : 'text-red-500'}
                    strokeDasharray={`${winRate}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute font-mono font-black text-sm text-stone-900">{winRate}%</div>
              </div>
              <div>
                <div className="text-xl font-black text-stone-900">{wins}勝 {losses}敗</div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">勝敗比率 (Winrate)</div>
              </div>
            </div>

            {/* 平均KDA */}
            <div className="bg-black/3 p-4 rounded-2xl border border-black/10 space-y-1">
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">平均KDAスコア</div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-black font-mono ${getKdaColor(parseFloat(avgKda))}`}>
                  {avgKda}
                </span>
                <span className="text-xs text-gray-400 font-mono">
                  ({avgKills} / <span className="text-red-600">{avgDeaths}</span> / {avgAssists})
                </span>
              </div>
            </div>

            {/* 勝敗傾向ドット */}
            <div className="bg-black/3 p-4 rounded-2xl border border-black/10 space-y-2">
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">直近の勝敗トレンド</div>
              <div className="flex flex-wrap gap-1.5">
                {history.slice(0, 20).reverse().map((h, i) => {
                  const isWin = h.team === h.matches.winning_team;
                  return (
                    <div
                      key={h.id || i}
                      className={`w-3.5 h-3.5 rounded border transition-all duration-300 ${
                        isWin 
                          ? 'bg-blue-500 border-blue-400/50 shadow-[0_0_8px_rgba(59,130,246,0.6)]' 
                          : 'bg-red-600 border-red-500/50 shadow-[0_0_8px_rgba(220,38,38,0.6)]'
                      }`}
                      title={isWin ? 'WIN' : 'LOSS'}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 下部 2カラムレイアウト */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          
          {/* 左カラム: 苦手チャンピオン ＆ モストプレイチャンピオン */}
          <div className="md:col-span-1 space-y-6">
            
            {/* 使用チャンピオン Top3 */}
            <div className="space-y-3">
              <h2 className="text-sm font-black text-[#c89b3c] uppercase tracking-widest flex items-center gap-2 px-1">
                <Compass className="w-4 h-4" />
                <span>得意チャンピオンプール (モスト3)</span>
              </h2>
              <div className="glass-panel border border-black/10 rounded-3xl p-5 space-y-4 shadow-lg bg-gradient-to-b from-black/2 to-transparent">
                {sortedMostPlayed.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 text-xs">使用したチャンピオンのデータはありません</div>
                ) : (
                  <div className="space-y-3">
                    {sortedMostPlayed.map((c, i) => {
                      const cWinRate = Math.round((c.wins / c.games) * 100);
                      const cAvgKills = (c.kills / c.games).toFixed(1);
                      const cAvgDeaths = (c.deaths / c.games).toFixed(1);
                      const cAvgAssists = (c.assists / c.games).toFixed(1);
                      const cKda = c.deaths > 0 ? ((c.kills + c.assists) / c.deaths).toFixed(2) : (c.kills + c.assists).toFixed(2);
                      return (
                        <div key={c.championName} className="flex items-center gap-3 bg-black/5 border border-black/10 rounded-2xl p-3 relative overflow-hidden group">
                          {/* チャンピオンアイコン */}
                          <Image
                            src={getChampIcon(c.championName)}
                            alt={c.championName}
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-xl border border-black/10 shrink-0"
                          />
                          <div className="space-y-1 flex-grow">
                            <div className="flex justify-between items-center">
                              <span className="font-extrabold text-xs text-stone-900">{c.championName}</span>
                              <span className="text-[9px] text-gray-500 font-mono">{c.games}戦</span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] font-mono">
                              <span className={cWinRate >= 60 ? 'text-emerald-600 font-bold' : cWinRate <= 40 ? 'text-rose-600' : 'text-amber-600'}>
                                勝率 {cWinRate}%
                              </span>
                              <span className={getKdaColor(parseFloat(cKda))}>
                                KDA {cKda}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 苦手対面チャンピオン */}
            <div className="space-y-3">
              <h2 className="text-sm font-black text-red-700 uppercase tracking-widest flex items-center gap-2 px-1">
                <ShieldAlert className="w-4 h-4" />
                <span>対面要注意チャンプ (苦手ワースト3)</span>
              </h2>
              <div className="glass-panel border border-black/10 rounded-3xl p-5 space-y-4 shadow-lg bg-gradient-to-b from-black/2 to-transparent">
                {nemesisList.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 text-xs">要注意チャンプのデータはありません</div>
                ) : (
                  <div className="space-y-3">
                    {nemesisList.map((n, i) => (
                      <div key={n.championName} className="flex items-center gap-3 bg-black/5 border border-black/10 rounded-2xl p-3 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 px-2 py-0.5 bg-red-100 border-l border-b border-red-200 text-[8px] font-black text-red-700 tracking-wider uppercase">
                          worst {i+1}
                        </div>

                        {/* チャンピオンアイコン */}
                        <Image
                          src={getChampIcon(n.championName)}
                          alt={n.championName}
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded-xl border border-black/10 shrink-0"
                        />

                        {/* 統計 */}
                        <div className="space-y-0.5 flex-grow">
                          <div className="font-extrabold text-xs text-stone-900">{n.championName}</div>
                          <div className="flex items-center justify-between text-[9px] text-gray-400 font-mono">
                            <span>対面: {n.games}戦 ({n.losses}敗)</span>
                            <span className="font-black text-red-600">勝率: {n.winRate}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 右カラム: 試合履歴 */}
          <div className="md:col-span-2 space-y-3">
            <h2 className="text-sm font-black text-stone-900 uppercase tracking-widest flex items-center gap-2 px-1">
              <Swords className="w-4 h-4 text-gray-400" />
              <span>直近の対戦履歴リスト (直近20戦)</span>
            </h2>
            <div className="glass-panel border border-black/10 rounded-3xl overflow-hidden shadow-lg divide-y divide-white/5">
              {history.length === 0 ? (
                <div className="p-10 text-center text-gray-500 text-xs">試合履歴がありません</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {history.map(h => {
                    const isWin = h.team === h.matches.winning_team;
                    const gameKda = parseFloat(h.kda_score?.toString() || '0');
                    return (
                      <div 
                        key={h.id} 
                        className={`p-4 sm:px-6 transition-all flex items-center justify-between gap-4 border-l-4 ${
                          isWin 
                            ? 'bg-blue-950/[0.04] hover:bg-blue-900/10 border-l-blue-500' 
                            : 'bg-red-950/[0.04] hover:bg-red-900/10 border-l-red-500'
                        }`}
                      >
                        {/* Win/Loss Badge */}
                        <div className="w-14 flex-shrink-0">
                          {isWin ? (
                            <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 font-black text-center py-0.5 rounded-lg text-[10px] tracking-widest">WIN</div>
                          ) : (
                            <div className="bg-red-100 border border-red-200 text-red-700 font-black text-center py-0.5 rounded-lg text-[10px] tracking-widest">LOSS</div>
                          )}
                        </div>

                        {/* Champion & Role & Opponent */}
                        <div className="flex-grow flex items-center gap-3.5 min-w-0">
                          <Image
                            src={getChampIcon(h.champion_name)}
                            alt={h.champion_name}
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-xl border border-black/10 shrink-0 hidden sm:block shadow-md"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-extrabold text-sm text-stone-900 truncate">{h.champion_name}</span>
                              <span className="text-[9px] font-black text-gray-400 bg-black/5 border border-black/10 px-1.5 py-0.5 rounded uppercase tracking-wider">{h.role}</span>
                            </div>
                            <div className="text-[10px] text-gray-400 truncate">
                              {h.opponent_champion ? (
                                <span className="flex items-center gap-1">
                                  対面: <span className="font-extrabold text-red-600">{h.opponent_champion}</span>
                                </span>
                              ) : (
                                <span className="text-gray-600">対面情報なし</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* KDA */}
                        <div className="text-center px-4 border-l border-r border-black/10 min-w-[110px] shrink-0">
                          <div className="text-xs font-mono text-stone-700 font-bold mb-0.5 tracking-wide">
                            {h.kills} / <span className="text-red-600">{h.deaths}</span> / {h.assists}
                          </div>
                          <div className={`text-[9px] font-mono font-black ${getKdaColor(gameKda)}`}>
                            KDA: {h.kda_score || '-'}
                          </div>
                        </div>

                        {/* MMR Delta */}
                        <div className="w-16 text-right flex-shrink-0">
                          <div className={`text-sm font-black font-mono ${h.mmr_delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {h.mmr_delta >= 0 ? '+' : ''}{h.mmr_delta}
                          </div>
                          <div className="text-[8px] text-gray-500 font-bold tracking-wider uppercase">MMR</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
