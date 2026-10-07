'use client';

import React, { useState } from 'react';
import {
  Swords,
  Sparkles,
  Shield,
  Zap,
  Target,
  RefreshCw,
  Award,
  Activity,
  Brain,
  CheckCircle2,
  AlertCircle,
  Eye,
  Crosshair,
  TrendingUp,
  Layers,
  ChevronRight,
  Flame,
} from 'lucide-react';

interface PlayerStats {
  riotId: string;
  tier: string;
  lp: number;
  mainRole: string;
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  kda: number;
  avgCsPerMin: number;
  avgGoldPerMin: number;
  avgVisionPerMin: number;
  avgKpPercent: number;
  avgDamageShare: number;
  scores: {
    survival: number;
    farm: number;
    combat: number;
    teamfight: number;
    objective: number;
  };
  topChampions: {
    name: string;
    games: number;
    wins: number;
    winRate: number;
    kda: number;
    avgCsPerMin: number;
  }[];
}

interface CommonChampComparison {
  championName: string;
  player1: {
    name: string;
    games: number;
    wins: number;
    winRate: number;
    kda: number;
    avgCsPerMin: number;
  };
  player2: {
    name: string;
    games: number;
    wins: number;
    winRate: number;
    kda: number;
    avgCsPerMin: number;
  };
}

interface CompareResponse {
  success: boolean;
  player1: PlayerStats;
  player2: PlayerStats;
  commonChampions: CommonChampComparison[];
  aiDiagnosis: {
    styleComparison: string;
    keyFactors: string;
    coachingAdvice: string;
  };
}

interface PlayerCompareViewProps {
  recentSearches: string[];
  onSaveRecent: (raw: string) => void;
}

export function PlayerCompareView({ recentSearches, onSaveRecent }: PlayerCompareViewProps) {
  const [p1Input, setP1Input] = useState('');
  const [p2Input, setP2Input] = useState('');
  const [matchCount, setMatchCount] = useState<number>(18);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CompareResponse | null>(null);

  // サモナー名とタグのパース
  const parseSummoner = (raw: string) => {
    const parts = raw.trim().split('#');
    const name = parts[0]?.trim() || '';
    const tag = parts[1]?.trim() || 'JP1';
    return { name, tag };
  };

  const handleRunCompare = async () => {
    const p1 = parseSummoner(p1Input);
    const p2 = parseSummoner(p2Input);

    if (!p1.name || !p2.name) {
      setError('比較する2人のプレイヤー名（名前#タグ）を両方入力してください。');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/analyzer/compare', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player1: { gameName: p1.name, tagLine: p1.tag },
          player2: { gameName: p2.name, tagLine: p2.tag },
          matchCount,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '2人比較解析に失敗しました');
      }

      setResult(data);
      onSaveRecent(`${p1.name}#${p1.tag}`);
      onSaveRecent(`${p2.name}#${p2.tag}`);
    } catch (err: any) {
      setError(err?.message || '通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 入力フォーム */}
      <div className="rounded-3xl border border-border bg-surface p-5 md:p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-center gap-4">
          {/* Player 1 入力 */}
          <div className="flex-1 w-full space-y-1.5">
            <div className="flex items-center justify-between text-xs font-black">
              <span className="text-secondary-500 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-secondary-500 inline-block animate-pulse"></span>
                プレイヤー 1（生徒 / 自分）
              </span>
              {p1Input && (
                <button
                  type="button"
                  onClick={() => setP1Input('')}
                  className="text-stone-400 hover:text-stone-600 text-[10px]"
                >
                  クリア
                </button>
              )}
            </div>
            <input
              type="text"
              value={p1Input}
              onChange={(e) => setP1Input(e.target.value)}
              placeholder="例: Kazurin#4036 または 生徒名#JP1"
              className="w-full px-4 py-2.5 bg-background border border-secondary-500/30 rounded-2xl text-xs font-bold text-foreground placeholder:text-stone-400 focus:outline-none focus:border-secondary-500 transition"
            />
          </div>

          {/* VS バッジ */}
          <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-2xl bg-stone-900 text-amber-400 font-black text-xs shadow-md border border-stone-800 my-1 md:my-0">
            VS
          </div>

          {/* Player 2 入力 */}
          <div className="flex-1 w-full space-y-1.5">
            <div className="flex items-center justify-between text-xs font-black">
              <span className="text-rose-500 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block animate-pulse"></span>
                プレイヤー 2（目標 / コーチ / ライバル）
              </span>
              {p2Input && (
                <button
                  type="button"
                  onClick={() => setP2Input('')}
                  className="text-stone-400 hover:text-stone-600 text-[10px]"
                >
                  クリア
                </button>
              )}
            </div>
            <input
              type="text"
              value={p2Input}
              onChange={(e) => setP2Input(e.target.value)}
              placeholder="例: yukizo#7867 または 目標プレイヤー#JP1"
              className="w-full px-4 py-2.5 bg-background border border-rose-500/30 rounded-2xl text-xs font-bold text-foreground placeholder:text-stone-400 focus:outline-none focus:border-rose-500 transition"
            />
          </div>

          {/* 取得試合数 ＆ 実行ボタン */}
          <div className="flex items-center gap-2 w-full md:w-auto shrink-0 pt-2 md:pt-5">
            <select
              value={matchCount}
              onChange={(e) => setMatchCount(Number(e.target.value))}
              className="px-3 py-2.5 bg-background border border-border rounded-2xl text-xs font-black text-foreground focus:outline-none cursor-pointer"
            >
              <option value={15}>直近 15 試合</option>
              <option value={20}>直近 20 試合</option>
              <option value={25}>直近 25 試合</option>
            </select>

            <button
              type="button"
              onClick={handleRunCompare}
              disabled={loading}
              className="flex-1 md:flex-initial px-6 py-2.5 bg-gradient-to-r from-stone-900 via-primary-900 to-stone-900 hover:from-stone-800 hover:to-primary-800 text-white font-black text-xs rounded-2xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw size={13} className="animate-spin text-amber-400" />
                  <span>2人分取得・対戦診断中...</span>
                </>
              ) : (
                <>
                  <Swords size={14} className="text-amber-400" />
                  <span>⚔️ 比較実行</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 検索履歴クイック挿入 */}
        {recentSearches.length > 0 && (
          <div className="pt-2 border-t border-border flex items-center gap-1.5 flex-wrap text-[11px]">
            <span className="text-stone-400 font-bold shrink-0">最近の履歴からセット:</span>
            {recentSearches.slice(0, 6).map((item) => (
              <div key={item} className="inline-flex items-center gap-1 bg-stone-100 dark:bg-stone-800 rounded-lg px-2 py-0.5">
                <span className="font-bold text-stone-700 dark:text-stone-300">{item}</span>
                <button
                  type="button"
                  onClick={() => setP1Input(item)}
                  className="text-[9px] text-secondary-600 dark:text-secondary-400 hover:underline font-black ml-1"
                  title="Player 1にセット"
                >
                  P1
                </button>
                <span className="text-stone-300">/</span>
                <button
                  type="button"
                  onClick={() => setP2Input(item)}
                  className="text-[9px] text-rose-600 dark:text-rose-400 hover:underline font-black"
                  title="Player 2にセット"
                >
                  P2
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-700 font-bold">
          <AlertCircle size={16} className="text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ローディング案内 */}
      {loading && (
        <div className="p-12 text-center space-y-4 bg-surface border border-border rounded-3xl">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-black text-foreground">Riot API から2人分の実戦データを取得・解析中</h3>
            <p className="text-xs text-stone-500 font-medium">
              ソロキューのマッチ履歴・スタッツ集計・Geminiによる比較診断を生成しています。最大20〜30秒かかります。
            </p>
          </div>
        </div>
      )}

      {/* 結果表示 */}
      {result && !loading && (
        <div className="space-y-8">
          {/* VS プロファイルカード */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Player 1 カード */}
            <div className="p-5 rounded-3xl bg-surface border-2 border-secondary-500/30 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 px-3 py-1 bg-secondary-500 text-white text-[10px] font-black rounded-bl-xl">
                PLAYER 1
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-secondary-50 dark:bg-secondary-950/40 border border-secondary-500/30 flex items-center justify-center text-secondary-600 dark:text-secondary-400 font-black text-lg">
                  {result.player1.riotId.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">{result.player1.riotId}</h3>
                  <div className="flex items-center gap-2 text-xs font-bold text-stone-500 mt-0.5">
                    <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-foreground font-black text-[11px]">
                      {result.player1.tier} ({result.player1.lp} LP)
                    </span>
                    <span>•</span>
                    <span className="text-secondary-600 dark:text-secondary-400 font-bold">{result.player1.mainRole}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t border-border">
                <div className="p-2 rounded-xl bg-stone-50 dark:bg-stone-900">
                  <div className="text-[10px] text-stone-400 font-bold">勝率</div>
                  <div className="text-sm font-black text-foreground">
                    {result.player1.winRate}%
                    <span className="text-[10px] text-stone-400 block font-normal">
                      ({result.player1.wins}勝{result.player1.losses}敗)
                    </span>
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-stone-50 dark:bg-stone-900">
                  <div className="text-[10px] text-stone-400 font-bold">KDA</div>
                  <div className="text-sm font-black text-secondary-600 dark:text-secondary-400">
                    {result.player1.kda}
                    <span className="text-[10px] text-stone-400 block font-normal">
                      {result.player1.avgKills}/{result.player1.avgDeaths}/{result.player1.avgAssists}
                    </span>
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-stone-50 dark:bg-stone-900">
                  <div className="text-[10px] text-stone-400 font-bold">CS / 分</div>
                  <div className="text-sm font-black text-foreground">
                    {result.player1.avgCsPerMin}
                    <span className="text-[10px] text-stone-400 block font-normal">
                      G: {result.player1.avgGoldPerMin}/m
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Player 2 カード */}
            <div className="p-5 rounded-3xl bg-surface border-2 border-rose-500/30 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 px-3 py-1 bg-rose-500 text-white text-[10px] font-black rounded-bl-xl">
                PLAYER 2
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 font-black text-lg">
                  {result.player2.riotId.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">{result.player2.riotId}</h3>
                  <div className="flex items-center gap-2 text-xs font-bold text-stone-500 mt-0.5">
                    <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-foreground font-black text-[11px]">
                      {result.player2.tier} ({result.player2.lp} LP)
                    </span>
                    <span>•</span>
                    <span className="text-rose-600 dark:text-rose-400 font-bold">{result.player2.mainRole}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t border-border">
                <div className="p-2 rounded-xl bg-stone-50 dark:bg-stone-900">
                  <div className="text-[10px] text-stone-400 font-bold">勝率</div>
                  <div className="text-sm font-black text-foreground">
                    {result.player2.winRate}%
                    <span className="text-[10px] text-stone-400 block font-normal">
                      ({result.player2.wins}勝{result.player2.losses}敗)
                    </span>
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-stone-50 dark:bg-stone-900">
                  <div className="text-[10px] text-stone-400 font-bold">KDA</div>
                  <div className="text-sm font-black text-rose-600 dark:text-rose-400">
                    {result.player2.kda}
                    <span className="text-[10px] text-stone-400 block font-normal">
                      {result.player2.avgKills}/{result.player2.avgDeaths}/{result.player2.avgAssists}
                    </span>
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-stone-50 dark:bg-stone-900">
                  <div className="text-[10px] text-stone-400 font-bold">CS / 分</div>
                  <div className="text-sm font-black text-foreground">
                    {result.player2.avgCsPerMin}
                    <span className="text-[10px] text-stone-400 block font-normal">
                      G: {result.player2.avgGoldPerMin}/m
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI コーチング・ライバル比較診断カード */}
          <div className="rounded-3xl border border-stone-800 bg-gradient-to-br from-stone-900 via-stone-850 to-stone-950 p-6 text-white shadow-lg space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-400/20 text-amber-400 border border-amber-400/30">
                <Brain size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black flex items-center gap-2">
                  <span>🧠 AI 比較診断 ＆ コーチングアドバイス</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
                    実戦データ完全連動
                  </span>
                </h3>
                <p className="text-[11px] text-stone-400">
                  実測スタッツから読み取れるスタイル差と、ランク・勝率を分けている決定的な差
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {/* スタイル対比 */}
              <div className="p-4 rounded-2xl bg-stone-800/60 border border-stone-700/50 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
                  <Activity size={14} />
                  <span>1. プレイスタイルの対比</span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed font-medium">
                  {result.aiDiagnosis.styleComparison}
                </p>
              </div>

              {/* 決定打 */}
              <div className="p-4 rounded-2xl bg-stone-800/60 border border-stone-700/50 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-rose-300">
                  <Target size={14} />
                  <span>2. 差を生む決定的な要因</span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed font-medium">
                  {result.aiDiagnosis.keyFactors}
                </p>
              </div>

              {/* 指導・アドバイス */}
              <div className="p-4 rounded-2xl bg-stone-800/60 border border-stone-700/50 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-emerald-300">
                  <Sparkles size={14} />
                  <span>3. コーチング / 戦術対策</span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed font-medium">
                  {result.aiDiagnosis.coachingAdvice}
                </p>
              </div>
            </div>
          </div>

          {/* スタッツ直接対決（VSバー比較） */}
          <div className="p-6 rounded-3xl bg-surface border border-border shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                <Swords size={16} className="text-primary-600" />
                <span>重要メトリクス直接対決 (Head-to-Head)</span>
              </h3>
              <div className="flex items-center gap-4 text-[11px] font-black">
                <span className="text-secondary-500">● {result.player1.riotId}</span>
                <span className="text-rose-500">● {result.player2.riotId}</span>
              </div>
            </div>

            {/* バー比較項目一覧 */}
            <div className="space-y-4">
              {/* KDA */}
              <MetricComparisonBar
                label="KDA 比率"
                v1={result.player1.kda}
                v2={result.player2.kda}
                v1Label={`${result.player1.kda}`}
                v2Label={`${result.player2.kda}`}
                higherIsBetter={true}
              />

              {/* 平均デス数 (低い方が良い) */}
              <MetricComparisonBar
                label="平均デス数 (低リスク)"
                v1={result.player1.avgDeaths}
                v2={result.player2.avgDeaths}
                v1Label={`${result.player1.avgDeaths}回`}
                v2Label={`${result.player2.avgDeaths}回`}
                higherIsBetter={false}
              />

              {/* CS/分 */}
              <MetricComparisonBar
                label="CS / 分 (ファーム精度)"
                v1={result.player1.avgCsPerMin}
                v2={result.player2.avgCsPerMin}
                v1Label={`${result.player1.avgCsPerMin}`}
                v2Label={`${result.player2.avgCsPerMin}`}
                higherIsBetter={true}
              />

              {/* キル関与率 */}
              <MetricComparisonBar
                label="キル関与率 (KP%)"
                v1={result.player1.avgKpPercent}
                v2={result.player2.avgKpPercent}
                v1Label={`${result.player1.avgKpPercent}%`}
                v2Label={`${result.player2.avgKpPercent}%`}
                higherIsBetter={true}
              />

              {/* ダメージシェア */}
              <MetricComparisonBar
                label="ダメージシェア (%)"
                v1={result.player1.avgDamageShare}
                v2={result.player2.avgDamageShare}
                v1Label={`${result.player1.avgDamageShare}%`}
                v2Label={`${result.player2.avgDamageShare}%`}
                higherIsBetter={true}
              />

              {/* 分間視界スコア */}
              <MetricComparisonBar
                label="分間視界スコア (マップ把握)"
                v1={result.player1.avgVisionPerMin}
                v2={result.player2.avgVisionPerMin}
                v1Label={`${result.player1.avgVisionPerMin}`}
                v2Label={`${result.player2.avgVisionPerMin}`}
                higherIsBetter={true}
              />

              {/* 分間ゴールド */}
              <MetricComparisonBar
                label="分間獲得ゴールド"
                v1={result.player1.avgGoldPerMin}
                v2={result.player2.avgGoldPerMin}
                v1Label={`${result.player1.avgGoldPerMin}G`}
                v2Label={`${result.player2.avgGoldPerMin}G`}
                higherIsBetter={true}
              />
            </div>
          </div>

          {/* 5大総合能力スコア対比 */}
          <div className="p-6 rounded-3xl bg-surface border border-border shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                <Award size={16} className="text-amber-500" />
                <span>5大能力スコア対比 (0〜100pt)</span>
              </h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
              <ScoreCard
                label="🛡️ 生存力"
                s1={result.player1.scores.survival}
                s2={result.player2.scores.survival}
              />
              <ScoreCard
                label="🌾 ファーム力"
                s1={result.player1.scores.farm}
                s2={result.player2.scores.farm}
              />
              <ScoreCard
                label="⚔️ 戦闘関与"
                s1={result.player1.scores.combat}
                s2={result.player2.scores.combat}
              />
              <ScoreCard
                label="👥 集団戦力"
                s1={result.player1.scores.teamfight}
                s2={result.player2.scores.teamfight}
              />
              <ScoreCard
                label="🐉 オブジェクト"
                s1={result.player1.scores.objective}
                s2={result.player2.scores.objective}
              />
            </div>
          </div>

          {/* 共通チャンピオン直接対決 ＆ 各自の主力プール */}
          <div className="space-y-6">
            {/* 共通チャンピオン対決 */}
            {result.commonChampions && result.commonChampions.length > 0 && (
              <div className="p-6 rounded-3xl bg-surface border-2 border-amber-500/30 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Crosshair size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground">
                      🎯 共通プール直接比較 (同一チャンピオン対決)
                    </h3>
                    <p className="text-[11px] text-stone-500 font-medium">
                      両者が直近で使用している共通ピックの成績比較です。
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.commonChampions.map((c) => (
                    <div
                      key={c.championName}
                      className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-border space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sm text-foreground">{c.championName}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-bold">
                          共通ピック
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {/* P1 */}
                        <div className="p-2.5 rounded-xl bg-secondary-50/60 dark:bg-secondary-950/30 border border-secondary-500/20 space-y-1">
                          <div className="text-[10px] font-black text-secondary-600 dark:text-secondary-400 truncate">
                            {result.player1.riotId}
                          </div>
                          <div className="font-black text-foreground">
                            勝率 {c.player1.winRate}% ({c.player1.games}戦)
                          </div>
                          <div className="text-[11px] text-stone-500 font-bold">
                            KDA: {c.player1.kda} / CS: {c.player1.avgCsPerMin}
                          </div>
                        </div>

                        {/* P2 */}
                        <div className="p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-500/20 space-y-1">
                          <div className="text-[10px] font-black text-rose-600 dark:text-rose-400 truncate">
                            {result.player2.riotId}
                          </div>
                          <div className="font-black text-foreground">
                            勝率 {c.player2.winRate}% ({c.player2.games}戦)
                          </div>
                          <div className="text-[11px] text-stone-500 font-bold">
                            KDA: {c.player2.kda} / CS: {c.player2.avgCsPerMin}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 各自の主力プール */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* P1 トップピック */}
              <div className="p-5 rounded-3xl bg-surface border border-border shadow-sm space-y-3">
                <h4 className="text-xs font-black text-secondary-600 dark:text-secondary-400 flex items-center gap-1.5">
                  <span>●</span>
                  <span>{result.player1.riotId} の主力ピック</span>
                </h4>
                <div className="space-y-2">
                  {result.player1.topChampions.map((c) => (
                    <div
                      key={c.name}
                      className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 flex items-center justify-between text-xs"
                    >
                      <span className="font-black text-foreground">{c.name}</span>
                      <div className="flex items-center gap-3 font-bold text-[11px]">
                        <span className="text-stone-500">{c.games}戦</span>
                        <span className="text-foreground">{c.winRate}%</span>
                        <span className="text-secondary-600 dark:text-secondary-400 font-black">KDA {c.kda}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* P2 トップピック */}
              <div className="p-5 rounded-3xl bg-surface border border-border shadow-sm space-y-3">
                <h4 className="text-xs font-black text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <span>●</span>
                  <span>{result.player2.riotId} の主力ピック</span>
                </h4>
                <div className="space-y-2">
                  {result.player2.topChampions.map((c) => (
                    <div
                      key={c.name}
                      className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 flex items-center justify-between text-xs"
                    >
                      <span className="font-black text-foreground">{c.name}</span>
                      <div className="flex items-center gap-3 font-bold text-[11px]">
                        <span className="text-stone-500">{c.games}戦</span>
                        <span className="text-foreground">{c.winRate}%</span>
                        <span className="text-rose-600 dark:text-rose-400 font-black">KDA {c.kda}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 指標対決バー部品
function MetricComparisonBar({
  label,
  v1,
  v2,
  v1Label,
  v2Label,
  higherIsBetter,
}: {
  label: string;
  v1: number;
  v2: number;
  v1Label: string;
  v2Label: string;
  higherIsBetter: boolean;
}) {
  const sum = Math.max(0.001, v1 + v2);
  const p1Ratio = Math.round((v1 / sum) * 100);
  const p2Ratio = 100 - p1Ratio;

  const p1Wins = higherIsBetter ? v1 > v2 : v1 < v2;
  const p2Wins = higherIsBetter ? v2 > v1 : v2 < v1;
  const isTie = v1 === v2;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-black">
        <span className={`flex items-center gap-1 ${p1Wins ? 'text-secondary-600 dark:text-secondary-400 font-black' : 'text-stone-500'}`}>
          {p1Wins && <span>👑</span>}
          <span>{v1Label}</span>
        </span>
        <span className="text-[11px] text-stone-400 font-bold">{label}</span>
        <span className={`flex items-center gap-1 ${p2Wins ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-stone-500'}`}>
          <span>{v2Label}</span>
          {p2Wins && <span>👑</span>}
        </span>
      </div>

      {/* バーグラフ */}
      <div className="h-2.5 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden flex">
        <div
          style={{ width: `${p1Ratio}%` }}
          className={`h-full transition-all duration-500 ${
            p1Wins ? 'bg-secondary-500' : 'bg-secondary-300 dark:bg-secondary-800'
          }`}
        />
        <div
          style={{ width: `${p2Ratio}%` }}
          className={`h-full transition-all duration-500 ${
            p2Wins ? 'bg-rose-500' : 'bg-rose-300 dark:bg-rose-800'
          }`}
        />
      </div>
    </div>
  );
}

// スコアカード部品
function ScoreCard({ label, s1, s2 }: { label: string; s1: number; s2: number }) {
  const diff = s1 - s2;
  return (
    <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-border text-center space-y-1.5">
      <div className="text-[11px] font-black text-stone-500 truncate">{label}</div>
      <div className="flex items-center justify-center gap-2 text-xs font-black">
        <span className={s1 >= s2 ? 'text-secondary-600 dark:text-secondary-400' : 'text-stone-400'}>
          {s1}
        </span>
        <span className="text-stone-300 text-[10px]">vs</span>
        <span className={s2 >= s1 ? 'text-rose-600 dark:text-rose-400' : 'text-stone-400'}>
          {s2}
        </span>
      </div>
      <div className="text-[10px] font-bold">
        {diff > 0 ? (
          <span className="text-secondary-600 dark:text-secondary-400">P1が+{diff}優位</span>
        ) : diff < 0 ? (
          <span className="text-rose-600 dark:text-rose-400">P2が+{Math.abs(diff)}優位</span>
        ) : (
          <span className="text-stone-400">同等</span>
        )}
      </div>
    </div>
  );
}
