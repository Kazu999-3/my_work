"use client";

import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 200) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="ページ最上部へ戻る"
      className="fixed bottom-6 right-6 z-30 p-3 rounded-full bg-surface/90 hover:bg-surface border border-border/80 text-foreground shadow-lg hover:shadow-xl backdrop-blur-md transition-all duration-300 transform active:scale-95 flex items-center justify-center cursor-pointer group"
      title="トップへ戻る"
    >
      <ArrowUp className="w-4 h-4 text-primary-600 group-hover:-translate-y-0.5 transition-transform" />
    </button>
  );
}
