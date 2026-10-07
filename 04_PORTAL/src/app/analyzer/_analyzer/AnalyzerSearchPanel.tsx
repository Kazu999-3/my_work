"use client";

import { Search, Sparkles, RefreshCw, Clock } from 'lucide-react';

// 検索バー・目標ランク・実行ボタン・最近の検索/サンプル候補
// 2026-10-07: app/analyzer/page.tsx（1,939行）から分割。表示内容・動作は分割前と同じ。
export default function AnalyzerSearchPanel({ targetTier, setTargetTier, summonerInput, setSummonerInput, loading, handleRunAnalysis, recentSearches, removeRecentSearch, clearAllRecents }: {
  targetTier: string;
  setTargetTier: (v: string) => void;
  summonerInput: string;
  setSummonerInput: (v: string) => void;
  loading: boolean;
  handleRunAnalysis: (rawInput?: string, tier?: string) => void;
  recentSearches: string[];
  removeRecentSearch: (e: React.MouseEvent, target: string) => void;
  clearAllRecents: () => void;
}) {
  return (
    <>
          {/* サモナー検索バー ＆ 条件指定 */}
          <div className="rounded-3xl border border-border bg-surface p-4 md:p-5 shadow-xs space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRunAnalysis();
          }}
          className="flex flex-col md:flex-row items-stretch md:items-center gap-3"
        >
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-faint">
              <Search size={16} />
            </div>
            <input
              type="text"
              value={summonerInput}
              onChange={(e) => setSummonerInput(e.target.value)}
              placeholder="サモナー名#タグ (例: Kazurin#4036, yukizo#7867, Hide on bush#KR1)"
              className="w-full pl-10 pr-3 py-2.5 bg-background border border-border rounded-2xl text-xs font-bold text-foreground placeholder:text-faint focus:outline-none focus:border-primary-edge-strong focus:bg-surface transition"
            />
          </div>

          {/* 目標ランクセレクター */}
          <div className="flex items-center gap-1.5 bg-background px-3 py-1.5 rounded-2xl border border-border shrink-0">
            <span className="text-[11px] font-bold text-faint">目標:</span>
            <select
              value={targetTier}
              onChange={(e) => {
                setTargetTier(e.target.value);
                handleRunAnalysis(summonerInput, e.target.value);
              }}
              className="bg-transparent text-xs font-black text-foreground focus:outline-none cursor-pointer"
            >
              <option value="Gold IV">🥇 Gold IV (ゴールド)</option>
              <option value="Platinum IV">🥈 Platinum IV (プラチナ)</option>
              <option value="Emerald IV">💎 Emerald IV (エメラルド)</option>
              <option value="Diamond IV">💠 Diamond IV (ダイアモンド)</option>
            </select>
          </div>

          {/* 実行ボタン */}
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white font-black text-xs rounded-2xl shadow-xs transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>実測解析中...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>⚡ 実行</span>
              </>
            )}
          </button>
        </form>

        {/* 入力補助（最近検索したサモナー履歴 ＆ サンプル候補） */}
        <div className="space-y-2 pt-2 border-t border-stone-100">
          {recentSearches.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
              <span className="text-muted-strong font-bold flex items-center gap-1">
                <Clock size={12} className="text-primary-600" />
                <span>最近検索したサモナー:</span>
              </span>
              {recentSearches.map((rec) => (
                <div
                  key={rec}
                  onClick={() => {
                    setSummonerInput(rec);
                    handleRunAnalysis(rec, targetTier);
                  }}
                  className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-primary-50 hover:bg-primary-100 text-primary-950 font-bold border border-primary-edge-soft/80 transition cursor-pointer shadow-2xs"
                >
                  <span>{rec}</span>
                  <button
                    type="button"
                    onClick={(e) => removeRecentSearch(e, rec)}
                    className="text-faint hover:text-danger-600 transition p-0.5 rounded-full hover:bg-surface/80"
                    title="履歴から削除"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={clearAllRecents}
                className="text-[10px] text-faint hover:text-danger-600 transition underline cursor-pointer ml-1"
              >
                履歴クリア
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
            <span className="text-faint font-bold">サンプル候補:</span>
            <span className="text-faint">（JP鯖のみ対応）</span>
            {/* ⚠️ 2026-09-23: 以前は Faker(KR1) / Agurin(EUW) をサンプルに出していたが、
                アカウント検索と試合一覧は asia ルーティング（lib/riot.ts の RIOT_API_BASE_ASIA）、
                ランク・マスタリー等は jp1 固定（RIOT_API_BASE_JP）のため、
                **JP鯖以外のプレイヤーは名前が引けてもランク情報が取れない**。
                誤解を招くのでJP鯖のサンプルだけに絞った。 */}
            {[
              { raw: 'Kazurin#4036', label: 'Kazurin#4036 (JG)' },
              { raw: 'yukizo#7867', label: 'yukizo#7867 (SUP)' },
            ].map((p) => (
              <button
                key={p.raw}
                type="button"
                onClick={() => {
                  setSummonerInput(p.raw);
                  handleRunAnalysis(p.raw, targetTier);
                }}
                className="px-2.5 py-0.5 rounded-lg bg-surface-subtle hover:bg-surface-hover text-muted hover:text-foreground font-medium text-[10.5px] border border-border/70 transition cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
