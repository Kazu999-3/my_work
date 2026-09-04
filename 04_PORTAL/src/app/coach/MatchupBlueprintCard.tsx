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

const MY_POOL_CHAMPIONS = [
  'Aatrox', 'Darius', 'Renekton', 'Riven', 'Camille', 'Fiora', 'Jax', 'Sett', 'Yone', 'Zed', 'Ahri', 'Sylas', 'Jinx', 'Kaisa'
];

const ENEMY_POPULAR_CHAMPIONS = [
  'Darius', 'Aatrox', 'Renekton', 'Riven', 'Jax', 'Fiora', 'Sett', 'Malphite', 'Garen', 'Irelia', 'Yone', 'Yasuo', 'Zed', 'Ahri', 'Sylas'
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
  const [hasIgnite, setHasIgnite] = useState(true);
  const [data, setData] = useState<BlueprintResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // 追加インテル (カウンター・ビルド・JG警戒・過去の反省遺言)
  const [activeTab, setActiveTab] = useState<'blueprint' | 'builds' | 'jungle'>('blueprint');
  const [counterData, setCounterData] = useState<any>(null);
  const [counterLoading, setCounterLoading] = useState(false);
  const [matchupWarning, setMatchupWarning] = useState<any>(null);

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
    fetch(`/api/lol/matchup-blueprint?my=${encodeURIComponent(myChamp)}&enemy=${encodeURIComponent(enemyChamp)}&level=${enemyLevel}&ignite=${hasIgnite}`)
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [myChamp, enemyChamp, enemyLevel, hasIgnite]);

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

  // 過去の反省遺言・対面過去戦績の取得
  useEffect(() => {
    if (!enemyChamp) return;
    fetch('/api/soloq/matchup-warning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ champion: myChamp, enemyChampion: enemyChamp })
    })
      .then((r) => r.json())
      .then((d) => {
        if (d && d.warning) {
          setMatchupWarning(d.warning);
        } else {
          setMatchupWarning(null);
        }
      })
      .catch(() => setMatchupWarning(null));
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
      {/* ⚠️ 過去の自分の反省遺言バナー（存在時最優先ポップアップ） */}
      {matchupWarning && (
        <div className="bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-amber-500/15 border-2 border-amber-500/60 rounded-xl p-3.5 shadow-2xs space-y-2 animate-in">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-600 animate-bounce" />
              <span>【過去の反省遺言】 vs {enemyChamp} 前回の教訓</span>
            </div>
            {matchupWarning.laneRecord && (
              <span className="text-[10px] font-black font-mono bg-white/90 text-stone-700 px-2 py-0.5 rounded border border-amber-300">
                対面勝率 {matchupWarning.laneRecord.gameWinRate}% ({matchupWarning.laneRecord.wins}勝 {matchupWarning.laneRecord.losses}敗)
              </span>
            )}
          </div>
          {matchupWarning.matchupMemo && (
            <p className="text-xs font-bold text-stone-800 bg-white/90 p-2 rounded-lg border border-amber-200/80 leading-relaxed">
              💬 <span className="text-amber-900 font-extrabold">メモ:</span> {matchupWarning.matchupMemo}
            </p>
          )}
          {matchupWarning.sentinelStrategy && (
            <p className="text-[11px] font-medium text-stone-700 leading-snug">
              🛡️ <span className="font-bold">対策要点:</span> {matchupWarning.sentinelStrategy}
            </p>
          )}
        </div>
      )}

      {/* ヘッダー: ドラフト即応セレクター ＆ 対戦カード ＆ Lv/スペル切替 */}
      <div className="border-b border-stone-100 pb-3.5 space-y-3">
        {/* 1段目: チャンピオンクイックセレクター (MyPool / 敵対面) */}
        <div className="bg-stone-50/90 border border-stone-200/90 rounded-xl p-3 space-y-2.5">
          {/* 自分側の選択 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black text-stone-700 flex items-center gap-1">
                <span>🛡️ 使用チャンピオン (My Pick):</span>
              </label>
              <input
                type="text"
                value={myChamp}
                onChange={(e) => handleMyChange(e.target.value)}
                placeholder="自チャンプ検索..."
                className="text-xs font-bold px-2 py-0.5 rounded border border-stone-300 bg-white text-stone-800 w-28 text-right outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[10px] font-bold text-stone-400 shrink-0 mr-0.5">MyPool:</span>
              {MY_POOL_CHAMPIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleMyChange(c)}
                  className={`shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold transition border ${
                    myChamp.toLowerCase() === c.toLowerCase()
                      ? 'bg-amber-500 text-stone-950 border-amber-600 shadow-2xs'
                      : 'bg-white text-stone-700 border-stone-200 hover:border-amber-300'
                  }`}
                >
                  <Image
                    src={getChampIcon(c)}
                    alt={c}
                    width={14}
                    height={14}
                    className="w-3.5 h-3.5 rounded-full"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <span>{c}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 敵側の選択 */}
          <div className="space-y-1.5 pt-1 border-t border-stone-200/60">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black text-rose-900 flex items-center gap-1">
                <span>⚔️ 敵チャンピオン (Enemy Pick):</span>
              </label>
              <input
                type="text"
                value={enemyChamp}
                onChange={(e) => handleEnemyChange(e.target.value)}
                placeholder="敵チャンプ検索..."
                className="text-xs font-bold px-2 py-0.5 rounded border border-rose-300 bg-white text-rose-900 w-28 text-right outline-none focus:border-rose-500"
              />
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[10px] font-bold text-stone-400 shrink-0 mr-0.5">人気対面:</span>
              {ENEMY_POPULAR_CHAMPIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleEnemyChange(c)}
                  className={`shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold transition border ${
                    enemyChamp.toLowerCase() === c.toLowerCase()
                      ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                      : 'bg-white text-stone-700 border-stone-200 hover:border-rose-300'
                  }`}
                >
                  <Image
                    src={getChampIcon(c)}
                    alt={c}
                    width={14}
                    height={14}
                    className="w-3.5 h-3.5 rounded-full"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <span>{c}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2段目: 対戦カードサマリー ＆ スペル/Lv切替 */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-stone-100/80 px-2.5 py-1 rounded-xl border border-stone-200">
              <div className="flex items-center gap-1.5">
                <Image
                  src={getChampIcon(myChamp)}
                  alt={myChamp}
                  width={22}
                  height={22}
                  className="w-5.5 h-5.5 rounded-full border border-amber-500 shrink-0"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <span className="font-black text-xs text-stone-900">{myChamp}</span>
              </div>
              <span className="text-[10px] font-black text-stone-400">VS</span>
              <div className="flex items-center gap-1.5">
                <Image
                  src={getChampIcon(enemyChamp)}
                  alt={enemyChamp}
                  width={22}
                  height={22}
                  className="w-5.5 h-5.5 rounded-full border border-rose-500 shrink-0"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <span className="font-black text-xs text-rose-900">{enemyChamp}</span>
              </div>
            </div>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-md text-[10px] font-black uppercase tracking-wider">
              公式計算キルライン
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* サモナースペル切替 */}
            <button
              type="button"
              onClick={() => setHasIgnite(!hasIgnite)}
              className={`px-2 py-1 rounded-md text-[11px] font-black border transition flex items-center gap-1 ${
                hasIgnite
                  ? 'bg-rose-100 text-rose-900 border-rose-300 shadow-2xs'
                  : 'bg-stone-100 text-stone-500 border-stone-200'
              }`}
            >
              <span>{hasIgnite ? '🔥' : '🌀'}</span>
              <span>{hasIgnite ? '敵Igniteあり' : 'TP/他スペル'}</span>
            </button>

            {/* 敵Lv切替 */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold text-stone-500">敵Lv:</span>
              <select
                value={enemyLevel}
                onChange={(e) => setEnemyLevel(parseInt(e.target.value, 10))}
                className="text-xs font-bold px-2 py-1 rounded-md border border-stone-200 bg-stone-50 text-stone-800 cursor-pointer font-mono"
              >
                <option value="3">Lv3 (序盤)</option>
                <option value="6">Lv6 (Ult)</option>
                <option value="11">Lv11 (中盤)</option>
                <option value="16">Lv16 (終盤)</option>
              </select>
            </div>
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

