'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import { CheckCircle2, RefreshCw, AlertTriangle, Eye, Compass, BookOpen, Edit3, Dna, Swords } from 'lucide-react';
import StrategyPreviewTab from './StrategyPreviewTab';
import MatchupPreviewTab from './MatchupPreviewTab';
import FactsPreviewTab from './FactsPreviewTab';
import LanePreviewTab from './LanePreviewTab';
import { LANE_OPTIONS, type ItemEditState, type LaneKey, type LineDestination, type PreviewResult } from './types';

// 統合先プレビュー＆修正モーダル（記事情報の調整・3種類のプレビュー・承認）
// 2026-10-07: app/admin/review/page.tsx（1,691行）から分割。表示内容・動作は分割前と同じ。
export default function PreviewModal({ edit, previewData, previewLoading, previewTab, setPreviewTab, modalError, busy, selectedFactFields, setSelectedFactFields, lineDestinations, setLineDestinations, editedLaneSectionText, setEditedLaneSectionText, onClose, onEdit, onRecalculate, onApprove }: {
  edit: ItemEditState | undefined;
  previewData: PreviewResult | null;
  previewLoading: boolean;
  previewTab: 'facts' | 'strategy' | 'lane' | 'matchup';
  setPreviewTab: (v: 'facts' | 'strategy' | 'lane' | 'matchup') => void;
  modalError: string | null;
  busy: boolean;
  selectedFactFields: Record<string, boolean>;
  setSelectedFactFields: Dispatch<SetStateAction<Record<string, boolean>>>;
  lineDestinations: Record<string, LineDestination>;
  setLineDestinations: Dispatch<SetStateAction<Record<string, LineDestination>>>;
  editedLaneSectionText: string;
  setEditedLaneSectionText: (v: string) => void;
  onClose: () => void;
  onEdit: (patch: Partial<ItemEditState>) => void;
  onRecalculate: () => void;
  onApprove: () => void;
}) {
  // 表示の切り替えはこのモーダルの中だけで使う（開き直すと既定に戻る）
  const [factsViewMode, setFactsViewMode] = useState<'highlight' | 'split'>('highlight');
  const [laneViewMode, setLaneViewMode] = useState<'highlight' | 'split' | 'edit'>('highlight');
  return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
            <div className="bg-[#141418] border border-zinc-700/80 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
              {/* モーダルヘッダー */}
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-amber-400" />
                  <div>
                    <h2 className="text-sm font-black text-white">実際の統合文面プレビュー ＆ 内容の修正</h2>
                    <p className="text-[11px] text-zinc-400">
                      実際に各データベースに書き込まれる完全な文面です。確認・手直しの上で承認統合を実行できます。
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onClose()}
                  className="text-zinc-400 hover:text-white text-sm font-bold p-1 cursor-pointer"
                >
                  ✕ 閉じる
                </button>
              </div>

              {/* モーダルコンテンツ */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
                {modalError && (
                  <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-600 text-rose-200 text-xs flex items-start gap-2 shadow-sm animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-rose-300 font-bold">承認・統合エラー</strong>
                      <span>{modalError}</span>
                    </div>
                  </div>
                )}

                {previewLoading ? (
                  <div className="py-20 text-center text-amber-400 flex items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>AIによる各項目マージと統合文面を生成中...</span>
                  </div>
                ) : (
                  <>
                    {/* タイトル・本文の微調整フォーム */}
                    <div className="space-y-3 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
                      <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                        <Edit3 className="w-3.5 h-3.5" /> 記事情報の調整（統合前に修正できます）
                      </span>
                      <label className="block space-y-1">
                        <span className="text-[10px] text-zinc-400 font-bold">記事タイトル</span>
                        <input
                          type="text"
                          value={edit?.title || ''}
                          onChange={(e) => onEdit({ title: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white"
                        />
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <label className="block space-y-1">
                          <span className="text-[10px] text-zinc-400 font-bold">対象チャンピオン</span>
                          <input
                            list="roster-champions"
                            value={edit?.champion || ''}
                            onChange={(e) => onEdit({ champion: e.target.value })}
                            placeholder="例: ノクターン"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-[10px] text-zinc-400 font-bold">対面相手（空欄＝なし）</span>
                          <input
                            list="roster-champions"
                            value={edit?.enemyChampion || ''}
                            onChange={(e) => onEdit({ enemyChampion: e.target.value })}
                            placeholder="例: トリンダメア"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-[10px] text-zinc-400 font-bold">統合先レーン</span>
                          <select
                            value={edit?.lane || 'COMMON'}
                            onChange={(e) => onEdit({ lane: e.target.value as LaneKey })}
                            className="w-full px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white"
                          >
                            {LANE_OPTIONS.map((l) => (
                              <option key={l.key} value={l.key}>{l.label}</option>
                            ))}
                          </select>
                        </label>
                        <div className="flex items-center gap-3 pt-3">
                          <label className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={edit?.includeLaneGuide || false}
                              onChange={(e) => onEdit({ includeLaneGuide: e.target.checked })}
                              className="accent-amber-500 w-4 h-4"
                            />
                            <span>レーンガイド</span>
                          </label>
                          <label className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={edit?.includeFactMerge ?? true}
                              onChange={(e) => onEdit({ includeFactMerge: e.target.checked })}
                              className="accent-amber-500 w-4 h-4"
                            />
                            <span>項目マージ</span>
                          </label>
                        </div>
                      </div>
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => onRecalculate()}
                          className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-bold cursor-pointer"
                        >
                          プレビューを再計算
                        </button>
                      </div>
                    </div>

                    {/* プレビュー表示タブバー */}
                    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-2">
                      <button
                        onClick={() => setPreviewTab('strategy')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          previewTab === 'strategy'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-zinc-400 hover:text-white bg-zinc-900'
                        }`}
                      >
                        <BookOpen size={13} />
                        <span>📖 教本プレビュー</span>
                        <span className="text-[10px] opacity-80">({previewData?.championPreviews?.length || 0}体)</span>
                      </button>

                      {((previewData?.matchupPreviews && previewData.matchupPreviews.length > 0) || edit?.enemyChampion) && (
                        <button
                          onClick={() => setPreviewTab('matchup')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            previewTab === 'matchup'
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'text-zinc-400 hover:text-white bg-zinc-900'
                          }`}
                        >
                          <Swords size={13} />
                          <span>⚔️ 対面DBプレビュー</span>
                          <span className="text-[10px] opacity-80">({previewData?.matchupPreviews?.length || 0}件)</span>
                        </button>
                      )}

                      {edit?.includeFactMerge && (
                        <button
                          onClick={() => setPreviewTab('facts')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            previewTab === 'facts'
                              ? 'bg-purple-600 text-white shadow-sm'
                              : 'text-zinc-400 hover:text-white bg-zinc-900'
                          }`}
                        >
                          <Dna size={13} />
                          <span>🧬 項目マージ差分</span>
                          <span className="text-[10px] opacity-80">({previewData?.factPreviews?.length || 0}体)</span>
                        </button>
                      )}

                      <button
                        onClick={() => setPreviewTab('lane')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          previewTab === 'lane'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-zinc-400 hover:text-white bg-zinc-900'
                        }`}
                      >
                        <Compass size={13} />
                        <span>🗺️ レーンガイドプレビュー</span>
                        {previewData?.laneGuidePreview && <span className="text-[10px] opacity-80">(ON)</span>}
                      </button>
                    </div>

                    {previewTab === 'strategy' && <StrategyPreviewTab previewData={previewData} />}
                    {previewTab === 'matchup' && <MatchupPreviewTab previewData={previewData} />}
                    {previewTab === 'facts' && (
                      <FactsPreviewTab
                        previewData={previewData}
                        factsViewMode={factsViewMode}
                        setFactsViewMode={setFactsViewMode}
                        selectedFactFields={selectedFactFields}
                        setSelectedFactFields={setSelectedFactFields}
                        lineDestinations={lineDestinations}
                        setLineDestinations={setLineDestinations}
                      />
                    )}
                    {previewTab === 'lane' && (
                      <LanePreviewTab
                        previewData={previewData}
                        laneViewMode={laneViewMode}
                        setLaneViewMode={setLaneViewMode}
                        editedLaneSectionText={editedLaneSectionText}
                        setEditedLaneSectionText={setEditedLaneSectionText}
                      />
                    )}
                  </>
                )}
              </div>

              {/* モーダルフッター */}
              <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between gap-3">
                <button
                  onClick={() => onClose()}
                  disabled={busy}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold cursor-pointer transition disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => onApprove()}
                  disabled={busy || previewLoading}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition"
                >
                  {busy ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                      <span>二系統統合 ＆ AI差分マージを実行中...</span>
                    </>
                  ) : previewLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                      <span>プレビュー生成中...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>この完全な文面で承認して統合を実行</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
  );
}
