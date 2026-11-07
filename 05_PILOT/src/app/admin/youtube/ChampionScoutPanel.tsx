'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Target, Sparkles, RefreshCw, Layers, CheckCircle2, AlertCircle, Compass, ChevronDown, ChevronUp } from 'lucide-react';

interface ChampionItem {
  id: string;
  name: string;
  jpName: string;
  roles: string[];
  articleCount: number;
  hasPendingQueue?: boolean;
}

const ROLE_ITEMS = [
  { key: 'ALL', label: '全ロール' },
  { key: 'TOP', label: 'TOP' },
  { key: 'MID', label: 'MID' },
  { key: 'BOT', label: 'ADC (BOT)' },
  { key: 'SUP', label: 'SUP' },
  { key: 'JG', label: 'JG' },
] as const;
type RoleKey = typeof ROLE_ITEMS[number]['key'];

export default function ChampionScoutPanel() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    totalChampions: number;
    zeroCount: number;
    lowCount: number;
    roleStats: Record<string, { total: number; zero: number }>;
    zeroArticles: ChampionItem[];
    lowArticles: ChampionItem[];
  } | null>(null);

  const [activeRole, setActiveRole] = useState<RoleKey>('ALL');
  const [expanded, setExpanded] = useState(false);
  const [scoutingChamp, setScoutingChamp] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const showMsg = (text: string, ok: boolean) => {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 6000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/youtube/scout-champion');
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'データの取得に失敗しました');
      setData(json);
    } catch (e: any) {
      showMsg(e.message || 'データ取得エラー', false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 個別チャンピオンの動画補給
  const handleScout = async (champ: ChampionItem) => {
    setScoutingChamp(champ.id);
    setMessage(null);
    try {
      const res = await fetch('/api/youtube/scout-champion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ championId: champ.id, limit: 2 }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || json.message || 'スカウトに失敗しました');

      showMsg(
        `🎯 【${champ.jpName}】の解説動画を ${json.addedCount} 本、⚡ 優先度: 高（先頭割り込み）でキューに追加しました！`,
        true
      );
      fetchData();
    } catch (e: any) {
      showMsg(e.message || 'エラーが発生しました', false);
    } finally {
      setScoutingChamp(null);
    }
  };

  // 一括補給
  const handleBatchScout = async () => {
    setBatchLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/youtube/scout-champion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'batch', role: activeRole === 'ALL' ? undefined : activeRole }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || json.message || '一括補給に失敗しました');

      showMsg(`🚀 ${json.message}`, true);
      fetchData();
    } catch (e: any) {
      showMsg(e.message || '一括補給エラー', false);
    } finally {
      setBatchLoading(false);
    }
  };

  const filteredChamps = (data?.zeroArticles || []).filter((c) => {
    if (activeRole === 'ALL') return true;
    return c.roles.includes(activeRole);
  });

  return (
    <div className="bg-gradient-to-r from-amber-950/30 via-zinc-900 to-zinc-950 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Target size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">
                🎯 オンデマンド補給
              </span>
              <h3 className="text-sm sm:text-base font-black text-zinc-100">
                未開拓チャンピオン・優先スカウター
              </h3>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              記事が0本のチャンピオンを自動検出し、高レート実戦・解説動画をワンクリックでキューへ投入します。
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition"
            title="最新状況を再取得"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-850 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-bold transition cursor-pointer"
          >
            <span>{expanded ? 'パネルを閉じる' : '未開拓チャンプを展開'}</span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* 統計バッジ */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mt-3.5">
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-zinc-400 font-bold">記事0本 (未開拓)</div>
            <div className="text-base font-black text-amber-400">
              {data ? `${data.zeroCount}体` : '...'}
            </div>
          </div>
          <AlertCircle size={16} className="text-amber-500/60" />
        </div>

        {ROLE_ITEMS.filter((r) => r.key !== 'ALL').map((role) => {
          const stats = data?.roleStats?.[role.key];
          return (
            <div
              key={role.key}
              className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-2.5 flex items-center justify-between"
            >
              <div>
                <div className="text-[10px] text-zinc-400 font-bold">{role.label} 未開拓</div>
                <div className="text-sm font-black text-zinc-200">
                  {stats ? `${stats.zero}体 / ${stats.total}体` : '...'}
                </div>
              </div>
              <Compass size={14} className="text-zinc-500" />
            </div>
          );
        })}
      </div>

      {/* メッセージトースト */}
      {message && (
        <div
          className={`mt-3 p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${
            message.ok
              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40'
              : 'bg-rose-950/40 text-rose-300 border-rose-500/40'
          }`}
        >
          {message.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* 展開時の中身 */}
      {expanded && (
        <div className="mt-4 pt-3 border-t border-zinc-800/80 space-y-3">
          {/* フィルター＆一括補給バー */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {ROLE_ITEMS.map((role) => (
                <button
                  key={role.key}
                  onClick={() => setActiveRole(role.key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                    activeRole === role.key
                      ? 'bg-amber-500 text-zinc-950 font-black shadow-sm'
                      : 'bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                  }`}
                >
                  {role.label} {role.key !== 'ALL' && data?.roleStats?.[role.key] ? `(${data.roleStats[role.key].zero})` : ''}
                </button>
              ))}
            </div>

            <button
              onClick={handleBatchScout}
              disabled={batchLoading || filteredChamps.length === 0}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black text-xs shadow-md transition disabled:opacity-50 cursor-pointer shrink-0"
              title="選択中のロールから未開拓チャンプ上位3体を一括検索してキューに追加"
            >
              <Sparkles size={13} className={batchLoading ? 'animate-spin' : ''} />
              <span>{batchLoading ? 'スカウト中...' : `⚡ ${activeRole} 未開拓上位3体を一括補給`}</span>
            </button>
          </div>

          {/* チャンピオン一覧グリッド */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-72 overflow-y-auto pr-1">
            {filteredChamps.map((champ) => {
              const isBusy = scoutingChamp === champ.id;
              return (
                <div
                  key={champ.id}
                  className="bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 rounded-xl p-2 flex flex-col justify-between transition group"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-black text-zinc-200 truncate" title={champ.jpName}>
                      {champ.jpName}
                    </span>
                    <span className="text-[9px] font-mono text-zinc-500 uppercase">
                      {champ.roles[0] || ''}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-1">
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {champ.hasPendingQueue ? '⏳ キュー有' : '記事 0本'}
                    </span>

                    <button
                      onClick={() => handleScout(champ)}
                      disabled={isBusy || batchLoading}
                      className="px-2 py-0.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[10px] font-bold transition disabled:opacity-50 cursor-pointer flex items-center gap-1"
                      title="このチャンピオンの解説動画をYouTubeから検索してキューへ追加"
                    >
                      {isBusy ? <RefreshCw size={10} className="animate-spin" /> : <span>補給 +</span>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
