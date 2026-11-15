'use client';

import React from 'react';
import { Target } from 'lucide-react';
import ChampionIcon from '../../../components/ChampionIcon';

interface ChampionInfo {
  id: string;
  name: string;
}

interface MatchChampSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (champId: string) => void;
  championsList: ChampionInfo[];
  champSearchQuery: string;
  setChampSearchQuery: (query: string) => void;
}

export default function MatchChampSelectorModal({
  isOpen,
  onClose,
  onSelect,
  championsList,
  champSearchQuery,
  setChampSearchQuery,
}: MatchChampSelectorModalProps) {
  if (!isOpen) return null;

  const filtered = championsList.filter(
    (c) =>
      c.name.toLowerCase().includes(champSearchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(champSearchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
            <Target className="h-5 w-5 text-success-500" />
            チャンピオン選択
          </h3>
          <button
            onClick={onClose}
            type="button"
            className="text-muted hover:text-foreground text-sm bg-surface-subtle hover:bg-surface-hover px-3 py-1.5 rounded-lg border border-border transition cursor-pointer"
          >
            閉じる
          </button>
        </div>

        <input
          type="text"
          placeholder="チャンピオン名で検索 (ひらがな・カタカナ・英語名)..."
          value={champSearchQuery}
          onChange={(e) => setChampSearchQuery(e.target.value)}
          className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground mb-4 outline-none focus:border-success-500 text-sm"
          autoFocus
        />

        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              type="button"
              className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-surface-hover transition group cursor-pointer active:scale-95"
            >
              <ChampionIcon
                champId={c.id}
                champName={c.name}
                className="w-12 h-12 rounded-xl border border-border group-hover:border-success-500 transition object-cover shadow-xs"
              />
              <span className="text-[10px] text-muted truncate w-14 text-center group-hover:text-foreground transition">
                {c.name}
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted text-sm">
              該当するチャンピオンが見つかりません。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
