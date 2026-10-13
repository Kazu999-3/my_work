'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Check, RotateCcw, Save, ShieldAlert, Sparkles } from 'lucide-react';

interface ChampionInfo {
  id: string;
  name: string;
  jpName: string;
  roles: string[];
}

interface LaneMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  champions: ChampionInfo[];
  focusedChampionId?: string;
  currentCustomRoles: Record<string, string[]>;
  onRolesSaved: (newRoles: Record<string, string[]>) => void;
}

const AVAILABLE_ROLES = ['TOP', 'JG', 'MID', 'ADC', 'SUP'] as const;

export default function LaneMaintenanceModal({
  isOpen,
  onClose,
  champions,
  focusedChampionId,
  currentCustomRoles,
  onRolesSaved,
}: LaneMaintenanceModalProps) {
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('ALL');
  const [localRoles, setLocalRoles] = useState<Record<string, string[]>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 初期化
  useEffect(() => {
    if (isOpen) {
      const initialMap: Record<string, string[]> = {};
      for (const c of champions) {
        initialMap[c.id] = currentCustomRoles[c.id] || c.roles || ['TOP'];
      }
      setLocalRoles(initialMap);
      setSaveSuccess(false);
      if (focusedChampionId) {
        setSearch(focusedChampionId);
      } else {
        setSearch('');
      }
    }
  }, [isOpen, champions, currentCustomRoles, focusedChampionId]);

  // ロールトグル
  const toggleRole = (champId: string, role: string) => {
    const current = localRoles[champId] || [];
    let updated: string[];
    if (current.includes(role)) {
      // 既に存在する場合は削除（ただし最低1つは維持）
      if (current.length === 1) return;
      updated = current.filter((r) => r !== role);
    } else {
      // 追加
      updated = [...current, role];
    }
    setLocalRoles((prev) => ({
      ...prev,
      [champId]: updated,
    }));
  };

  // メインロール（先頭）切り替え
  const setPrimaryRole = (champId: string, role: string) => {
    const current = localRoles[champId] || [];
    const without = current.filter((r) => r !== role);
    setLocalRoles((prev) => ({
      ...prev,
      [champId]: [role, ...without],
    }));
  };

  // フィルタリング
  const filteredChamps = useMemo(() => {
    const q = search.trim().toLowerCase();
    return champions.filter((c) => {
      const matchSearch =
        !q ||
        c.id.toLowerCase().includes(q) ||
        c.jpName.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q);

      const champRoles = localRoles[c.id] || c.roles || [];
      const matchRole =
        filterRole === 'ALL' ||
        (filterRole === 'ADC'
          ? champRoles.includes('ADC') || champRoles.includes('BOT')
          : champRoles.includes(filterRole));

      return matchSearch && matchRole;
    });
  }, [champions, search, filterRole, localRoles]);

  // 保存処理
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 変更があった差分または全体を送信
      const res = await fetch('/api/champions/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulk: localRoles }),
      });
      const data = await res.json();
      if (data.success) {
        onRolesSaved(localRoles);
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          onClose();
        }, 800);
      } else {
        alert(`保存に失敗しました: ${data.error || '不明なエラー'}`);
      }
    } catch (err: any) {
      alert(`保存中に通信エラーが発生しました: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#121216] border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-[#16161c]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-zinc-100 flex items-center gap-2">
                <span>🛠️ チャンピオン・レーン所属メンテナンス</span>
              </h2>
              <p className="text-xs text-zinc-400">
                各チャンピオンの所属レーン（TOP / JG / MID / ADC / SUP）を自在に編集・即時反映できます。
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* コントロールバー */}
        <div className="p-3 border-b border-zinc-800/80 bg-zinc-950/60 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {/* 検索入力 */}
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="チャンピオン検索 (例: Lee, アートロックス)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60 transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* ロール絞り込みタブ */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto p-1 bg-zinc-900 rounded-xl border border-zinc-800">
            {['ALL', 'TOP', 'JG', 'MID', 'ADC', 'SUP'].map((r) => (
              <button
                key={r}
                onClick={() => setFilterRole(r)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filterRole === r
                    ? 'bg-amber-500 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="text-xs text-zinc-400 font-mono shrink-0">
            {filteredChamps.length} 体表示中
          </div>
        </div>

        {/* リストエリア */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          {filteredChamps.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs">
              該当するチャンピオンが見つかりません。
            </div>
          ) : (
            filteredChamps.map((c) => {
              const roles = localRoles[c.id] || ['TOP'];
              const primary = roles[0] || 'TOP';
              const imgUrl = `https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${c.id}.png`;

              return (
                <div
                  key={c.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 hover:border-zinc-700 transition"
                >
                  {/* アイコン ＆ チャンピオン名 */}
                  <div className="flex items-center gap-2.5 min-w-[180px]">
                    <div className="w-8 h-8 rounded-lg overflow-hidden border border-zinc-700 shrink-0">
                      <img src={imgUrl} alt={c.jpName} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-zinc-100 flex items-center gap-1.5">
                        <span>{c.jpName}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">({c.id})</span>
                      </div>
                      <div className="text-[10px] text-amber-400/80 font-mono mt-0.5">
                        主レーン: <span className="font-bold underline">{primary}</span>
                        {roles.length > 1 && (
                          <span className="text-zinc-400 ml-1">
                            (サブ: {roles.slice(1).join(', ')})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* レーントグルチップ群 */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {AVAILABLE_ROLES.map((r) => {
                      const isActive = roles.includes(r);
                      const isPrimary = primary === r;

                      return (
                        <div key={r} className="inline-flex items-center">
                          <button
                            onClick={() => toggleRole(c.id, r)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                              isActive
                                ? isPrimary
                                  ? 'bg-amber-500 text-zinc-950 shadow-md ring-1 ring-amber-400'
                                  : 'bg-zinc-700 text-zinc-100 border border-zinc-600'
                                : 'bg-zinc-950 text-zinc-500 border border-zinc-800 hover:text-zinc-300'
                            }`}
                            title={
                              isActive
                                ? isPrimary
                                  ? 'メインレーン（解除するには他をメインにするかクリック）'
                                  : 'サブレーン（クリックで解除、長押し/ダブルクリックでメイン化）'
                                : `クリックして ${r} に追加`
                            }
                          >
                            <span>{r}</span>
                            {isPrimary && <span className="text-[9px] font-black">★</span>}
                          </button>
                          {isActive && !isPrimary && (
                            <button
                              onClick={() => setPrimaryRole(c.id, r)}
                              className="text-[9px] px-1 py-1 text-zinc-400 hover:text-amber-400 font-bold transition ml-0.5"
                              title="メインレーン（最優先）に変更"
                            >
                              ↑主
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* フッター */}
        <div className="p-3 sm:p-4 border-t border-zinc-800 bg-[#16161c] flex items-center justify-between gap-3">
          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
            <ShieldAlert size={14} className="text-amber-400 shrink-0" />
            <span>★印が一覧カードの先頭バッジになります。「↑主」でメインレーンを入れ替え可能。</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition cursor-pointer"
            >
              閉じる
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black transition cursor-pointer shadow-lg ${
                saveSuccess
                  ? 'bg-emerald-500 text-white'
                  : 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-amber-500/20'
              }`}
            >
              {saveSuccess ? (
                <>
                  <Check size={14} /> <span>保存完了！</span>
                </>
              ) : isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                  <span>保存中...</span>
                </>
              ) : (
                <>
                  <Save size={14} /> <span>設定を保存する</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
