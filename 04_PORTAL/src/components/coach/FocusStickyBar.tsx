'use client';

import React, { useState, useEffect } from 'react';

export default function FocusStickyBar() {
  const [focus, setFocus] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const loadFocus = () => {
    try {
      const saved = localStorage.getItem('today_soloq_focus') || '';
      setFocus(saved);
      setInputValue(saved);
    } catch {}
  };

  useEffect(() => {
    loadFocus();
    window.addEventListener('storage', loadFocus);
    return () => window.removeEventListener('storage', loadFocus);
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('today_soloq_focus', inputValue);
      setFocus(inputValue);
      setIsEditing(false);
    } catch {}
  };

  const handleClear = () => {
    try {
      localStorage.removeItem('today_soloq_focus');
      setFocus('');
      setInputValue('');
      setIsEditing(false);
    } catch {}
  };

  if (!focus && !isEditing) {
    return (
      <div className="bg-amber-900/10 border border-amber-800/30 rounded-xl px-4 py-2 flex items-center justify-between text-xs text-amber-900">
        <span className="font-bold flex items-center gap-1.5">
          <span>🎯</span> 今日の意識テーマが未設定です。「1つの課題」に集中してソロQに挑みましょう
        </span>
        <button
          onClick={() => setIsEditing(true)}
          className="px-2.5 py-1 bg-amber-800 hover:bg-amber-900 text-white font-bold rounded-lg text-[11px] shadow-sm transition"
        >
          + テーマを設定
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-amber-900 to-stone-900 text-amber-50 rounded-xl px-4 py-2.5 shadow-lg border border-amber-700/50 flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
        <span className="text-base animate-bounce">🔥</span>
        {isEditing ? (
          <form onSubmit={handleSave} className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="例: 3:30スカトルで無理に戦わず逆サイドへ / 8分前アイテム更新"
              className="flex-1 px-2.5 py-1 text-xs rounded bg-stone-800 text-white border border-amber-500 focus:outline-none"
              autoFocus
            />
            <button
              type="submit"
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded"
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-2 py-1 text-xs text-stone-300 hover:text-white"
            >
              取消
            </button>
          </form>
        ) : (
          <div className="space-y-0.5">
            <div className="text-[10px] text-amber-300 uppercase font-black tracking-wider flex items-center gap-1.5">
              <span>TODAY&apos;S FOCUS</span>
              <span className="text-[9px] bg-amber-500/30 px-1.5 py-0.2 rounded text-amber-200">
                本日のJG最重要テーマ
              </span>
            </div>
            <div className="text-xs font-black text-white tracking-wide">
              {focus}
            </div>
          </div>
        )}
      </div>

      {!isEditing && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(true)}
            className="text-[11px] text-amber-200 hover:text-white underline font-medium"
          >
            変更
          </button>
          <button
            onClick={handleClear}
            className="text-[11px] text-stone-400 hover:text-stone-200"
          >
            完了・クリア
          </button>
        </div>
      )}
    </div>
  );
}
