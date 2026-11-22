import { useEffect, useState } from 'react';
import { toast } from '../../components/Toaster';
import { History, Swords, Trophy, Calendar, RefreshCw, Edit, Trash2, Search, AlertCircle, X, Target, GripVertical, PartyPopper } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getItemIcon, getSummonerSpellIcon } from '../../lib/ddragonClient';
import { calculateKdaScore, type MmrBreakdown } from '../../lib/mmr';
import { isEventMatch, isNormalMatch, getMatchType } from '../../lib/matchType';
import ChampionIcon from '../../components/ChampionIcon';
import MatchItemSlots from './_parts/MatchItemSlots';
import MatchChampSelectorModal from './_parts/MatchChampSelectorModal';
import type { Match, Participant } from './_parts/types';

export type { Match, Participant };

function formatMmrBreakdown(b?: MmrBreakdown | null, delta?: number): string {
  if (!b) return delta !== undefined ? `MMR変動: ${delta > 0 ? '+' : ''}${delta}` : '';
  if ((b as any).isExhibition) return 'お祭りカスタム（戦績対象外）: 変動0';
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

function DamageBar({ damage, maxDamage, team }: { damage?: number; maxDamage: number; team: 'BLUE' | 'RED' }) {
  const dmg = Number(damage) || 0;
  if (dmg <= 0 || maxDamage <= 0) return null;
  const pct = Math.min(100, Math.round((dmg / maxDamage) * 100));
  const isBlue = team === 'BLUE';

  return (
    <div className="flex flex-col items-end gap-0.5 min-w-[55px] sm:min-w-[75px] shrink-0" title={`与ダメージ: ${dmg.toLocaleString()}`}>
      <div className="text-[10px] font-mono font-bold text-foreground-subtle flex items-center gap-1">
        <span>{(dmg / 1000).toFixed(1)}k</span>
      </div>
      <div className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isBlue ? 'bg-secondary-500' : 'bg-danger-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SummonerSpells({ spells }: { spells?: number[] }) {
  if (!spells || spells.length === 0 || spells.every(s => !s || s <= 0)) return null;
  return (
    <div className="flex flex-col gap-0.5 shrink-0">
      {spells.slice(0, 2).map((spellId, i) => {
        const icon = getSummonerSpellIcon(spellId);
        if (!icon) return <div key={i} className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded bg-black/30 border border-border/30" />;
        return (
          <img key={i} src={icon} alt="" className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded object-cover border border-black/40 shadow-2xs" />
        );
      })}
    </div>
  );
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
  const [winFilter, setWinFilter] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL'); // 'ALL' | 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP'
  const [matchTypeFilter, setMatchTypeFilter] = useState<'ALL' | 'NORMAL' | 'EVENT'>('ALL');
  const [limit, setLimit] = useState(50);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  // アコーディオン開閉状態（デフォルトで直近3試合を展開）
  const [expandedMatchIds, setExpandedMatchIds] = useState<Set<string>>(new Set());

  const fetchMatches = async () => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch('/api/match/history?limit=50', { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '取得に失敗しました');

      setMatches(data.matches || []);
      // 初期表示は全試合折りたたみに統一（SPEC 05: 初期の縦の長さを抑制）
      setExpandedMatchIds(new Set());
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('データの取得がタイムアウト（10秒）しました。通信状況をご確認のうえ再度お試しください。');
      } else {
        setError(err.message || '試合履歴の取得に失敗しました');
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    const nextLimit = limit + 50;
    try {
      const res = await fetch(`/api/match/history?limit=${nextLimit}`);
      const data = await res.json();
      if (res.ok && data.matches) {
        setMatches(data.matches);
        if (data.matches.length < nextLimit) {
          setHasMore(false);
        }
        setLimit(nextLimit);
      }
    } catch (err: any) {
      toast.error('過去試合の取得に失敗しました');
    } finally {
      setLoadingMore(false);
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

  const [togglingMatchId, setTogglingMatchId] = useState<string | null>(null);

  const handleToggleMatchType = async (match: Match) => {
    const isCurrentlyEvent = isEventMatch(match);
    const nextType = isCurrentlyEvent ? 'NORMAL' : 'EVENT';
    const confirmMsg = isCurrentlyEvent
      ? `マッチ #${match.id} を「公式戦」に変更しますか？\n（勝敗・MMR変動が公式記録に再反映され、自動で全MMRが再計算されます）`
      : `マッチ #${match.id} を「お祭り・エキシビション」に変更しますか？\n（レート非干渉となり、勝敗・MMR変動が公式記録から除外され、自動で全MMRが再計算されます）`;

    if (!confirm(confirmMsg)) return;

    setTogglingMatchId(match.id);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/match/${match.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchType: nextType })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '試合種別の更新に失敗しました');

      toast.success(data.message || '試合種別を更新し、MMRを再計算しました！');
      setActionMessage({ type: 'success', text: data.message || '試合種別を更新しました。' });
      fetchMatches();
    } catch (err: any) {
      toast.error(`エラー: ${err.message}`);
      setActionMessage({ type: 'error', text: `更新エラー: ${err.message}` });
    } finally {
      setTogglingMatchId(null);
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (!confirm(`本当にこの試合 (Match #${matchId}) を削除しますか？\n(※削除後、自動でMMRが再計算されます)`)) return;
    
    try {
      const res = await fetch(`/api/admin/match/${matchId}`, {
        method: 'DELETE',
        credentials: 'include', // 管理者Cookieを送らないと401になる
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '削除に失敗しました');

      toast.success('試合履歴を削除し、MMRを再計算しました。');
      setActionMessage({ type: 'success', text: '試合履歴を削除し、MMRを再計算しました。' });
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
          participants: editingMatch.participants,
          matchType: isEventMatch(editingMatch) ? 'EVENT' : 'NORMAL'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '更新に失敗しました');

      toast.success('試合データを更新し、MMRを再計算しました。');
      setActionMessage({ type: 'success', text: '試合データを更新し、MMRを再計算しました。' });
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-success-100 rounded-xl">
          <History className="h-6 w-6 text-success-700" />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-foreground">試合履歴</h2>
          <p className="text-xs text-muted-strong mt-0.5">
            KDA＝(キル+アシスト)÷デス（3.0以上で好成績）。MMR変動は格上/格下補正・早期投了緩和などを反映しています。
            <a href="/guide#portal-mmr" className="ml-2 text-primary-700 hover:underline font-bold">📖 用語・MMRの見方</a>
          </p>
          <p className="text-faint font-medium text-sm">
            {loading ? '戦績データを取得中...' : matches.length > 0 ? `最新${matches.length}件の試合結果とMMR変動履歴` : '試合結果とMMR変動履歴'}
          </p>
        </div>
      </div>

      {actionMessage && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${actionMessage.type === 'error' ? 'bg-danger-100 text-danger-700 border border-danger-edge-soft' : 'bg-success-100 text-success-700 border-success-edge-soft'}`}>
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium whitespace-pre-wrap">{actionMessage.text}</p>
        </div>
      )}

      {/* ⚠️ 取得エラー時の表示 */}
      {error && !loading && (
        <div className="bg-danger-50 dark:bg-danger-950/20 border-2 border-danger-edge-soft rounded-3xl p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-danger-100 dark:bg-danger-900/40 text-danger-700 dark:text-danger-300 flex items-center justify-center text-2xl mx-auto">
            ⚠️
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-foreground">
              試合履歴の取得に失敗しました
            </h3>
            <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
              {error}
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={fetchMatches}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-danger-600 hover:bg-danger-700 text-white font-black text-xs transition shadow-sm cursor-pointer"
            >
              <RefreshCw size={14} />
              再読み込み
            </button>
          </div>
        </div>
      )}

      {/* ⏳ 読み込み中のスケルトン表示 */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="bg-surface/90 border border-border/80 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-6 bg-surface-subtle rounded-lg" />
                  <div className="w-24 h-4 bg-surface-subtle rounded" />
                  <div className="w-16 h-4 bg-surface-subtle rounded" />
                </div>
                <div className="w-28 h-5 bg-surface-subtle rounded-full" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-surface-subtle/50 rounded-xl space-y-2">
                  <div className="w-20 h-4 bg-surface-subtle rounded mb-2" />
                  {[1, 2, 3, 4, 5].map((j) => (
                    <div key={j} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-surface-subtle" />
                        <div className="w-20 h-3 bg-surface-subtle rounded" />
                      </div>
                      <div className="w-12 h-3 bg-surface-subtle rounded" />
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-surface-subtle/50 rounded-xl space-y-2">
                  <div className="w-20 h-4 bg-surface-subtle rounded mb-2" />
                  {[1, 2, 3, 4, 5].map((j) => (
                    <div key={j} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-surface-subtle" />
                        <div className="w-20 h-3 bg-surface-subtle rounded" />
                      </div>
                      <div className="w-12 h-3 bg-surface-subtle rounded" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && (
        <>

      {/* 検索・アコーディオン一括開閉コントロールバー */}
      <div className="bg-surface/80 backdrop-blur-md border border-border/80 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* テキスト入力 */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={playerFilter}
                onChange={(e) => setPlayerFilter(e.target.value)}
                placeholder="プレイヤー名で検索..."
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

            {/* 勝敗フィルター */}
            {playerFilter && (
              <div className="flex items-center gap-1 bg-background border border-border rounded-xl p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setWinFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-black transition cursor-pointer ${winFilter === 'ALL' ? 'bg-primary-500 text-stone-950 shadow-2xs' : 'text-muted hover:text-foreground'}`}
                >
                  全戦
                </button>
                <button
                  type="button"
                  onClick={() => setWinFilter('WIN')}
                  className={`px-2.5 py-1 rounded-lg font-black transition cursor-pointer ${winFilter === 'WIN' ? 'bg-success-600 text-white shadow-2xs' : 'text-muted hover:text-foreground'}`}
                >
                  勝利のみ
                </button>
                <button
                  type="button"
                  onClick={() => setWinFilter('LOSS')}
                  className={`px-2.5 py-1 rounded-lg font-black transition cursor-pointer ${winFilter === 'LOSS' ? 'bg-danger-600 text-white shadow-2xs' : 'text-muted hover:text-foreground'}`}
                >
                  敗北のみ
                </button>
              </div>
            )}
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

        {/* 2段目: 試合種別 ＆ レーンフィルター */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs">
          {/* 試合種別 */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-muted mr-1">種別:</span>
            {[
              { id: 'ALL', label: 'すべて' },
              { id: 'NORMAL', label: '🏆 公式戦' },
              { id: 'EVENT', label: '🎭 お祭り' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setMatchTypeFilter(t.id as any)}
                className={`px-2.5 py-1 rounded-lg font-black transition cursor-pointer border ${
                  matchTypeFilter === t.id
                    ? 'bg-primary-500/15 border-primary-500 text-primary-500 shadow-2xs'
                    : 'bg-background border-border text-muted hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* レーンフィルター */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-muted mr-1">レーン:</span>
            {['ALL', ...ROLES].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`px-2 py-0.5 rounded-lg font-mono font-bold transition cursor-pointer border ${
                  roleFilter === r
                    ? 'bg-secondary-500/15 border-secondary-500 text-secondary-500 shadow-2xs'
                    : 'bg-background border-border text-muted hover:text-foreground'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 📊 プレイヤー検索時のリアルタイム戦績サマリーカード */}
      {(() => {
        if (!playerFilter.trim()) return null;
        const q = playerFilter.trim().toLowerCase();
        let total = 0;
        let wins = 0;
        let losses = 0;
        const roleStats: Record<string, { total: number; wins: number }> = {};

        matches.forEach((m) => {
          if (matchTypeFilter === 'NORMAL' && !isNormalMatch(m)) return;
          if (matchTypeFilter === 'EVENT' && !isEventMatch(m)) return;

          const pt = m.participants.find((p) => p.player_name.toLowerCase().includes(q));
          if (!pt) return;
          if (roleFilter !== 'ALL' && pt.role !== roleFilter) return;

          total++;
          const isWin = pt.team === m.winning_team;
          if (isWin) wins++;
          else losses++;

          const r = pt.role || 'OTHER';
          if (!roleStats[r]) roleStats[r] = { total: 0, wins: 0 };
          roleStats[r].total++;
          if (isWin) roleStats[r].wins++;
        });

        if (total === 0) return null;
        const winRate = Math.round((wins / total) * 100);

        return (
          <div className="bg-gradient-to-r from-primary-500/10 via-surface to-primary-500/10 border border-primary-500/30 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📊</span>
              <div>
                <div className="text-sm font-black text-foreground flex items-center gap-2">
                  <span>「{playerFilter}」の戦績</span>
                  <span className="text-xs font-mono font-bold text-muted-strong bg-surface px-2.5 py-0.5 rounded-full border border-border">
                    {total}戦 {wins}勝 {losses}敗
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-strong flex-wrap">
                  <span className="font-bold text-foreground">勝率:</span>
                  <span className={`font-mono font-black ${winRate >= 60 ? 'text-emerald-500' : winRate >= 50 ? 'text-primary-500' : 'text-danger-500'}`}>
                    {winRate}%
                  </span>
                  {/* レーン別内訳 */}
                  <div className="flex items-center gap-1.5 ml-2 border-l border-border pl-2 font-mono text-[11px] flex-wrap">
                    {ROLES.map((r) => {
                      const st = roleStats[r];
                      if (!st || st.total === 0) return null;
                      return (
                        <span key={r} className="px-1.5 py-0.5 rounded bg-surface border border-border">
                          {r}: {st.wins}W {st.total - st.wins}L
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 text-xs text-muted font-mono">
              表示フィルター適用中
            </div>
          </div>
        );
      })()}

      <div className="space-y-4">
        {matches
          .filter(match => {
            // 試合種別フィルター
            if (matchTypeFilter === 'NORMAL' && !isNormalMatch(match)) return false;
            if (matchTypeFilter === 'EVENT' && !isEventMatch(match)) return false;

            // プレイヤー指定あり
            if (playerFilter.trim()) {
              const q = playerFilter.trim().toLowerCase();
              const pt = match.participants.find(p => p.player_name.toLowerCase().includes(q));
              if (!pt) return false;
              if (roleFilter !== 'ALL' && pt.role !== roleFilter) return false;
              if (winFilter === 'WIN') return pt.team === match.winning_team;
              if (winFilter === 'LOSS') return pt.team !== match.winning_team;
              return true;
            }

            // プレイヤー指定なしだがロール指定あり
            if (roleFilter !== 'ALL') {
              const hasRole = match.participants.some(p => p.role === roleFilter);
              if (!hasRole) return false;
            }

            return true;
          })
          .map(match => {
          const isExpanded = expandedMatchIds.has(match.id);
          const isFestival = isEventMatch(match);
          const blueTeam = match.participants.filter(p => p.team === 'BLUE');
          const redTeam = match.participants.filter(p => p.team === 'RED');

          // 安全なロール順ソート（ロール重複・欠損・特殊ロールがあっても全員漏れなく表示）
          const sortByRole = (arr: Participant[]) => {
            const result: Participant[] = [];
            const used = new Set<Participant>();
            for (const role of ROLES) {
              const found = arr.find(p => p.role === role && !used.has(p));
              if (found) {
                result.push(found);
                used.add(found);
              }
            }
            for (const p of arr) {
              if (!used.has(p)) {
                result.push(p);
                used.add(p);
              }
            }
            return result;
          };
          const blueSorted = sortByRole(blueTeam);
          const redSorted = sortByRole(redTeam);

          // チーム最大ダメージの算出（バーのスケール用）
          const blueMaxDmg = Math.max(...blueTeam.map(p => Number(p.damage_dealt) || 0), 1);
          const redMaxDmg = Math.max(...redTeam.map(p => Number(p.damage_dealt) || 0), 1);

          // チーム合計キル
          const blueKills = blueTeam.reduce((sum, p) => sum + (p.kills || 0), 0);
          const redKills = redTeam.reduce((sum, p) => sum + (p.kills || 0), 0);
          const hasKillData = blueKills > 0 || redKills > 0;

          const dateObj = new Date(match.created_at);
          const dateStr = `${dateObj.getFullYear()}/${String(dateObj.getMonth()+1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

          return (
            <div key={match.id} className="bg-surface border border-border rounded-2xl overflow-hidden shadow-md transition-all">
              {/* Header (タップで開閉可能なアコーディオンヘッダー) */}
              <div 
                onClick={() => toggleAccordion(match.id)}
                className={`p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 border-b cursor-pointer transition select-none ${
                  isFestival
                    ? 'bg-amber-950/20 hover:bg-amber-950/30 border-amber-500/30'
                    : match.winning_team === 'BLUE' 
                      ? 'bg-secondary-950/20 hover:bg-secondary-950/30 border-secondary-edge-strong/30' 
                      : 'bg-danger-950/20 hover:bg-danger-950/30 border-danger-edge-strong/30'
                }`}
              >
                {/* 上段 (PCでは左側): 勝敗 + スコア + 試合時間 */}
                <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black shrink-0 ${
                    isFestival
                      ? 'bg-amber-500/20 text-amber-400'
                      : match.winning_team === 'BLUE' ? 'bg-secondary-500/20 text-secondary-400' : 'bg-danger-500/20 text-danger-400'
                  }`}>
                    {isFestival ? <span className="text-base">🎉</span> : <Trophy className="h-4 w-4" />}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-black tracking-wider text-base sm:text-lg ${
                      isFestival
                        ? 'text-amber-400'
                        : match.winning_team === 'BLUE' ? 'text-secondary-400' : 'text-danger-400'
                    }`}>
                      {isFestival ? 'お祭りカスタム（戦績対象外）' : `${match.winning_team}勝利`}
                    </span>
                    {!isFestival && hasKillData ? (
                      <span className="text-xs font-mono font-bold text-faint px-2 py-0.5 rounded-md bg-black/20">
                        Score: <span className="text-secondary-400">{blueKills}</span> - <span className="text-danger-400">{redKills}</span>
                      </span>
                    ) : null}
                    {isFestival ? (
                      <span className="text-xs font-mono font-bold text-amber-400/80 px-2 py-0.5 rounded-md bg-black/20">
                        参加 {match.participants.length}名 (勝敗・MMR変動なし)
                      </span>
                    ) : null}
                    {match.game_duration && match.game_duration > 0 ? (
                      <span className="text-xs font-mono font-bold text-faint px-2 py-0.5 rounded-md bg-black/20">
                        ⏱️ {Math.floor(match.game_duration / 60)}分{match.game_duration % 60}秒
                      </span>
                    ) : null}
                    {match.game_duration && match.game_duration < 18 * 60 && match.game_duration > 0 ? (
                      <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <span>⚡</span>
                        <span>早期投了 ({Math.round(match.game_duration / 60)}分)</span>
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* 下段 (PCでは右側): 日時 + 編集/削除ボタン + 開閉インジケーター */}
                <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2.5 sm:gap-4 text-faint text-xs font-bold shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-black/10 dark:border-white/5">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] sm:text-xs">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{dateStr}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggleMatchType(match)}
                          disabled={togglingMatchId === match.id}
                          className={`px-2 py-1 border rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                            isFestival
                              ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-600'
                              : 'bg-black/10 hover:bg-black/20 border-border text-faint hover:text-foreground'
                          }`}
                          title={isFestival ? "お祭りカスタム（戦績対象外）モード中。クリックで公式戦に戻します" : "クリックしてお祭りカスタム（戦績対象外）に変更"}
                        >
                          <PartyPopper className={`h-3 w-3 ${isFestival ? 'text-amber-500' : 'text-muted-strong'}`} />
                          <span>{togglingMatchId === match.id ? '切替中...' : (isFestival ? 'お祭り' : '公式戦')}</span>
                        </button>
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
                    <span className="text-[11px] sm:text-xs text-muted-strong font-mono px-2 py-1 rounded-lg bg-black/10">
                      {isExpanded ? '▲ 閉じる' : '▼ 詳細'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Body (アコーディオン展開時のみ描画) */}
              {isExpanded && (
                isFestival ? (
                  <div className="p-4 sm:p-5 bg-amber-950/10 border-t border-amber-500/20 animate-fade-in space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                      <span className="flex items-center gap-1.5">
                        <span>🎉</span>
                        <span>お祭りカスタム 出席メンバー一覧（{match.participants.length}名）</span>
                      </span>
                      <span className="text-[11px] font-mono text-faint">
                        通算試合数カウント対象 / MMR変動なし
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-2.5">
                      {match.participants.map((p) => (
                        <Link
                          key={p.player_name}
                          href={`/player/${encodeURIComponent(p.player_name)}`}
                          className="flex items-center gap-2 p-2.5 rounded-xl bg-surface/80 border border-border/80 hover:border-amber-500/50 hover:bg-surface transition cursor-pointer group"
                        >
                          <div className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-xs font-black text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
                            👤
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-black text-foreground group-hover:text-primary-600 truncate block">
                              {p.player_name}
                            </span>
                            <span className="text-[10px] font-mono text-muted-strong block">
                              出席 +1試合
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
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
                        <div key={p.player_name} className="flex items-center gap-2 sm:gap-2.5 bg-surface/80 p-2 sm:p-2.5 rounded-xl border border-border/60 hover:bg-black/5 transition flex-wrap sm:flex-nowrap">
                          <div className="w-7 sm:w-8 text-center text-[10px] sm:text-[11px] font-black text-muted-strong shrink-0">{p.role}</div>
                          {p.champion_name ? (
                            <ChampionIcon
                              champId={p.champion_name}
                              champName={p.champion_name}
                              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-border shrink-0 shadow-2xs"
                            />
                          ) : (
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/5 shrink-0 border border-border flex items-center justify-center text-[10px] text-muted-strong">?</div>
                          )}
                          <SummonerSpells spells={p.spells} />
                          <div className="flex-1 min-w-[90px] sm:min-w-[110px]">
                            <Link href={`/player/${encodeURIComponent(p.player_name)}`} className="font-black text-foreground truncate text-xs sm:text-sm hover:underline hover:text-primary-600 block">
                              {p.player_name}
                            </Link>
                            <div className="text-[10px] font-bold text-muted-strong flex items-center gap-1.5 flex-wrap">
                              <span>{p.champion_name || 'チャンピオン未記録'}</span>
                              {Number(p.cs) > 0 && <span className="text-faint font-mono font-normal">({p.cs} CS)</span>}
                              {p.gold && p.gold > 0 ? <span className="text-amber-500/90 font-mono font-normal">🪙{p.gold.toLocaleString()}</span> : null}
                            </div>
                          </div>

                          <DamageBar damage={p.damage_dealt} maxDamage={blueMaxDmg} team="BLUE" />
                          <MatchItemSlots items={p.items} />

                          <div className="flex flex-col items-end justify-center shrink-0">
                            <div className="text-xs font-bold text-foreground-subtle font-mono">
                              {p.kills} / <span className="text-danger-700">{p.deaths}</span> / {p.assists}
                            </div>
                            <div className="text-[10px] font-mono text-faint">
                              KDA {p.kda_score ? p.kda_score.toFixed(2) : calculateKdaScore(p.kills, p.deaths, p.assists).toFixed(2)}
                            </div>
                          </div>

                          <div
                            title={formatMmrBreakdown(p.mmr_breakdown, p.mmr_delta)}
                            className={`w-10 sm:w-12 text-right font-black font-mono text-xs sm:text-sm shrink-0 cursor-help ${p.mmr_delta > 0 ? 'text-success-700' : p.mmr_delta < 0 ? 'text-danger-700' : 'text-muted-strong'}`}
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
                        <div key={p.player_name} className="flex items-center gap-2 sm:gap-2.5 bg-surface/80 p-2 sm:p-2.5 rounded-xl border border-border/60 hover:bg-black/5 transition flex-wrap sm:flex-nowrap">
                          <div className="w-7 sm:w-8 text-center text-[10px] sm:text-[11px] font-black text-muted-strong shrink-0">{p.role}</div>
                          {p.champion_name ? (
                            <ChampionIcon
                              champId={p.champion_name}
                              champName={p.champion_name}
                              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-border shrink-0 shadow-2xs"
                            />
                          ) : (
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/5 shrink-0 border border-border flex items-center justify-center text-[10px] text-muted-strong">?</div>
                          )}
                          <SummonerSpells spells={p.spells} />
                          <div className="flex-1 min-w-[90px] sm:min-w-[110px]">
                            <Link href={`/player/${encodeURIComponent(p.player_name)}`} className="font-black text-foreground truncate text-xs sm:text-sm hover:underline hover:text-primary-600 block">
                              {p.player_name}
                            </Link>
                            <div className="text-[10px] font-bold text-muted-strong flex items-center gap-1.5 flex-wrap">
                              <span>{p.champion_name || 'チャンピオン未記録'}</span>
                              {Number(p.cs) > 0 && <span className="text-faint font-mono font-normal">({p.cs} CS)</span>}
                              {p.gold && p.gold > 0 ? <span className="text-amber-500/90 font-mono font-normal">🪙{p.gold.toLocaleString()}</span> : null}
                            </div>
                          </div>

                          <DamageBar damage={p.damage_dealt} maxDamage={redMaxDmg} team="RED" />
                          <MatchItemSlots items={p.items} />

                          <div className="flex flex-col items-end justify-center shrink-0">
                            <div className="text-xs font-bold text-foreground-subtle font-mono">
                              {p.kills} / <span className="text-danger-700">{p.deaths}</span> / {p.assists}
                            </div>
                            <div className="text-[10px] font-mono text-faint">
                              KDA {p.kda_score ? p.kda_score.toFixed(2) : calculateKdaScore(p.kills, p.deaths, p.assists).toFixed(2)}
                            </div>
                          </div>

                          <div
                            title={formatMmrBreakdown(p.mmr_breakdown, p.mmr_delta)}
                            className={`w-10 sm:w-12 text-right font-black font-mono text-xs sm:text-sm shrink-0 cursor-help ${p.mmr_delta > 0 ? 'text-success-700' : p.mmr_delta < 0 ? 'text-danger-700' : 'text-muted-strong'}`}
                          >
                            {p.mmr_delta > 0 ? '+' : ''}{p.mmr_delta}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 💡 KDA計算 ＆ MMR内訳の注記 */}
                <div className="px-3.5 sm:px-4 py-2 bg-surface-subtle/60 border-t border-border/50 text-[10px] sm:text-[11px] text-faint flex flex-wrap items-center justify-between gap-2">
                  <span>※デス0の場合は完全勝利ボーナスとして「(K + A) × 1.2」でKDAを算出しています</span>
                  <span>※MMR変動値にカーソルを合わせると詳細な内訳（勝敗・対面差・格差補正等）を確認できます</span>
                </div>
                  </>
                )
              )}
            </div>
          );
        })}
        {matches.length === 0 && (
          <div className="text-center p-10 bg-surface/90 border border-border rounded-3xl space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-surface-subtle border border-border flex items-center justify-center text-2xl mx-auto mb-2">
              📜
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-foreground">
                まだ記録された試合データがありません
              </h3>
              <p className="text-xs text-muted-strong max-w-md mx-auto leading-relaxed">
                週末定期カスタムなどの対戦結果が登録されると、ここに詳細な勝敗・KDA・レーン対面結果・MMR変動履歴が自動で表示されます。
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/balancer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-black text-xs transition shadow-sm cursor-pointer"
              >
                <Swords size={14} />
                バランサーでカスタム対戦を組む
              </Link>
            </div>
          </div>
        )}

        {/* 過去試合の追加読み込み */}
        {hasMore && matches.length >= limit && (
          <div className="text-center pt-2 pb-4">
            <button
              type="button"
              disabled={loadingMore}
              onClick={handleLoadMore}
              className="px-6 py-2.5 rounded-xl bg-surface hover:bg-surface-hover border border-border text-xs font-black text-foreground shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {loadingMore ? '読み込み中...' : 'さらに過去の試合を読み込む (+50件) ➔'}
            </button>
          </div>
        )}
      </div>
      </>
    )}

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
                  {(() => {
                    const blueIndices: number[] = [];
                    const used = new Set<number>();
                    ROLES.forEach(r => {
                      const found = editingMatch.participants.findIndex((p, i) => p.team === 'BLUE' && p.role === r && !used.has(i));
                      if (found !== -1) { blueIndices.push(found); used.add(found); }
                    });
                    editingMatch.participants.forEach((p, i) => {
                      if (p.team === 'BLUE' && !used.has(i)) { blueIndices.push(i); used.add(i); }
                    });
                    return blueIndices.map(idx => {
                      const p = editingMatch.participants[idx];
                      const role = p.role;
                      const isDragging = draggedParticipantIndex === idx;
                      const isTapSelected = tapSwapIndex === idx;
                      return (
                        <div 
                          key={`edit-BLUE-${idx}`} 
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
                              <ChampionIcon
                                champId={p.champion_name}
                                champName={p.champion_name}
                                className="w-4 h-4 rounded-full border border-border shrink-0"
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
                    });
                  })()}
                </div>
              </div>

              {/* RED TEAM INPUT */}
              <div>
                <h4 className="font-bold text-danger-400 mb-3 text-lg tracking-wider">🟥 RED TEAM</h4>
                <div className="space-y-3">
                  {(() => {
                    const redIndices: number[] = [];
                    const used = new Set<number>();
                    ROLES.forEach(r => {
                      const found = editingMatch.participants.findIndex((p, i) => p.team === 'RED' && p.role === r && !used.has(i));
                      if (found !== -1) { redIndices.push(found); used.add(found); }
                    });
                    editingMatch.participants.forEach((p, i) => {
                      if (p.team === 'RED' && !used.has(i)) { redIndices.push(i); used.add(i); }
                    });
                    return redIndices.map(idx => {
                      const p = editingMatch.participants[idx];
                      const role = p.role;
                      const isDragging = draggedParticipantIndex === idx;
                      const isTapSelected = tapSwapIndex === idx;
                      return (
                        <div 
                          key={`edit-RED-${idx}`} 
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
                            <ChampionIcon
                              champId={p.champion_name}
                              champName={p.champion_name}
                              className="w-4 h-4 rounded-full border border-border shrink-0"
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
                  });
                })()}
              </div>
              </div>
            </div>

            {/* 勝敗選択と保存 */}
            <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 bg-black/5 p-2 rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-muted-strong px-2 text-sm">勝利チーム:</span>
                  <button
                    onClick={() => setEditingMatch(prev => prev ? { ...prev, winning_team: 'BLUE' } : null)}
                    type="button"
                    className={`px-4 sm:px-6 py-2 rounded-lg font-bold transition text-xs ${editingMatch.winning_team === 'BLUE' ? 'bg-secondary-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-surface text-muted-strong border border-border hover:bg-black/5'}`}
                  >
                    BLUE WIN
                  </button>
                  <button
                    onClick={() => setEditingMatch(prev => prev ? { ...prev, winning_team: 'RED' } : null)}
                    type="button"
                    className={`px-4 sm:px-6 py-2 rounded-lg font-bold transition text-xs ${editingMatch.winning_team === 'RED' ? 'bg-danger-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]' : 'bg-surface text-muted-strong border border-border hover:bg-black/5'}`}
                  >
                    RED WIN
                  </button>
                </div>

                <div className="h-5 w-px bg-border hidden sm:block" />

                <div className="flex items-center gap-2">
                  <span className="font-bold text-muted-strong px-2 text-sm">種別:</span>
                  <button
                    onClick={() => setEditingMatch(prev => prev ? { ...prev, match_type: 'NORMAL', riot_match_id: prev.riot_match_id === 'EXHIBITION' ? null : prev.riot_match_id } : null)}
                    type="button"
                    className={`px-3 py-2 rounded-lg font-bold transition text-xs ${!isEventMatch(editingMatch) ? 'bg-primary-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.3)]' : 'bg-surface text-muted-strong border border-border hover:bg-black/5'}`}
                  >
                    ⚔️ 公式戦
                  </button>
                  <button
                    onClick={() => setEditingMatch(prev => prev ? { ...prev, match_type: 'EVENT', riot_match_id: 'EXHIBITION' } : null)}
                    type="button"
                    className={`px-3 py-2 rounded-lg font-bold transition text-xs ${isEventMatch(editingMatch) ? 'bg-amber-600 text-white shadow-[0_0_12px_rgba(217,119,6,0.3)]' : 'bg-surface text-muted-strong border border-border hover:bg-black/5'}`}
                  >
                    🎪 お祭りカスタム（戦績対象外）
                  </button>
                </div>
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

      {/* チャンピオン選択アイコンモーダル (編集モーダル用・外部コンポーネント化) */}
      <MatchChampSelectorModal
        isOpen={Boolean(activeChampSelectorPlayer)}
        onClose={() => {
          setActiveChampSelectorPlayer(null);
          setChampSearchQuery('');
        }}
        onSelect={(champId) => {
          if (activeChampSelectorPlayer) {
            const idx = parseInt(activeChampSelectorPlayer);
            handleEditingParticipantChange(idx, 'champion_name', champId);
            setActiveChampSelectorPlayer(null);
            setChampSearchQuery('');
          }
        }}
        championsList={championsList}
        champSearchQuery={champSearchQuery}
        setChampSearchQuery={setChampSearchQuery}
      />
    </div>
  );
}
