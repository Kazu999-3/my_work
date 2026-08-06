'use client';

import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export default function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShow(true);
      } else {
        setShow(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!show) return null;

  return (
    <button
      onClick={scrollToTop}
      aria-label="ページ最上部へ戻る"
      className="fixed bottom-20 md:bottom-8 right-5 z-40 p-3 bg-amber-700 hover:bg-amber-800 active:scale-95 text-white rounded-full shadow-2xl transition-all border border-amber-400/40 flex items-center justify-center animate-fade-in group"
    >
      <ArrowUp className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
    </button>
  );
}
