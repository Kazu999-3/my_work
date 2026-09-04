'use client';

import { useEffect, useState } from 'react';
import { History, RefreshCw, Trophy, Swords, Calendar } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { getChampIcon } from '../../lib/ddragonClient';
import { Spinner } from '../../components/Feedback';

interface MatchData {
  id: number;
  created_at: string;
  winning_team: 'BLUE' | 'RED';
  riot_match_id?: string | null;
  participants: {
    player_name: string;
    team: 'BLUE' | 'RED';
    role: string;
    champion_name: string;
    kills: number;
    deaths: number;
    assists: number;
    player_mmr?: number | null;
    mmr_breakdown?: any;
  }[];
  prediction?: {
    predicted_blue_winprob: number;
    correct: boolean;
  } | null;
}

export default function HistoryPage() {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [winFilter, setWinFilter] = useState<'ALL' | 'BLUE' | 'RED'>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    async function fetchHistory() {
      try {
        setFetchError(null);
        const res = await fetch('/api/match/history?limit=50&withPredictions=true');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '試合履歴の取得に失敗しました。');

        // データ整形
        const formatted = (data.matches as any[]).map(m => ({
          id: m.id,
          created_at: new Date(m.created_at).toLocaleString('ja-JP'),
          winning_team: m.winning_team,
          participants: m.participants,
          prediction: m.prediction
        }));
        setMatches(formatted);
      } catch (err: any) {
        console.error('Failed to fetch history:', err);
        setFetchError(err?.message || '試合履歴の取得に失敗しました。');
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-stone-900">
        <Spinner label="試合履歴を読み込み中..." />
      </div>
    );
  }

  // 絞り込み
  const filteredMatches = matches.filter(m => {
    // 勝敗フィルター
    if (winFilter !== 'ALL' && m.winning_team !== winFilter) return false;

    // ロールフィルター
    if (roleFilter !== 'ALL') {
      const hasRole = m.participants.some(p => p.role === roleFilter);
      if (!hasRole) return false;
    }

    // 検索クエリ
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return m.participants.some(p => 
      p.player_name?.toLowerCase().includes(q) || 
      p.champion_name?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredMatches.length / PAGE_SIZE));
  const paginatedMatches = filteredMatches.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleFilterChange = (setter: any, val: any) => {
    setter(val);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-background text-stone-800 p-4 md:p-8">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* 戻るリンク ＆ アナリティクス・コーチリンク */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-stone-600 hover:text-stone-900 font-bold text-xs shadow-2xs hover:bg-stone-50 transition"
          >
            <span>←</span>
            <span>ポータルトップへ戻る</span>
          </Link>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/coach?tab=postgame"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 font-bold text-xs shadow-2xs transition"
            >
              <span>⚡</span>
              <span>1分ソロQ振り返り</span>
            </Link>
            <Link
              href="/history/analytics"
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-xs shadow-sm transition"
            >
              <span>👑 集団戦ディープアナリティクスを見る</span>
            </Link>
          </div>
        </div>

        {/* ヘッダー ＆ 検索 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border pb-4 gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-stone-900 flex items-center gap-2.5">
              <History className="h-7 w-7 text-primary" />
              過去の試合履歴
            </h1>
            <p className="text-stone-500 mt-1 text-xs font-bold">
              直近のカスタム対戦結果 ＆ レーン別対決詳細 ⚔️
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full sm:w-auto">
            <input
              type="text"
              placeholder="名前・チャンピオンで検索..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="bg-white border border-stone-300 text-stone-900 text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-primary flex-1 min-w-0 sm:w-64 shadow-xs"
            />
            <Link
              href="/balancer/record"
              className="flex items-center gap-2 bg-primary hover:bg-accent text-white px-4 py-2.5 rounded-xl font-bold transition text-xs shadow-xs shrink-0"
            >
              <Trophy className="h-4 w-4" />
              <span>戦績の手動記録 🏆</span>
            </Link>
          </div>
        </div>

        {/* 🏷️ 多角フィルターバー (勝敗 ＆ ロール) */}
        <div className="bg-white border border-stone-200/90 rounded-2xl p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* 勝敗フィルター */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-stone-500 font-bold text-[11px] mr-1">勝敗:</span>
            {(['ALL', 'BLUE', 'RED'] as const).map(w => (
              <button
                key={w}
                type="button"
                onClick={() => handleFilterChange(setWinFilter, w)}
                className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition cursor-pointer ${
                  winFilter === w
                    ? w === 'BLUE'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : w === 'RED'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-stone-800 text-white shadow-2xs'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                }`}
              >
                {w === 'ALL' ? 'すべて' : w === 'BLUE' ? '🟦 BLUE勝利' : '🟥 RED勝利'}
              </button>
            ))}
          </div>

          {/* ロールフィルター */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-stone-500 font-bold text-[11px] mr-1">レーン:</span>
            {(['ALL', 'TOP', 'JG', 'MID', 'ADC', 'SUP'] as const).map(r => (
              <button
                key={r}
                type="button"
                onClick={() => handleFilterChange(setRoleFilter, r)}
                className={`px-2.5 py-1 rounded-lg font-black text-[11px] transition cursor-pointer ${
                  roleFilter === r
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                }`}
              >
                {r === 'ALL' ? '全レーン' : r}
              </button>
            ))}
          </div>

          {/* 件数バッジ */}
          <div className="text-[11px] font-bold text-stone-500 ml-auto">
            該当: <span className="text-stone-900 font-black font-mono">{filteredMatches.length}</span> 件
          </div>
        </div>

        <div className="space-y-6">
          {fetchError ? (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-8 text-center font-bold">
              試合履歴の取得中にエラーが発生しました: {fetchError}
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-3xl p-12 text-center text-stone-500 font-bold">
              {searchQuery || winFilter !== 'ALL' || roleFilter !== 'ALL' ? '条件に一致する試合が見つかりませんでした。' : 'まだ記録された試合がありません。'}
            </div>
          ) : (
            paginatedMatches.map(match => {
              const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
              const blueMap = new Map(match.participants.filter(p => p.team === 'BLUE').map(p => [p.role, p]));
              const redMap = new Map(match.participants.filter(p => p.team === 'RED').map(p => [p.role, p]));
              const rawId = String((match as any).id || '');
              const shortMatchId = rawId.length > 8 ? `#${rawId.slice(0, 8)}` : `#${rawId}`;

              const isExhibition = match.riot_match_id === 'EXHIBITION' || match.participants?.some((p: any) => p.mmr_breakdown?.isExhibition || p.mmr_breakdown?.note?.includes('お祭り'));

              return (
                <div key={match.id} className="bg-white border border-stone-200/90 rounded-3xl overflow-hidden shadow-xs hover:border-stone-300 transition-all">
                  <div className="bg-stone-50/80 px-4 py-3.5 md:px-6 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-stone-200 gap-2 md:gap-0 flex-wrap">
                    <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                      <span className="text-stone-900 font-extrabold text-xs md:text-sm bg-stone-200/70 px-2.5 py-1 rounded-lg">Match {shortMatchId}</span>
                      {isExhibition && (
                        <span className="text-[10px] font-black bg-amber-500 text-white px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shadow-2xs">
                          <span>🎪</span>
                          <span>お祭りエキシビション (戦績保護)</span>
                        </span>
                      )}
                      <span className="text-stone-500 flex items-center gap-1 text-xs font-medium"><Calendar className="w-3.5 h-3.5 text-stone-400"/> {match.created_at}</span>
                      {match.prediction && (
                        <div className="flex items-center gap-1.5 md:gap-2 text-xs bg-white px-2.5 py-1 rounded-xl border border-stone-200 text-stone-700 ml-0 md:ml-2 font-bold shadow-2xs">
                          <span className="text-stone-400 text-[10px]">予測勝率:</span>
                          <span className="text-blue-700 font-mono">🟦 {Math.round(match.prediction.predicted_blue_winprob * 100)}%</span>
                          <span className="text-stone-300">/</span>
                          <span className="text-rose-700 font-mono">🟥 {Math.round((1 - match.prediction.predicted_blue_winprob) * 100)}%</span>
                          <span className="ml-1">
                            {match.prediction.correct ? (
                              <span className="text-emerald-800 font-extrabold bg-emerald-100 px-1.5 py-0.5 rounded-md border border-emerald-300 text-[10px]">🎯 的中</span>
                            ) : (
                              <span className="text-rose-800 font-extrabold bg-rose-100 px-1.5 py-0.5 rounded-md border border-rose-300 text-[10px]">💀 不的中</span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] md:text-xs text-stone-400 font-bold">勝者:</span>
                      <span className={`font-extrabold px-2.5 py-0.5 md:px-3 md:py-1 rounded-xl text-xs whitespace-nowrap border ${match.winning_team === 'BLUE' ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-rose-100 text-rose-800 border-rose-300'}`}>
                        {match.winning_team === 'BLUE' ? '🟦 BLUE 勝利' : '🟥 RED 勝利'}
                      </span>
                    </div>
                  </div>
                  
                  {/* 対戦カードのヘッダー見出し */}
                  <div className="grid grid-cols-11 gap-1 md:gap-2 items-center py-2 px-2 md:px-4 bg-stone-100/60 border-b border-stone-200 text-xs font-black">
                    <div className="col-span-5 flex items-center justify-end gap-1.5 text-blue-700">
                      <span className="truncate">🟦 BLUE</span>
                      {match.winning_team === 'BLUE' && <span className="text-[10px] bg-blue-600 text-white px-1 py-0.2 rounded">WIN</span>}
                    </div>
                    <div className="col-span-1 text-center text-stone-400 text-[9px] md:text-[10px]">VS</div>
                    <div className="col-span-5 flex items-center justify-start gap-1.5 text-rose-700">
                      {match.winning_team === 'RED' && <span className="text-[10px] bg-rose-600 text-white px-1 py-0.2 rounded">WIN</span>}
                      <span className="truncate">RED 🟥</span>
                    </div>
                  </div>

                  {/* レーン直接対決テーブル */}
                  <div className="divide-y divide-stone-100 p-1 md:p-4">
                    {roles.map(role => {
                      const blueP = blueMap.get(role);
                      const redP = redMap.get(role);
                      return (
                        <div key={role} className="grid grid-cols-11 gap-1 md:gap-2 items-center py-1.5 md:py-2 px-1 md:px-2 hover:bg-stone-50 rounded-xl transition">
                          {/* BLUE 側 */}
                          <div className="col-span-5 flex items-center justify-end gap-1 md:gap-2 text-right overflow-hidden">
                            {blueP ? (
                              <>
                                <span className="font-mono text-xs bg-stone-100 px-1.5 py-0.5 rounded text-stone-600 font-bold hidden sm:inline">
                                  {blueP.kills}/{blueP.deaths}/{blueP.assists}
                                </span>
                                <span className="font-bold text-[11px] md:text-sm text-stone-900 truncate max-w-[65px] sm:max-w-[120px]">{blueP.player_name}</span>
                                {blueP.champion_name && (
                                  <Image
                                    src={getChampIcon(blueP.champion_name)}
                                    alt={blueP.champion_name}
                                    title={blueP.champion_name}
                                    width={28}
                                    height={28}
                                    className="w-5 h-5 md:w-7 md:h-7 rounded-full border border-blue-300 shrink-0"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                )}
                              </>
                            ) : <span className="text-stone-300 text-xs">-</span>}
                          </div>

                          {/* 中央レーンバッジ */}
                          <div className="col-span-1 text-center flex justify-center">
                            <span className="text-[8px] md:text-[10px] font-black px-1 md:px-2 py-0.5 rounded-full bg-stone-200/80 text-stone-700 border border-stone-300 inline-block leading-none">
                              {role}
                            </span>
                          </div>

                          {/* RED 側 */}
                          <div className="col-span-5 flex items-center justify-start gap-1 md:gap-2 text-left overflow-hidden">
                            {redP ? (
                              <>
                                {redP.champion_name && (
                                  <Image
                                    src={getChampIcon(redP.champion_name)}
                                    alt={redP.champion_name}
                                    title={redP.champion_name}
                                    width={28}
                                    height={28}
                                    className="w-5 h-5 md:w-7 md:h-7 rounded-full border border-rose-300 shrink-0"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                )}
                                <span className="font-bold text-[11px] md:text-sm text-stone-900 truncate max-w-[65px] sm:max-w-[120px]">{redP.player_name}</span>
                                <span className="font-mono text-xs bg-stone-100 px-1.5 py-0.5 rounded text-stone-600 font-bold hidden sm:inline">
                                  {redP.kills}/{redP.deaths}/{redP.assists}
                                </span>
                              </>
                            ) : <span className="text-stone-300 text-xs">-</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 📄 ページネーションコントロール */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-stone-200">
            <div className="text-xs font-bold text-stone-500">
              全 <span className="text-stone-900 font-black">{filteredMatches.length}</span> 件中 <span className="text-stone-900 font-black">{(currentPage - 1) * PAGE_SIZE + 1}〜{Math.min(currentPage * PAGE_SIZE, filteredMatches.length)}</span> 件を表示
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1.5 rounded-xl bg-white border border-stone-300 text-stone-700 hover:bg-stone-100 font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs"
              >
                ◀ 前へ
              </button>

              <div className="flex items-center gap-1 px-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCurrentPage(p)}
                    className={`w-7 h-7 rounded-lg font-black text-xs transition cursor-pointer ${
                      currentPage === p
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 rounded-xl bg-white border border-stone-300 text-stone-700 hover:bg-stone-100 font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs"
              >
                次へ ▶
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function PlayerRow({ p }: { p: any }) {
  return (
    <div className="flex items-center justify-between bg-white/70 p-2 rounded-lg border border-border hover:bg-black/5 transition">
      <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
        <span className="text-[10px] md:text-xs font-black text-stone-500 w-6 md:w-8 text-center">{p.role}</span>
        {p.champion_name ? (
          <Image
            src={getChampIcon(p.champion_name)}
            alt={p.champion_name}
            title={p.champion_name}
            width={32}
            height={32}
            className="w-6 h-6 md:w-8 md:h-8 rounded-full border border-border shadow-sm flex-shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-black/5 border border-border flex items-center justify-center text-[10px] md:text-xs text-stone-500 flex-shrink-0">?</div>
        )}
        <span className="font-bold text-stone-800 text-xs md:text-sm truncate mr-2">{p.player_name}</span>
        <span className="text-[10px] font-mono bg-surface text-stone-400 px-1.5 py-0.5 rounded border border-border mr-2 flex-shrink-0">
          {p.player_mmr ? `MMR: ${p.player_mmr}` : 'MMR: -'}
        </span>
      </div>
      <div className="flex items-center flex-shrink-0">
        <span className="font-mono text-xs md:text-sm tracking-tighter bg-surface px-1.5 md:px-2 py-0.5 md:py-1 rounded">
          <span className="text-emerald-700 font-bold">{p.kills}</span>
          <span className="text-stone-500 px-0.5">/</span>
          <span className="text-red-700 font-bold">{p.deaths}</span>
          <span className="text-stone-500 px-0.5">/</span>
          <span className="text-amber-700 font-bold">{p.assists}</span>
        </span>
      </div>
    </div>
  );
}

function getRoleWeight(role: string) {
  switch (role) {
    case 'TOP': return 1;
    case 'JG': return 2;
    case 'MID': return 3;
    case 'ADC': return 4;
    case 'SUP': return 5;
    default: return 9;
  }
}
