'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Dna, Sparkles } from 'lucide-react';
import { isLineNewlyAdded } from './factRouting';
import type { LineDestination, PreviewResult } from './types';

// プレビュー: 各項目（強み・弱み等）のマージ差分。項目ごとの反映/スキップと、新規追記行ごとの宛先（辞典/レーンガイド/除外）を選ぶ
// 2026-10-07: app/admin/review/page.tsx（1,691行）から分割。表示内容・動作は分割前と同じ。
export default function FactsPreviewTab({ previewData, factsViewMode, setFactsViewMode, selectedFactFields, setSelectedFactFields, lineDestinations, setLineDestinations }: {
  previewData: PreviewResult | null;
  factsViewMode: 'highlight' | 'split';
  setFactsViewMode: (v: 'highlight' | 'split') => void;
  selectedFactFields: Record<string, boolean>;
  setSelectedFactFields: Dispatch<SetStateAction<Record<string, boolean>>>;
  lineDestinations: Record<string, LineDestination>;
  setLineDestinations: Dispatch<SetStateAction<Record<string, LineDestination>>>;
}) {
  return (
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-zinc-800/80">
                          <div className="text-[11px] text-zinc-400">
                            AI（Gemini）が記事から抽出した「強み・弱み・スパイク等」の新知見です。既存記述を保持したまま安全に追記マージされます。
                          </div>
                          <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 shrink-0 self-start sm:self-auto">
                            <button
                              type="button"
                              onClick={() => setFactsViewMode('highlight')}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition ${
                                factsViewMode === 'highlight'
                                  ? 'bg-purple-600 text-white shadow-sm'
                                  : 'text-zinc-400 hover:text-white'
                              }`}
                            >
                              ✨ 追記箇所を強調
                            </button>
                            <button
                              type="button"
                              onClick={() => setFactsViewMode('split')}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition ${
                                factsViewMode === 'split'
                                  ? 'bg-purple-600 text-white shadow-sm'
                                  : 'text-zinc-400 hover:text-white'
                              }`}
                            >
                              ⇄ 変更前・後を比較
                            </button>
                          </div>
                        </div>

                        {previewData?.factPreviews && previewData.factPreviews.length > 0 ? (
                          previewData.factPreviews.map((fp) => (
                            <div key={fp.champion} className="p-4 rounded-xl bg-zinc-950 border border-purple-900/50 space-y-3">
                              <div className="flex items-center justify-between text-xs text-purple-300 font-bold border-b border-zinc-800 pb-2">
                                <span className="flex items-center gap-1.5">
                                  <Dna size={14} />
                                  <span>{fp.championNameJa}（{fp.champion}）の各項目マージ予定</span>
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedFactFields((prev) => {
                                        const next = { ...prev };
                                        fp.diffs.forEach((d) => {
                                          next[`${fp.champion}::${d.key}`] = !!d.isChanged;
                                        });
                                        return next;
                                      });
                                    }}
                                    className="text-[10px] text-purple-400 hover:text-purple-300 underline cursor-pointer"
                                  >
                                    変更分を全選択
                                  </button>
                                  <span className="text-zinc-600 text-[10px]">|</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedFactFields((prev) => {
                                        const next = { ...prev };
                                        fp.diffs.forEach((d) => {
                                          next[`${fp.champion}::${d.key}`] = false;
                                        });
                                        return next;
                                      });
                                    }}
                                    className="text-[10px] text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
                                  >
                                    すべて解除
                                  </button>
                                </div>
                              </div>

                              {/* AI生成の失敗（設定漏れ等）は知見と混ぜずにエラーとして出す */}
                              {fp.error && (
                                <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-800/60 text-[11px] text-rose-400">
                                  <span className="font-bold">AIによる項目マージ案を作れませんでした。既存の内容は変更されません。</span>
                                  <span className="block text-rose-300/80 mt-0.5">理由: {fp.error}</span>
                                </div>
                              )}

                              {/* ハイライト */}
                              {fp.addedHighlights.length > 0 && (
                                <div className="p-2.5 rounded-lg bg-purple-950/30 border border-purple-800/40 text-[11px] text-purple-200 space-y-1">
                                  <span className="font-bold flex items-center gap-1 text-purple-300">
                                    <Sparkles size={12} /> 今回新たに追記される知見のサマリー:
                                  </span>
                                  <ul className="list-disc list-inside space-y-0.5 pl-1 text-zinc-300">
                                    {fp.addedHighlights.map((h, i) => <li key={i}>{h}</li>)}
                                  </ul>
                                </div>
                              )}

                              {/* 各フィールド差分 */}
                              <div className="space-y-3">
                                {fp.diffs.map((diff) => {
                                  const before = diff.before || '';
                                  const after = diff.after || '';
                                  const beforeLines = before.split('\n').map((l) => l.trim()).filter(Boolean);
                                  const beforeSet = new Set(beforeLines);
                                  const afterLines = after.split('\n');

                                  const fieldKeyId = `${fp.champion}::${diff.key}`;
                                  const isFieldSelected = selectedFactFields[fieldKeyId] ?? diff.isChanged;

                                  // 新規追加行のカウント
                                  let newlyAddedCount = 0;
                                  if (diff.isChanged) {
                                    afterLines.forEach((l) => {
                                      if (isLineNewlyAdded(l, before, beforeSet)) newlyAddedCount++;
                                    });
                                  }

                                   // 文ごとの行レンダラー（新規追記行なら反映/除外チェック＋宛先切り替えボタンを表示）
                                   const renderFactLine = (line: string, idx: number, isAdded: boolean) => {
                                     if (!isAdded) {
                                       return (
                                         <div key={idx} className="text-zinc-400 px-1 py-0.5 opacity-90 break-words font-sans">
                                           {line || '\u00A0'}
                                         </div>
                                       );
                                     }

                                     const lineKey = `${fp.champion}::${diff.key}::${idx}`;
                                     const dest = lineDestinations[lineKey] || 'champion';
                                     const isSkip = dest === 'skip';
                                     const isChamp = dest === 'champion';
                                     const isLane = dest === 'lane';

                                     return (
                                       <div
                                         key={idx}
                                         className={`p-2 rounded-lg border transition space-y-1.5 my-1.5 ${
                                           isSkip
                                             ? 'bg-zinc-950/40 border-zinc-800/60 opacity-50'
                                             : isLane
                                             ? 'bg-emerald-950/40 border-emerald-500/60 shadow-sm'
                                             : 'bg-purple-950/30 border-purple-500/60 shadow-sm'
                                         }`}
                                       >
                                         <div className="flex items-center justify-between gap-2 flex-wrap">
                                           {/* 反映 / スキップ チェックボックス */}
                                           <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                             <input
                                               type="checkbox"
                                               checked={!isSkip}
                                               onChange={() => {
                                                 setLineDestinations((prev) => ({
                                                   ...prev,
                                                   [lineKey]: isSkip ? 'champion' : 'skip',
                                                 }));
                                               }}
                                               className="w-3.5 h-3.5 accent-purple-500 rounded cursor-pointer"
                                             />
                                             <span className={`text-[10px] font-bold ${!isSkip ? 'text-zinc-200' : 'text-zinc-500'}`}>
                                               {!isSkip ? '反映' : 'スキップ（除外）'}
                                             </span>
                                             <span
                                               className={`text-[9px] px-1.5 py-0.2 rounded font-black uppercase border ${
                                                 isSkip
                                                   ? 'bg-zinc-800 text-zinc-500 border-zinc-700'
                                                   : isLane
                                                   ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                                   : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                               }`}
                                             >
                                               {isSkip ? '✕ 除外' : isLane ? '🗺️ レーンガイドへ' : '🏆 辞典へ'}
                                             </span>
                                           </label>

                                           {/* 宛先切り替えボタン */}
                                           <div className="flex items-center gap-1">
                                             <button
                                               type="button"
                                               onClick={() => {
                                                 setLineDestinations((prev) => ({ ...prev, [lineKey]: 'champion' }));
                                               }}
                                               className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                                                 isChamp
                                                   ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                                                   : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-purple-300'
                                               }`}
                                               title="チャンピオン辞典の該当項目へマージ"
                                             >
                                               <span>🏆 辞典へ</span>
                                             </button>

                                             <button
                                               type="button"
                                               onClick={() => {
                                                 setLineDestinations((prev) => ({ ...prev, [lineKey]: 'lane' }));
                                               }}
                                               className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                                                 isLane
                                                   ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm'
                                                   : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-emerald-300'
                                               }`}
                                               title="レーンガイド（攻略バイブル）の第8章へマクロ知見として合流"
                                             >
                                               <span>🗺️ レーンガイドへ</span>
                                             </button>
                                           </div>
                                         </div>

                                         {/* テキスト行 */}
                                         <div
                                           className={`text-xs pl-5 break-words font-sans ${
                                             isSkip
                                               ? 'line-through text-zinc-500'
                                               : isLane
                                               ? 'text-emerald-200 font-medium'
                                               : 'text-purple-200 font-medium'
                                           }`}
                                         >
                                           {line}
                                         </div>
                                       </div>
                                     );
                                   };

                                  return (
                                    <div
                                      key={diff.key}
                                      className={`p-3 rounded-xl border text-xs space-y-2 transition ${
                                        !isFieldSelected && diff.isChanged
                                          ? 'bg-zinc-900/40 border-zinc-800/60'
                                          : 'bg-zinc-900/80 border-zinc-800'
                                      }`}
                                    >
                                      {/* ヘッダー: チェックボックス ＆ ラベル ＆ 反映ステータス */}
                                      <div className="flex items-center justify-between gap-2">
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                          <input
                                            type="checkbox"
                                            checked={isFieldSelected}
                                            onChange={() => {
                                              setSelectedFactFields((prev) => ({
                                                ...prev,
                                                [fieldKeyId]: !isFieldSelected,
                                              }));
                                            }}
                                            className="w-4 h-4 accent-purple-500 rounded cursor-pointer shrink-0"
                                          />
                                          <span className="font-bold text-amber-300 text-xs">{diff.label}</span>
                                          {diff.isChanged && newlyAddedCount > 0 && (
                                            <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                              +{newlyAddedCount}行を新規追記
                                            </span>
                                          )}
                                        </label>

                                        {/* 一括設定ボタン */}
                                        {diff.isChanged && newlyAddedCount > 0 && isFieldSelected && (
                                          <div className="flex items-center gap-1 text-[10px] pl-2 border-l border-zinc-800">
                                            <span className="text-zinc-500 text-[9px]">一括:</span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setLineDestinations((prev) => {
                                                  const next = { ...prev };
                                                  afterLines.forEach((l, i) => {
                                                    if (isLineNewlyAdded(l, before, beforeSet)) {
                                                      next[`${fp.champion}::${diff.key}::${i}`] = 'champion';
                                                    }
                                                  });
                                                  return next;
                                                });
                                              }}
                                              className="px-1.5 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/80 hover:bg-purple-900/60 transition cursor-pointer text-[9px] font-bold"
                                              title="新規行をすべてチャンピオン辞典へ"
                                            >
                                              全行🏆辞典
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setLineDestinations((prev) => {
                                                  const next = { ...prev };
                                                  afterLines.forEach((l, i) => {
                                                    if (isLineNewlyAdded(l, before, beforeSet)) {
                                                      next[`${fp.champion}::${diff.key}::${i}`] = 'lane';
                                                    }
                                                  });
                                                  return next;
                                                });
                                              }}
                                              className="px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/80 hover:bg-emerald-900/60 transition cursor-pointer text-[9px] font-bold"
                                              title="新規行をすべてレーンガイドへ"
                                            >
                                              全行🗺️レーン
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setLineDestinations((prev) => {
                                                  const next = { ...prev };
                                                  afterLines.forEach((l, i) => {
                                                    if (isLineNewlyAdded(l, before, beforeSet)) {
                                                      next[`${fp.champion}::${diff.key}::${i}`] = 'skip';
                                                    }
                                                  });
                                                  return next;
                                                });
                                              }}
                                              className="px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200 transition cursor-pointer text-[9px] font-bold"
                                              title="新規行をすべて除外"
                                            >
                                              全行✕除外
                                            </button>
                                          </div>
                                        )}
                                        <div className="flex items-center gap-1.5">
                                          {diff.isChanged ? (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setSelectedFactFields((prev) => ({
                                                  ...prev,
                                                  [fieldKeyId]: !isFieldSelected,
                                                }));
                                              }}
                                              className={`text-[10px] px-2 py-0.5 rounded font-bold border transition cursor-pointer ${
                                                isFieldSelected
                                                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm'
                                                  : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-400'
                                              }`}
                                            >
                                              {isFieldSelected ? '✓ 反映する' : '✕ スキップ（反映しない）'}
                                            </button>
                                          ) : (
                                            <span className="text-[10px] px-2 py-0.5 rounded font-bold text-zinc-500 bg-zinc-950/60 border border-zinc-800">
                                              変更なし（既存維持）
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* スキップ時の注意通知 */}
                                      {!isFieldSelected && diff.isChanged && (
                                        <div className="p-2 rounded-lg bg-zinc-950/90 border border-zinc-800 text-[10px] text-zinc-400 flex items-center justify-between">
                                          <span className="text-zinc-400 font-semibold">
                                            ※ 反映しない設定です（承認時、既存データがそのまま維持されます）
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => setSelectedFactFields((prev) => ({ ...prev, [fieldKeyId]: true }))}
                                            className="text-purple-400 hover:text-purple-300 underline font-bold cursor-pointer"
                                          >
                                            反映する
                                          </button>
                                        </div>
                                      )}

                                      {/* コンテンツ表示エリア */}
                                      <div className={!isFieldSelected && diff.isChanged ? 'opacity-40 pointer-events-none' : ''}>
                                        {!diff.isChanged || !after.trim() ? (
                                          <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800 text-[11px] text-zinc-400 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto font-sans">
                                            {after.trim() || '（未記入）'}
                                          </div>
                                        ) : !before.trim() ? (
                                          /* 初回登録（Beforeが空）の場合 */
                                          <div className="p-2.5 rounded-lg bg-zinc-950 border border-emerald-900/60 text-[11px] space-y-1.5 max-h-60 overflow-y-auto font-sans">
                                            <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                              <span className="px-1.5 py-0.5 bg-emerald-500/20 rounded border border-emerald-500/40">
                                                ✨ 初回登録（全行が新規追記）
                                              </span>
                                            </div>
                                            <div className="space-y-1">
                                              {afterLines.map((line, idx) =>
                                                renderFactLine(line, idx, isLineNewlyAdded(line, before, beforeSet))
                                              )}
                                            </div>
                                          </div>
                                        ) : factsViewMode === 'split' ? (
                                          /* 2カラム比較モード */
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-sans">
                                            <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 text-zinc-400 space-y-1 max-h-60 overflow-y-auto">
                                              <span className="text-[10px] font-bold text-zinc-500 block border-b border-zinc-800/80 pb-1">
                                                変更前（既存データ）
                                              </span>
                                              <div className="whitespace-pre-wrap leading-relaxed">{before}</div>
                                            </div>
                                            <div className="p-2.5 rounded-lg bg-zinc-950 border border-purple-900/40 space-y-1 max-h-60 overflow-y-auto">
                                              <span className="text-[10px] font-bold text-emerald-400 block border-b border-zinc-800/80 pb-1">
                                                マージ後（+新知見ハイライト）
                                              </span>
                                              <div className="space-y-1">
                                                {afterLines.map((line, idx) =>
                                                  renderFactLine(line, idx, isLineNewlyAdded(line, before, beforeSet))
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        ) : (
                                          /* ハイライト強調表示モード（デフォルト） */
                                          <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/90 text-[11px] space-y-1 max-h-60 overflow-y-auto font-sans leading-relaxed">
                                            <div className="space-y-1">
                                              {afterLines.map((line, idx) =>
                                                renderFactLine(line, idx, isLineNewlyAdded(line, before, beforeSet))
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="p-4 rounded-xl bg-zinc-950 text-zinc-500 text-xs border border-zinc-800">
                            対象チャンピオンが指定されていないか、項目マージがオフになっています。
                          </p>
                        )}
                      </div>
  );
}
