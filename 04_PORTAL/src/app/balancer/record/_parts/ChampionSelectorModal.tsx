'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Target } from 'lucide-react';
import { getChampIcon } from '../../../../lib/ddragonClient';
import type { ActiveChampSelector, ChampionItem } from './types';

interface ChampionSelectorModalProps {
  activeSelector: ActiveChampSelector;
  championsList: ChampionItem[];
  onSelect: (slotIndex: number, championId: string) => void;
  onClose: () => void;
  onReloadChampions: () => void;
}

export default function ChampionSelectorModal({
  activeSelector,
  championsList,
  onSelect,
  onClose,
  onReloadChampions,
}: ChampionSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredChampions = championsList.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-surface border border-border rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
            <Target className="h-5 w-5 text-success-600" />
            チャンピオン選択 ({activeSelector.team} - {activeSelector.role})
          </h3>
          <button
            onClick={onClose}
            className="text-muted-strong hover:text-foreground text-sm bg-black/5 px-3 py-1.5 rounded-lg border border-border transition cursor-pointer"
          >
            閉じる
          </button>
        </div>

        <input
          type="text"
          placeholder="チャンピオン名で検索 (ひらがな・カタカナ・英語名)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-foreground mb-4 outline-none focus:border-success-edge-strong text-sm"
          autoFocus
        />

        {championsList.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-strong mb-3">チャンピオン一覧が読み込まれていません。</p>
            <button
              onClick={onReloadChampions}
              type="button"
              className="px-4 py-2 rounded-lg bg-success-600 hover:bg-success-500 text-white text-sm font-bold cursor-pointer"
            >
              🔄 一覧を再読み込み
            </button>
          </div>
        )}

        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
          {filteredChampions.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                onSelect(activeSelector.slotIndex, c.id);
                onClose();
              }}
              type="button"
              className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-black/5 transition group cursor-pointer"
            >
              <Image
                src={getChampIcon(c.id)}
                width={48}
                height={48}
                className="w-12 h-12 rounded-xl border border-border group-hover:border-success-edge-strong transition object-cover"
                alt={c.name}
              />
              <span className="text-[10px] text-muted-strong truncate w-14 text-center group-hover:text-foreground transition">
                {c.name}
              </span>
            </button>
          ))}
          {filteredChampions.length === 0 && championsList.length > 0 && (
            <div className="col-span-full text-center py-12 text-muted-strong text-sm">
              該当するチャンピオンが見つかりません。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
