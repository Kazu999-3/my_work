'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { getChampIcon } from '../../lib/ddragonClient';
import {
  TrendingUp,
  Clock,
  ShoppingBag,
  Eye,
  ShieldAlert,
  Sparkles,
  Award,
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Swords,
  Layers,
  Calendar,
  Activity,
  ChevronRight,
} from 'lucide-react';

interface RecentMatchMeta {
  matchId: string;
  championName: string;
  enemyChampionName: string;
  lane: string;
  isWin: boolean;
  kdaStr: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  visionScore: number;
  gameDurationStr: string;
  gameDurationSec: number;
  gameStartTimestamp: number;
}

interface CrossMatchSummary {
  total_matches: number;
  win_rate: number;
  avg_kda: string;
  avg_deaths: number;
  avg_total_cs: number;
  avg_vision_score: number;
  summary_text: string;
}

interface PostGameData {
  success: boolean;
  selected_match_id?: string;
  recent_matches?: RecentMatchMeta[];
  cross_match_summary?: CrossMatchSummary;
  my_champion: string;
  enemy_champion: string;
  is_win?: boolean;
  is_jungle?: boolean;
  my_position?: string;
  match_duration_str: string;
  kda_str: string;
  early_game_metrics: {
    cs_timeline: { minute: number; cs: number; benchmark: number }[];
    cs_at_15: number;
    cs_per_min_at_15: number;
    trade_ratio: number;
    gold_diff_at_15: number;
    lane_result: string;
  };
  recall_efficiency: {
    events: {
      time_str: string;
      gold_at_recall: number;
      bought_items: string[];
      wave_state: string;
      loss_cs: number;
      loss_gold: number;
      evaluation: string;
      detail: string;
    }[];
    total_loss_gold: number;
    rating: string;
  };
  build_audit: {
    score: number;
    grade: string;
    summary: string;
    items_audited: {
      item_name: string;
      timing: string;
      audit: string;
      reason: string;
    }[];
  };
  timing_scaling: {
    phase: string;
    win_rate: number;
    impact: string;
    status: string;
  }[];
  radar_metrics: {
    subject: string;
    my_score: number;
    target_score: number;
    diff: string;
    status: string;
  }[];
  biggest_bottleneck: {
    metric: string;
    advice: string;
  };
}

interface PostGameDashboardProps {
  controlledMatchId?: string;
  onSelectMatchId?: (mId: string) => void;
  summonerName?: string;
  puuid?: string;
}

export default function PostGameDeepAnalyticsDashboard({
  controlledMatchId,
  onSelectMatchId,
  summonerName,
  puuid,
}: PostGameDashboardProps = {}) {
  const [data, setData] = useState<PostGameData | null>(null);
  const [internalMatchId, setInternalMatchId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  // メモ編集用の状態
  const [memoText, setMemoText] = useState<string>('');
  const [savingMemo, setSavingMemo] = useState(false);
  const [memoSaved, setMemoSaved] = useState(false);

  // リコール逆再生タイムライン選択インデックス
  const [selectedRecallIdx, setSelectedRecallIdx] = useState<number>(0);

  const currentMatchId = controlledMatchId || internalMatchId;

  const fetchAnalytics = async (matchId?: string) => {
    setSwitching(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (matchId && matchId !== 'all') params.set('matchId', matchId);
      if (summonerName) params.set('summoner', summonerName);
      if (puuid) params.set('puuid', puuid);

      const url = `/api/lol/postgame-deep-analytics?${params.toString()}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok || json.error || !json.success) {
        throw new Error(json.error || '解析データの取得に失敗しました');
      }
      setData(json);
      if (!internalMatchId && json.selected_match_id) {
        setInternalMatchId(json.selected_match_id);
      }
      // メモを取得
      const mId = matchId || json.selected_match_id;
      if (mId) {
        fetchMemo(mId);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'データ取得エラー');
    } finally {
      setLoading(false);
      setSwitching(false);
    }
  };

  const fetchMemo = async (mId: string) => {
    try {
      const res = await fetch(`/api/lol/match-memo?matchId=${mId}`);
      const d = await res.json();
      if (d.success) {
        setMemoText(d.memo || '');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveMemo = async () => {
    const targetId = currentMatchId || data?.selected_match_id;
    if (!targetId) return;
    setSavingMemo(true);
    try {
      const res = await fetch('/api/lol/match-memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: targetId,
          memo: memoText,
          champion: data?.my_champion,
          enemyChampion: data?.enemy_champion,
          isWin: data?.is_win,
        }),
      });
      const d = await res.json();
      if (d.success) {
        setMemoSaved(true);
        setTimeout(() => setMemoSaved(false), 2500);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingMemo(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(currentMatchId);
  }, [currentMatchId]);

  const handleSelect = (mId: string) => {
    if (onSelectMatchId) {
      onSelectMatchId(mId);
    } else {
      setInternalMatchId(mId);
    }
  };

  const handleSyncFeedback = async () => {
    if (!data || syncing || synced) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/lol/sync-match-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          myChampion: data.my_champion,
          enemyChampion: data.enemy_champion,
          keyLearning: `${data.biggest_bottleneck.metric}: ${data.biggest_bottleneck.advice}`,
          bottleneck: data.biggest_bottleneck.metric
        })
      });
      const d = await res.json();
      if (d.success) {
        setSynced(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-5 md:p-6 shadow-xs animate-pulse space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 bg-stone-200 rounded w-1/3"></div>
          <div className="h-5 bg-stone-200 rounded w-1/4"></div>
        </div>
        <div className="h-20 bg-stone-100 rounded-xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-44 bg-stone-100 rounded-xl"></div>
          <div className="h-44 bg-stone-100 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
        <h4 className="text-sm font-bold text-stone-900">試合後ディープアナリティクス</h4>
        <p className="text-xs text-stone-500 max-w-md mx-auto">
          {error || '直近のランク戦タイムラインデータが見つかりませんでした。ソロQをプレイ後に再度お試しください。'}
        </p>
        <button
          onClick={() => fetchAnalytics(currentMatchId)}
          className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
        >
          <RefreshCw size={12} />
          <span>最新の試合を再読み込み</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 md:p-6 shadow-xs text-stone-900 space-y-6">
      {/* 🎮 直近マッチ選択セレクターバー */}
      {data.recent_matches && data.recent_matches.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-stone-800 flex items-center gap-1.5 uppercase tracking-wider">
              <Layers className="w-4 h-4 text-amber-600" />
              <span>直近のソロQマッチ選択 (全{data.recent_matches.length}試合)</span>
            </h4>
            <span className="text-[10px] text-stone-400 font-bold">クリックで各試合の深層解析に即時切り替え</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {/* 個別試合カード一覧 */}
            {data.recent_matches.map((m, idx) => {
              const isSelected = currentMatchId === m.matchId || (!currentMatchId && idx === 0);
              const dateObj = new Date(m.gameStartTimestamp);
              const timeStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()} ${dateObj.getHours()}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

              return (
                <button
                  key={m.matchId || idx}
                  type="button"
                  onClick={() => handleSelect(m.matchId)}
                  disabled={switching}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 relative overflow-hidden ${
                    isSelected
                      ? 'bg-stone-900 text-white border-stone-900 shadow-xs ring-2 ring-stone-700'
                      : m.isWin
                      ? 'bg-emerald-50/70 border-emerald-200/80 hover:bg-emerald-100/60 hover:border-emerald-300'
                      : 'bg-rose-50/70 border-rose-200/80 hover:bg-rose-100/60 hover:border-rose-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[9px] font-black px-1.5 py-0.2 rounded font-mono ${
                        m.isWin ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                      }`}
                    >
                      {m.isWin ? 'WIN' : 'LOSS'}
                    </span>
                    <span className={`text-[9px] font-mono ${isSelected ? 'text-stone-300' : 'text-stone-400'}`}>
                      #{idx + 1}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 my-0.5">
                    <Image
                      src={getChampIcon(m.championName)}
                      alt={m.championName}
                      width={24}
                      height={24}
                      className="w-6 h-6 rounded-full border border-stone-300 shadow-2xs shrink-0"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <span className="text-[11px] font-black truncate">{m.championName}</span>
                  </div>

                  <div className={`flex items-center justify-between text-[10px] font-mono ${isSelected ? 'text-stone-300' : 'text-stone-500'}`}>
                    <span className="font-bold">{m.kdaStr}</span>
                    <span>{m.gameDurationStr}</span>
                  </div>
                </button>
              );
            })}
          </div>

        </div>
      )}

      {/* 📊 直近数試合の横断スタッツサマリー */}
      {data.cross_match_summary && data.cross_match_summary.total_matches > 1 && (
        <div className="bg-gradient-to-r from-amber-50/90 via-stone-50 to-indigo-50/90 border border-amber-200/80 rounded-xl p-4 space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-black text-stone-900 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-amber-600" />
              <span>直近 {data.cross_match_summary.total_matches} 試合の横断パフォーマンス総括</span>
            </span>
            <div className="flex items-center gap-3 text-[11px] font-bold">
              <span className="text-stone-700 font-mono">
                勝率: <strong className={data.cross_match_summary.win_rate >= 50 ? 'text-emerald-700' : 'text-rose-600'}>{data.cross_match_summary.win_rate}%</strong>
              </span>
              <span className="text-stone-700 font-mono">
                平均KDA: <strong>{data.cross_match_summary.avg_kda}</strong>
              </span>
              <span className="text-stone-700 font-mono">
                平均視界: <strong>{data.cross_match_summary.avg_vision_score}pt</strong>
              </span>
            </div>
          </div>
          <p className="text-xs text-stone-700 font-medium leading-relaxed bg-white/80 p-2.5 rounded-lg border border-amber-200/50">
            💡 {data.cross_match_summary.summary_text}
          </p>
        </div>
      )}

      {/* 選択中の試合ディープアナリティクス ヘッダー */}
      <div className="flex items-center justify-between border-b border-stone-100 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-md text-[10px] font-black uppercase tracking-wider">
            {currentMatchId === 'all' || data.selected_match_id === 'all' ? 'Multi-Match Aggregate' : 'Match Deep Dive'}
          </span>
          <h3 className="text-base font-black text-stone-900 flex items-center gap-1.5">
            <span>
              {currentMatchId === 'all' || data.selected_match_id === 'all'
                ? `⚡ 直近${data.recent_matches?.length || ''}戦 統合ディープアナリティクス`
                : '⚡ 選択マッチの精密ディープアナリティクス'}
            </span>
          </h3>
          {switching && (
            <span className="text-xs text-amber-600 font-bold flex items-center gap-1 animate-pulse ml-2">
              <RefreshCw size={12} className="animate-spin" /> 解析展開中...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-stone-600 flex-wrap">
          <span className={`px-2 py-0.5 rounded text-[10px] font-black text-white ${data.is_win ? 'bg-emerald-600' : 'bg-rose-600'}`}>
            {currentMatchId === 'all' || data.selected_match_id === 'all'
              ? `勝率 ${data.cross_match_summary?.win_rate || 0}%`
              : data.is_win
              ? 'VICTORY'
              : 'DEFEAT'}
          </span>
          <span className="bg-stone-100 px-2 py-0.5 rounded border border-stone-200 text-stone-800 flex items-center gap-1.5">
            {currentMatchId !== 'all' && (
              <Image
                src={getChampIcon(data.my_champion)}
                alt={data.my_champion}
                width={16}
                height={16}
                className="w-4 h-4 rounded-full"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
            {data.my_champion} {currentMatchId !== 'all' && `vs ${data.enemy_champion}`}
          </span>
          <span>•</span>
          <span>KDA: {data.kda_str}</span>
          <span>•</span>
          <span>{data.match_duration_str}</span>
          <button
            onClick={() => fetchAnalytics(currentMatchId)}
            title="最新の試合を再読み込み"
            className="p-1 rounded-lg hover:bg-stone-100 text-stone-500 hover:text-stone-900 transition ml-1"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* 🚨 1-Action Takeaway (次戦への最重要改善アクション・最優先ファーストビュー) */}
      <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-rose-50 border-2 border-rose-400/80 rounded-xl p-4 shadow-sm space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎯</span>
            <span className="text-xs font-black text-rose-950 uppercase tracking-wide">
              【実戦からの抽出】次戦で必ず意識する最重要改善アクション
            </span>
          </div>
          <span className="text-[10px] font-black bg-rose-600 text-white px-2 py-0.5 rounded font-mono">
            ボトルネック: {data.biggest_bottleneck.metric}
          </span>
        </div>
        <p className="text-xs md:text-sm font-black text-stone-900 leading-relaxed bg-white/95 p-3 rounded-lg border border-rose-200">
          {data.biggest_bottleneck.advice}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 1: 序盤15分メトリクス */}
        <div className="bg-stone-50/70 border border-stone-200 rounded-xl p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-stone-900 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-600" />
              1. 序盤15分CS ＆ レーン戦推移
            </span>
            <span className="text-[11px] font-black text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200">
              {data.early_game_metrics.lane_result}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white p-2.5 rounded-lg border border-stone-200">
              <div className="text-[10px] font-bold text-stone-400">15分CS数</div>
              <div className="text-base font-black text-stone-900 font-mono">{data.early_game_metrics.cs_at_15}</div>
              <div className="text-[9px] text-stone-500 font-bold">{data.early_game_metrics.cs_per_min_at_15} CS/分</div>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-stone-200">
              <div className="text-[10px] font-bold text-stone-400">ダメージ効率</div>
              <div className="text-base font-black text-emerald-700 font-mono">{data.early_game_metrics.trade_ratio}倍</div>
              <div className="text-[9px] text-stone-500">与ダメ / 被ダメ</div>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-stone-200">
              <div className="text-[10px] font-bold text-stone-400">15分差分</div>
              <div className={`text-base font-black font-mono ${data.early_game_metrics.gold_diff_at_15 >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                {data.early_game_metrics.gold_diff_at_15 >= 0 ? `+${data.early_game_metrics.gold_diff_at_15}` : data.early_game_metrics.gold_diff_at_15}G
              </div>
              <div className="text-[9px] text-stone-500 font-bold">対面ゴールド差</div>
            </div>
          </div>
        </div>

        {/* 2: アイテムビルド選択の分岐監査 (Build Audit) */}
        <div className="bg-stone-50/70 border border-stone-200 rounded-xl p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-stone-900 flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-sky-600" />
              2. ビルド選択の分岐監査 (Build Audit)
            </span>
            <span className="text-[11px] font-black text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-200 font-mono">
              スコア: {data.build_audit.score}点 ({data.build_audit.grade}ランク)
            </span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            {data.build_audit.items_audited.map((item, idx) => (
              <div key={idx} className="bg-white p-2 rounded-lg border border-stone-200 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="font-extrabold text-stone-800">{item.item_name}</span>
                  <span className="text-[10px] text-stone-400 ml-1.5 font-mono">({item.timing})</span>
                  <p className="text-[10px] text-stone-600 truncate mt-0.5">{item.reason}</p>
                </div>
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded shrink-0">
                  {item.audit}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 3: リコール＆ウェーブ テンポロス逆再生 (インタラクティブ・タイムライン視覚化) */}
        <div className="bg-stone-50/70 border border-stone-200 rounded-xl p-4 space-y-3.5 shadow-2xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-black text-stone-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-purple-600" />
              <span>
                {data.is_jungle
                  ? '3. ジャングル周回 ＆ リコールテンポ監査'
                  : '3. テンポロス逆再生 (タイムラインリコール監査)'}
              </span>
            </span>
            <div className="flex items-center gap-2">
              {data.is_jungle ? (
                <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono">
                  🌿 JG専任 (レーンウェーブ損失免除)
                </span>
              ) : (
                <span className="text-[10px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 font-mono">
                  総損失: -{data.recall_efficiency.total_loss_gold}G
                </span>
              )}
              <span className="text-[10px] font-bold text-stone-500 font-mono hidden sm:inline">
                {data.recall_efficiency.rating}
              </span>
            </div>
          </div>

          {/* 橫型タイムラインルーラー (各リコール地点のピン留め) */}
          {data.recall_efficiency.events.length > 0 && (
            <div className="space-y-2 bg-white p-3 rounded-xl border border-stone-200">
              <div className="flex items-center justify-between text-[10px] text-stone-400 font-mono px-0.5">
                <span>00:00 (開始)</span>
                <span className="text-purple-700 font-bold">全 {data.recall_efficiency.events.length} 回のリコール</span>
                <span>{data.match_duration_str || '試合終了'}</span>
              </div>

              {/* タイムライントラック */}
              <div className="relative w-full h-3 bg-stone-100 rounded-full my-3 border border-stone-200">
                {/* 各リコールのピン */}
                {data.recall_efficiency.events.map((ev, idx) => {
                  // 分秒からパーセンテージ位置を計算（基準: 最大時間または25分）
                  const parts = ev.time_str.split(':').map(Number);
                  const sec = (parts[0] || 0) * 60 + (parts[1] || 0);
                  const durParts = (data.match_duration_str || '25:00').split(':').map(Number);
                  const totalSec = Math.max(1200, (durParts[0] || 25) * 60 + (durParts[1] || 0));
                  const pct = Math.min(96, Math.max(4, Math.round((sec / totalSec) * 100)));

                  const isSelected = selectedRecallIdx === idx;
                  const hasLoss = (ev.loss_gold || 0) > 0;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedRecallIdx(idx)}
                      style={{ left: `${pct}%` }}
                      className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all cursor-pointer flex flex-col items-center group ${
                        isSelected ? 'z-20 scale-125' : 'z-10 hover:scale-110'
                      }`}
                      title={`リコール #${idx + 1} (${ev.time_str})`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-[9px] font-black shadow-xs ${
                          isSelected
                            ? 'bg-purple-600 text-white border-white ring-2 ring-purple-400'
                            : hasLoss
                            ? 'bg-amber-500 text-stone-950 border-white'
                            : 'bg-emerald-500 text-white border-white'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span
                        className={`text-[9px] font-mono font-bold mt-1 whitespace-nowrap px-1 rounded transition-colors ${
                          isSelected ? 'bg-purple-100 text-purple-900' : 'text-stone-400 group-hover:text-stone-700'
                        }`}
                      >
                        {ev.time_str}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* 選択中のリコール詳細インスペクター */}
              {(() => {
                const activeEv = data.recall_efficiency.events[selectedRecallIdx] || data.recall_efficiency.events[0];
                if (!activeEv) return null;
                return (
                  <div className="mt-4 pt-3 border-t border-stone-100 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-black bg-purple-100 text-purple-950 px-2 py-0.5 rounded border border-purple-200">
                          リコール #{selectedRecallIdx + 1} ({activeEv.time_str})
                        </span>
                        <span className="text-[10px] font-black text-stone-700 bg-stone-100 px-2 py-0.5 rounded">
                          所持G: {activeEv.gold_at_recall ? `${activeEv.gold_at_recall}G` : '未記録'}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-stone-800">
                        {activeEv.evaluation}
                      </span>
                    </div>

                    {/* 購入アイテム一覧 */}
                    {activeEv.bought_items && activeEv.bought_items.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap pt-0.5">
                        <span className="text-[10px] font-bold text-stone-400">購入:</span>
                        {activeEv.bought_items.map((item, i) => (
                          <span key={i} className="text-[10px] font-bold bg-stone-100 text-stone-800 px-1.5 py-0.2 rounded border border-stone-200">
                            🛒 {item}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* ウェーブ状況＆損失メトリクス */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                      <div className="bg-stone-50 p-1.5 rounded border border-stone-200">
                        <span className="text-stone-400 font-bold block">
                          {data.is_jungle ? '帰還時周回状況:' : '帰還時ウェーブ:'}
                        </span>
                        <span className="font-black text-stone-800">{activeEv.wave_state || (data.is_jungle ? 'キャンプ周回後' : 'ウェーブ押し込み後')}</span>
                      </div>
                      <div className="bg-stone-50 p-1.5 rounded border border-stone-200">
                        <span className="text-stone-400 font-bold block">
                          {data.is_jungle ? '周回テンポ損失:' : 'テンポ損失:'}
                        </span>
                        <span className={`font-mono font-black ${(activeEv.loss_gold || 0) > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {data.is_jungle
                            ? '中立キャンプ損失なし (良好) 🟢'
                            : (activeEv.loss_gold || 0) > 0
                            ? `-${activeEv.loss_gold}G (ミニオン${activeEv.loss_cs || 0}体損)`
                            : '損失なし (適格帰還)'}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-stone-600 leading-relaxed font-medium bg-purple-50/50 p-2 rounded-lg border border-purple-100">
                      💬 <span className="font-bold text-purple-950">判定:</span> {activeEv.detail}
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* 4: レーダー多角形指標 */}
        <div className="bg-stone-50/70 border border-stone-200 rounded-xl p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-stone-900 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-indigo-600" />
              4. 目標ランク水準とのギャップ比較
            </span>
            <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
              実戦スタッツ照合
            </span>
          </div>

          {/* レーダーメトリクスグリッド */}
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            {data.radar_metrics.map((m, idx) => (
              <div key={idx} className="bg-white p-2 rounded-lg border border-stone-200 flex items-center justify-between">
                <span className="font-bold text-stone-700">{m.subject}</span>
                <span className={`font-mono font-bold text-[10px] ${m.diff.startsWith('+') ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {m.diff}pt ({m.status})
                </span>
              </div>
            ))}
          </div>

          {/* 昇格ボトルネックアドバイス */}
          <div className="bg-rose-50/80 border border-rose-200/80 rounded-xl p-3 text-[11px] space-y-1">
            <div className="flex items-center gap-1.5 font-black text-rose-800">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>改善急所: {data.biggest_bottleneck.metric}</span>
            </div>
            <p className="text-stone-700 text-[10px] leading-relaxed">
              {data.biggest_bottleneck.advice}
            </p>
          </div>
        </div>
      </div>

      {/* 📝 この試合の気づき・反省メモ（後からいつでも追加・編集・保存可能） */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-stone-900 flex items-center gap-1.5">
            <span>📝</span>
            <span>この試合の反省・気づきメモ（後からいつでも編集可能）</span>
          </span>
          {memoSaved && (
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md animate-pulse">
              ✅ 保存完了！
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={memoText}
            onChange={(e) => setMemoText(e.target.value)}
            placeholder="例: レベル3ガンク時の寄り遅れを反省 / 敵JGの位置予測が当たってテンポ取れた"
            className="flex-1 px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button
            type="button"
            onClick={handleSaveMemo}
            disabled={savingMemo}
            className="px-4 py-2.5 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white rounded-xl text-xs font-black transition whitespace-nowrap cursor-pointer shadow-xs flex items-center justify-center gap-1.5 shrink-0"
          >
            <span>💾</span>
            <span>{savingMemo ? '保存中...' : 'メモを保存'}</span>
          </button>
        </div>
      </div>

      {/* 完全勝利サイクル: ナレッジ自動フィードバック同期バー */}
      <div className="bg-gradient-to-r from-amber-50 via-purple-50 to-emerald-50 border border-amber-200/80 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="space-y-0.5 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-black text-stone-900">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>完全勝利サイクル (The Sovereign Victory Loop) 連動</span>
          </div>
          <p className="text-[11px] text-stone-600 font-medium">
            この試合で得た確定データ（対面攻略 ＆ 改善点）をナレッジ辞典へ自動蓄積し、次回プレイ前へ循環させます。
          </p>
        </div>
        <button
          onClick={handleSyncFeedback}
          disabled={syncing || synced}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-xs transition-all shrink-0 cursor-pointer ${
            synced
              ? 'bg-emerald-600 text-white border border-emerald-500'
              : syncing
              ? 'bg-stone-700 text-stone-300 animate-pulse'
              : 'bg-stone-900 hover:bg-stone-800 text-white'
          }`}
        >
          <CheckCircle2 className={`w-4 h-4 ${synced ? 'text-white' : 'text-emerald-400'}`} />
          <span>{synced ? '✅ ナレッジ辞典に自動同期完了！' : syncing ? '同期中...' : '教訓をナレッジ辞典に自動同期'}</span>
        </button>
      </div>
    </div>
  );
}
