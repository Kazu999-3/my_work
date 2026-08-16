"use client";

import { CheckCircle2, RefreshCw, X, BookOpen } from 'lucide-react';

export type MergePreviewItem = {
  champion: string;
  fieldName: string;
  isNewField: boolean;
  existingExcerpt: string;
  mergedExcerpt: string;
};

// 「攻略ライブラリから保存した時にチャンピオン辞典割り振りする際のプレビューが出ない」
// への対応(2026-08-16)。LibraryTabContent.tsxの記事編集画面で「保存する」を押した際、
// 従来は確認なしに即matchup_sentinelへマージ＆ライブラリから削除していたが、
// dryRunで計算した「どのフィールドに」「マージ後どうなるか」をここで見せてから
// 実際の統合を実行する。
export default function LibraryMergePreviewModal({
  previews, saving, onConfirm, onCancel,
}: {
  previews: MergePreviewItem[];
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <BookOpen size={20} className="text-violet-600" /> 辞典統合プレビュー
          </h3>
          <button onClick={onCancel} disabled={saving} className="text-gray-400 hover:text-gray-900 disabled:opacity-50">
            <X size={20} />
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          保存すると、この記事は下記の内容でチャンピオン辞典へマージされ、攻略ライブラリからは削除されます（辞典側に統合済みとして残ります）。
        </p>

        <div className="space-y-4">
          {previews.map((p, idx) => (
            <div key={idx} className="border border-violet-200 rounded-2xl p-4 bg-violet-50/40">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-violet-100 border border-violet-300 text-violet-700">
                  🏆 {p.champion}
                </span>
                <span className="text-[10px] text-gray-500">項目: <span className="font-mono">{p.fieldName}</span></span>
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                  p.isNewField ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}>
                  {p.isNewField ? '新規項目として追加' : '既存項目に追記/更新'}
                </span>
              </div>

              {!p.isNewField && (
                <div className="mb-2">
                  <p className="text-[10px] font-bold text-gray-400 mb-1">現在の内容（統合前）</p>
                  <div className="bg-white border border-gray-200 rounded-xl p-3 max-h-24 overflow-y-auto text-[11px] text-gray-500 whitespace-pre-wrap leading-relaxed">
                    {p.existingExcerpt || '(空)'}
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] font-bold text-gray-400 mb-1">統合後の内容</p>
                <div className="bg-white border border-gray-200 rounded-xl p-3 max-h-40 overflow-y-auto text-[11px] text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {p.mergedExcerpt}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {saving ? '統合中...' : 'この内容で辞典に統合する'}
          </button>
        </div>
      </div>
    </div>
  );
}
