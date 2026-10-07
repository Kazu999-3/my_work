"use client";

import { Sparkles } from 'lucide-react';

// 未検索時の案内（最近検索したサモナーから再実行）
// 2026-10-07: app/analyzer/page.tsx（1,939行）から分割。表示内容・動作は分割前と同じ。
export default function WelcomeGuide({ report, targetTier, setSummonerInput, loading, handleRunAnalysis, recentSearches, error }: {
  report: any;
  targetTier: string;
  setSummonerInput: (v: string) => void;
  loading: boolean;
  handleRunAnalysis: (rawInput?: string, tier?: string) => void;
  recentSearches: string[];
  error: string;
}) {
  return (
    <>
      {!report && !loading && !error && (
        <div className="rounded-3xl border border-border bg-surface p-8 md:p-12 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-primary-50 border border-primary-edge-soft text-primary-600 flex items-center justify-center mx-auto text-2xl shadow-inner">
            🔍
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base font-black text-foreground">
              サモナー名を入力して深層アナライズを開始
            </h3>
            <p className="text-xs text-muted-strong font-medium leading-relaxed">
              上の検索バーに「サモナー名#タグ」を入力して実行してください。一度検索したサモナーは入力補助履歴に自動保存され、ワンクリックで再解析できます。
            </p>
          </div>
          {recentSearches.length > 0 && (
            <div className="pt-4 max-w-md mx-auto">
              <div className="text-xs font-bold text-faint mb-2">最近検索したサモナーから再開:</div>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {recentSearches.map((rec) => (
                  <button
                    key={rec}
                    type="button"
                    onClick={() => {
                      setSummonerInput(rec);
                      handleRunAnalysis(rec, targetTier);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-primary-500/10 hover:bg-primary-500/20 text-primary-900 font-black text-xs border border-primary-edge/60 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles size={12} className="text-primary-600" />
                    <span>{rec}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
