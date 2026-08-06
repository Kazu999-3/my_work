'use client';

import React, { useState, useMemo } from 'react';
import { Shield, Swords, Zap, Activity, CheckCircle2 } from 'lucide-react';

interface Recommendation {
  champion: string;
  role: string;
  reason: string;
  synergyScore: number;
  counterScore: number;
}

export default function PickRecommendationTab() {
  const [role, setRole] = useState('MID');
  const [allyPicks, setAllyPicks] = useState({
    top: '',
    jg: '',
    mid: '',
    adc: '',
    sup: '',
  });
  const [enemyPickInput, setEnemyPickInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommends, setRecommends] = useState<Recommendation[]>([]);
  const [summary, setSummary] = useState('');

  // リアルタイムチーム構成相性 ＆ 勝率期待値 Synergy Meter のリアルタイム計算
  const synergyStats = useMemo(() => {
    const picks = Object.values(allyPicks).filter(Boolean);
    if (picks.length === 0) {
      return {
        winrateExpectation: 50,
        apAdBalance: 'バランス良好 (AP 50% / AD 50%)',
        engageScore: 60,
        durabilityScore: 50,
        advice: '味方のチャンピオンを入力すると構成相性と勝率期待値がリアルタイム計算されます。',
      };
    }

    // ダメージタイプ / ロール簡易判定
    let apCount = 0;
    let adCount = 0;
    let tankCount = 0;
    let ccCount = 0;

    const lowerPicks = picks.map((p) => p.toLowerCase());

    lowerPicks.forEach((p) => {
      if (['ahri', 'syndra', 'lux', 'veigar', 'viktor', 'vladimir', 'elise', 'evelynn', 'karma', 'nami', 'leona', 'maokai', 'amumu', 'xerath', 'brand', 'anivia'].some(k => p.includes(k))) {
        apCount++;
      } else {
        adCount++;
      }

      if (['malphite', 'ornn', 'sion', 'sejuani', 'zac', 'maokai', 'alistar', 'leona', 'nautilus', 'shen', 'rammus', 'ksante', 'tahm'].some(k => p.includes(k))) {
        tankCount++;
        ccCount++;
      }
      if (['nautilus', 'leona', 'amumu', 'sejuani', 'zac', 'malphite', 'jarvan', 'vi', 'rakan', 'yone', 'yasuo'].some(k => p.includes(k))) {
        ccCount++;
      }
    });

    const apRatio = Math.round((apCount / picks.length) * 100);
    const adRatio = 100 - apRatio;

    let balanceText = `AP ${apRatio}% / AD ${adRatio}%`;
    if (apRatio >= 80) balanceText = `⚠️ 魔法ダメージ過多 (${balanceText})`;
    else if (adRatio >= 80) balanceText = `⚠️ 物理ダメージ過多 (${balanceText})`;
    else balanceText = `✅ 良好なダメージバランス (${balanceText})`;

    const engageScore = Math.min(100, Math.max(30, ccCount * 30 + 30));
    const durabilityScore = Math.min(100, Math.max(30, tankCount * 35 + 30));

    // 期待値計算
    let winrateExpectation = 50;
    if (apRatio >= 30 && apRatio <= 70) winrateExpectation += 5;
    if (tankCount >= 1) winrateExpectation += 6;
    if (ccCount >= 2) winrateExpectation += 7;

    return {
      winrateExpectation: Math.min(78, Math.max(35, winrateExpectation)),
      apAdBalance: balanceText,
      engageScore,
      durabilityScore,
      advice: tankCount === 0 ? 'フロントライン（前線タンク）が不在です。集団戦で耐久できるピックを推奨します。' : 'バランスの取れた良い構成です。',
    };
  }, [allyPicks]);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const enemies = enemyPickInput.split(',').map((s) => s.trim()).filter(Boolean);
      const res = await fetch('/api/soloq/pick-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, enemyTeam: enemies }),
      });
      const data = await res.json();
      setRecommends(data.recommendations || []);
      setSummary(data.analysisSummary || '');
    } catch {
      setRecommends([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 🏆 チーム構成相性 ＆ 勝率期待値 Synergy Meter (リアルタイム診断) */}
      <div className="bg-gradient-to-r from-amber-900/10 via-amber-800/5 to-amber-900/10 border border-amber-300/60 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-extrabold text-stone-900">🏆 チーム構成相性 ＆ 勝率期待値 Synergy Meter</h3>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-full">
            リアルタイムAI診断
          </span>
        </div>

        {/* 味方5体のクイックピック入力 */}
        <div className="grid grid-cols-5 gap-2 bg-white/80 p-3 rounded-xl border border-stone-200">
          {(['top', 'jg', 'mid', 'adc', 'sup'] as const).map((pos) => (
            <div key={pos}>
              <label className="block text-[9px] font-bold text-stone-500 uppercase mb-0.5">{pos}</label>
              <input
                type="text"
                placeholder={pos.toUpperCase()}
                value={allyPicks[pos]}
                onChange={(e) => setAllyPicks((prev) => ({ ...prev, [pos]: e.target.value }))}
                className="w-full px-2 py-1 border border-stone-200 rounded text-xs bg-stone-50 font-bold focus:outline-none focus:border-amber-500"
              />
            </div>
          ))}
        </div>

        {/* 診断メーター結果 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {/* 勝率期待値メーター */}
          <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-sm flex flex-col justify-between">
            <div className="text-[10px] font-bold text-stone-500 uppercase">勝率期待値 (構成スコア)</div>
            <div className="flex items-baseline gap-1.5 my-1">
              <span className="text-2xl font-black text-amber-700">{synergyStats.winrateExpectation}%</span>
              <span className="text-[10px] text-stone-400 font-bold">標準: 50%</span>
            </div>
            <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden border border-stone-200">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-600 transition-all duration-500"
                style={{ width: `${synergyStats.winrateExpectation}%` }}
              />
            </div>
          </div>

          {/* ダメージバランス */}
          <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-sm flex flex-col justify-between">
            <div className="text-[10px] font-bold text-stone-500 uppercase">AP / AD ダメージバランス</div>
            <div className="text-xs font-extrabold text-stone-800 my-1 truncate">{synergyStats.apAdBalance}</div>
            <div className="text-[10px] text-stone-500 font-medium truncate">{synergyStats.advice}</div>
          </div>

          {/* 集団戦 ＆ 耐久度 */}
          <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-sm space-y-1.5 justify-between">
            <div className="flex justify-between items-center text-[10px] font-bold text-stone-600">
              <span>集団戦エンゲージ力:</span>
              <span className="font-extrabold text-stone-900">{synergyStats.engageScore} / 100</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-bold text-stone-600">
              <span>フロントライン耐久度:</span>
              <span className="font-extrabold text-stone-900">{synergyStats.durabilityScore} / 100</span>
            </div>
          </div>
        </div>
      </div>

      {/* 推奨ピック分析フォーム */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-black/5 p-3.5 rounded-xl border border-black/10">
        <div>
          <label className="block text-[11px] font-bold text-foreground/60 mb-1">担当レーン</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="TOP">TOP (トップ)</option>
            <option value="JUNGLE">JUNGLE (ジャングル)</option>
            <option value="MID">MID (ミッド)</option>
            <option value="ADC">ADC (ボットキャリー)</option>
            <option value="SUPPORT">SUPPORT (サポート)</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-[11px] font-bold text-foreground/60 mb-1">相手の確定ピック (カンマ区切り・任意)</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="例: Malphite, Yasuo"
              value={enemyPickInput}
              onChange={(e) => setEnemyPickInput(e.target.value)}
              className="flex-1 px-3 py-2 border border-stone-300 rounded-lg bg-white text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button
              type="button"
              onClick={fetchRecommendations}
              disabled={loading}
              className="px-4 py-2 bg-amber-700 hover:bg-amber-800 active:scale-95 text-white font-bold text-xs rounded-lg shadow transition-all shrink-0 disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-white border-t-transparent shrink-0" />
                  <span>AI計算中...</span>
                </>
              ) : (
                '推奨ピック表示'
              )}
            </button>
          </div>
        </div>
      </div>

      {summary && <p className="text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200 p-2.5 rounded-lg">{summary}</p>}

      {recommends.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {recommends.map((rec, idx) => (
            <div key={rec.champion} className="bg-white border border-stone-200 rounded-xl p-3.5 shadow-sm space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                  第 {idx + 1} 推奨
                </span>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                  相性: {rec.synergyScore}%
                </span>
              </div>
              <h4 className="font-extrabold text-base text-stone-900">{rec.champion}</h4>
              <p className="text-xs text-stone-600 leading-relaxed font-medium">{rec.reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
