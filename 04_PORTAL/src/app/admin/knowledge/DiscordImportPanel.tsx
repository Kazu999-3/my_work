'use client';

import { useState } from 'react';
import { MessageSquare, Sparkles, Check, Trash2, Edit3, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { getChampIcon } from '../../../lib/ddragonClient';

interface ExtractedItem {
  id?: string;
  champion: string;
  enemy_champion: string | null;
  category: string;
  title: string;
  summary: string;
  raw_excerpt?: string;
  selected?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  strategy: '📖 立ち回り・マクロ',
  buildRunes: '🔮 ビルド・ルーン',
  counterChampions: '⚔️ 対面対策・相性',
  strengths: '⚡ 強み (Strengths)',
  weaknesses: '🛡️ 弱み (Weaknesses)',
  general: '💡 一般知見',
};

export default function DiscordImportPanel() {
  const [inputText, setInputText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleParse = async () => {
    if (!inputText.trim()) {
      showMsg('Discordのチャットログをテキスト入力欄に貼り付けてください。', 'error');
      return;
    }

    setParsing(true);
    try {
      const res = await fetch('/api/admin/knowledge/import-discord', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'parse', text: inputText }),
      });
      const data = await res.json();
      if (res.ok && data.items) {
        if (data.items.length === 0) {
          showMsg('チャット文からLoLの攻略知見を検出できませんでした。別のテキストをお試しください。', 'error');
        } else {
          setExtractedItems(data.items.map((it: any) => ({ ...it, selected: true })));
          showMsg(`AIが ${data.items.length} 件の知見を抽出しました！ 内容を確認して取り込んでください。`, 'success');
        }
      } else {
        showMsg(data.error || 'AI解析に失敗しました。', 'error');
      }
    } catch {
      showMsg('通信エラーが発生しました。', 'error');
    } finally {
      setParsing(false);
    }
  };

  const handleCommit = async () => {
    const selectedList = extractedItems.filter((item) => item.selected);
    if (selectedList.length === 0) {
      showMsg('取り込む知見を1件以上選択してください。', 'error');
      return;
    }

    setCommitting(true);
    try {
      const res = await fetch('/api/admin/knowledge/import-discord', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'commit', items: selectedList }),
      });
      const data = await res.json();
      if (res.ok) {
        showMsg(`✅ ${selectedList.length} 件の知見をナレッジベースに取り込みました！`, 'success');
        setExtractedItems([]);
        setInputText('');
      } else {
        showMsg(data.error || '取り込みに失敗しました。', 'error');
      }
    } catch {
      showMsg('通信エラーが発生しました。', 'error');
    } finally {
      setCommitting(false);
    }
  };

  const removeItem = (index: number) => {
    setExtractedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, key: keyof ExtractedItem, val: any) => {
    setExtractedItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [key]: val } : item))
    );
  };

  return (
    <div className="bg-surface border border-border rounded-3xl p-6 space-y-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-stone-100 pb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-2xl bg-primary-50 border border-amber-200 text-primary-700">
            <MessageSquare size={20} />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
              💬 Discordトーク AI全自動抽出・ナレッジインポート
            </h2>
            <p className="text-xs text-muted-strong mt-0.5">
              Botが入っていない他人のDiscordサーバーのトーク文をコピペするだけで、AIが雑談を除去して攻略ナレッジとして自動整形します
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
            message.type === 'success' ? 'bg-success-50 text-success-800 border-emerald-200' : 'bg-danger-50 text-danger-800 border-rose-200'
          }`}
        >
          {message.type === 'success' ? '✅' : '❌'} {message.text}
        </div>
      )}

      {/* フォームエリア */}
      <div className="space-y-3">
        <label className="block text-xs font-extrabold text-foreground-soft flex items-center justify-between">
          <span>📋 Discordのチャットログをそのままコピペ（貼り付け）</span>
          <span className="text-[10px] text-faint font-normal">ユーザー名やタイムスタンプ・雑談が混ざっていてもAIが自動フィルタします</span>
        </label>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="例: [15:30] UserA: アーリは対アサシンだと6前にW上げでハラスして押し切るのが強い。コアビルドはルーデン..."
          className="w-full h-36 p-4 rounded-2xl border border-border bg-background/50 text-xs font-mono text-foreground-soft focus:bg-surface focus:outline-none focus:border-amber-500 transition-all resize-y"
        />

        <div className="flex justify-end">
          <button
            onClick={handleParse}
            disabled={parsing || !inputText.trim()}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 hover:from-primary-700 hover:to-primary-900 active:scale-95 text-white text-xs font-black transition flex items-center gap-2 shadow-lg disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${parsing ? 'animate-spin' : ''}`} />
            {parsing ? 'AIがチャットログを解読・抽出中...' : '🤖 AIで攻略知見を自動抽出'}
          </button>
        </div>
      </div>

      {/* 解析結果プレビュー */}
      {extractedItems.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-foreground flex items-center gap-2">
              <ShieldCheck size={16} className="text-success-600" />
              抽出されたナレッジ候補 ({extractedItems.length}件)
            </span>
            <button
              onClick={handleCommit}
              disabled={committing || extractedItems.filter((i) => i.selected).length === 0}
              className="px-5 py-2.5 rounded-xl bg-success-600 hover:bg-success-700 text-white text-xs font-black transition flex items-center gap-2 shadow-md disabled:opacity-50"
            >
              <Check size={14} />
              {committing ? '取り込み中...' : `✅ 選択した ${extractedItems.filter((i) => i.selected).length} 件をナレッジベースに登録`}
            </button>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {extractedItems.map((item, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-2xl border transition-all ${
                  item.selected ? 'bg-surface border-amber-300 shadow-sm' : 'bg-background border-border opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={!!item.selected}
                      onChange={(e) => updateItem(idx, 'selected', e.target.checked)}
                      className="w-4 h-4 rounded border-border text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                    <img
                      src={getChampIcon(item.champion)}
                      alt={item.champion}
                      className="w-9 h-9 rounded-xl border border-border object-cover"
                      onError={(e) => { (e.target as any).src = '/favicon.ico'; }}
                    />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-foreground text-xs">{item.champion}</span>
                        {item.enemy_champion && (
                          <span className="text-[10px] bg-danger-100 text-danger-800 font-bold px-2 py-0.5 rounded-full border border-rose-200">
                            vs {item.enemy_champion}
                          </span>
                        )}
                        <span className="text-[10px] bg-surface-subtle text-foreground-subtle font-bold px-2 py-0.5 rounded-full border border-border">
                          {CATEGORY_LABELS[item.category] || item.category}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-foreground-soft block mt-0.5">{item.title}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
                      className="p-1.5 rounded-lg hover:bg-surface-subtle text-muted transition"
                      title="内容を微調整"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => removeItem(idx)}
                      className="p-1.5 rounded-lg hover:bg-danger-50 text-danger-600 transition"
                      title="除外する"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {editingIdx === idx ? (
                  <div className="space-y-2 mt-3 pt-3 border-t border-stone-100">
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => updateItem(idx, 'title', e.target.value)}
                      className="w-full text-xs font-bold p-2 border rounded-lg bg-background"
                      placeholder="タイトル"
                    />
                    <textarea
                      value={item.summary}
                      onChange={(e) => updateItem(idx, 'summary', e.target.value)}
                      className="w-full h-24 text-xs p-2 border rounded-lg bg-background font-mono"
                      placeholder="要約メモ"
                    />
                    <button
                      onClick={() => setEditingIdx(null)}
                      className="text-[10px] font-bold px-3 py-1 bg-stone-800 text-white rounded-md ml-auto block"
                    >
                      確定
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-foreground-subtle bg-background/80 p-3 rounded-xl border border-stone-100 leading-relaxed whitespace-pre-wrap mt-2">
                    {item.summary}
                  </div>
                )}

                {item.raw_excerpt && (
                  <p className="text-[10px] text-faint mt-2 italic truncate" title={item.raw_excerpt}>
                    💬 発言抜粋: &quot;{item.raw_excerpt}&quot;
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
