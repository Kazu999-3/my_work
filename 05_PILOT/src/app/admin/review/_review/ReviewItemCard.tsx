'use client';

import { XCircle, ExternalLink, Eye, Compass, BookOpen, Dna, Tv, Scissors } from 'lucide-react';
import { LANE_OPTIONS, type ItemEditState, type LaneKey, type ReviewItem } from './types';

// 承認待ちの記事カード（統合予定バッジ・本文・インライン編集・却下/プレビュー・ナレッジ分解）
// 2026-10-07: app/admin/review/page.tsx（1,691行）から分割。表示内容・動作は分割前と同じ。
export default function ReviewItemCard({ item, edit, isOpen, isSelected, channel, busy, onToggleSelect, onToggleExpand, setChannel, onEdit, onPreview, onReject, onDecompose }: {
  item: ReviewItem;
  edit: ItemEditState;
  isOpen: boolean;
  isSelected: boolean;
  channel: string;
  busy: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  setChannel: (v: string) => void;
  onEdit: (patch: Partial<ItemEditState>) => void;
  onPreview: () => void;
  onReject: () => void;
  onDecompose?: () => void;
}) {
  return (
              <div
                className={`p-4 md:p-5 rounded-2xl border space-y-3 transition ${
                  isSelected ? 'bg-amber-500/5 border-amber-500/40' : 'bg-slate-900/80 border-slate-800'
                }`}
              >
                {/* タイトル ＆ メタデータ行 */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={onToggleSelect}
                    className="mt-1 accent-amber-500 shrink-0"
                    aria-label="選択"
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-white break-words">{item.title}</h3>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                        item.is_atomic ? 'text-teal-300 border-teal-800/60 bg-teal-950/40' : 'text-amber-300 border-amber-800/60 bg-amber-950/40'
                      }`}>
                        {item.is_atomic ? '分割知見' : '動画解析'}
                      </span>
                      {Array.isArray(item.tags) && item.tags.includes('__DECOMPOSED__') && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-indigo-300 border-indigo-800/60 bg-indigo-950/40 flex items-center gap-1">
                          <Scissors className="w-2.5 h-2.5" /> 分解済み
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                      {/* 📺 チャンネル名バッジ（クリックでそのチャンネルにワンクリック絞り込み） */}
                      {item.channel && (
                        <button
                          type="button"
                          onClick={() => setChannel(channel === item.channel ? '' : item.channel)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border transition cursor-pointer ${
                            channel === item.channel
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-sm'
                              : 'bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700 hover:text-white'
                          }`}
                          title={channel === item.channel ? 'チャンネル絞り込みを解除' : `「${item.channel}」で絞り込む`}
                        >
                          <Tv className="w-3 h-3 text-red-400" />
                          {item.channel}
                        </button>
                      )}

                      {/* 📚 文字数バッジ */}
                      <span className="text-[11px] text-slate-400 font-mono">
                        📚 {(item.char_count || item.content?.length || 0).toLocaleString()}文字
                      </span>

                      <span>{new Date(item.created_at).toLocaleDateString('ja-JP')} 生成</span>
                      {item.parentTitle && <span>元記事: {item.parentTitle}</span>}
                      {item.source_url && (
                        <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 font-medium">
                          <ExternalLink className="w-3 h-3" /> 元動画
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* 🤖 自動判定＆統合先プレビューバッジ */}
                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">統合予定:</span>
                    {/* チャンピオン教本バッジ */}
                    {edit.champion.trim() ? (
                      <span className="px-2 py-0.5 rounded-md bg-blue-950/60 border border-blue-800/70 text-blue-300 text-[11px] font-bold flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> 教本: {edit.champion}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-slate-800/60 text-slate-400 text-[11px]">
                        教本: なし（一般論）
                      </span>
                    )}

                    {/* レーンガイドバッジ */}
                    {edit.includeLaneGuide ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-800/70 text-emerald-300 text-[11px] font-bold flex items-center gap-1">
                        <Compass className="w-3 h-3" /> レーンガイド: {edit.lane}（第8章）
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-slate-800/60 text-slate-500 text-[11px]">
                        レーンガイド: なし
                      </span>
                    )}

                    {/* 各項目マージバッジ */}
                    {edit.champion.trim() && edit.includeFactMerge && (
                      <span className="px-2 py-0.5 rounded-md bg-purple-950/60 border border-purple-800/70 text-purple-300 text-[11px] font-bold flex items-center gap-1">
                        <Dna className="w-3 h-3" /> 項目マージ: ON
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {onDecompose && !item.is_atomic && (
                      <button
                        type="button"
                        onClick={() => onDecompose()}
                        disabled={busy}
                        className="px-2.5 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 text-[11px] font-bold flex items-center gap-1 border border-teal-500/30 transition cursor-pointer"
                        title="記事内の複数チャンピオン・マクロ知見を個別の分割知見へ分解します"
                      >
                        <Scissors className="w-3.5 h-3.5" /> 複数チャンプにナレッジ分解
                      </button>
                    )}
                    <button
                      onClick={() => onPreview()}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[11px] font-bold flex items-center gap-1 border border-amber-500/30 transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> 統合プレビュー＆修正
                    </button>
                  </div>
                </div>

                {/* 本文プレビュー */}
                <p className={`text-xs text-slate-300 leading-relaxed whitespace-pre-wrap ${isOpen ? '' : 'line-clamp-4'}`}>
                  {item.content}
                </p>
                {item.content.length > 250 && (
                  <button onClick={onToggleExpand} className="text-[11px] text-amber-400 hover:text-amber-300 cursor-pointer">
                    {isOpen ? '折りたたむ' : '本文全文を表示'}
                  </button>
                )}

                {/* 🛠️ インライン編集＆承認コントローラー */}
                <div className="pt-3 border-t border-slate-800/80 flex flex-col lg:flex-row lg:items-end justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3 flex-1">
                    {/* チャンピオン入力欄 */}
                    <label className="flex flex-col gap-1 text-[10px] text-slate-400 font-bold min-w-[200px] flex-1">
                      <span>対象チャンピオン（カンマ区切りで複数可 / 空欄＝一般論）</span>
                      <input
                        list="roster-champions"
                        value={edit.champion}
                        onChange={(e) => onEdit({ champion: e.target.value })}
                        placeholder="例: ノクターン, シン・ジャオ"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </label>

                    {/* レーン選択セレクト */}
                    <label className="flex flex-col gap-1 text-[10px] text-slate-400 font-bold w-36">
                      <span>統合先レーン</span>
                      <select
                        value={edit.lane}
                        onChange={(e) => onEdit({ lane: e.target.value as LaneKey })}
                        className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                      >
                        {LANE_OPTIONS.map((l) => (
                          <option key={l.key} value={l.key}>{l.label}</option>
                        ))}
                      </select>
                    </label>

                    {/* トグル群 */}
                    <div className="flex items-center gap-3 pt-4">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={edit.includeLaneGuide}
                          onChange={(e) => onEdit({ includeLaneGuide: e.target.checked })}
                          className="accent-amber-500 w-4 h-4"
                        />
                        <span>🗺️ レーンガイド</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={edit.includeFactMerge}
                          onChange={(e) => onEdit({ includeFactMerge: e.target.checked })}
                          className="accent-amber-500 w-4 h-4"
                        />
                        <span>🧬 項目マージ</span>
                      </label>
                    </div>
                  </div>

                  {/* アクションボタン */}
                  <div className="flex items-center gap-2 shrink-0">
                    {onDecompose && !item.is_atomic && (
                      <button
                        type="button"
                        onClick={() => onDecompose()}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-lg bg-teal-950/40 border border-teal-700/60 text-teal-300 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 hover:bg-teal-900/50 transition shadow-sm"
                        title="記事内の複数チャンピオン・マクロ知見を個別の分割知見へ分解します"
                      >
                        <Scissors className="w-3.5 h-3.5" /> ✂️ ナレッジ分解
                      </button>
                    )}
                    <button
                      onClick={() => onReject()}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg bg-rose-950/30 border border-rose-800/60 text-rose-400 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" /> 却下
                    </button>
                    <button
                      onClick={() => onPreview()}
                      disabled={busy}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                      title="統合先をプレビュー確認してから承認を実行します"
                    >
                      <Eye className="w-3.5 h-3.5" /> プレビューして承認統合
                    </button>
                  </div>
                </div>
              </div>
  );
}
