'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, RefreshCw, X, ArrowLeftRight, Check, Search } from 'lucide-react';
import { CHAMPION_NAME_MAP, normalizeChampionName } from '../../lib/championNames';

interface ChampionQuickSelectorProps {
  myChampion: string;
  enemyChampion: string;
  onMyChampionChange: (champ: string) => void;
  onEnemyChampionChange: (champ: string) => void;
  onLiveMatchDetected?: (myChamp: string, enemyChamp: string) => void;
}

// ユーザーの主力JGプール（Kazurinお気に入り）
const MY_FAVORITE_CHAMPIONS = [
  { id: 'Graves', name: 'グレイブス' },
  { id: 'Viego', name: 'ヴィエゴ' },
  { id: 'Nidalee', name: 'ニダリー' },
  { id: 'Lillia', name: 'リリア' },
  { id: 'Hecarim', name: 'ヘカリム' },
  { id: 'Nocturne', name: 'ノクターン' },
  { id: 'Kindred', name: 'キンドレッド' },
  { id: 'Kayn', name: 'ケイン' },
  { id: 'Talon', name: 'タロン' },
  { id: 'Briar', name: 'ブライアー' },
];

// よくあるメタ対面JG
const META_ENEMY_CHAMPIONS = [
  { id: 'LeeSin', name: 'リー・シン' },
  { id: 'XinZhao', name: 'シン・ジャオ' },
  { id: 'JarvanIV', name: 'ジャーヴァンIV' },
  { id: 'Viego', name: 'ヴィエゴ' },
  { id: 'Nocturne', name: 'ノクターン' },
  { id: 'Vi', name: 'ヴァイ' },
  { id: 'MasterYi', name: 'マスター・イー' },
  { id: 'Zac', name: 'ザック' },
  { id: 'Amumu', name: 'アムム' },
  { id: 'Warwick', name: 'ワーウィック' },
  { id: 'Elise', name: 'エリス' },
  { id: 'Shaco', name: 'シャコ' },
];

// 日本語名辞書の作成（CHAMPION_NAME_MAPからユニークな一覧を抽出）
const ALL_CHAMPIONS_LIST: { id: string; nameJa: string }[] = (() => {
  const map = new Map<string, string>();
  for (const [key, id] of Object.entries(CHAMPION_NAME_MAP)) {
    // 日本語（カタカナ等）のエントリ
    if (/[\u3040-\u30ff]/.test(key)) {
      if (!map.has(id)) {
        map.set(id, key);
      }
    }
  }
  // マップにないチャンピオンもIDから追加
  for (const id of Object.values(CHAMPION_NAME_MAP)) {
    if (!map.has(id)) {
      map.set(id, id);
    }
  }
  return Array.from(map.entries())
    .map(([id, nameJa]) => ({ id, nameJa }))
    .sort((a, b) => a.id.localeCompare(b.id));
})();

function getDDragonIconUrl(championId: string): string {
  if (!championId) return '';
  const normalized = normalizeChampionName(championId);
  return `https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${normalized}.png`;
}

export default function ChampionQuickSelector({
  myChampion,
  enemyChampion,
  onMyChampionChange,
  onEnemyChampionChange,
  onLiveMatchDetected,
}: ChampionQuickSelectorProps) {
  const [myQuery, setMyQuery] = useState(myChampion);
  const [enemyQuery, setEnemyQuery] = useState(enemyChampion);
  const [isMyDropdownOpen, setIsMyDropdownOpen] = useState(false);
  const [isEnemyDropdownOpen, setIsEnemyDropdownOpen] = useState(false);
  const [detectingLive, setDetectingLive] = useState(false);
  const [liveDetectMessage, setLiveDetectMessage] = useState<string | null>(null);

  const myRef = useRef<HTMLDivElement>(null);
  const enemyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMyQuery(myChampion);
  }, [myChampion]);

  useEffect(() => {
    setEnemyQuery(enemyChampion);
  }, [enemyChampion]);

  // クリック外でドロップダウンを閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (myRef.current && !myRef.current.contains(e.target as Node)) {
        setIsMyDropdownOpen(false);
      }
      if (enemyRef.current && !enemyRef.current.contains(e.target as Node)) {
        setIsEnemyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 検索候補の絞り込み
  const filterChampions = (q: string) => {
    const term = q.trim().toLowerCase();
    if (!term) return ALL_CHAMPIONS_LIST.slice(0, 15);
    return ALL_CHAMPIONS_LIST.filter(
      (c) =>
        c.id.toLowerCase().includes(term) ||
        c.nameJa.toLowerCase().includes(term)
    ).slice(0, 20);
  };

  const handleSelectMyChamp = (champId: string) => {
    const normalized = normalizeChampionName(champId);
    onMyChampionChange(normalized);
    setMyQuery(normalized);
    setIsMyDropdownOpen(false);
  };

  const handleSelectEnemyChamp = (champId: string) => {
    const normalized = normalizeChampionName(champId);
    onEnemyChampionChange(normalized);
    setEnemyQuery(normalized);
    setIsEnemyDropdownOpen(false);
  };

  // 入れ替え
  const handleSwap = () => {
    const temp = myChampion;
    onMyChampionChange(enemyChampion);
    onEnemyChampionChange(temp);
  };

  // 進行中の試合から自動取得
  const handleDetectLiveMatch = async () => {
    setDetectingLive(true);
    setLiveDetectMessage(null);
    try {
      const res = await fetch('/api/riot/live-game');
      const data = await res.json();
      if (data && data.success && data.liveMatch) {
        const myDetected = data.liveMatch.myChampion || '';
        const enemyDetected = data.liveMatch.enemyChampion || '';
        if (myDetected) onMyChampionChange(myDetected);
        if (enemyDetected) onEnemyChampionChange(enemyDetected);
        setLiveDetectMessage(`✅ 進行中の試合を検出: ${myDetected} vs ${enemyDetected}`);
        if (onLiveMatchDetected) onLiveMatchDetected(myDetected, enemyDetected);
      } else {
        setLiveDetectMessage('⚠️ 進行中の試合（Active Game）が見つかりませんでした。');
      }
    } catch (e: any) {
      setLiveDetectMessage(`❌ 検出エラー: ${e.message || '通信失敗'}`);
    } finally {
      setDetectingLive(false);
      setTimeout(() => setLiveDetectMessage(null), 5000);
    }
  };

  const myFiltered = filterChampions(myQuery);
  const enemyFiltered = filterChampions(enemyQuery);

  return (
    <div className="rounded-3xl border border-stone-200/90 bg-white/95 p-5 shadow-xs space-y-4">
      {/* 上部ヘッダー ＆ ライブ自動検出ボタン */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
        <div>
          <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
            <span>🎯</span>
            <span>試合前 マッチアップ高速セレクター</span>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full border border-amber-200">
              ワンタップ入力対応
            </span>
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            自分と対面を選ぶだけで、カウンター・推奨ルーン・初動作戦が即座に同期展開されます。
          </p>
        </div>

        <button
          type="button"
          onClick={handleDetectLiveMatch}
          disabled={detectingLive}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white shadow-sm transition-all disabled:opacity-50 shrink-0 cursor-pointer"
        >
          <RefreshCw size={13} className={detectingLive ? 'animate-spin' : ''} />
          <span>{detectingLive ? '試合スキャン中...' : '🔴 進行中の試合から自動取得'}</span>
        </button>
      </div>

      {liveDetectMessage && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900 flex items-center justify-between animate-in fade-in">
          <span>{liveDetectMessage}</span>
          <button onClick={() => setLiveDetectMessage(null)} className="text-stone-400 hover:text-stone-600">
            <X size={13} />
          </button>
        </div>
      )}

      {/* 2カラム入力ボックス ＆ スワップボタン */}
      <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
        {/* 自分 (My Champion) */}
        <div className="md:col-span-5 relative" ref={myRef}>
          <label className="mb-1.5 flex items-center justify-between text-xs font-black text-stone-800">
            <span className="flex items-center gap-1.5 text-blue-700">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-600" />
              今日使うチャンピオン (自分)
            </span>
            {myChampion && (
              <button
                type="button"
                onClick={() => { onMyChampionChange(''); setMyQuery(''); }}
                className="text-[10px] text-stone-400 hover:text-stone-700 flex items-center gap-0.5"
              >
                <X size={11} /> クリア
              </button>
            )}
          </label>
          <div className="relative flex items-center">
            {myChampion ? (
              <img
                src={getDDragonIconUrl(myChampion)}
                alt={myChampion}
                className="absolute left-2.5 w-6 h-6 rounded-lg object-cover border border-blue-400 shadow-xs pointer-events-none"
                onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
              />
            ) : (
              <Search size={14} className="absolute left-3 text-stone-400 pointer-events-none" />
            )}
            <input
              type="text"
              value={myQuery}
              onChange={(e) => {
                setMyQuery(e.target.value);
                setIsMyDropdownOpen(true);
              }}
              onFocus={() => setIsMyDropdownOpen(true)}
              placeholder="例: Graves, グレイブス"
              className={`w-full rounded-2xl border bg-stone-50/70 py-2.5 pr-8 text-xs font-bold text-stone-900 outline-none transition-all focus:bg-white focus:ring-2 ${
                myChampion
                  ? 'pl-11 border-blue-300 focus:border-blue-500 focus:ring-blue-100'
                  : 'pl-9 border-stone-300 focus:border-amber-500 focus:ring-amber-100'
              }`}
            />
          </div>

          {/* オートコンプリート候補ドロップダウン */}
          {isMyDropdownOpen && (
            <div className="absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-1.5 shadow-xl space-y-0.5">
              {myFiltered.length === 0 ? (
                <div className="p-3 text-center text-xs text-stone-400">見つかりませんでした</div>
              ) : (
                myFiltered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectMyChamp(c.id)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs text-left hover:bg-stone-100 transition text-stone-800 cursor-pointer"
                  >
                    <img
                      src={getDDragonIconUrl(c.id)}
                      alt={c.id}
                      className="w-5 h-5 rounded-md object-cover border border-stone-200"
                      onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                    />
                    <span className="font-bold">{c.nameJa}</span>
                    <span className="text-[10px] text-stone-400 font-mono">({c.id})</span>
                    {normalizeChampionName(myChampion) === c.id && (
                      <Check size={12} className="ml-auto text-blue-600" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* スワップボタン */}
        <div className="md:col-span-1 flex justify-center py-1 md:py-0">
          <button
            type="button"
            onClick={handleSwap}
            title="自分と相手を入れ替え"
            className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 transition-all border border-stone-200/80 shadow-2xs cursor-pointer"
          >
            <ArrowLeftRight size={14} />
          </button>
        </div>

        {/* 相手 (Enemy Champion) */}
        <div className="md:col-span-5 relative" ref={enemyRef}>
          <label className="mb-1.5 flex items-center justify-between text-xs font-black text-stone-800">
            <span className="flex items-center gap-1.5 text-red-700">
              <span className="inline-block w-2 h-2 rounded-full bg-red-600" />
              対面の敵チャンピオン (相手)
            </span>
            {enemyChampion && (
              <button
                type="button"
                onClick={() => { onEnemyChampionChange(''); setEnemyQuery(''); }}
                className="text-[10px] text-stone-400 hover:text-stone-700 flex items-center gap-0.5"
              >
                <X size={11} /> クリア
              </button>
            )}
          </label>
          <div className="relative flex items-center">
            {enemyChampion ? (
              <img
                src={getDDragonIconUrl(enemyChampion)}
                alt={enemyChampion}
                className="absolute left-2.5 w-6 h-6 rounded-lg object-cover border border-red-400 shadow-xs pointer-events-none"
                onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
              />
            ) : (
              <Search size={14} className="absolute left-3 text-stone-400 pointer-events-none" />
            )}
            <input
              type="text"
              value={enemyQuery}
              onChange={(e) => {
                setEnemyQuery(e.target.value);
                setIsEnemyDropdownOpen(true);
              }}
              onFocus={() => setIsEnemyDropdownOpen(true)}
              placeholder="例: LeeSin, リー・シン"
              className={`w-full rounded-2xl border bg-stone-50/70 py-2.5 pr-8 text-xs font-bold text-stone-900 outline-none transition-all focus:bg-white focus:ring-2 ${
                enemyChampion
                  ? 'pl-11 border-red-300 focus:border-red-500 focus:ring-red-100'
                  : 'pl-9 border-stone-300 focus:border-amber-500 focus:ring-amber-100'
              }`}
            />
          </div>

          {/* オートコンプリート候補ドロップダウン */}
          {isEnemyDropdownOpen && (
            <div className="absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-1.5 shadow-xl space-y-0.5">
              {enemyFiltered.length === 0 ? (
                <div className="p-3 text-center text-xs text-stone-400">見つかりませんでした</div>
              ) : (
                enemyFiltered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectEnemyChamp(c.id)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs text-left hover:bg-stone-100 transition text-stone-800 cursor-pointer"
                  >
                    <img
                      src={getDDragonIconUrl(c.id)}
                      alt={c.id}
                      className="w-5 h-5 rounded-md object-cover border border-stone-200"
                      onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                    />
                    <span className="font-bold">{c.nameJa}</span>
                    <span className="text-[10px] text-stone-400 font-mono">({c.id})</span>
                    {normalizeChampionName(enemyChampion) === c.id && (
                      <Check size={12} className="ml-auto text-red-600" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ワンタップクイックチップ群 */}
      <div className="space-y-2 pt-1 border-t border-stone-100">
        {/* 自分の主力プール */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-stone-500 shrink-0">
            ⭐ 自分の主力:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {MY_FAVORITE_CHAMPIONS.map((c) => {
              const isSelected = normalizeChampionName(myChampion) === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectMyChamp(c.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-700 shadow-xs scale-[1.03]'
                      : 'bg-stone-100/90 hover:bg-blue-50 hover:text-blue-800 hover:border-blue-200 text-stone-700 border-stone-200/80'
                  }`}
                >
                  <img
                    src={getDDragonIconUrl(c.id)}
                    alt={c.name}
                    className="w-3.5 h-3.5 rounded-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                  />
                  <span>{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 人気メタ対面 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-stone-500 shrink-0">
            ⚔️ メタ対面:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {META_ENEMY_CHAMPIONS.map((c) => {
              const isSelected = normalizeChampionName(enemyChampion) === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectEnemyChamp(c.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-red-600 text-white border-red-700 shadow-xs scale-[1.03]'
                      : 'bg-stone-100/90 hover:bg-red-50 hover:text-red-800 hover:border-red-200 text-stone-700 border-stone-200/80'
                  }`}
                >
                  <img
                    src={getDDragonIconUrl(c.id)}
                    alt={c.name}
                    className="w-3.5 h-3.5 rounded-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                  />
                  <span>{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
