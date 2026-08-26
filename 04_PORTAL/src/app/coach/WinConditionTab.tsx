'use client';

import React, { useState } from 'react';
import { apiJson } from '../../lib/apiClient';
import { ShieldAlert, Zap, Target, Swords, Users, Clock, Sparkles } from 'lucide-react';

const ROLES = [
  { id: 'TOP', label: 'TOP', icon: '🛡️' },
  { id: 'JG', label: 'JG', icon: '🌲' },
  { id: 'MID', label: 'MID', icon: '🧙' },
  { id: 'ADC', label: 'ADC', icon: '🏹' },
  { id: 'SUP', label: 'SUP', icon: '✨' },
];

export default function WinConditionTab() {
  const [allies, setAllies] = useState<Record<string, string>>({
    TOP: '', JG: '', MID: '', ADC: '', SUP: '',
  });
  const [enemies, setEnemies] = useState<Record<string, string>>({
    TOP: '', JG: '', MID: '', ADC: '', SUP: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  const handleDiagnose = async () => {
    setError('');
    const allyList = Object.entries(allies).map(([role, champion]) => ({ role, champion: champion.trim() }));
    const enemyList = Object.entries(enemies).map(([role, champion]) => ({ role, champion: champion.trim() }));

    const hasAlly = allyList.some((a) => a.champion);
    const hasEnemy = enemyList.some((e) => e.champion);

    if (!hasAlly || !hasEnemy) {
      setError('味方と敵のチャンピオンをそれぞれ1体以上入力してください。');
      return;
    }

    setLoading(true);
    try {
      const data = await apiJson('/api/coach/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'win_condition',
          allies: allyList,
          enemies: enemyList,
        }),
      });

      if (data.error) throw new Error(data.error);
      setResult(data.result);
    } catch (e: any) {
      setError(e.message || '勝ち筋診断に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setAllies({ TOP: '', JG: '', MID: '', ADC: '', SUP: '' });
    setEnemies({ TOP: '', JG: '', MID: '', ADC: '', SUP: '' });
    setResult(null);
    setError('');
  };

  return (
    <div className="space-y-6">
      {/* 説明ヘッダー */}
      <div className="rounded-2xl border border-amber-300/80 bg-gradient-to-br from-amber-50 to-orange-50/50 p-4 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-black text-amber-900 uppercase">
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span>ピック画面 ＆ 構成勝ち筋診断 (Win Condition)</span>
        </div>
        <p className="text-xs text-stone-700 mt-1 leading-relaxed font-medium">
          味方と敵のピックを入力すると、AIが「誰を育てるべきか」「集団戦 vs スプリット」「JGとしてのゲームプラン」を瞬時に診断します。
        </p>
      </div>

      {/* ピック入力グリッド */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 味方チーム */}
        <div className="bg-sky-50/60 border border-sky-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-sky-950 flex items-center gap-1.5">
              <span>🔵</span> 味方チーム構成
            </h3>
            <span className="text-[10px] text-sky-700 font-bold">自陣</span>
          </div>

          <div className="space-y-2">
            {ROLES.map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <span className="w-14 text-[11px] font-bold text-stone-600 flex items-center gap-1">
                  <span>{r.icon}</span> {r.label}
                </span>
                <input
                  type="text"
                  placeholder={`例: ${r.id === 'JG' ? 'Hecarim' : r.id === 'TOP' ? 'Aatrox' : r.id === 'MID' ? 'Ahri' : r.id === 'ADC' ? 'Jinx' : 'Thresh'}`}
                  value={allies[r.id]}
                  onChange={(e) => setAllies((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-semibold text-stone-900"
                />
              </div>
            ))}
          </div>
        </div>

        {/* 敵チーム */}
        <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-rose-950 flex items-center gap-1.5">
              <span>🔴</span> 敵チーム構成
            </h3>
            <span className="text-[10px] text-rose-700 font-bold">敵陣</span>
          </div>

          <div className="space-y-2">
            {ROLES.map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <span className="w-14 text-[11px] font-bold text-stone-600 flex items-center gap-1">
                  <span>{r.icon}</span> {r.label}
                </span>
                <input
                  type="text"
                  placeholder={`例: ${r.id === 'JG' ? 'Lee Sin' : r.id === 'TOP' ? 'Jax' : r.id === 'MID' ? 'Syndra' : r.id === 'ADC' ? 'KaiSa' : 'Nautilus'}`}
                  value={enemies[r.id]}
                  onChange={(e) => setEnemies((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-rose-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-semibold text-stone-900"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* アクションボタン */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleDiagnose}
          disabled={loading}
          className="flex-1 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>AIが構成と勝ち筋を分析中...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>勝ち筋（Win Condition）を診断する</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={loading}
          className="px-4 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl border border-stone-300 transition cursor-pointer"
        >
          クリア
        </button>
      </div>

      {error && <p className="text-xs font-bold text-rose-600 text-center">❌ {error}</p>}

      {/* 診断結果表示 */}
      {result && (
        <div className="space-y-4 animate-in fade-in">
          {/* 最重要勝ち筋カード */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl p-5 shadow-sm space-y-2">
            <div className="text-[11px] font-black uppercase tracking-wider text-amber-100 flex items-center gap-1.5">
              <Target className="w-4 h-4" />
              <span>最重要勝ち筋 (Core Win Condition)</span>
            </div>
            <p className="text-base sm:text-lg font-black leading-snug">
              {result.winCondition}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 構成タイプ & パワースパイク対比 */}
            <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="text-xs font-black text-stone-900 flex items-center gap-1.5">
                <Swords className="w-4 h-4 text-amber-600" />
                <span>構成タイプ ＆ パワースパイク比較</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center bg-stone-50 p-2.5 rounded-lg">
                  <span className="font-bold text-sky-800">味方構成タイプ</span>
                  <span className="font-black text-stone-800">{result.teamCompType?.ally}</span>
                </div>
                <div className="flex justify-between items-center bg-stone-50 p-2.5 rounded-lg">
                  <span className="font-bold text-rose-800">敵構成タイプ</span>
                  <span className="font-black text-stone-800">{result.teamCompType?.enemy}</span>
                </div>
              </div>

              {result.powerSpikeComparison && (
                <div className="pt-2 border-t border-stone-100 space-y-2 text-xs">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-stone-50 p-2 rounded-lg">
                      <div className="text-[10px] text-stone-400 font-bold">序盤(〜10分)</div>
                      <div className="font-bold text-stone-800 mt-0.5">{result.powerSpikeComparison.early}</div>
                    </div>
                    <div className="bg-stone-50 p-2 rounded-lg">
                      <div className="text-[10px] text-stone-400 font-bold">中盤(10〜25分)</div>
                      <div className="font-bold text-stone-800 mt-0.5">{result.powerSpikeComparison.mid}</div>
                    </div>
                    <div className="bg-stone-50 p-2 rounded-lg">
                      <div className="text-[10px] text-stone-400 font-bold">終盤(25分〜)</div>
                      <div className="font-bold text-stone-800 mt-0.5">{result.powerSpikeComparison.late}</div>
                    </div>
                  </div>
                  {result.powerSpikeComparison.criticalWindow && (
                    <div className="text-center text-[11px] font-bold text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200">
                      ⚡ 勝負を決めるべき時間帯: <span className="font-black">{result.powerSpikeComparison.criticalWindow}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* キープレイヤー ＆ 警戒敵 */}
            <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="text-xs font-black text-stone-900 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-600" />
                <span>勝敗を分ける重要チャンピオン</span>
              </div>

              {/* 育てるべき味方 */}
              <div className="bg-emerald-50/80 border border-emerald-200 p-3 rounded-xl space-y-1">
                <div className="text-[10px] font-black text-emerald-900 flex items-center gap-1">
                  <span>👑</span> 最優先で育てるべき味方
                </div>
                <p className="text-xs text-stone-800 font-bold leading-relaxed">
                  {result.keyPlayerToFeed}
                </p>
              </div>

              {/* 警戒すべき敵 */}
              <div className="bg-rose-50/80 border border-rose-200 p-3 rounded-xl space-y-1">
                <div className="text-[10px] font-black text-rose-900 flex items-center gap-1">
                  <span>⚠️</span> 最も警戒すべき敵
                </div>
                <p className="text-xs text-stone-800 font-bold leading-relaxed">
                  {result.dangerEnemy}
                </p>
              </div>
            </div>
          </div>

          {/* JGゲームプラン */}
          {result.jgGamePlan?.length > 0 && (
            <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="text-xs font-black text-stone-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>🌲 JG視点でのタイムライン別ゲームプラン</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {result.jgGamePlan.map((plan: string, idx: number) => (
                  <div key={idx} className="bg-stone-50 border border-stone-200 p-3 rounded-xl space-y-1">
                    <div className="text-[10px] font-black text-amber-800">
                      Step {idx + 1}
                    </div>
                    <p className="text-stone-800 font-semibold leading-relaxed">
                      {plan}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
