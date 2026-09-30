'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // 既定は 'light'。2026-09-30までは 'system'（OS設定に追従）だったため、
  // 端末をダークにしている人には**自分で選んでいなくてもダークが適用**されていた。
  //
  // ダークモードの見た目は長らく「クラス名を列挙して後追いで !important 上書きする
  // 中和レイヤー」に依存しており、列挙から漏れたものがそのまま不具合になっていた
  // （同日だけで「鮮やかな背景379箇所が灰色に潰れる」「ページ全体が明るいまま白文字」
  //   「バッジが読めない」の3件が報告された）。
  // 現在その中和レイヤーをトークン方式へ移行中で、完了すれば列挙漏れという概念自体が
  // 無くなるが、それまでは**自分で選んだ人だけがダークを見る**状態にしてリスクを抑える。
  //
  // ⚠️ 既に 'dark' / 'system' を選択済みの人の設定はそのまま尊重する（下の localStorage
  //    読み込みで復元される）。変わるのは「一度も選んでいない人」の初期値だけ。
  const [theme, setThemeState] = useState<Theme>('light');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  // 初期化: localStorage に保存された選択があればそれを復元する
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('ktm-theme') as Theme | null;
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system')) {
        setThemeState(savedTheme);
      }
    } catch (_) {}
    setMounted(true);
  }, []);

  // テーマ適用ロジック
  useEffect(() => {
    if (!mounted) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      let isDark = false;
      if (theme === 'dark') {
        isDark = true;
      } else if (theme === 'light') {
        isDark = false;
      } else {
        // system
        isDark = mediaQuery.matches;
      }

      setResolvedTheme(isDark ? 'dark' : 'light');

      const root = document.documentElement;
      if (isDark) {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }
    };

    applyTheme();

    // システム設定の変化を監視
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, mounted]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('ktm-theme', newTheme);
    } catch (_) {}
  };

  const toggleTheme = () => {
    if (resolvedTheme === 'dark') {
      setTheme('light');
    } else {
      setTheme('dark');
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
