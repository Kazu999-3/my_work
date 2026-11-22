'use client';

import { RefreshCw, Target } from 'lucide-react';
import { parseDurationText } from './ocrUtils';

interface MatchSummaryControlsProps {
  winningTeam: 'BLUE' | 'RED' | null;
  onSelectWinningTeam: (team: 'BLUE' | 'RED') => void;
  durationText: string;
  onChangeDurationText: (text: string) => void;
  isFinalMatch: boolean;
  onChangeIsFinalMatch: (checked: boolean) => void;
  submitting: boolean;
  missingNamesCount?: number;
  onSubmit: () => void;
}

export default function MatchSummaryControls({
  winningTeam,
  onSelectWinningTeam,
  durationText,
  onChangeDurationText,
  isFinalMatch,
  onChangeIsFinalMatch,
  submitting,
  missingNamesCount = 0,
  onSubmit,
}: MatchSummaryControlsProps) {
  const parsedSec = parseDurationText(durationText);
  const isEarlySurrender = parsedSec !== undefined && parsedSec < 18 * 60;
  const missingReasons: string[] = [];
  if (!winningTeam) missingReasons.push('勝利チーム（BLUE / RED）の選択');
  if (missingNamesCount > 0) missingReasons.push(`未入力のプレイヤー名（あと${missingNamesCount}人）`);
  const isSaveDisabled = submitting || !winningTeam || missingNamesCount > 0;

  return (
    <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-6">
      {/* 勝利チーム選択 */}
      <div className="flex items-center gap-4 bg-black/3 p-2 rounded-lg border border-border">
        <span className="font-bold text-muted-strong px-2">勝利チーム:</span>
        <button
          type="button"
          onClick={() => onSelectWinningTeam('BLUE')}
          className={`px-8 py-3 rounded-lg font-black transition cursor-pointer ${
            winningTeam === 'BLUE'
              ? 'bg-secondary-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.6)]'
              : 'bg-surface text-muted-strong border border-border hover:bg-black/5'
          }`}
        >
          BLUE WIN
        </button>
        <button
          type="button"
          onClick={() => onSelectWinningTeam('RED')}
          className={`px-8 py-3 rounded-lg font-black transition cursor-pointer ${
            winningTeam === 'RED'
              ? 'bg-danger-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.6)]'
              : 'bg-surface text-muted-strong border border-border hover:bg-black/5'
          }`}
        >
          RED WIN
        </button>
      </div>

      {/* 試合時間（スクショ解析で自動入力。18分未満の敗北は MMR 減少が半分になる） */}
      <label className="flex items-center gap-2 bg-black/3 p-2 rounded-lg border border-border cursor-pointer">
        <span className="font-bold text-muted-strong px-1 text-sm">試合時間</span>
        <input
          type="text"
          inputMode="numeric"
          value={durationText}
          onChange={(e) => onChangeDurationText(e.target.value)}
          placeholder="28:14"
          className="w-20 px-2 py-1.5 rounded-md bg-surface border border-border text-sm font-mono text-foreground"
        />
        <div className="flex flex-col gap-0.5 max-w-56 leading-tight">
          <span className="text-[10px] text-muted-strong">
            {durationText && parsedSec === undefined
              ? '「分:秒」で入力（例 28:14）'
              : '18分未満の早期終了は敗北側のMMR減少が半分に緩和されます'}
          </span>
          {isEarlySurrender && (
            <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse">
              ⚡ 早期投了緩和(-50%)が適用されます
            </span>
          )}
        </div>
      </label>

      {/* 🏁 最終戦チェックボックス（解散時にVCステータスを自動クリア） */}
      <label className="flex items-start gap-2 cursor-pointer select-none bg-black/3 hover:bg-black/5 px-3 py-2 rounded-lg border border-border transition max-w-64">
        <input
          type="checkbox"
          checked={isFinalMatch}
          onChange={(e) => onChangeIsFinalMatch(e.target.checked)}
          className="w-4 h-4 mt-0.5 rounded text-secondary-600 focus:ring-secondary-500 cursor-pointer shrink-0"
        />
        <span className="text-xs font-bold text-foreground leading-snug">
          🏁 本日の最終戦
          <span className="block text-[10px] font-normal text-muted-strong mt-0.5">
            ONにすると保存時にDiscordのVC横吹き出しステータスを自動で消去します
          </span>
        </span>
      </label>

      {/* 保存送信ボタン ＋ 不足項目案内 */}
      <div className="flex flex-col items-center md:items-end gap-1.5">
        <button
          onClick={onSubmit}
          disabled={isSaveDisabled}
          type="button"
          className={`px-8 py-4 rounded-xl font-black text-lg transition flex items-center gap-3 ${
            isSaveDisabled
              ? 'bg-black/5 text-faint cursor-not-allowed'
              : 'bg-gradient-to-r from-success-500 to-secondary-600 text-white hover:from-success-400 hover:to-secondary-500 shadow-xl shadow-success-900/30 cursor-pointer'
          }`}
        >
          {submitting ? <RefreshCw className="h-6 w-6 animate-spin" /> : <Target className="h-6 w-6" />}
          試合結果を保存してMMR更新
        </button>
        {missingReasons.length > 0 && (
          <p className="text-[11px] font-bold text-danger-700">
            ⚠️ 保存するには「{missingReasons.join('」と「')}」が必要です
          </p>
        )}
      </div>
    </div>
  );
}
