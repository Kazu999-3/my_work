'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { getChampIcon } from '@/lib/ddragonClient';
import championsSummary from '@/data/champions_summary.json';

// チャンピオン選択（旧ポータル components/ChampSelect の移植）。2026-10-04
// 旧版は173体を手書きした一覧(championConstants.ts)を使っており、ウーコンが "Wukong"
// （DDragonの正式IDは MonkeyKing）になっていてアイコンが出なかった。05では辞典トップと同じ
// champions_summary.json（DDragon由来の173体）から作る。

interface ChampEntry { id: string; ja: string }

const CHAMPIONS: ChampEntry[] = (championsSummary as any[])
  .map((c) => ({ id: String(c.id), ja: String(c.jpName || c.name || c.id) }))
  .sort((a, b) => a.ja.localeCompare(b.ja, 'ja'));
const BY_ID = new Map(CHAMPIONS.map((c) => [c.id, c]));

interface ChampSelectProps {
  value: string;
  onChange: (value: string) => void;
  /** 複数選択モード用: リストからクリック選択された時に呼ばれる */
  onSelect?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function ChampSelect({ value, onChange, onSelect, placeholder = 'チャンピオン名', className = '' }: ChampSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) setSearchTerm(BY_ID.get(value || '')?.ja || value || '');
  }, [value, isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const term = (searchTerm || '').toLowerCase();
    if (!term) return CHAMPIONS;
    return CHAMPIONS.filter((c) => c.id.toLowerCase().includes(term) || c.ja.includes(searchTerm));
  }, [searchTerm]);

  const handleSelect = (id: string) => {
    if (onSelect) {
      onSelect(id);
      setSearchTerm('');
      onChange('');
    } else {
      setSearchTerm(BY_ID.get(id)?.ja || id);
      onChange(id);
    }
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => {
          const v = e.target.value;
          setSearchTerm(v);
          const matched = CHAMPIONS.find((c) => c.id.toLowerCase() === v.toLowerCase() || c.ja === v);
          onChange(matched?.id || v);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className={`w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 rounded-xl p-3 text-slate-100 placeholder-slate-500 outline-none transition-colors ${className}`}
      />
      {isOpen && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 p-2.5 hover:bg-slate-800 cursor-pointer border-b border-slate-800 last:border-none"
              onClick={() => handleSelect(c.id)}
            >
              <Image src={getChampIcon(c.id)} alt={c.id} width={32} height={32} className="w-8 h-8 rounded-full border border-slate-700" />
              <div className="flex flex-col">
                <span className="font-bold text-sm text-slate-100">{c.ja}</span>
                <span className="text-[10px] text-slate-500 font-mono">{c.id}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
