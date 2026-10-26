'use client';

import { useMemo } from 'react';
import { XCircle, ExternalLink, Eye, Compass, BookOpen, Dna, Tv, Scissors, Swords, RotateCcw, Loader2, Undo2, AlertTriangle, Lightbulb, Zap } from 'lucide-react';
import { LANE_OPTIONS, type ItemEditState, type LaneKey, type ReviewItem } from './types';
import { extractArticleSummary, stripArticleChrome } from '@/lib/articleDensity';
import { detectChampionsFromText } from '@/lib/championDetector';

// 承認待ちの記事カード（統合予定バッジ・本文・インライン編集・却下/プレビュー・ナレッジ分解）
// 2026-10-07: app/admin/review/page.tsx（1,691行）から分割。表示内容・動作は分割前と同じ。
// 2026-10-19: 「薄い可能性」の目印・🔁 再解析・再解析版の 🆚 比較 / 元の記事に戻す を追加。
export default function ReviewItemCard({ item, edit, isOpen, isSelected, isFocused, channel, busy, onToggleSelect, onToggleExpand, setChannel, onEdit, onApprove, onPreview, onReject, onDecompose, onReanalyze, onCompare, onDiscardReanalysis, onReload, onCardClick }: {
  item: ReviewItem;
  edit: ItemEditState;
  isOpen: boolean;
  isSelected: boolean;
  isFocused?: boolean;
  channel: string;
  busy: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  setChannel: (v: string) => void;
  onEdit: (patch: Partial<ItemEditState>) => void;
  onApprove?: () => void;
  onPreview: () => void;
  onReject: () => void;
  onDecompose?: () => void;
  onReanalyze?: () => void;
  onCompare?: () => void;
  onDiscardReanalysis?: () => void;
  onReload?: () => void;
  onCardClick?: () => void;
}) {
  const isDraft = item.reanalysis_of != null;
  const task = item.reanalysisTask;
  const taskActive = task && (task.status === 'pending' || task.status === 'running');
  const canReanalyze = !!onReanalyze && !item.is_atomic && /youtu/.test(item.source_url || '') && !taskActive;
  const thin = item.density?.level === 'thin';
  const factCount = item.analysis_meta?.fact_count;
  const summary = useMemo(() => extractArticleSummary(item.content), [item.content]);
  const cleanBody = useMemo(() => stripArticleChrome(item.content), [item.content]);
  const detected = useMemo(() => detectChampionsFromText(item.title, summary), [item.title, summary]);
  return (
    <div
      onClick={onCardClick}
      data-review-card={item.id}
      className={`p-4 md:p-5 rounded-2xl border space-y-3 transition duration-150 ${
        isFocused
          ? 'ring-2 ring-amber-500/90 border-amber-500/80 bg-zinc-900 shadow-xl shadow-amber-500/10'
          : isSelected
          ? 'bg-amber-500/5 border-amber-500/40'
          : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
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
            {isFocused && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500 text-zinc-950 font-mono tracking-wider animate-pulse">
                FOCUS (A:承認 X:却下)
              </span>
            )}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
              item.is_atomic ? 'text-teal-300 border-teal-800/60 bg-teal-950/40' : 'text-amber-300 border-amber-800/60 bg-amber-950/40'
            }`}>
              {item.is_atomic ? '分割知見' : '動画解析'}
            </span>
            {isDraft && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-emerald-300 border-emerald-800/60 bg-emerald-950/40">
                🔁 再解析版{typeof factCount === 'number' ? `（事実 ${factCount}件）` : ''}
              </span>
            )}
            {thin && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-amber-200 border-amber-700/60 bg-amber-950/40"
                title={item.density?.reasons.join('\n')}
              >
                ⚠️ 薄い可能性
              </span>
            )}

            {/* ✂️ 複数チャンピオン対象バッジ（ナレッジ分解推奨） */}
            {item.isMultiChampion && (
              <span
                className="text-[10px] font-black px-2 py-0.5 rounded border text-teal-200 border-teal-500/70 bg-teal-950/60 flex items-center gap-1 shadow-sm"
                title={item.multiReason || '複数チャンピオンが検出されました。ナレッジ分解を推奨します'}
              >
                <Scissors className="w-3 h-3 text-teal-400" />
                ✂️ 複数チャンプ対象 ({item.multiReason || '要分解'})
              </span>
            )}

            {/* 🎯 統合先＆対面バッジ（確実なメタ情報） */}
            {(() => {
              if (item.isMultiChampion) {
                return (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded border text-teal-300 border-teal-700/60 bg-teal-950/40 flex items-center gap-1">
                    ✂️ 個別教本へ分解推奨
                  </span>
                );
              }
              const targetChamp = edit.champion || item.currentChampNamesJa || item.detectedChampionsJa;
              if (targetChamp) {
                return (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded border text-emerald-300 border-emerald-700/60 bg-emerald-950/40 flex items-center gap-1 shadow-sm">
                    🎯 統合先: {targetChamp}教本
                  </span>
                );
              }
              return (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded border text-amber-300 border-amber-700/60 bg-amber-950/40 flex items-center gap-1">
                  ❓ チャンプ未定（レーン一般論）
                </span>
              );
            })()}
            {(edit.enemyChampion || item.enemyChampionJa) && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded border text-rose-300 border-rose-700/60 bg-rose-950/40 flex items-center gap-1 shadow-sm">
                ⚔️ vs {edit.enemyChampion || item.enemyChampionJa}
              </span>
            )}

            {Array.isArray(item.tags) && item.tags.includes('__DECOMPOSED__') && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-amber-300 border-amber-800/60 bg-amber-950/40 flex items-center gap-1">
                <Scissors className="w-2.5 h-2.5" /> 分解済み
              </span>
            )}
          </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
                      {/* 📺 チャンネル名バッジ（クリックでそのチャンネルにワンクリック絞り込み） */}
                      {item.channel && (
                        <button
                          type="button"
                          onClick={() => setChannel(channel === item.channel ? '' : item.channel)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border transition cursor-pointer ${
                            channel === item.channel
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-sm'
                              : 'bg-zinc-800/80 text-zinc-300 border-zinc-700/80 hover:bg-zinc-700 hover:text-white'
                          }`}
                          title={channel === item.channel ? 'チャンネル絞り込みを解除' : `「${item.channel}」で絞り込む`}
                        >
                          <Tv className="w-3 h-3 text-red-400" />
                          {item.channel}
                        </button>
                      )}

                      {/* 📚 文字数バッジ */}
                      <span className="text-[11px] text-zinc-400 font-mono">
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

                {/* 🔁 再解析の状態・薄いと判断した理由（2026-10-19） */}
                {(taskActive || task?.status === 'failed' || (thin && !isDraft) || isDraft) && (
                  <div className="space-y-1.5">
                    {taskActive && (
                      <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-800/50 text-[11px] text-amber-200 flex flex-wrap items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        再解析中（{task!.status === 'pending' ? '順番待ち' : '解析中'}・{new Date(task!.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 依頼）。終わると新しい版がこの記事と入れ替わって届きます
                        {onReload && (
                          <button type="button" onClick={onReload} className="underline cursor-pointer">最新の状態を読み込む</button>
                        )}
                      </div>
                    )}
                    {task?.status === 'failed' && (
                      <div className="p-2 rounded-lg bg-rose-950/30 border border-rose-800/60 text-[11px] text-rose-300 flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span className="break-words">再解析に失敗しました: {(task.error || '理由不明').split('\n')[0].slice(0, 200)}</span>
                      </div>
                    )}
                    {thin && !isDraft && item.density && item.density.reasons.length > 0 && (
                      <p className="text-[11px] text-amber-200/80">⚠️ {item.density.reasons.join(' ／ ')}</p>
                    )}
                    {isDraft && (
                      <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-800/60 text-[11px] text-emerald-200 flex flex-wrap items-center gap-2">
                        <span>元の記事 #{item.reanalysis_of} を作り直した版です。</span>
                        {onCompare && (
                          <button type="button" onClick={onCompare} className="px-2 py-0.5 rounded-md bg-emerald-600/80 hover:bg-emerald-500 text-white font-bold cursor-pointer">
                            🆚 元の記事と比べる
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 💡 核心要約（実戦ポイント直出し・目視判断を爆速化） */}
                {summary && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>💡 核心要約（実戦ポイント）</span>
                    </div>
                    <p className="text-xs text-amber-100/95 leading-relaxed font-medium">
                      {summary}
                    </p>
                  </div>
                )}

                {/* 🤖 自動判定＆統合先プレビューバッジ */}
                <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">統合予定:</span>
                    {/* チャンピオン教本バッジ */}
                    {edit.champion.trim() ? (
                      <span className="px-2 py-0.5 rounded-md bg-blue-950/60 border border-blue-800/70 text-blue-300 text-[11px] font-bold flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> 教本: {edit.champion}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-zinc-800/60 text-zinc-400 text-[11px]">
                        教本: なし（一般論）
                      </span>
                    )}

                    {/* 対面DBバッジ */}
                    {edit.enemyChampion.trim() ? (
                      <span className="px-2 py-0.5 rounded-md bg-rose-950/60 border border-rose-800/70 text-rose-300 text-[11px] font-bold flex items-center gap-1">
                        <Swords className="w-3 h-3 text-rose-400" /> 対面DB: vs {edit.enemyChampion} [{edit.lane}]
                      </span>
                    ) : item.isMatchup && item.matchupLabel ? (
                      <span className="px-2 py-0.5 rounded-md bg-rose-950/40 border border-rose-800/40 text-rose-300/80 text-[11px] font-bold flex items-center gap-1">
                        <Swords className="w-3 h-3 text-rose-400" /> {item.matchupLabel}
                      </span>
                    ) : null}

                    {/* レーンガイドバッジ */}
                    {edit.includeLaneGuide ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-800/70 text-emerald-300 text-[11px] font-bold flex items-center gap-1">
                        <Compass className="w-3 h-3" /> レーンガイド: {edit.lane}（第8章）
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-zinc-800/60 text-zinc-500 text-[11px]">
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

                {/* 字幕から取れた事実（2026-10-20）。全文を読まずに判断できるよう本文より先に出す。時刻は動画のその場面へのリンク */}
                {Array.isArray(item.analysis_meta?.facts) && item.analysis_meta!.facts!.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-1">
                    <div className="text-[11px] font-bold text-zinc-400">
                      🧾 字幕から取れた事実（{item.analysis_meta!.facts!.length}件）
                    </div>
                    <ul className="space-y-1">
                      {item.analysis_meta!.facts!.map((f, i) => {
                        const sec = f.ts ? f.ts.split(':').reduce((acc, v) => acc * 60 + Number(v), 0) : null;
                        const href = sec !== null && item.source_url
                          ? `${item.source_url}${item.source_url.includes('?') ? '&' : '?'}t=${sec}s`
                          : null;
                        return (
                          <li key={i} className="text-[11px] text-zinc-300 leading-relaxed">
                            {href ? (
                              <a href={href} target="_blank" rel="noopener noreferrer" className="font-mono text-amber-400 hover:underline mr-1.5">[{f.ts}]</a>
                            ) : (
                              <span className="font-mono text-zinc-600 mr-1.5">[--:--]</span>
                            )}
                            {f.uncertain && <span className="text-rose-300 mr-1" title="聞き間違いの疑いがある固有名詞を含む">要確認</span>}
                            <span>{f.claim}</span>
                            {f.condition && <span className="text-zinc-500">（{f.condition}）</span>}
                            {f.reason && <span className="text-zinc-400"> ← {f.reason}</span>}
                            {f.numbers && <span className="text-emerald-300/80 ml-1">[{f.numbers}]</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* 本文プレビュー */}
                <p className={`text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap ${isOpen ? '' : 'line-clamp-4'}`}>
                  {isOpen ? item.content : (cleanBody || item.content)}
                </p>
                {item.content.length > 250 && (
                  <button onClick={onToggleExpand} className="text-[11px] text-amber-400 hover:text-amber-300 cursor-pointer">
                    {isOpen ? '折りたたむ' : '本文全文を表示（元動画URL情報を含む）'}
                  </button>
                )}

                {/* 🛠️ インライン編集＆承認コントローラー */}
                <div className="pt-3 border-t border-zinc-800/80 flex flex-col lg:flex-row lg:items-end justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3 flex-1">
                    {/* チャンピオン入力欄 */}
                    <div className="flex flex-col gap-1 min-w-[180px] flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-zinc-400 font-bold">
                        <span>対象チャンピオン（カンマ区切り可 / 空欄＝一般論）</span>
                        {detected.main && edit.champion.trim() !== detected.main.id && (
                          <button
                            type="button"
                            onClick={() => onEdit({ champion: detected.main!.id })}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border border-blue-500/40 text-[10px] font-bold cursor-pointer transition shadow-sm"
                            title="クリックすると対象チャンピオン欄に自動入力されます"
                          >
                            <span>🎯 {detected.main.nameJa} ({detected.main.id}) 適用</span>
                          </button>
                        )}
                      </div>
                      <input
                        list="roster-champions"
                        value={edit.champion}
                        onChange={(e) => onEdit({ champion: e.target.value })}
                        placeholder="例: ノクターン, シン・ジャオ"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* 対面相手入力欄 */}
                    <div className="flex flex-col gap-1 min-w-[140px] w-44">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-zinc-400 font-bold">
                        <span>対面相手（空欄＝対面なし）</span>
                        {detected.enemy && edit.enemyChampion.trim() !== detected.enemy.id && (
                          <button
                            type="button"
                            onClick={() => onEdit({ enemyChampion: detected.enemy!.id })}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-[10px] font-bold cursor-pointer transition shadow-sm"
                            title="クリックすると対面相手欄に自動入力されます"
                          >
                            <span>⚔️ {detected.enemy.nameJa} ({detected.enemy.id}) 適用</span>
                          </button>
                        )}
                      </div>
                      <input
                        list="roster-champions"
                        value={edit.enemyChampion}
                        onChange={(e) => onEdit({ enemyChampion: e.target.value })}
                        placeholder="例: トリンダメア"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* レーン選択セレクト */}
                    <label className="flex flex-col gap-1 text-[10px] text-zinc-400 font-bold w-36">
                      <span>統合先レーン</span>
                      <select
                        value={edit.lane}
                        onChange={(e) => onEdit({ lane: e.target.value as LaneKey })}
                        className="w-full px-2 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                      >
                        {LANE_OPTIONS.map((l) => (
                          <option key={l.key} value={l.key}>{l.label}</option>
                        ))}
                      </select>
                    </label>

                    {/* トグル群 */}
                    <div className="flex items-center gap-3 pt-4">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={edit.includeLaneGuide}
                          onChange={(e) => onEdit({ includeLaneGuide: e.target.checked })}
                          className="accent-amber-500 w-4 h-4"
                        />
                        <span>🗺️ レーンガイド</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 cursor-pointer select-none">
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
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {onDecompose && !item.is_atomic && (
                      <button
                        type="button"
                        onClick={() => onDecompose()}
                        disabled={busy}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 transition shadow-sm ${
                          item.isMultiChampion
                            ? 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white shadow-teal-900/30 font-black'
                            : 'bg-teal-950/40 border border-teal-700/60 text-teal-300 hover:bg-teal-900/50'
                        }`}
                        title="記事内の複数チャンピオン・マクロ知見を個別の分割知見へ分解します"
                      >
                        <Scissors className="w-3.5 h-3.5" /> ✂️ {item.isMultiChampion ? 'ナレッジ分解（推奨）' : 'ナレッジ分解'}
                      </button>
                    )}
                    {canReanalyze && (
                      <button
                        type="button"
                        onClick={() => onReanalyze!()}
                        disabled={busy}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 transition ${
                          thin ? 'bg-amber-600/80 hover:bg-amber-500 border-amber-500 text-white' : 'bg-amber-950/30 border-amber-700/60 text-amber-300 hover:bg-amber-900/40'
                        }`}
                        title="理由や深掘りしたい観点を付けて、この記事を作り直します（元の記事は残ります）"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> {isDraft ? 'もう一度再解析' : '再解析'}
                      </button>
                    )}
                    {isDraft && onDiscardReanalysis ? (
                      <button
                        onClick={() => onDiscardReanalysis()}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-600 text-stone-200 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        title="この再解析版は使わず、元の記事を承認待ちに戻します"
                      >
                        <Undo2 className="w-3.5 h-3.5" /> 元の記事に戻す
                      </button>
                    ) : (
                      <button
                        onClick={() => onReject()}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-lg bg-rose-950/30 border border-rose-800/60 text-rose-400 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" /> 却下
                      </button>
                    )}
                    {onApprove && (
                      <button
                        type="button"
                        onClick={() => onApprove()}
                        disabled={busy}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm transition"
                        title="プレビューモーダルを開かず、現在の設定で即座に承認して統合を実行します"
                      >
                        <Zap className="w-3.5 h-3.5" /> ⚡ 即時承認（統合）
                      </button>
                    )}
                    <button
                      onClick={() => onPreview()}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 border border-zinc-700 shadow-sm transition"
                      title="統合先をプレビュー確認・手直ししてから承認を実行します"
                    >
                      <Eye className="w-3.5 h-3.5" /> プレビュー
                    </button>
                  </div>
                </div>
              </div>
  );
}
