'use client';

import { useState } from 'react';
import { ExternalLink, Check, X, Ban, Trash2, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import FactCheckSourceBlock, { EditableSourceBlock } from './FactCheckSourceBlock';

export interface QueueItem {
  id: number;
  champion: string;
  issue_type: 'contradiction' | 'unconfirmed_source' | 'possible_fact_error' | 'invalid_champion_tag';
  summary: string;
  detail?: {
    claim_a?: string;
    claim_b?: string;
    conflict_reason?: string;
    target_field?: string;
  };
  source_refs: any;
  status: string;
  created_at: string;
  sourcePreview?: { title: string; body: string; url?: string };
  championBlocks?: { editable: EditableSourceBlock[]; linked: { key: string; table?: 'personal_knowledge'; id?: number; label: string; value: string; url: string }[] };
}

const ISSUE_LABEL: Record<string, { label: string; cls: string }> = {
  contradiction: { label: '⚠️ 矛盾', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
  unconfirmed_source: { label: '❓ 単一ソースのみ(未確証)', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  possible_fact_error: { label: '🚫 事実誤りの疑い', cls: 'bg-red-100 text-red-700 border-red-200' },
  invalid_champion_tag: { label: '🏷️ 不正チャンピオンタグ', cls: 'bg-sky-100 text-sky-700 border-sky-200' },
};

// 一斉ファクトチェックのキュー1件分のカード。/admin/knowledge のレビュー画面と
// チャンピオン辞典ページ内の単体パネル(このチャンピオンだけ)の両方で使い回す。
export default function FactCheckQueueCard({ item, onActed }: { item: QueueItem; onActed: (id: number) => void }) {
  const it = item;
  const isContradiction = it.issue_type === 'contradiction';
  const [fixInput, setFixInput] = useState('');
  const [enemyInput, setEnemyInput] = useState('');
  const [acting, setActing] = useState(false);
  // 全情報源の垂れ流し表示を防ぎ、ピンポイント抽出対比カードを最優先表示するためデフォルトはfalse
  const [showBlocks, setShowBlocks] = useState(false);
  const [error, setError] = useState('');

  const act = async (
    action: 'dismiss' | 'acknowledge' | 'fix_champion_tag' | 'record_correction' | 'mark_no_champion' | 'delete_article',
    overrideCorrectInfo?: string,
  ) => {
    if (action === 'delete_article' && !confirm('元の記事データ自体を完全に削除します。この操作は取り消せません。よろしいですか？')) return;
    setActing(true); setError('');
    try {
      const body: any = { id: it.id, action };
      if (action === 'fix_champion_tag') {
        body.fixedChampion = fixInput.trim();
        if (enemyInput.trim()) body.fixedEnemy = enemyInput.trim();
      }
      if (action === 'record_correction') body.correctInfo = (overrideCorrectInfo ?? fixInput).trim();
      const res = await fetch('/api/admin/dict-fact-check/queue', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '反映に失敗しました');
      onActed(it.id);
    } catch (e: any) { setError(e.message); } finally { setActing(false); }
  };

  // 該当する問題レコード・記事のみを厳密抽出（無関係な大量の対面メモや分析をノイズ除去）
  // 指摘テーマ（例: target_field = 'power_spikes'）がある場合は、そのフィールドのテキスト『のみ』をピンポイント切り抜き抽出！
  const targetField = it.detail?.target_field;

  const filteredEditable = (it.championBlocks?.editable || []).filter((b) => {
    if (targetField && b.field && b.field !== targetField) {
      return false; // 無関係な全フィールド（ルーン、弱み等）を100%遮断
    }
    if (!Array.isArray(it.source_refs) || it.source_refs.length === 0) return true;
    return it.source_refs.some((ref: any) => {
      const targetTable = typeof ref === 'string' ? ref : ref.table;
      const targetId = typeof ref === 'object' ? ref.id : undefined;
      if (b.table !== targetTable) return false;
      if (targetId !== undefined && b.id !== undefined) return b.id === targetId;
      return true;
    });
  });

  const filteredLinked = (it.championBlocks?.linked || []).filter((b) => {
    if (!Array.isArray(it.source_refs) || it.source_refs.length === 0) return true;
    return it.source_refs.some((ref: any) => {
      const targetTable = typeof ref === 'string' ? ref : ref.table;
      const targetId = typeof ref === 'object' ? ref.id : undefined;
      if (b.table !== targetTable) return false;
      if (targetId !== undefined && b.id !== undefined) return b.id === targetId;
      return true;
    });
  });

  // 1タップで「元データテキストの自動更新」＋「AI再発防止ルールの学習登録」＋「カードの完了」を全て全自動で完走！
  const pickCorrect = async (label: string, value: string) => {
    if (!confirm(`「${label}」の内容を正しい情報として全自動適用しますか？\n\n【1タップで自動実行される内容】\n1. 元のテキストデータをこの正解テキストで即時自動全更新\n2. AIの再発防止ルールに登録（今後の自動生成でも二度と同じ間違いをしない）\n3. このカードを点検完了にして次のカードへ進む\n\n適用内容: ${value.slice(0, 150)}...`)) return;
    setActing(true); setError('');
    try {
      // 1. もし編集可能な対象ブロック (editable) が存在すれば、元テキストを正解で自動更新！
      // ここが失敗したまま次の手順(訂正記録＋完了)に進むと、誤った記述がDBに残ったまま
      // レビュー済み扱いになってしまうため、1件でも更新に失敗したら中断する。
      if (filteredEditable.length > 0) {
        const results = await Promise.all(filteredEditable.map((block) =>
          fetch('/api/admin/dict-fact-check/source', {
            method: 'PATCH', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table: block.table, id: block.id, champion: block.champion, field: block.field, value }),
          }).then((r) => r.ok).catch(() => false)
        ));
        if (results.some((ok) => !ok)) {
          throw new Error('元データの更新に失敗しました。ネットワーク状態を確認してもう一度お試しください。');
        }
      }

      // 2. AIの再発防止ルールに登録＋キューカード完了
      const body = { id: it.id, action: 'record_correction', correctInfo: `[${label}] ${value}` };
      const res = await fetch('/api/admin/dict-fact-check/queue', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '反映に失敗しました');
      onActed(it.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActing(false);
    }
  };

  // AIによる書き換え案の生成状態
  const [suggesting, setSuggesting] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ text: string; explanation: string } | null>(null);

  // AIに書き換え案を作成してもらう
  const handleRequestAiSuggestion = async () => {
    setSuggesting(true);
    setError('');
    try {
      const currentVal = filteredEditable[0]?.value || '';
      const res = await fetch('/api/admin/dict-fact-check/suggest-fix', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          champion: it.champion,
          issue_type: it.issue_type,
          summary: it.summary,
          conflict_reason: it.detail?.conflict_reason,
          target_field: targetField || filteredEditable[0]?.field,
          current_value: currentVal,
          claim_a: it.detail?.claim_a,
          claim_b: it.detail?.claim_b,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'AI修正案の生成に失敗しました');
      setAiSuggestion({
        text: d.suggested_text,
        explanation: d.explanation,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSuggesting(false);
    }
  };

  // 1タップで「元データテキストをクリア（削除）」＋「キュー完了」
  const clearAndFinish = async () => {
    if (!confirm(`対象の記載内容をすべて削除（クリア）し、このキューを点検完了にします。よろしいですか？`)) return;
    setActing(true);
    setError('');
    try {
      if (filteredEditable.length > 0) {
        await Promise.all(
          filteredEditable.map((block) =>
            fetch('/api/admin/dict-fact-check/source', {
              method: 'PATCH',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                table: block.table,
                id: block.id,
                champion: block.champion,
                field: block.field,
                value: '',
              }),
            })
          )
        );
      }
      const res = await fetch('/api/admin/dict-fact-check/queue', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: it.id, action: 'acknowledge' }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '完了処理に失敗しました');
      onActed(it.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3.5 shadow-2xs space-y-3">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-extrabold text-stone-900 text-sm">{it.champion}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ISSUE_LABEL[it.issue_type]?.cls}`}>
            {ISSUE_LABEL[it.issue_type]?.label || it.issue_type}
          </span>
          {Array.isArray(it.source_refs) && it.issue_type !== 'invalid_champion_tag' && (
            <span className="text-[10px] text-stone-400">出典: {it.source_refs.map((s: any) => (typeof s === 'string' ? s : s.table)).join(', ')}</span>
          )}
        </div>
        {it.issue_type !== 'invalid_champion_tag' && (
          <a href={`/champions?select=${encodeURIComponent(it.champion)}`} target="_blank" rel="noreferrer"
            className="text-[10px] text-sky-700 hover:underline flex items-center gap-0.5 shrink-0 font-bold">
            辞典で確認 <ExternalLink size={10} />
          </a>
        )}
      </div>

      <p className="text-xs text-stone-800 font-bold leading-relaxed">{it.summary}</p>

      {/* 🧭 アクション案内ガイド（何を行えばよいか） */}
      <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-2.5 text-[11px] text-amber-950 space-y-1">
        <div className="font-black flex items-center gap-1 text-amber-900">
          <span>💡</span> この指摘への対応方法（推奨手順）:
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-1 text-[10px] font-bold">
          <div className="bg-white/80 border border-amber-200 rounded-lg p-1.5 flex items-start gap-1">
            <span className="text-emerald-600 font-black">①</span>
            <span><strong>AI提案で書き換え</strong>: 下の「AI修正案」を採用して1タップで更新＆完了</span>
          </div>
          <div className="bg-white/80 border border-amber-200 rounded-lg p-1.5 flex items-start gap-1">
            <span className="text-rose-600 font-black">②</span>
            <span><strong>記載を削除</strong>: 誤った古い記述自体を消去して完了</span>
          </div>
          <div className="bg-white/80 border border-amber-200 rounded-lg p-1.5 flex items-start gap-1">
            <span className="text-stone-600 font-black">③</span>
            <span><strong>誤検知として却下</strong>: AIの誤判定の場合はそのまま却下</span>
          </div>
        </div>
      </div>

      {/* ⚡ AIがピンポイント抽出した矛盾・問題箇所の比較対比カード ⚡ */}
      {it.detail && (it.detail.claim_a || it.detail.claim_b) && (
        <div className="p-3 rounded-xl border border-rose-300 bg-rose-50/60 space-y-3 shadow-xs">
          <div className="text-xs font-black text-rose-900 flex items-center gap-1.5 border-b border-rose-200 pb-2">
            <span className="text-base">⚡</span> AIが検出したピンポイント的矛盾・不整合箇所
          </div>

          {it.detail.conflict_reason && (
            <p className="text-xs text-stone-800 bg-white/90 p-2.5 rounded-lg border border-rose-200 font-bold leading-relaxed">
              💡 <strong className="text-rose-900">食い違いの理由:</strong> {it.detail.conflict_reason}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {it.detail.claim_a && (
              <div className="p-3 rounded-xl bg-white border border-rose-200 space-y-2 flex flex-col justify-between shadow-2xs">
                <div>
                  <span className="font-extrabold text-rose-800 text-[11px] block mb-1">【記述 A】</span>
                  <p className="text-stone-800 leading-relaxed font-mono text-[11px] bg-stone-50 p-2 rounded border border-stone-200">{it.detail.claim_a}</p>
                </div>
                <button
                  type="button"
                  onClick={() => pickCorrect('記述 A', it.detail?.claim_a || '')}
                  disabled={acting}
                  className="px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg text-[11px] font-extrabold transition flex items-center justify-center gap-1 w-full mt-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Check size={13} /> ⚡ 1タップ全自動採用（テキスト更新＋完了）
                </button>
              </div>
            )}
            {it.detail.claim_b && (
              <div className="p-3 rounded-xl bg-white border border-rose-200 space-y-2 flex flex-col justify-between shadow-2xs">
                <div>
                  <span className="font-extrabold text-rose-800 text-[11px] block mb-1">【記述 B (矛盾)】</span>
                  <p className="text-stone-800 leading-relaxed font-mono text-[11px] bg-stone-50 p-2 rounded border border-stone-200">{it.detail.claim_b}</p>
                </div>
                <button
                  type="button"
                  onClick={() => pickCorrect('記述 B', it.detail?.claim_b || '')}
                  disabled={acting}
                  className="px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg text-[11px] font-extrabold transition flex items-center justify-center gap-1 w-full mt-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Check size={13} /> ⚡ 1タップ全自動採用（テキスト更新＋完了）
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🪄 AI修正案（書き換え提案）セクション */}
      {it.issue_type !== 'invalid_champion_tag' && (
        <div className="p-3 rounded-xl border border-emerald-300 bg-emerald-50/60 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-emerald-200 pb-2">
            <span className="text-xs font-black text-emerald-950 flex items-center gap-1">
              <span>🪄</span> AIによる書き換え推奨案
            </span>
            {!aiSuggestion && (
              <button
                type="button"
                onClick={handleRequestAiSuggestion}
                disabled={suggesting}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                {suggesting ? '🤖 AIが修正案を生成中...' : '✨ AIに修正案を作ってもらう'}
              </button>
            )}
          </div>

          {aiSuggestion ? (
            <div className="space-y-2 pt-1">
              <div className="bg-white p-2.5 rounded-lg border border-emerald-200 text-xs text-stone-800 font-mono whitespace-pre-wrap leading-relaxed">
                {aiSuggestion.text}
              </div>
              {aiSuggestion.explanation && (
                <p className="text-[11px] text-emerald-900 font-bold bg-emerald-100/60 p-2 rounded">
                  💡 <strong>修正理由:</strong> {aiSuggestion.explanation}
                </p>
              )}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => pickCorrect('AI修正提案', aiSuggestion.text)}
                  disabled={acting}
                  className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg text-xs font-black transition flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Check size={13} /> ✨ このAI修正案を採用して上書き更新＆完了（1タップ）
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFixInput(aiSuggestion.text);
                  }}
                  className="px-2.5 py-1.5 bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 rounded-lg text-xs font-bold transition"
                >
                  ✏️ 入力欄にコピーして手動調整
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-emerald-800 leading-relaxed font-bold">
              「AIに修正案を作ってもらう」を押すと、最新のゲーム知識をもとに元の記述を自然に書き換えたテキスト案を即座に作成します。
            </p>
          )}
        </div>
      )}

      {/* 🎯 指摘該当記事・記載内容のみ（確認対象） */}
      {it.issue_type !== 'invalid_champion_tag' && (filteredEditable.length > 0 || filteredLinked.length > 0) && (
        <div className="p-3 rounded-xl border border-sky-300 bg-sky-50/70 space-y-2">
          <div className="text-xs font-black text-sky-950 flex items-center justify-between border-b border-sky-200 pb-2">
            <span className="flex items-center gap-1.5">
              <span className="text-base">🎯</span> 指摘該当箇所の現在の記載（確認対象）
            </span>
            <span className="text-[10px] bg-sky-200 text-sky-900 px-2 py-0.5 rounded-full font-bold">
              該当 {filteredEditable.length + filteredLinked.length} 件のみ抽出
            </span>
          </div>

          <div className="space-y-2 pt-1 max-h-60 overflow-y-auto pr-1">
            {filteredEditable.map((b) => (
              <FactCheckSourceBlock key={b.key} block={b} onPickAsCorrect={isContradiction ? pickCorrect : undefined} />
            ))}
            {filteredLinked.map((b) => (
              <div key={b.key} className="rounded-lg border border-violet-200 bg-white p-3 text-xs shadow-2xs">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-bold text-violet-900">{b.label}</span>
                  {isContradiction && (
                    <button onClick={() => pickCorrect(b.label, b.value)} className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-0.5 shrink-0 text-[11px]">
                      <Check size={12} /> これが正しい
                    </button>
                  )}
                </div>
                <p className="text-stone-800 font-mono text-[11px] whitespace-pre-wrap leading-relaxed bg-stone-50 p-2 rounded border border-stone-200">{b.value.slice(0, 400)}{b.value.length >= 400 ? '…' : ''}</p>
                <a href={b.url} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline flex items-center gap-0.5 mt-1.5 w-fit text-[10px] font-bold">
                  ナレッジ記事を直接編集する <ExternalLink size={10} />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* invalid_champion_tagはchampion列自体がゴミ値のことが多く、参照元レコードの中身をここに直接プレビュー表示する */}
      {it.issue_type === 'invalid_champion_tag' && it.sourcePreview && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-xs">
          <div className="font-bold text-amber-900">📄 {it.sourcePreview.title || '(タイトルなし)'}</div>
          {it.sourcePreview.body && (
            <p className="text-stone-600 mt-1 whitespace-pre-wrap leading-relaxed">{it.sourcePreview.body}{it.sourcePreview.body.length >= 300 ? '…' : ''}</p>
          )}
          {it.sourcePreview.url && (
            <a href={it.sourcePreview.url} target="_blank" rel="noreferrer"
              className="text-sky-700 hover:underline flex items-center gap-0.5 mt-1 w-fit">
              元記事を開く <ExternalLink size={10} />
            </a>
          )}
        </div>
      )}

      {error && <p className="text-xs text-rose-700 mt-2 font-bold">{error}</p>}

      {/* フッターアクション */}
      <div className="flex items-center gap-2 pt-2 border-t border-stone-200 flex-wrap">
        {it.issue_type === 'invalid_champion_tag' ? (
          <>
            <input
              value={fixInput}
              onChange={(e) => setFixInput(e.target.value)}
              placeholder="正しいチャンピオン名を英語表記で（例: Graves）"
              className="text-xs px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white text-stone-900 w-56"
            />
            {['matchup_sentinel', 'champion_notes'].includes(it.source_refs?.[0]?.table) && (
              <input
                value={enemyInput}
                onChange={(e) => setEnemyInput(e.target.value)}
                placeholder="対面がいれば入力（任意・例: Fizz）"
                title="元の値に2チャンピオン分(例: 「Rek'Sai & Fizz」)が紛れていた場合、2体目をここに"
                className="text-xs px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white text-stone-900 w-48"
              />
            )}
            <button onClick={() => act('fix_champion_tag')} disabled={acting || !fixInput.trim()}
              className="flex items-center gap-1 text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-200 disabled:opacity-50">
              <Check size={12} /> この名前に修正
            </button>
            <button onClick={() => act('mark_no_champion')} disabled={acting}
              title="特定のチャンピオンに関する記事ではない場合（メタ記事・マクロ解説など）"
              className="flex items-center gap-1 text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-50">
              <Ban size={12} /> チャンピオンなし（対象外にする）
            </button>
            <button onClick={() => act('delete_article')} disabled={acting}
              title="ゴミ記事・不要な英語記事などを元データごと完全に削除します（取り消せません）"
              className="flex items-center gap-1 text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-lg hover:bg-rose-200 disabled:opacity-50">
              <Trash2 size={12} /> 記事を削除
            </button>
          </>
        ) : (
          <>
            {filteredEditable.length > 0 && (
              <button
                type="button"
                onClick={clearAndFinish}
                disabled={acting}
                className="flex items-center gap-1 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1.5 rounded-lg hover:bg-rose-100 disabled:opacity-50 transition"
                title="この問題の記載内容を空にして削除し、キューを完了にします"
              >
                <Trash2 size={12} /> 記載を削除して完了
              </button>
            )}

            <input
              value={fixInput}
              onChange={(e) => setFixInput(e.target.value)}
              placeholder="手動で正しい文章を入力して反映する場合"
              className="text-xs px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white text-stone-900 flex-1 min-w-[200px]"
            />
            <button onClick={() => pickCorrect('手動入力', fixInput)} disabled={acting || !fixInput.trim()}
              title="入力した内容で元データを更新し、再発防止記録に登録します"
              className="flex items-center gap-1 text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-200 disabled:opacity-50 shrink-0">
              <Check size={12} /> 手動入力内容で更新
            </button>
            <button onClick={() => act('acknowledge')} disabled={acting}
              title="指摘の内容は把握・確認したとして完了にする（元テキストはそのまま）"
              className="flex items-center gap-1 text-xs font-bold bg-stone-100 text-stone-700 border border-stone-200 px-2.5 py-1.5 rounded-lg hover:bg-stone-200 disabled:opacity-50 shrink-0">
              <Check size={12} /> 確認済みとして完了
            </button>
          </>
        )}
        <button onClick={() => act('dismiss')} disabled={acting}
          title="AIの誤判定。実際には矛盾・誤り・未確証ではない。このキュー項目を却下して消す"
          className="flex items-center gap-1 text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1.5 rounded-lg hover:bg-amber-100 disabled:opacity-50 shrink-0 ml-auto">
          <X size={12} /> 誤検知（指摘自体を却下）
        </button>
      </div>
    </div>
  );
}
