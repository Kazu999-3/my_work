"use client";

import { TrendingUp, Award, Brain, Compass } from 'lucide-react';

// レポートのタブ切り替え
// 2026-10-07: app/analyzer/page.tsx（1,939行）から分割。表示内容・動作は分割前と同じ。
export default function ReportTabNav({ activeTab, setActiveTab }: {
  activeTab: 'overview' | 'champions' | 'session' | 'psychology';
  setActiveTab: (v: 'overview' | 'champions' | 'session' | 'psychology') => void;
}) {
  return (
    <>
          {/* ナビゲーションタブ */}
          <div className="flex items-center gap-2 border-b border-border pb-2 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-2xl font-black text-xs transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-surface text-muted hover:bg-surface-subtle border border-border'
              }`}
            >
              <TrendingUp size={14} />
              <span>1. 📊 5大レーダー ＆ 展開4分類</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('champions')}
              className={`px-4 py-2 rounded-2xl font-black text-xs transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'champions'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-surface text-muted hover:bg-surface-subtle border border-border'
              }`}
            >
              <Award size={14} />
              <span>2. 👑 上位チャンプ深掘り ＆ プール穴診断</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('session')}
              className={`px-4 py-2 rounded-2xl font-black text-xs transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'session'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-surface text-muted hover:bg-surface-subtle border border-border'
              }`}
            >
              <Brain size={14} />
              <span>3. 🧠 実測コンディション ＆ ティルト分析</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('psychology')}
              className={`px-4 py-2 rounded-2xl font-black text-xs transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'psychology'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-surface text-primary-700 hover:bg-primary-50 border border-primary-edge-soft'
              }`}
            >
              <Compass size={14} />
              <span>4. 🧬 プレイスタイル特性タイプ診断（独自スタッツ分析）</span>
            </button>
          </div>
    </>
  );
}
