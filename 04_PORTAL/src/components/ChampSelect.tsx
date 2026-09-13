"use client";

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { getChampIcon } from '../lib/ddragonClient';
import { ALL_CHAMPIONS, CHAMPION_JA } from '../lib/championConstants';

export { ALL_CHAMPIONS, CHAMPION_JA };



interface ChampSelectProps {
  value: string;
  onChange: (value: string) => void;
  /** 複数選択モード用: リストからクリック選択された時に呼ばれる */
  onSelect?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function ChampSelect({ value, onChange, onSelect, placeholder = "チャンピオン名", className = "" }: ChampSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm(CHAMPION_JA[value]?.ja || value);
    }
  }, [value, isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredChamps = ALL_CHAMPIONS.filter(c => {
    const term = searchTerm.toLowerCase();
    const jaData = CHAMPION_JA[c];
    
    const matchEnglish = c.toLowerCase().includes(term) || c.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().includes(term);
    if (!jaData) return matchEnglish;

    const matchJapanese = jaData.ja.includes(term) || jaData.ruby.includes(term);
    return matchEnglish || matchJapanese;
  });

  const handleSelect = (champ: string) => {
    if (onSelect) {
      onSelect(champ);
      setSearchTerm('');
      onChange('');
    } else {
      setSearchTerm(CHAMPION_JA[champ]?.ja || champ);
      onChange(champ);
    }
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          const matchedChamp = ALL_CHAMPIONS.find(c => 
            c.toLowerCase() === e.target.value.toLowerCase() || 
            CHAMPION_JA[c]?.ja === e.target.value ||
            CHAMPION_JA[c]?.ruby === e.target.value
          );
          onChange(matchedChamp || e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className={`w-full bg-surface border border-black/10 focus:border-[#c89b3c]/50 rounded-xl p-3 text-stone-900 outline-none transition-colors shadow-inner ${className}`}
      />

      {isOpen && filteredChamps.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-black/10 rounded-xl shadow-[0_8px_30px_rgba(32,28,43,0.15)] max-h-60 overflow-y-auto custom-scrollbar">
          {filteredChamps.map((champ) => (
            <div
              key={champ}
              className="flex items-center gap-3 p-3 hover:bg-black/5 cursor-pointer transition-colors border-b border-black/5 last:border-none"
              onClick={() => handleSelect(champ)}
            >
              <Image
                src={getChampIcon(champ)}
                alt={champ}
                width={32}
                height={32}
                className="w-8 h-8 rounded-full border border-black/10 shadow-sm"
                onError={(e) => { (e.target as HTMLImageElement).src = '/favicon.ico'; }}
              />
              <div className="flex flex-col">
                <span className="font-bold text-sm text-stone-800">{CHAMPION_JA[champ]?.ja || champ}</span>
                <span className="text-[10px] text-gray-500 font-mono">{champ}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}