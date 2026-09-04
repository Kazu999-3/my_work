'use client';

import { useEffect, useState } from 'react';
import { Skull, Zap, ChevronRight, Swords, ArrowRightLeft, Shield, Sparkles, Compass, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import { getChampIcon } from '../../lib/ddragonClient';
import EarlyJunglePathingCard from './EarlyJunglePathingCard';

interface Phase {
  phase: string;
  title: string;
  action: string;
  win_trigger: string;
  badge: string;
}

interface KillLineData {
  total_lethal_damage: number;
  raw_burst_damage: number;
  ignite_damage: number;
  kill_hp_percent: number;
  my_max_hp: number;
  safe_hp_threshold: number;
  danger_badge: string;
  danger_color: string;
  advice: string;
}

interface BlueprintResponse {
  success: boolean;
  my_champion: string;
  enemy_champion: string;
  enemy_level: number;
  kill_line: KillLineData;
  blueprint: {
    phases: Phase[];
  };
}

const COMMON_CHAMPIONS = [
  'Darius', 'Aatrox', 'Zed', 'Ahri', 'Riven', 'Renekton', 'Fiora', 'Jax', 'Malphite', 'Garen', 'Irelia', 'Yone', 'Yasuo', 'Kassadin', 'Sylas'
];

export default function MatchupBlueprintCard({
  myChampion: initialMyChampion = 'Aatrox',
  enemyChampion: initialEnemyChampion = 'Darius',
  onMyChampionChange,
  onEnemyChampionChange,
}: {
  myChampion?: string;
  enemyChampion?: string;
  onMyChampionChange?: (champ: string) => void;
  onEnemyChampionChange?: (champ: string) => void;
}) {
  const [myChamp, setMyChamp] = useState(initialMyChampion);
  const [enemyChamp, setEnemyChamp] = useState(initialEnemyChampion);
  const [enemyLevel, setEnemyLevel] = useState(6);
  const [data, setData] = useState<BlueprintResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // 追加インテル (カウンター・ビルド・JG警戒)
  const [activeTab, setActiveTab] = useState<'blueprint' | 'builds' | 'jungle'>('blueprint');
  const [counterData, setCounterData] = useState<any>(null);
  const [counterLoading, setCounterLoading] = useState(false);

  // 外部からのprops更新に同期
  useEffect(() => {
    if (initialMyChampion) setMyChamp(initialMyChampion);
  }, [initialMyChampion]);

  useEffect(() => {
    if (initialEnemyChampion) setEnemyChamp(initialEnemyChampion);
  }, [initialEnemyChampion]);

  const handleMyChange = (val: string) => {
    setMyChamp(val);
    if (onMyChampionChange) onMyChampionChange(val);
  };

  const handleEnemyChange = (val: string) => {
    setEnemyChamp(val);
    if (onEnemyChampionChange) onEnemyChampionChange(val);
  };

  useEffect(() => {
    if (!enemyChamp) return;
    setLoading(true);
    fetch(`/api/lol/matchup-blueprint?my=${encodeURIComponent(myChamp)}&enemy=${encodeURIComponent(enemyChamp)}&level=${enemyLevel}`)
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [myChamp, enemyChamp, enemyLevel]);

  // カウンター＆ビルド情報の取得
  useEffect(() => {
    if (!enemyChamp) return;
    setCounterLoading(true);
    fetch('/api/coach/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'counter_pick', enemyChampion: enemyChamp, myChampion: myChamp })
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setCounterData(d);
        setCounterLoading(false);
      })
      .catch(() => setCounterLoading(false));
  }, [myChamp, enemyChamp]);

  if (loading && !data) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs animate-pulse">
        <div className="h-4 bg-stone-200 rounded w-1/3 mb-3"></div>
        <div className="h-16 bg-stone-100 rounded-xl mb-4"></div>
        <div className="h-24 bg-stone-100 rounded-xl"></div>
      </div>
    );
  }

  if (!data || !data.kill_line) return null;

  const { kill_line, blueprint } = data;

  return (
    <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-sm text-stone-900 space-y-4">
      {/* ヘッダー ＆ 動的対面セレクター */}
      <div className="border-b border-stone-100 pb-3 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-md text-[10px] font-black uppercase tracking-wider shadow-2xs">
              Sovereign Pre-Game Hub
            </span>
            <h3 className="text-sm md:text-base font-extrabold text-stone-900 flex items-center gap-1.5">
              <span>⚔️ ドラフト勝率最大化 1画面作戦司令塔</span>
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-stone-500">敵Lv想定:</span>
            <select
              value={enemyLevel}
              onChange={(e) => setEnemyLevel(parseInt(e.target.value, 10))}
              className="text-xs font-bold px-2 py-1 rounded-md border border-stone-200 bg-stone-50 text-stone-800 cursor-pointer font-mono"
            >
              <option value="3">Lv3 (序盤)</option>
              <option value="6">Lv6 (Ult習得)</option>
              <option value="11">Lv11 (中盤)</option>
              <option value="16">Lv16 (レイト)</option>
            </select>
          </div>
        </div>

        {/* 動的対面切り替えセレクター */}
        <div className="flex items-center gap-2 bg-stone-50/90 p-2.5 rounded-xl border border-stone-200/80 flex-wrap">
          <div className="flex items-center gap-2 min-w-[150px]">
            <Image
              src={getChampIcon(myChamp)}
              alt={myChamp}
              width={26}
              height={26}
              className="w-6.5 h-6.5 rounded-full border border-amber-500 shrink-0"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-stone-400">自分</span>
              <select
                value={myChamp}
                onChange={(e) => handleMyChange(e.target.value)}
                className="text-xs font-black px-2 py-0.5 rounded-md border border-stone-200 bg-white text-stone-900 cursor-pointer"
              >
                {COMMON_CHAMPIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <ArrowRightLeft className="w-3.5 h-3.5 text-stone-400 shrink-0" />

          <div className="flex items-center gap-2 min-w-[150px]">
            <Image
              src={getChampIcon(enemyChamp)}
              alt={enemyChamp}
              width={26}
              height={26}
              className="w-6.5 h-6.5 rounded-full border border-rose-500 shrink-0"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-stone-400">敵対面</span>
              <select
                value={enemyChamp}
                onChange={(e) => handleEnemyChange(e.target.value)}
                className="text-xs font-black px-2 py-0.5 rounded-md border border-stone-200 bg-white text-rose-800 cursor-pointer"
              >
                {COMMON_CHAMPIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* クイック選択チップ */}
          <div className="flex items-center gap-1 flex-wrap ml-auto">
            <span className="text-[10px] text-stone-400 font-bold">即切替:</span>
            {['Darius', 'Zed', 'Ahri', 'Riven', 'Renekton'].map((c) => (
              <button
                key={c}
                onClick={() => handleEnemyChange(c)}
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border transition-colors ${
                  enemyChamp === c
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                }`}
              >
                vs {c}
              </button>
            ))}
          </div>
        </div>

        {/* 3大サブタブ切替 */}
        <div className="flex items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => setActiveTab('blueprint')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1 ${
              activeTab === 'blueprint'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>手順書 ＆ 即死ライン</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('builds')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1 ${
              activeTab === 'builds'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>推奨ルーン ＆ 初期ビルド</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('jungle')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1 ${
              activeTab === 'jungle'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-sky-400" />
            <span>初動JGルート警戒</span>
          </button>
        </div>
      </div>

      {/* タブ1: 手順書 ＆ 即死ライン */}
      {activeTab === 'blueprint' && (
        <div className="space-y-4 animate-in">
          {/* 即死キルライン（致死ダメージ）境界メーター */}
          <div className="bg-gradient-to-br from-rose-50/70 via-amber-50/40 to-white border border-rose-200/80 rounded-xl p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Skull className="w-4 h-4 text-rose-600" />
                <span className="text-xs font-black text-stone-900">
                  即死キルライン（敵 {data.enemy_champion} Lv{data.enemy_level} 最大瞬間火力）
                </span>
              </div>
              <span className="text-xs font-black text-rose-700 font-mono bg-rose-100/90 px-2.5 py-0.5 rounded-md border border-rose-200">
                {kill_line.total_lethal_damage} dmg (HP {kill_line.kill_hp_percent}% 以下即死) {kill_line.danger_badge}
              </span>
            </div>

            {/* 視覚的HP即死メーター */}
            <div className="space-y-1">
              <div className="h-4 w-full bg-stone-200 rounded-full overflow-hidden flex border border-stone-300">
                {/* 安全ゾーン */}
                <div
                  style={{ width: `${100 - kill_line.kill_hp_percent}%` }}
                  className="bg-emerald-500 h-full flex items-center justify-center text-[9px] font-black text-white"
                >
                  安全圏 (HP {100 - kill_line.kill_hp_percent}%以上)
                </div>
                {/* 即死ゾーン */}
                <div
                  style={{ width: `${kill_line.kill_hp_percent}%` }}
                  className="bg-rose-500 h-full flex items-center justify-center text-[9px] font-black text-white animate-pulse"
                >
                  💀 即死圏 ({kill_line.kill_hp_percent}%)
                </div>
              </div>
              <div className="flex justify-between text-[10px] font-mono font-bold text-stone-400">
                <span>0 HP</span>
                <span>致死境界: {kill_line.total_lethal_damage} HP</span>
                <span>最大 {kill_line.my_max_hp} HP</span>
              </div>
            </div>

            <p className="text-xs font-bold text-stone-700 bg-white/90 p-2.5 rounded-lg border border-rose-100 leading-relaxed">
              💡 <span className="text-rose-700 font-extrabold">【安全管理】</span> {kill_line.advice}
            </p>
          </div>

          {/* レーン戦3段階勝ちパターン手順書 */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-black text-stone-800">
              <Zap className="w-4 h-4 text-amber-600" />
              <span>{data.my_champion} vs {data.enemy_champion} 3段階勝ちパターン・タイムライン</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {blueprint.phases.map((p, idx) => (
                <div
                  key={idx}
                  className="bg-stone-50/80 border border-stone-200 rounded-xl p-3.5 space-y-2 flex flex-col justify-between shadow-2xs hover:border-amber-300 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-extrabold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded border border-amber-200">
                        {p.phase}
                      </span>
                      <span className="font-bold text-stone-600 text-[10px]">
                        {p.badge}
                      </span>
                    </div>
                    <h4 className="text-xs font-black text-stone-900 leading-snug">
                      {p.title}
                    </h4>
                    <p className="text-[11px] text-stone-600 leading-relaxed font-medium">
                      {p.action}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-stone-200/70 text-[10px] text-emerald-800 font-bold bg-emerald-50/80 p-1.5 rounded">
                    🎯 クリア条件: {p.win_trigger}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* タブ2: 推奨ルーン ＆ 初期ビルド */}
      {activeTab === 'builds' && (
        <div className="space-y-3 animate-in">
          {counterLoading ? (
            <div className="p-6 text-center text-xs text-stone-500 font-bold animate-pulse">
              ビルド＆ルーン最適解を計算中...
            </div>
          ) : counterData ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 推奨ルーン */}
                <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-stone-900">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>推奨ルーン構成</span>
                  </div>
                  <div className="text-xs font-extrabold text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    {counterData.recommendedRunes || '征服者 / 不撓不屈 / 息継ぎ'}
                  </div>
                  <p className="text-[11px] text-stone-600 leading-relaxed font-medium">
                    {counterData.runeReason || '対面の持続ダメージを息継ぎで相殺し、長期トレードで勝率を最大化します。'}
                  </p>
                </div>

                {/* 推奨初手アイテム・ブーツ */}
                <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-stone-900">
                    <Shield className="w-3.5 h-3.5 text-emerald-600" />
                    <span>初手アイテム ＆ 対策ビルド</span>
                  </div>
                  <div className="text-xs font-extrabold text-emerald-900 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                    {counterData.recommendedItems || 'ドランシールド ＋ プレートスチールキャップ'}
                  </div>
                  <p className="text-[11px] text-stone-600 leading-relaxed font-medium">
                    {counterData.itemReason || '物理バーストを抑えつつ、序盤のCS獲得スタビリティを確保。'}
                  </p>
                </div>
              </div>

              {/* カウンター留意点 */}
              {counterData.tips && (
                <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-xl text-xs text-stone-800 leading-relaxed font-medium">
                  <span className="font-black text-amber-900 block mb-1">💡 対面トレードの極意:</span>
                  {counterData.tips}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-stone-500">
              ビルドデータが取得できませんでした
            </div>
          )}
        </div>
      )}

      {/* タブ3: 初動JGルート警戒 */}
      {activeTab === 'jungle' && (
        <div className="animate-in">
          <EarlyJunglePathingCard myChampion={myChamp} enemyChampion={enemyChamp} />
        </div>
      )}
    </div>
  );
}

