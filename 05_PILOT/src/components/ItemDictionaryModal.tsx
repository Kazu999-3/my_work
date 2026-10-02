'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Plus, Trash2, Edit2, Check, BookOpen, Save, Sparkles, ArrowRight } from 'lucide-react';

interface ItemDictionaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialKey?: string;
  initialValue?: string;
  currentCustomDict: Record<string, string>;
  onDictionarySaved: (newDict: Record<string, string>) => void;
}

export default function ItemDictionaryModal({
  isOpen,
  onClose,
  initialKey,
  initialValue,
  currentCustomDict,
  onDictionarySaved,
}: ItemDictionaryModalProps) {
  const [search, setSearch] = useState('');
  const [inputKey, setInputKey] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [localDict, setLocalDict] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 初期化
  useEffect(() => {
    if (isOpen) {
      setLocalDict({ ...currentCustomDict });
      setSaveSuccess(false);
      if (initialKey) {
        setInputKey(initialKey);
        setInputValue(initialValue || currentCustomDict[initialKey] || '');
        setSearch(initialKey);
      } else {
        setInputKey('');
        setInputValue('');
        setSearch('');
      }
    }
  }, [isOpen, currentCustomDict, initialKey, initialValue]);

  // 新規登録・更新
  const handleAddOrUpdate = () => {
    const k = inputKey.trim();
    const v = inputValue.trim();
    if (!k || !v) {
      alert('「変換前」と「変換後」の両方を入力してください。');
      return;
    }

    const updated = { ...localDict, [k]: v };
    setLocalDict(updated);
    setInputKey('');
    setInputValue('');
  };

  // 1件削除
  const handleDelete = (keyToDelete: string) => {
    if (!confirm(`「${keyToDelete}」の辞書登録を削除しますか？`)) return;
    const updated = { ...localDict };
    delete updated[keyToDelete];
    setLocalDict(updated);
  };

  // 編集開始
  const handleStartEdit = (key: string, value: string) => {
    setInputKey(key);
    setInputValue(value);
  };

  // フィルタリング
  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    const entries = Object.entries(localDict);
    if (!q) return entries;
    return entries.filter(([k, v]) =>
      k.toLowerCase().includes(q) || v.toLowerCase().includes(q)
    );
  }, [localDict, search]);

  // 保存処理（APIへ送信）
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/items/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulk: localDict }),
      });
      const data = await res.json();
      if (data.success) {
        onDictionarySaved(localDict);
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
      <div className="bg-[#121216] border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-[#16161c]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <BookOpen size={18} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-zinc-100 flex items-center gap-2">
                <span>📖 アイテム翻訳・辞書登録</span>
              </h2>
              <p className="text-xs text-zinc-400">
                英語アイテム名や誤訳を登録し、正しい日本語名へ自動変換します。
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

        {/* 単語登録フォーム */}
        <div className="p-3.5 border-b border-zinc-800/80 bg-zinc-950/80 space-y-2">
          <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
            <Plus size={14} /> <span>新しい変換ルールを追加 / 編集</span>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="flex-1 w-full">
              <input
                type="text"
                placeholder="変換前 (例: Luden's Companion, ルナラン・ハリケーン)"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60 transition"
              />
            </div>
            <ArrowRight size={16} className="text-zinc-500 hidden sm:block shrink-0" />
            <div className="flex-1 w-full">
              <input
                type="text"
                placeholder="変換後 (例: ルーデン コンパニオン, ルナーン・ハリケーン)"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60 transition"
              />
            </div>
            <button
              onClick={handleAddOrUpdate}
              className="w-full sm:w-auto px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black transition cursor-pointer shrink-0 shadow-sm flex items-center justify-center gap-1"
            >
              <Plus size={14} />
              <span>{localDict[inputKey.trim()] ? '更新' : '辞書登録'}</span>
            </button>
          </div>
        </div>

        {/* 検索バー */}
        <div className="p-3 border-b border-zinc-800/60 bg-zinc-950/40 flex items-center justify-between gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="登録済み辞書を検索..."
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
          <div className="text-xs text-zinc-400 font-mono">
            全 <strong className="text-zinc-200">{Object.keys(localDict).length}</strong> 件中 {filteredEntries.length} 件
          </div>
        </div>

        {/* 辞書テーブルエリア */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 divide-y divide-zinc-800/40">
          {filteredEntries.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs">
              該当するアイテム辞書ルールが見つかりません。
            </div>
          ) : (
            filteredEntries.slice(0, 100).map(([k, v]) => (
              <div
                key={k}
                className="py-2 px-2.5 flex items-center justify-between gap-3 hover:bg-zinc-900/60 rounded-lg transition group"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="font-mono text-xs text-rose-300/90 truncate bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/50">
                    {k}
                  </span>
                  <ArrowRight size={13} className="text-zinc-600 shrink-0" />
                  <span className="font-bold text-xs text-emerald-300 truncate bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/50">
                    {v}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition">
                  <button
                    onClick={() => handleStartEdit(k, v)}
                    className="p-1 rounded text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition cursor-pointer"
                    title="編集"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(k)}
                    className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition cursor-pointer"
                    title="削除"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
          {filteredEntries.length > 100 && (
            <div className="py-2 text-center text-[11px] text-zinc-500">
              ※件数が多いため上位100件を表示しています。検索バーで絞り込んでください。
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-3 sm:p-4 border-t border-zinc-800 bg-[#16161c] flex items-center justify-between gap-3">
          <div className="text-[11px] text-zinc-400">
            登録した内容はブラウザおよびサーバー辞書に保存され、全画面で即座に反映されます。
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition cursor-pointer"
            >
              閉じる
            </button>
            <button
              onClick={handleSaveAll}
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
                  <Save size={14} /> <span>辞書を保存する</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
