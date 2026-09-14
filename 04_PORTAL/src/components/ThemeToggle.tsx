'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, Laptop } from 'lucide-react';

interface ThemeToggleProps {
  variant?: 'compact' | 'full' | 'dropdown';
  className?: string;
}

export default function ThemeToggle({ variant = 'compact', className = '' }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={`w-8 h-8 rounded-xl bg-stone-200/50 dark:bg-stone-800/50 animate-pulse ${className}`} />
    );
  }

  if (variant === 'full') {
    return (
      <div className={`flex items-center gap-1 p-1 bg-stone-200/70 dark:bg-[#2b2d31] rounded-xl border border-stone-300/60 dark:border-[#3f4147] ${className}`}>
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            theme === 'light'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
          }`}
          title="ライトモード"
        >
          <Sun size={14} className="text-amber-500" />
          <span>ライト</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            theme === 'dark'
              ? 'bg-[#1e1f22] text-white shadow-xs'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
          }`}
          title="ダークモード"
        >
          <Moon size={14} className="text-indigo-400" />
          <span>ダーク</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme('system')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            theme === 'system'
              ? 'bg-white dark:bg-[#1e1f22] text-stone-900 dark:text-white shadow-xs'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
          }`}
          title="OS設定に連動"
        >
          <Laptop size={14} className="text-stone-500 dark:text-stone-400" />
          <span>自動</span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2 rounded-xl bg-white/80 dark:bg-[#2b2d31]/80 hover:bg-stone-100 dark:hover:bg-[#35373c] text-stone-700 dark:text-stone-200 border border-stone-200/80 dark:border-[#3f4147] shadow-2xs transition-all flex items-center justify-center cursor-pointer group ${className}`}
      title={`テーマ切替 (現在: ${resolvedTheme === 'dark' ? 'ダーク' : 'ライト'})`}
      aria-label="ダークモード切り替え"
    >
      {resolvedTheme === 'dark' ? (
        <Moon size={16} className="text-indigo-400 group-hover:rotate-12 transition-transform" />
      ) : (
        <Sun size={16} className="text-amber-500 group-hover:rotate-45 transition-transform" />
      )}
    </button>
  );
}
