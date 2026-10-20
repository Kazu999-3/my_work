"use client";

import React from "react";
import { toast } from "../../../components/Toaster";
import { RefreshCw, Check, Shield } from "lucide-react";

// 初参加者（通算3戦未満）と同じチームに優先配置する「指定メンター」の設定（ktm_settings.onboarding_mentors）。
// 2026-10-20: バランサーの管理パネルの奥から管理画面へ移した（場所が分かりにくく、未登録のまま一度も働いていなかった）。
// バランサーではその時読み込んだ人しか選べなかったため、管理画面の全員の名簿から選ぶ。
export default function MentorSettingsSection({ players }: { players: any[] }) {
  const [mentors, setMentors] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [open, setOpen] = React.useState(true);
  const [query, setQuery] = React.useState('');
  // 選択中の人を先に、残りは名前順。絞り込みは名前の部分一致
  const shown = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...players]
      .filter((p: any) => p?.name && (!q || String(p.name).toLowerCase().includes(q)))
      .sort((a: any, b: any) => Number(mentors.includes(b.name)) - Number(mentors.includes(a.name)) || String(a.name).localeCompare(String(b.name), 'ja'));
  }, [players, mentors, query]);

  React.useEffect(() => {
    fetch('/api/admin/mentors')
      .then(res => res.json())
      .then(data => {
        if (data.ok && Array.isArray(data.mentors)) {
          setMentors(data.mentors);
        }
      })
      .catch(err => console.warn('Failed to load mentors:', err))
      .finally(() => setLoading(false));
  }, []);

  const toggleMentor = (name: string) => {
    setMentors(prev =>
      prev.includes(name) ? prev.filter(m => m !== name) : [...prev, name]
    );
  };

  const handleSaveMentors = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/mentors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mentors }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || '保存に失敗しました');
      toast.success('指定メンター設定を保存しました！チーム分け時に初参加者と同チーム配置を優先します。');
    } catch (err: any) {
      toast.error('メンター設定の保存に失敗: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary-600" />
          <span className="text-sm font-bold text-foreground">初参加者向けメンター（お世話係）</span>
          <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full font-bold">
            {loading ? '読込中...' : `${mentors.length}名設定中`}
          </span>
        </div>
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 bg-surface-subtle hover:bg-surface-hover text-foreground-soft px-3 py-1.5 rounded-lg font-bold transition text-xs"
        >
          {open ? '閉じる' : 'メンターを指定・編集'}
        </button>
      </div>
      <p className="text-[11px] text-muted-strong mt-1.5">
        大会やカスタム運用で「初参加メンバー（通算0〜2戦）」と同じチームに優先配置したい信頼できるメンバー（お世話係）を指定できます。
        バランサーが自動で同チームになる組み合わせを優先選抜します（Discord通知には出さず裏側で自然にサポート）。
      </p>

      {open && (
        <div className="mt-3 space-y-3 bg-surface-subtle/50 border border-border rounded-xl p-3">
          <div className="text-xs font-bold text-foreground-subtle flex items-center justify-between">
            <span>メンバーを選択（クリックでON/OFF）</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="名前で絞り込み" className="w-36 px-2 py-1 rounded-lg border border-border bg-background text-xs font-normal" />
          </div>

          <div className="max-h-64 overflow-y-auto rounded-xl border border-border p-2 bg-surface grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {shown.map((p: any) => {
              const isSelected = mentors.includes(p.name);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleMentor(p.name)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                    isSelected
                      ? 'bg-primary-500/15 border-primary-500 text-primary-800 dark:text-primary-300 shadow-xs'
                      : 'bg-background hover:bg-surface-hover border-border text-foreground-subtle'
                  }`}
                >
                  <span className="truncate">{p.name}</span>
                  <span className="text-[11px] ml-1">{isSelected ? '✓' : '+'}</span>
                </button>
              );
            })}
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-muted-strong font-medium">
              選択中: {mentors.length > 0 ? mentors.join(', ') : 'なし'}
            </span>
            <button
              type="button"
              onClick={handleSaveMentors}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-xs font-black bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              メンター設定を保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
