import { useEffect, useState } from 'react';
import { toast } from '../../components/Toaster';
import { History, Swords, Trophy, Calendar, RefreshCw, Edit, Trash2, Search, AlertCircle, X, Target, GripVertical } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getChampIcon } from '../../lib/ddragonClient';
import type { MmrBreakdown } from '../../lib/mmr';

interface Match {
  id: string;
  created_at: string;
  winning_team: 'BLUE' | 'RED';
  participants: Participant[];
}

interface Participant {
  player_name: string;
  team: 'BLUE' | 'RED';
  role: string;
  kills: number;
  deaths: number;
  assists: number;
  kda_score: number;
  mmr_delta: number;
  mmr_breakdown?: MmrBreakdown | null;
  champion_name?: string;
  cs?: number;
  gold?: number | null;
  damage_dealt?: number;
  vision_score?: number;
}

function formatMmrBreakdown(b?: MmrBreakdown | null, delta?: number): string {
  if (!b) return delta !== undefined ? `MMR変動: ${delta > 0 ? '+' : ''}${delta}` : '';
  if ((b as any).isExhibition) return 'お祭りカスタム（戦績ノーカウント）: 変動0';
  if ((b as any).note) return (b as any).note;

  const parts: string[] = [];
  if (b.base !== undefined) {
    if (b.base > 0) parts.push(`勝利+${b.base}`);
    else if (b.base < 0) parts.push(`敗北${b.base}`);
    else parts.push('ベース0');
  }
  if (b.elo) {
    parts.push(`${b.elo > 0 ? '格上補正+' : '格下補正'}${b.elo}`);
  }
  if (b.wrAdjust) {
    parts.push(`高勝率補正${b.wrAdjust > 0 ? '+' : ''}${b.wrAdjust}`);
  }
  if (b.kda) {
    parts.push(`KDA+${b.kda}`);
  }
  if (b.dampener && b.dampener < 1.0) {
    parts.push(`対面減衰×${b.dampener}`);
  }
  if (b.placement) {
    parts.push('プレースメント×1.5');
  }
  if ((b as any).surrenderMitigated) {
    parts.push('早期投了緩和(-50%)');
  }
  parts.push(`計 ${b.final > 0 ? '+' : ''}${b.final ?? delta ?? 0}`);
  return parts.join(' / ');
}

const ROLES = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];

interface MatchHistoryPanelProps {
  isAdmin?: boolean;
}

export default function MatchHistoryPanel({ isAdmin: propIsAdmin }: MatchHistoryPanelProps = {}) {
  const [isAdmin, setIsAdmin] = useState(propIsAdmin ?? false);

  useEffect(() => {
    if (propIsAdmin !== undefined) {
      setIsAdmin(propIsAdmin);
      return;
    }
    fetch('/api/auth/verify', { method: 'POST', credentials: 'include' })
      .then(res => setIsAdmin(res.ok))
      .catch(() => setIsAdmin(false));
  }, [propIsAdmin]);

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 編集・削除用の追加ステート
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [tapSwapIndex, setTapSwapIndex] = useState<number | null>(null);
  const [draggedParticipantIndex, setDraggedParticipantIndex] = useState<number | null>(null);
  const [playersPool, setPlayersPool] = useState<{ name: string }[]>([]);
  const [championsList, setChampionsList] = useState<{ id: string, name: string }[]>([]);
  const [activeChampSelectorPlayer, setActiveChampSelectorPlayer] = useState<string | null>(null);
  const [champSearchQuery, setChampSearchQuery] = useState('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [playerFilter, setPlayerFilter] = useState('');
  // アコーディオン開閉状態（デフォルトで直近3試合を展開）
  const [expandedMatchIds, setExpandedMatchIds] = useState<Set<string>>(new Set());

  const fetchMatches = async () => {
    try {
      const res = await fetch('/api/match/history?limit=30');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '取得に失敗しました');

      setMatches(data.matches);
      // 直近3試合をデフォルトで展開
      if (data.matches && data.matches.length > 0) {
        const top3Ids = data.matches.slice(0, 3).map((m: Match) => m.id);
        setExpandedMatchIds(new Set(top3Ids));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleAccordion = (id: string) => {
    setExpandedMatchIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllAccordions = (expand: boolean) => {
    if (expand) {
      setExpandedMatchIds(new Set(matches.map(m => m.id)));
    } else {
      setExpandedMatchIds(new Set());
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  useEffect(() => {
    async function loadPlayersAndChamps() {
      try {
        const pRes = await fetch('/api/players/list');
        const pJson = await pRes.json();
        if (pRes.ok && pJson.players) {
          setPlayersPool(pJson.players);
        }

        const vRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
        const versions = await vRes.json();
        const cRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${versions[0]}/data/ja_JP/champion.json`);
        const d = await cRes.json();
        const list = Object.values(d.data).map((c: any) => ({
          id: c.id,
          name: c.name
        }));
        list.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        setChampionsList(list);
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    }
    loadPlayersAndChamps();
  }, []);

  const handleDeleteMatch = async (matchId: string) => {
    if (!confirm(`本当にこの試合 (Match #${matchId}) を削除しますか？\n(※削除後、名簿から「Rebuild」を実行してMMRを再計算するまで整合性は失われます)`)) return;
    
    try {
      const res = await fetch(`/api/admin/match/${matchId}`, {
        method: 'DELETE',
        credentials: 'include', // 管理者Cookieを送らないと401になる
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '削除に失敗しました');

      toast.success('試合履歴を削除しました。プレイヤーのMMRに反映させるために、必ず名簿タブの「Rebuild」を実行してください。');
      setActionMessage({ type: 'success', text: '試合履歴を削除しました。「Rebuild」を実行してください。' });
      fetchMatches();
    } catch (err: any) {
      toast.error(`削除エラー: ${err.message}`);
      setActionMessage({ type: 'error', text: `削除エラー: ${err.message}` });
    }
  };

  const handleSaveMatch = async () => {
    if (!editingMatch) return;
    setSaving(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/match/${editingMatch.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          winningTeam: editingMatch.winning_team,
          participants: editingMatch.participants
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '更新に失敗しました');

      toast.success('試合データを更新しました。プレイヤーのMMRに反映させるために、必ず名簿タブの「Rebuild」を実行してください。');
      setActionMessage({ type: 'success', text: '試合データを更新しました。「Rebuild」を実行してください。' });
      setEditingMatch(null);
      fetchMatches();
    } catch (err: any) {
      toast.error(`更新エラー: ${err.message}`);
      setActionMessage({ type: 'error', text: `更新エラー: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleEditingParticipantChange = (index: number, field: string, value: any) => {
    if (!editingMatch) return;
    setEditingMatch(prev => {
      if (!prev) return null;
      const nextParticipants = [...prev.participants];
      if (field === 'kills' || field === 'deaths' || field === 'assists' || field === 'cs') {
        nextParticipants[index] = { ...nextParticipants[index], [field]: parseInt(value) || 0 };
      } else if (field === 'gold') {
        // 空欄は「記録なし」（null）。0 とは区別する
        nextParticipants[index] = { ...nextParticipants[index], gold: value === '' ? null : (parseInt(value) || 0) };
      } else {
        nextParticipants[index] = { ...nextParticipants[index], [field]: value };
      }
      return { ...prev, participants: nextParticipants };
    });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedParticipantIndex(index);
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const rawIndex = e.dataTransfer.getData('text/plain');
    if (!rawIndex) return;
    swapParticipants(parseInt(rawIndex, 10), targetIndex);
  };

  // 「⠿ を押す → 入れ替えたい相手の ⠿ を押す」で入れ替える（2026-10-18）。
  // 行の大半が入力欄でドラッグを始めにくく、スマホではドラッグ自体が動かないため。
  const handleTapSwap = (index: number) => {
    if (tapSwapIndex === null) { setTapSwapIndex(index); return; }
    if (tapSwapIndex !== index) swapParticipants(tapSwapIndex, index);
    setTapSwapIndex(null);
  };

  const swapParticipants = (sourceIndex: number, targetIndex: number) => {
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;
    if (!editingMatch) return;

    const pStart = editingMatch.participants[sourceIndex];
    const pTarget = editingMatch.participants[targetIndex];

    // 同一チーム内のみスワップを許可する
    if (pStart.team !== pTarget.team) return;

    setEditingMatch(prev => {
      if (!prev) return null;
      const nextParticipants = [...prev.participants];

      // role と team 以外のデータをスワップ
      const updatedStart = {
        ...pStart,
        player_name: pTarget.player_name,
        champion_name: pTarget.champion_name,
        kills: pTarget.kills,
        deaths: pTarget.deaths,
        assists: pTarget.assists,
        kda_score: pTarget.kda_score,
        mmr_delta: pTarget.mmr_delta,
        mmr_breakdown: pTarget.mmr_breakdown,
        cs: pTarget.cs,
        gold: pTarget.gold,
        damage_dealt: pTarget.damage_dealt,
        vision_score: pTarget.vision_score
      };

      const updatedTarget = {
        ...pTarget,
        player_name: pStart.player_name,
        champion_name: pStart.champion_name,
        kills: pStart.kills,
        deaths: pStart.deaths,
        assists: pStart.assists,
        kda_score: pStart.kda_score,
        mmr_delta: pStart.mmr_delta,
        mmr_breakdown: pStart.mmr_breakdown,
        cs: pStart.cs,
        gold: pStart.gold,
        damage_dealt: pStart.damage_dealt,
        vision_score: pStart.vision_score
      };

      nextParticipants[sourceIndex] = updatedStart;
      nextParticipants[targetIndex] = updatedTarget;

      return { ...prev, participants: nextParticipants };
    });

    setDraggedParticipantIndex(null);
  };

  if (loading) {
    return <div className="py-20 flex flex-col items-center justify-center text-faint"><RefreshCw className="h-8 w-8 animate-spin text-primary-500 mb-4" />戦績データを読み込み中...</div>;
  }

  if (error) {
    return <div className="p-8 text-danger-700 font-bold bg-danger-100 rounded-xl border border-danger-edge-soft">Error: {error}</div>;
  }  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-success-100 rounded-xl">
          <History className="h-6 w-6 text-success-700" />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-foreground">直近の試合履歴</h2>
          <p className="text-faint font-medium text-sm">最新30件の試合結果とMMR変動履歴</p>
        </div>
      </div>

      {actionMessage && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${actionMessage.type === 'error' ? 'bg-danger-100 text-danger-700 border border-danger-edge-soft' : 'bg-success-100 text-success-700 border-success-edge-soft'}`}>
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium whitespace-pre-wrap">{actionMessage.text}</p>
        </div>
      )}

      {/* 検索・アコーディオン一括開閉コントロールバー */}
      <div className="bg-surface/80 backdrop-blur-md border border-border/80 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={playerFilter}
              onChange={(e) => setPlayerFilter(e.target.value)}
              placeholder="参加プレイヤー名で試合を検索..."
              className="w-full bg-background border border-border rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-foreground placeholder:text-faint focus:outline-none focus:border-primary-edge-strong transition"
            />
            {playerFilter && (
              <button
                type="button"
                onClick={() => setPlayerFilter('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-foreground text-xs p-0.5"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-xs">
          <button
            type="button"
            onClick={() => toggleAllAccordions(true)}
            className="px-3 py-1.5 rounded-xl bg-surface-subtle hover:bg-surface-hover border border-border font-bold text-foreground-subtle transition cursor-pointer"
          >
            すべて展開
          </button>
          <button
            type="button"
            onClick={() => toggleAllAccordions(false)}
            className="px-3 py-1.5 rounded-xl bg-surface-subtle hover:bg-surface-hover border border-border font-bold text-foreground-subtle transition cursor-pointer"
          >
            すべて畳む
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {matches
          .filter(match => {
            if (!playerFilter.trim()) return true;
            const q = playerFilter.trim().toLowerCase();
            return match.participants.some(p => p.player_name.toLowerCase().includes(q));
          })
          .map(match => {
          const isExpanded = expandedMatchIds.has(match.id);
          const blueTeam = match.participants.filter(p => p.team === 'BLUE');
          const redTeam = match.participants.filter(p => p.team === 'RED');

          // ロール順にソート
          const sortByRole = (arr: Participant[]) => ROLES.map(role => arr.find(p => p.role === role)).filter(Boolean) as Participant[];
          const blueSorted = sortByRole(blueTeam);
          const redSorted = sortByRole(redTeam);

          // チーム合計キル
          const blueKills = blueTeam.reduce((sum, p) => sum + (p.kills || 0), 0);
          const redKills = redTeam.reduce((sum, p) => sum + (p.kills || 0), 0);

          const dateObj = new Date(match.created_at);
          const dateStr = `${dateObj.getFullYear()}/${String(dateObj.getMonth()+1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

          return (
            <div key={match.id} className="bg-surface border border-border rounded-2xl overflow-hidden shadow-md transition-all">
              {/* Header (タップで開閉可能なアコーディオンヘッダー) */}
              <div 
                onClick={() => toggleAccordion(match.id)}
                className={`p-3.5 sm:p-4 flex items-center justify-between border-b cursor-pointer transition select-none ${
                  match.winning_team === 'BLUE' 
                    ? 'bg-secondary-950/20 hover:bg-secondary-950/30 border-secondary-edge-strong/30' 
                    : 'bg-danger-950/20 hover:bg-danger-950/30 border-danger-edge-strong/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black shrink-0 ${
                    match.winning_team === 'BLUE' ? 'bg-secondary-500/20 text-secondary-400' : 'bg-danger-500/20 text-danger-400'
                  }`}>
                    <Trophy className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-black tracking-wider text-base sm:text-lg ${
                      match.winning_team === 'BLUE' ? 'text-secondary-400' : 'text-danger-400'
                    }`}>
                      {match.winning_team} WIN
                    </span>
                    <span className="text-xs font-mono font-bold text-faint px-2 py-0.5 rounded-md bg-black/20">
                      Score: <span className="text-secondary-400">{blueKills}</span> - <span className="text-danger-400">{redKills}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 text-faint text-xs font-bold shrink-0">
                  <div className="flex items-center gap-1.5 font-mono">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{dateStr}</span>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => { setTapSwapIndex(null); setEditingMatch(JSON.parse(JSON.stringify(match))); }}
                        className="p-1.5 bg-black/10 hover:bg-black/20 border border-border text-primary-600 rounded-lg transition cursor-pointer"
                        title="試合履歴を編集"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteMatch(match.id)}
                        className="p-1.5 bg-black/10 hover:bg-danger-100 border border-border text-danger-600 rounded-lg transition cursor-pointer"
                        title="試合履歴を削除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* 開閉インジケーター */}
                  <span className="text-xs text-muted-strong font-mono px-2 py-1 rounded-lg bg-black/10">
                    {isExpanded ? '▲ 閉じる' : '▼ 詳細'}
                  </span>
                </div>
              </div>

              {/* Body (アコーディオン展開時のみ描画) */}
              {isExpanded && (
                <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border animate-fade-in">
                  {/* BLUE TEAM */}
                  <div className={`flex-1 p-3 sm:p-4 ${match.winning_team === 'BLUE' ? 'bg-secondary-950/5' : 'bg-black/2'}`}>
                    <div className="flex items-center justify-between mb-3 px-1">
                      <span className="text-xs font-black text-secondary-500 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-secondary-500"></span>
                        BLUE チーム {match.winning_team === 'BLUE' && '👑 勝利'}
                      </span>
                      <span className="text-xs font-mono font-bold text-muted">
                        計 {blueKills} キル
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      {blueSorted.map(p => (
                        <div key={p.player_name} className="flex items-center gap-2.5 bg-surface/80 p-2 sm:p-2.5 rounded-xl border border-border/60 hover:bg-black/5 transition">
                          <div className="w-8 text-center text-[11px] font-black text-muted-strong flex-shrink-0">{p.role}</div>
                          {p.champion_name ? (
                            <Image
                              src={getChampIcon(p.champion_name)}
                              alt={p.champion_name}
                              width={36}
                              height={36}
                              className="w-9 h-9 rounded-full border border-border flex-shrink-0 object-cover shadow-2xs"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-black/5 flex-shrink-0 border border-border flex items-center justify-center text-[10px] text-muted-strong">?</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <Link href={`/player/${encodeURIComponent(p.player_name)}`} className="font-black text-foreground truncate text-xs sm:text-sm hover:underline hover:text-primary-600 block">
                              {p.player_name}
                            </Link>
                            <div className="text-[10px] font-bold text-muted-strong">
                              {p.champion_name || 'Champion'}
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end justify-center flex-shrink-0">
                            <div className="text-xs font-bold text-foreground-subtle font-mono">
                              {p.kills} / <span className="text-danger-700">{p.deaths}</span> / {p.assists}
                            </div>
                            <div className="text-[10px] font-mono text-faint">
                              KDA {p.kda_score ? p.kda_score.toFixed(2) : ((p.kills + p.assists) / Math.max(1, p.deaths)).toFixed(2)}
                            </div>
                          </div>

                          <div
                            title={formatMmrBreakdown(p.mmr_breakdown, p.mmr_delta)}
                            className={`w-12 text-right font-black font-mono text-xs sm:text-sm flex-shrink-0 cursor-help ${p.mmr_delta > 0 ? 'text-success-700' : p.mmr_delta < 0 ? 'text-danger-700' : 'text-muted-strong'}`}
                          >
                            {p.mmr_delta > 0 ? '+' : ''}{p.mmr_delta}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* RED TEAM */}
                  <div className={`flex-1 p-3 sm:p-4 ${match.winning_team === 'RED' ? 'bg-danger-950/5' : 'bg-black/2'}`}>
                    <div className="flex items-center justify-between mb-3 px-1">
                      <span className="text-xs font-black text-danger-500 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-danger-500"></span>
                        RED チーム {match.winning_team === 'RED' && '👑 勝利'}
                      </span>
                      <span className="text-xs font-mono font-bold text-muted">
                        計 {redKills} キル
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      {redSorted.map(p => (
                        <div key={p.player_name} className="flex items-center gap-2.5 bg-surface/80 p-2 sm:p-2.5 rounded-xl border border-border/60 hover:bg-black/5 transition">
                          <div className="w-8 text-center text-[11px] font-black text-muted-strong flex-shrink-0">{p.role}</div>
                          {p.champion_name ? (
                            <Image
                              src={getChampIcon(p.champion_name)}
                              alt={p.champion_name}
                              width={36}
                              height={36}
                              className="w-9 h-9 rounded-full border border-border flex-shrink-0 object-cover shadow-2xs"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-black/5 flex-shrink-0 border border-border flex items-center justify-center text-[10px] text-muted-strong">?</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <Link href={`/player/${encodeURIComponent(p.player_name)}`} className="font-black text-foreground truncate text-xs sm:text-sm hover:underline hover:text-primary-600 block">
                              {p.player_name}
                            </Link>
                            <div className="text-[10px] font-bold text-muted-strong">
                              {p.champion_name || 'Champion'}
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end justify-center flex-shrink-0">
                            <div className="text-xs font-bold text-foreground-subtle font-mono">
                              {p.kills} / <span className="text-danger-700">{p.deaths}</span> / {p.assists}
                            </div>
                            <div className="text-[10px] font-mono text-faint">
                              KDA {p.kda_score ? p.kda_score.toFixed(2) : ((p.kills + p.assists) / Math.max(1, p.deaths)).toFixed(2)}
                            </div>
                          </div>

                          <div
                            title={formatMmrBreakdown(p.mmr_breakdown, p.mmr_delta)}
                            className={`w-12 text-right font-black font-mono text-xs sm:text-sm flex-shrink-0 cursor-help ${p.mmr_delta > 0 ? 'text-success-700' : p.mmr_delta < 0 ? 'text-danger-700' : 'text-muted-strong'}`}
                          >
                            {p.mmr_delta > 0 ? '+' : ''}{p.mmr_delta}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {matches.length === 0 && (
          <div className="text-center p-12 text-muted-strong font-bold border border-border border-dashed rounded-xl">試合履歴がありません</div>
        )}
      </div>

      {/* 試合編集モーダル */}
      {editingMatch && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-4xl p-6 shadow-2xl my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Edit className="h-5 w-5 text-primary-700" />
                試合履歴の編集 (Match #{editingMatch.id})
              </h3>
              <button 
                onClick={() => setEditingMatch(null)}
                className="text-faint hover:text-foreground bg-black/5 px-3 py-1.5 rounded-lg border border-border transition text-sm"
              >
                キャンセル
              </button>
            </div>

            <p className="text-xs text-muted-strong -mt-3 mb-4">
              {tapSwapIndex === null
                ? '入れ替え: ⠿ を押してから、入れ替えたい相手の ⠿ を押します（同じチーム内。ドラッグでも可）'
                : '入れ替える相手の ⠿ を押してください（同じ ⠿ をもう一度押すと取り消し）'}
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
              {/* BLUE TEAM INPUT */}
              <div>
                <h4 className="font-bold text-secondary-400 mb-3 text-lg tracking-wider">🟦 BLUE TEAM</h4>
                <div className="space-y-3">
                  {ROLES.map(role => {
                    const idx = editingMatch.participants.findIndex(p => p.team === 'BLUE' && p.role === role);
                    if (idx === -1) return null;
                    const p = editingMatch.participants[idx];
                    const isDragging = draggedParticipantIndex === idx;
                    const isTapSelected = tapSwapIndex === idx;
                    return (
                      <div 
                        key={`edit-BLUE-${role}`} 
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, idx)}
                        onDragEnd={() => setDraggedParticipantIndex(null)}
                        className={`flex flex-wrap items-center gap-2 bg-black/5 p-3 rounded-lg border border-border hover:bg-black/8 hover:border-border transition-all ${
                          isDragging ? 'opacity-40 border-dashed border-primary-edge-strong bg-surface' : isTapSelected ? 'ring-2 ring-primary-500 border-primary-edge-strong' : ''
                        }`}
                      >
                        <button
                          type="button"
                          draggable
                          onDragStart={(e) => handleDragStart(e, idx)}
                          onDragEnd={() => setDraggedParticipantIndex(null)}
                          onClick={() => handleTapSwap(idx)}
                          title="押してから、入れ替えたい相手の ⠿ を押すと入れ替わります（同じチーム内）"
                          className={`p-1 -m-1 rounded transition shrink-0 cursor-grab active:cursor-grabbing ${isTapSelected ? 'bg-primary-500 text-white' : 'text-muted-strong hover:text-foreground-subtle hover:bg-black/10'}`}
                        >
                          <GripVertical className="h-5 w-5" />
                        </button>
                        <div className="w-8 text-center font-bold text-muted-strong text-xs">{role}</div>
                        <select
                          value={p.player_name}
                          onChange={e => handleEditingParticipantChange(idx, 'player_name', e.target.value)}
                          onDragStart={e => e.stopPropagation()}
                          className="flex-1 min-w-0 bg-surface border border-border rounded px-2 py-1 text-foreground outline-none focus:border-secondary-edge-strong text-xs"
                        >
                          <option value="">選択...</option>
                          {p.player_name && !playersPool.some(pl => pl.name === p.player_name) && (
                            <option value={p.player_name}>{p.player_name} (未登録)</option>
                          )}
                          {playersPool.map(pl => <option key={pl.name} value={pl.name}>{pl.name}</option>)}
                        </select>
                        <button
                          onClick={() => setActiveChampSelectorPlayer(idx.toString())}
                          onDragStart={e => e.stopPropagation()}
                          type="button"
                          className="w-28 bg-surface border border-border hover:border-secondary-edge-strong rounded px-1.5 py-1 text-foreground-subtle hover:text-foreground text-xs flex items-center justify-between gap-1 transition shrink-0"
                        >
                          <span className="truncate">
                            {p.champion_name ? (championsList.find(c => c.id === p.champion_name)?.name || 'チャンプ') : '選択'}
                          </span>
                          {p.champion_name && (
                            <Image
                              src={getChampIcon(p.champion_name)}
                              width={16}
                              height={16}
                              className="w-4 h-4 rounded-full border border-border shrink-0 object-cover"
                              alt={p.champion_name}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                          )}
                        </button>
                        {/* 2段目: K/D/A（1行に詰めると枠からはみ出していた。2026-10-18） */}
                        <div className="basis-full flex flex-wrap gap-1 justify-end items-center" onDragStart={e => e.stopPropagation()}>
                          <input type="number" value={p.kills} onChange={e => handleEditingParticipantChange(idx, 'kills', e.target.value)} className="w-10 bg-surface border border-border text-foreground text-center rounded text-xs py-0.5" placeholder="K" />
                          <span className="text-muted-strong text-xs self-center">/</span>
                          <input type="number" value={p.deaths} onChange={e => handleEditingParticipantChange(idx, 'deaths', e.target.value)} className="w-10 bg-surface border border-danger-edge-soft text-danger-700 text-center rounded text-xs py-0.5" placeholder="D" />
                          <span className="text-muted-strong text-xs self-center">/</span>
                          <input type="number" value={p.assists} onChange={e => handleEditingParticipantChange(idx, 'assists', e.target.value)} className="w-10 bg-surface border border-border text-foreground text-center rounded text-xs py-0.5" placeholder="A" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RED TEAM INPUT */}
              <div>
                <h4 className="font-bold text-danger-400 mb-3 text-lg tracking-wider">🟥 RED TEAM</h4>
                <div className="space-y-3">
                  {ROLES.map(role => {
                    const idx = editingMatch.participants.findIndex(p => p.team === 'RED' && p.role === role);
                    if (idx === -1) return null;
                    const p = editingMatch.participants[idx];
                    const isDragging = draggedParticipantIndex === idx;
                    const isTapSelected = tapSwapIndex === idx;
                    return (
                      <div 
                        key={`edit-RED-${role}`} 
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, idx)}
                        onDragEnd={() => setDraggedParticipantIndex(null)}
                        className={`flex flex-wrap items-center gap-2 bg-black/5 p-3 rounded-lg border border-border hover:bg-black/8 hover:border-border transition-all ${
                          isDragging ? 'opacity-40 border-dashed border-danger-edge-strong bg-surface' : isTapSelected ? 'ring-2 ring-primary-500 border-primary-edge-strong' : ''
                        }`}
                      >
                        <button
                          type="button"
                          draggable
                          onDragStart={(e) => handleDragStart(e, idx)}
                          onDragEnd={() => setDraggedParticipantIndex(null)}
                          onClick={() => handleTapSwap(idx)}
                          title="押してから、入れ替えたい相手の ⠿ を押すと入れ替わります（同じチーム内）"
                          className={`p-1 -m-1 rounded transition shrink-0 cursor-grab active:cursor-grabbing ${isTapSelected ? 'bg-primary-500 text-white' : 'text-muted-strong hover:text-foreground-subtle hover:bg-black/10'}`}
                        >
                          <GripVertical className="h-5 w-5" />
                        </button>
                        <div className="w-8 text-center font-bold text-muted-strong text-xs">{role}</div>
                        <select
                          value={p.player_name}
                          onChange={e => handleEditingParticipantChange(idx, 'player_name', e.target.value)}
                          onDragStart={e => e.stopPropagation()}
                          className="flex-1 min-w-0 bg-surface border border-border rounded px-2 py-1 text-foreground outline-none focus:border-danger-edge-strong text-xs"
                        >
                          <option value="">選択...</option>
                          {p.player_name && !playersPool.some(pl => pl.name === p.player_name) && (
                            <option value={p.player_name}>{p.player_name} (未登録)</option>
                          )}
                          {playersPool.map(pl => <option key={pl.name} value={pl.name}>{pl.name}</option>)}
                        </select>
                        <button
                          onClick={() => setActiveChampSelectorPlayer(idx.toString())}
                          onDragStart={e => e.stopPropagation()}
                          type="button"
                          className="w-28 bg-surface border border-border hover:border-danger-edge-strong rounded px-1.5 py-1 text-foreground-subtle hover:text-foreground text-xs flex items-center justify-between gap-1 transition shrink-0"
                        >
                          <span className="truncate">
                            {p.champion_name ? (championsList.find(c => c.id === p.champion_name)?.name || 'チャンプ') : '選択'}
                          </span>
                          {p.champion_name && (
                            <Image
                              src={getChampIcon(p.champion_name)}
                              width={16}
                              height={16}
                              className="w-4 h-4 rounded-full border border-border shrink-0 object-cover"
                              alt={p.champion_name}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                          )}
                        </button>
                        {/* 2段目: K/D/A（1行に詰めると枠からはみ出していた。2026-10-18） */}
                        <div className="basis-full flex flex-wrap gap-1 justify-end items-center" onDragStart={e => e.stopPropagation()}>
                          <input type="number" value={p.kills} onChange={e => handleEditingParticipantChange(idx, 'kills', e.target.value)} className="w-10 bg-surface border border-border text-foreground text-center rounded text-xs py-0.5" placeholder="K" />
                          <span className="text-muted-strong text-xs self-center">/</span>
                          <input type="number" value={p.deaths} onChange={e => handleEditingParticipantChange(idx, 'deaths', e.target.value)} className="w-10 bg-surface border border-danger-edge-soft text-danger-700 text-center rounded text-xs py-0.5" placeholder="D" />
                          <span className="text-muted-strong text-xs self-center">/</span>
                          <input type="number" value={p.assists} onChange={e => handleEditingParticipantChange(idx, 'assists', e.target.value)} className="w-10 bg-surface border border-border text-foreground text-center rounded text-xs py-0.5" placeholder="A" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 勝敗選択と保存 */}
            <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 bg-black/5 p-2 rounded-lg border border-border">
                <span className="font-bold text-muted-strong px-2 text-sm">勝利チーム:</span>
                <button
                  onClick={() => setEditingMatch(prev => prev ? { ...prev, winning_team: 'BLUE' } : null)}
                  type="button"
                  className={`px-6 py-2 rounded-lg font-bold transition text-xs ${editingMatch.winning_team === 'BLUE' ? 'bg-secondary-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-surface text-muted-strong border border-border hover:bg-black/5'}`}
                >
                  BLUE WIN
                </button>
                <button
                  onClick={() => setEditingMatch(prev => prev ? { ...prev, winning_team: 'RED' } : null)}
                  type="button"
                  className={`px-6 py-2 rounded-lg font-bold transition text-xs ${editingMatch.winning_team === 'RED' ? 'bg-danger-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]' : 'bg-surface text-muted-strong border border-border hover:bg-black/5'}`}
                >
                  RED WIN
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setEditingMatch(null)}
                  type="button"
                  className="px-6 py-2.5 rounded-xl font-bold bg-black/5 hover:bg-black/8 border border-border text-foreground-subtle transition text-sm"
                >
                  キャンセル
                </button>
                <button 
                  onClick={handleSaveMatch}
                  disabled={saving}
                  type="button"
                  className="px-8 py-2.5 rounded-xl font-black bg-gradient-to-r from-success-500 to-secondary-600 hover:from-success-400 hover:to-secondary-500 text-white transition shadow-xl shadow-success-900/20 text-sm flex items-center gap-2"
                >
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                  変更を保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* チャンピオン選択アイコンモーダル (編集モーダル用) */}
      {activeChampSelectorPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                <Target className="h-5 w-5 text-success-700" />
                チャンピオン選択
              </h3>
              <button 
                onClick={() => { setActiveChampSelectorPlayer(null); setChampSearchQuery(''); }}
                className="text-faint hover:text-foreground text-sm bg-black/5 px-3 py-1.5 rounded-lg border border-border transition"
              >
                閉じる
              </button>
            </div>
            
            <input 
              type="text" 
              placeholder="チャンピオン名で検索 (ひらがな・カタカナ・英語名)..." 
              value={champSearchQuery}
              onChange={e => setChampSearchQuery(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground mb-4 outline-none focus:border-success-edge-strong text-sm"
              autoFocus
            />
            
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {championsList
                .filter(c => 
                  c.name.toLowerCase().includes(champSearchQuery.toLowerCase()) || 
                  c.id.toLowerCase().includes(champSearchQuery.toLowerCase())
                )
                .map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      const idx = parseInt(activeChampSelectorPlayer);
                      handleEditingParticipantChange(idx, 'champion_name', c.id);
                      setActiveChampSelectorPlayer(null);
                      setChampSearchQuery('');
                    }}
                    type="button"
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-black/5 transition group"
                  >
                    <Image
                      src={getChampIcon(c.id)}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-xl border border-border group-hover:border-success-edge-strong transition object-cover"
                      alt={c.name}
                    />
                    <span className="text-[10px] text-faint truncate w-14 text-center group-hover:text-foreground transition">
                      {c.name}
                    </span>
                  </button>
                ))
              }
              {championsList.filter(c => 
                c.name.toLowerCase().includes(champSearchQuery.toLowerCase()) || 
                c.id.toLowerCase().includes(champSearchQuery.toLowerCase())
              ).length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-strong text-sm">
                  該当するチャンピオンが見つかりません。
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
