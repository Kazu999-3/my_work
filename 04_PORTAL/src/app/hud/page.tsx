'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Swords, ShieldAlert, Target, RefreshCw, ExternalLink } from 'lucide-react';

interface JgTimingInfo {
  fastestClearSec: number | null;
  avg1stCoreSec: number | null;
  warningSkills: string[];
  earlyPathAdvice: string;
}

export default function MinimalHudPage() {
  const [myChamp, setMyChamp] = useState('Hecarim');
  const [enemyChamp, setEnemyChamp] = useState('LeeSin');
  const [focusPoint, setFocusPoint] = useState('');
  const [loading, setLoading] = useState(false);
  const [jgTiming, setJgTiming] = useState<JgTimingInfo | null>(null);

  // localStorage から最新の今日のテーマを自動同期
  useEffect(() => {
    const loadFocus = () => {
      try {
        const saved = localStorage.getItem('today_soloq_focus') || 'ファームとオブジェクトのテンポ管理';
        setFocusPoint(saved);
      } catch {}
    };
    loadFocus();
    window.addEventListener('storage', loadFocus);
    return () => window.removeEventListener('storage', loadFocus);
  }, []);

  // 対面JG情報の取得
  const fetchJgInfo = async () => {
    if (!enemyChamp) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/champions/timings?champion=${encodeURIComponent(enemyChamp)}`);
      if (res.ok) {
        const d = await res.json();
        setJgTiming({
          fastestClearSec: d.external_fastest_clear_sec || 195,
          avg1stCoreSec: d.avg_first_core_sec || 660,
          warningSkills: d.warning_skills || ['Q (必殺接近)', 'R (ノックバック)'],
          earlyPathAdvice: d.external_fastest_clear_sec && d.external_fastest_clear_sec <= 190
            ? '⚡ 超高速フルクリア型: 2:55スカトルで先行されます。逆サイドスカトルまたは対角ガンク推奨。'
            : '⚔️ 標準〜戦闘型: 2:55スカトルで遭遇戦の可能性高。味方の寄りを確認して勝負。',
        });
      } else {
        // フォールバック
        setJgTiming({
          fastestClearSec: 195,
          avg1stCoreSec: 660,
          warningSkills: ['主要CC', 'ブリンク'],
          earlyPathAdvice: '2:55 初代スカトル発生。相手の位置を確認して逆サイドへ展開。',
        });
      }
    } catch {
      setJgTiming({
        fastestClearSec: 195,
        avg1stCoreSec: 660,
        warningSkills: ['主要CC'],
        earlyPathAdvice: '2:55 初代スカトル発生。マップを注視。',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJgInfo();
  }, [enemyChamp]);

  const formatSec = (sec: number | null) => {
    if (!sec) return '3:15';
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const openMiniWindow = () => {
    window.open(
      '/hud',
      'LoL_Minimal_HUD',
      'width=420,height=600,menubar=no,toolbar=no,location=no,status=no,resizable=yes'
    );
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-stone-100 font-sans p-3 sm:p-4 select-none flex flex-col justify-between">
      <div className="space-y-3">
        {/* トップバー */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-black tracking-wider text-stone-300 uppercase">
              JG In-Game HUD
            </span>
          </div>
          <button
            type="button"
            onClick={openMiniWindow}
            className="text-[10px] bg-stone-800 hover:bg-stone-700 text-stone-300 px-2 py-1 rounded border border-stone-700 flex items-center gap-1 cursor-pointer transition"
            title="別ウィンドウで小窓表示"
          >
            <ExternalLink size={10} />
            <span>小窓化</span>
          </button>
        </div>

        {/* チャンピオン入力バー */}
        <div className="grid grid-cols-2 gap-2 bg-[#12151d] p-2 rounded-xl border border-stone-800/80">
          <div>
            <label className="text-[9px] font-bold text-stone-400 block uppercase">自JG</label>
            <input
              type="text"
              value={myChamp}
              onChange={(e) => setMyChamp(e.target.value)}
              placeholder="自分 (例: Hecarim)"
              className="w-full bg-[#181d28] border border-stone-700 rounded px-2 py-1 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-[9px] font-bold text-rose-400 block uppercase">敵JG (対面)</label>
            <input
              type="text"
              value={enemyChamp}
              onChange={(e) => setEnemyChamp(e.target.value)}
              placeholder="相手 (例: LeeSin)"
              className="w-full bg-[#181d28] border border-rose-900/60 rounded px-2 py-1 text-xs font-bold text-white focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>

        {/* 🎯 今日の意識テーマ (最重要フォーカス) */}
        <div className="bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-transparent p-2.5 rounded-xl border border-amber-600/40">
          <div className="text-[10px] font-black text-amber-400 flex items-center gap-1 uppercase tracking-wide">
            <Target size={12} className="text-amber-400" />
            <span>今日の意識テーマ (最優先)</span>
          </div>
          <div className="text-xs font-bold text-amber-100 mt-1 leading-snug">
            {focusPoint || 'ファームとオブジェクトのテンポ管理'}
          </div>
        </div>

        {/* ⏰ 初動3分 ＆ 2:55スカトル判断 */}
        <div className="bg-[#12151d] p-2.5 rounded-xl border border-stone-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-stone-300 flex items-center gap-1">
              <Swords size={13} className="text-rose-400" />
              <span>敵JGの初動テンポ</span>
            </span>
            {loading ? (
              <RefreshCw size={12} className="animate-spin text-stone-500" />
            ) : (
              <span className="font-mono font-black text-rose-400 text-sm">
                フルクリア: {formatSec(jgTiming?.fastestClearSec ?? null)}
              </span>
            )}
          </div>

          <div className="bg-[#181d28] p-2 rounded border border-stone-800 text-[11px] text-stone-300 leading-relaxed">
            <strong className="text-amber-300 block mb-0.5">🦀 2:55 初代スカトル判断:</strong>
            {jgTiming?.earlyPathAdvice || '2:55 初代スカトル発生。マップを注視して勝負または逆サイド回避。'}
          </div>
        </div>

        {/* ⚠️ 警戒スキル ＆ オブジェクト時間 */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-[#12151d] p-2 rounded-xl border border-stone-800 space-y-1">
            <div className="text-[10px] font-bold text-rose-400 flex items-center gap-1">
              <ShieldAlert size={11} />
              <span>敵の警戒スキル</span>
            </div>
            <ul className="text-[10px] text-stone-300 space-y-0.5 font-medium">
              {jgTiming?.warningSkills?.map((s, idx) => (
                <li key={idx}>・{s}</li>
              )) || <li>・主要CCに警戒</li>}
            </ul>
          </div>

          <div className="bg-[#12151d] p-2 rounded-xl border border-stone-800 space-y-1">
            <div className="text-[10px] font-bold text-sky-400 flex items-center gap-1">
              <Sparkles size={11} />
              <span>オブジェクト時間</span>
            </div>
            <div className="text-[10px] text-stone-300 space-y-0.5 font-mono font-semibold">
              <div>・2:55 スカトル</div>
              <div>・5:00 ドラゴン</div>
              <div>・8:00 グラブ</div>
            </div>
          </div>
        </div>
      </div>

      {/* フッター */}
      <div className="pt-2 text-center text-[9px] text-stone-600 border-t border-stone-800/60 mt-3">
        Sovereign Antigravity HUD • Sub-Monitor View
      </div>
    </div>
  );
}
