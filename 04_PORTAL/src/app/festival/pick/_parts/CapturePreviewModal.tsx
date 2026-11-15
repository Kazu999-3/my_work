'use client';

import React, { useState, useMemo } from 'react';
import { Camera, Copy, Check, Maximize2, Shield } from 'lucide-react';
import { toast } from '../../../../components/Toaster';
import { getChampIcon } from '../../../../lib/ddragonClient';
import {
  REGIONS,
  ROLES_LIST,
  RegionKey,
  ChampionRole,
  type ChampionMeta,
} from '../../../../lib/championMetadata';

interface CapturePreviewModalProps {
  filteredChamps: ChampionMeta[];
  excludedIds: Set<string>;
  activeCount: number;
  captureGroupBy: 'region' | 'role' | 'flat';
  setCaptureGroupBy: React.Dispatch<React.SetStateAction<'region' | 'role' | 'flat'>>;
  onClose: () => void;
}

export function CompactCaptureIcon({
  meta,
  size = 'compact',
  showName = false,
}: {
  meta: ChampionMeta;
  size?: 'compact' | 'tiny' | 'micro';
  showName?: boolean;
}) {
  const isMicro = size === 'micro';
  const isTiny = size === 'tiny';

  const iconBox = isMicro ? 'w-4 h-4 rounded-xs' : isTiny ? 'w-5 h-5 rounded' : 'w-6 h-6 rounded-md';
  const fontSize = isMicro ? 'text-[7.5px] max-w-[40px]' : isTiny ? 'text-[8.5px] max-w-[48px]' : 'text-[9.5px] max-w-[58px]';
  const minWidth = showName ? (isMicro ? 'min-w-[46px]' : isTiny ? 'min-w-[54px]' : 'min-w-[68px]') : '';

  return (
    <div
      className={`flex items-center gap-0.5 sm:gap-1 bg-[#181d2a] border border-stone-700/60 rounded-md p-0.5 px-0.5 sm:px-1 shadow-2xs shrink-0 select-none ${minWidth}`}
      title={`${meta.name} (${REGIONS[meta.region]?.name || meta.region})`}
    >
      <div className={`${iconBox} overflow-hidden border border-stone-600/80 shrink-0`}>
        <img
          src={getChampIcon(meta.id)}
          alt={meta.name}
          className="w-full h-full object-cover"
        />
      </div>
      <span className={`${fontSize} font-bold text-stone-200 truncate leading-none px-0.5`}>
        {meta.name}
      </span>
    </div>
  );
}

export default function CapturePreviewModal({
  filteredChamps,
  excludedIds,
  activeCount,
  captureGroupBy,
  setCaptureGroupBy,
  onClose,
}: CapturePreviewModalProps) {
  const [copiedPool, setCopiedPool] = useState(false);
  const [scaleMode, setScaleMode] = useState<'auto' | 'compact' | 'tiny' | 'micro'>('auto');

  // ピック可能なチャンピオンのみを抽出
  const pool = useMemo(() => {
    return filteredChamps.filter((c) => !excludedIds.has(c.id));
  }, [filteredChamps, excludedIds]);

  // 出身地別グループ（有効なもののみ）
  const poolByRegion = useMemo(() => {
    const map = new Map<RegionKey, ChampionMeta[]>();
    (Object.keys(REGIONS) as RegionKey[]).forEach((k) => map.set(k, []));
    pool.forEach((c) => {
      const list = map.get(c.region) || [];
      list.push(c);
      map.set(c.region, list);
    });
    return Array.from(map.entries()).filter(([_, list]) => list.length > 0);
  }, [pool]);

  // ロール別グループ（有効なもののみ）
  const poolByRole = useMemo(() => {
    const map = new Map<ChampionRole, ChampionMeta[]>();
    ROLES_LIST.forEach((r) => map.set(r, []));
    pool.forEach((c) => {
      c.roles.forEach((r) => {
        const list = map.get(r) || [];
        list.push(c);
        map.set(r, list);
      });
    });
    return Array.from(map.entries()).filter(([_, list]) => list.length > 0);
  }, [pool]);

  const handleCopyTextPool = () => {
    const text = pool.map((c) => c.name).join('、');
    navigator.clipboard.writeText(`【KTM お祭りピック可能プール (${pool.length}体)】\n${text}`);
    setCopiedPool(true);
    toast.success('ピック可能チャンピオン一覧をコピーしました！');
    setTimeout(() => setCopiedPool(false), 2000);
  };

  const roleLabelMap: Record<ChampionRole, { label: string; icon: string }> = {
    TOP: { label: 'TOP', icon: '🛡️' },
    JG: { label: 'JG', icon: '🌲' },
    MID: { label: 'MID', icon: '⚡' },
    ADC: { label: 'ADC', icon: '🏹' },
    SUP: { label: 'SUP', icon: '✨' },
  };

  // 候補数に応じた自動スケール判定
  const effectiveSize = useMemo(() => {
    if (scaleMode !== 'auto') return scaleMode;
    if (pool.length > 100) return 'micro';
    if (pool.length > 55) return 'tiny';
    return 'compact';
  }, [scaleMode, pool.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-[#0b0d13] text-[#f1f3f5] border-2 border-primary-500/60 rounded-2xl w-full max-w-[1440px] max-h-[96vh] shadow-2xl flex flex-col overflow-hidden">
        {/* モーダル上部操作バー */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#141822] border-b border-stone-800 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-black flex items-center gap-1.5 text-primary-400">
              <Camera className="w-4 h-4" /> 1枚キャプチャ用プレビュー
            </span>
            <span className="text-[11px] text-stone-400 hidden sm:inline">
              （全体が美しく収まり、はみ出し時はスクロールして全体を確認できます）
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-stone-900/80 p-0.5 rounded-lg border border-stone-800">
              <button
                type="button"
                onClick={() => setCaptureGroupBy('region')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                  captureGroupBy === 'region'
                    ? 'bg-primary-600 text-white shadow-xs'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                地域別
              </button>
              <button
                type="button"
                onClick={() => setCaptureGroupBy('role')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                  captureGroupBy === 'role'
                    ? 'bg-primary-600 text-white shadow-xs'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                ロール別
              </button>
              <button
                type="button"
                onClick={() => setCaptureGroupBy('flat')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                  captureGroupBy === 'flat'
                    ? 'bg-primary-600 text-white shadow-xs'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                全一覧
              </button>
            </div>

            <div className="flex items-center gap-1 bg-stone-900/80 p-0.5 rounded-lg border border-stone-800">
              <span className="text-[10px] text-stone-400 px-1">サイズ:</span>
              {(['auto', 'compact', 'tiny', 'micro'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setScaleMode(mode)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                    scaleMode === mode
                      ? 'bg-stone-700 text-white'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {mode === 'auto' ? '自動' : mode.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleCopyTextPool}
              className="text-stone-300 hover:text-white bg-stone-800 hover:bg-stone-700 px-2.5 py-1 rounded-lg flex items-center gap-1 border border-stone-700 transition cursor-pointer"
            >
              {copiedPool ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPool ? 'コピー完了' : '名前一覧コピー'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-stone-400 hover:text-white bg-stone-800 hover:bg-stone-700 px-2.5 py-1 rounded-lg border border-stone-700 transition cursor-pointer"
            >
              閉じる (Esc)
            </button>
          </div>
        </div>

        {/* キャプチャ対象エリア */}
        <div className="p-3 sm:p-5 flex-1 overflow-y-auto space-y-3 bg-[#0d1017]">
          {/* キャプチャヘッダー */}
          <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎪</span>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                  <span>KTM 日曜お祭りカスタム ピック可能プール</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-400 border border-primary-500/30 font-bold">
                    残り {pool.length} 体
                  </span>
                </h2>
                <p className="text-[10px] sm:text-xs text-stone-400">
                  全 {filteredChamps.length} 体中 {excludedIds.size} 体除外済み
                </p>
              </div>
            </div>
            <div className="text-right text-[10px] text-stone-400 hidden sm:block">
              <span>Win + Shift + S でこの枠内をスクリーンショットしてDiscordに貼れます</span>
            </div>
          </div>

          {/* プール一覧表示 */}
          {pool.length === 0 ? (
            <div className="text-center py-12 text-stone-500">
              すべてのチャンピオンが除外されています
            </div>
          ) : (
            <div>
              {/* ① 地域別 */}
              {captureGroupBy === 'region' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {poolByRegion.map(([regionKey, list]) => (
                    <div
                      key={regionKey}
                      className="bg-[#121622]/90 border border-stone-800/90 rounded-xl p-2 space-y-1.5 flex flex-col"
                    >
                      <div className="flex items-center justify-between border-b border-stone-800/80 pb-1">
                        <span className="text-xs font-black text-primary-300 flex items-center gap-1">
                          <span>{REGIONS[regionKey]?.icon || '🌐'}</span>
                          <span>{REGIONS[regionKey]?.name || regionKey}</span>
                        </span>
                        <span className="text-[10px] text-stone-400 font-bold">
                          {list.length}体
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 content-start">
                        {list.map((c) => (
                          <CompactCaptureIcon key={c.id} meta={c} size={effectiveSize} showName />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ② ロール別 */}
              {captureGroupBy === 'role' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                  {poolByRole.map(([roleKey, list]) => (
                    <div
                      key={roleKey}
                      className="bg-[#121622]/90 border border-stone-800/90 rounded-xl p-2 space-y-1.5 flex flex-col"
                    >
                      <div className="flex items-center justify-between border-b border-stone-800/80 pb-1">
                        <span className="text-xs font-black text-amber-300 flex items-center gap-1">
                          <span>{roleLabelMap[roleKey]?.icon || '⚔️'}</span>
                          <span>{roleLabelMap[roleKey]?.label || roleKey}</span>
                        </span>
                        <span className="text-[10px] text-stone-400 font-bold">
                          {list.length}体
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 content-start">
                        {list.map((c) => (
                          <CompactCaptureIcon key={c.id} meta={c} size={effectiveSize} showName />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ③ コンパクト全一覧 */}
              {captureGroupBy === 'flat' && (
                <div className="bg-[#121622]/90 border border-stone-800/90 rounded-xl p-2.5 flex flex-wrap gap-1 sm:gap-1.5 content-start">
                  {pool.map((c) => (
                    <CompactCaptureIcon key={c.id} meta={c} size={effectiveSize} showName />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* フッター情報 */}
          <div className="flex items-center justify-between text-[9px] text-stone-500 border-t border-stone-800/80 pt-1 px-1 shrink-0">
            <span>KTM Weekend Custom Official Portal</span>
            <span>https://my-work-8jbd.vercel.app/festival/pick</span>
          </div>
        </div>
      </div>
    </div>
  );
}
