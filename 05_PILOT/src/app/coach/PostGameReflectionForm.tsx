'use client';

import { useEffect, useState } from 'react';
import { NotebookPen } from 'lucide-react';

// この試合の振り返り（2026-10-06）。独立タブだった「📝 振り返りノート」を試合後タブへ吸収した。
// 保存先は従来どおり soloq_reflections（match_id で1試合1件）。チャンピオン・勝敗・KDA・CSは
// 手入力させず試合データから入れる。対面メモは保存時に対面メモ帳（matchup_sentinel）へ追記され、
// 次にその対面と当たった時の試合前タブに出る（lib/matchupMemo.ts）。
// 旧「試合メモ」(coach_analyses.notes)と「対面メモへ同期」ボタンはこのフォームに一本化した。

interface Props {
  matchId: string;
  champion: string;
  enemyChampion: string | null;
  isWin: boolean;
  kda: string;
  cs: number;
  gameDurationSec: number;
}

const MENTAL_LABELS = ['', 'かなり悪い', '悪い', '普通', '良い', 'かなり良い'];

export default function PostGameReflectionForm({ matchId, champion, enemyChampion, isWin, kda, cs, gameDurationSec }: Props) {
  const [note, setNote] = useState('');
  const [matchupMemo, setMatchupMemo] = useState('');
  const [nextFocus, setNextFocus] = useState('');
  const [mental, setMental] = useState<number | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string }[]>([]);

  const snapshot = JSON.stringify([note, matchupMemo, nextFocus, mental]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setStatus([]);
      try {
        const res = await fetch(`/api/soloq/reflections?matchId=${encodeURIComponent(matchId)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '振り返りの取得に失敗しました');
        const r = json.reflection;
        if (cancelled) return;
        const vals: [string, string, string, number | null] = [
          r?.reflection_note || '', r?.matchup_memo || '', r?.next_focus_point || '', r?.mental_rating ?? null,
        ];
        setNote(vals[0]); setMatchupMemo(vals[1]); setNextFocus(vals[2]); setMental(vals[3]);
        setSavedSnapshot(JSON.stringify(vals));
      } catch (e: any) {
        if (!cancelled) setStatus([{ ok: false, text: e.message }]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [matchId]);

  const save = async () => {
    setSaving(true);
    setStatus([]);
    try {
      const res = await fetch('/api/soloq/reflections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          champion,
          enemyChampion,
          win: isWin,
          kda,
          cs,
          gameDuration: gameDurationSec,
          mentalRating: mental,
          reflectionNote: note.trim(),
          matchupMemo: matchupMemo.trim(),
          nextFocusPoint: nextFocus.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '保存に失敗しました');
      const msgs = [{ ok: true, text: '振り返りを保存しました' }];
      if (json.matchupSync) msgs.push({ ok: json.matchupSync.ok, text: json.matchupSync.message });
      setStatus(msgs);
      setSavedSnapshot(snapshot);
    } catch (e: any) {
      setStatus([{ ok: false, text: e.message || '保存に失敗しました' }]);
    } finally {
      setSaving(false);
    }
  };

  const dirty = snapshot !== savedSnapshot;
  const inputCls = 'w-full px-3 py-2 bg-stone-900/60 border border-stone-800 rounded-xl text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500';

  return (
    <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-3">
      <span className="text-xs font-black text-stone-100 flex items-center gap-1.5">
        <NotebookPen className="w-4 h-4 text-amber-400" />
        この試合の振り返り
      </span>

      {loading ? (
        <p className="text-[11px] text-stone-400">読み込み中...</p>
      ) : (
        <>
          <label className="block space-y-1">
            <span className="text-[11px] font-bold text-stone-300">反省・勝敗の分岐点</span>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例: 2回目のガンクで敵JGと鉢合わせ、フラッシュを吐かされた"
              className={inputCls}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-bold text-stone-300">
              対面メモ{enemyChampion ? `（vs ${enemyChampion}）` : ''}
              <span className="text-[10px] font-normal text-stone-500 ml-1">保存すると対面メモ帳に追記され、次に当たった時の試合前タブに出ます</span>
            </span>
            <input
              type="text"
              value={matchupMemo}
              onChange={(e) => setMatchupMemo(e.target.value)}
              disabled={!enemyChampion}
              placeholder={enemyChampion ? `例: ${enemyChampion}のレベル6前後はオールインに注意` : '対面が特定できない試合では使えません'}
              className={`${inputCls} disabled:opacity-50`}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-bold text-stone-300">次の試合で意識すること</span>
            <input
              type="text"
              value={nextFocus}
              onChange={(e) => setNextFocus(e.target.value)}
              placeholder="例: スカトル前にマップを見て、隣のレーンの主導権を確認する"
              className={inputCls}
            />
          </label>
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-stone-300">メンタル</span>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMental(mental === n ? null : n)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition ${
                    mental === n ? 'bg-amber-700 border-amber-600 text-white' : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {n} {MENTAL_LABELS[n]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
            <div className="space-y-0.5">
              {status.map((s, i) => (
                <p key={i} className={`text-[11px] font-bold ${s.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{s.text}</p>
              ))}
            </div>
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty}
              className="px-4 py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-black transition cursor-pointer ml-auto"
            >
              {saving ? '保存中...' : '💾 振り返りを保存'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
