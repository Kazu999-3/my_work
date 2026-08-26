'use client';

import React, { useState, useEffect } from 'react';
import { CheckSquare, Square, Plus, RefreshCw, CheckCircle2, ListTodo, Sparkles } from 'lucide-react';

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  section: string;
  rawLine: string;
}

export default function TodoBoard() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTodoText, setNewTodoText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchTodos = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/tasks/todo', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setTodos(data.todos || []);
    } catch (e) {
      console.error('Fetch todos error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
  }, []);

  const handleToggle = async (item: TodoItem) => {
    setTogglingId(item.id);
    const prevCompleted = item.completed;
    
    // 楽観的UI更新
    setTodos(prev => prev.map(t => t.id === item.id ? { ...t, completed: !prevCompleted } : t));

    try {
      const res = await fetch('/api/admin/tasks/todo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', rawLine: item.rawLine }),
      });
      if (!res.ok) throw new Error('Toggle failed');
      const data = await res.json();
      if (data.newRawLine) {
        setTodos(prev => prev.map(t => t.id === item.id ? { ...t, rawLine: data.newRawLine } : t));
      }
    } catch {
      // ロールバック
      setTodos(prev => prev.map(t => t.id === item.id ? { ...t, completed: prevCompleted } : t));
    } finally {
      setTogglingId(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;

    try {
      setIsAdding(true);
      const res = await fetch('/api/admin/tasks/todo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', newText: newTodoText.trim() }),
      });
      if (res.ok) {
        setNewTodoText('');
        fetchTodos();
      }
    } catch (e) {
      console.error('Add todo error:', e);
    } finally {
      setIsAdding(false);
    }
  };

  const pendingCount = todos.filter(t => !t.completed).length;
  const completedCount = todos.filter(t => t.completed).length;

  const displayedTodos = todos.filter(t => {
    if (filter === 'pending') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  return (
    <div className="bg-white/95 border border-stone-200/90 rounded-2xl p-5 shadow-xs space-y-4">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200/80 pb-3.5">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-50 rounded-xl border border-amber-200/80 text-amber-800">
            <ListTodo className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
              業務 ＆ 開発TODOボード
              <span className="text-[10px] font-bold text-stone-400 font-mono">02_FACTORY/TODO.md 連動</span>
            </h3>
            <p className="text-[11px] text-stone-500 font-medium">
              未完了: <strong className="text-amber-700">{pendingCount}件</strong> / 完了済: <strong className="text-emerald-700">{completedCount}件</strong>
            </p>
          </div>
        </div>

        {/* フィルター＆更新 */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
              filter === 'pending' ? 'bg-amber-700 text-white shadow-2xs' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            未完了 ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('completed')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
              filter === 'completed' ? 'bg-emerald-700 text-white shadow-2xs' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            完了済 ({completedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
              filter === 'all' ? 'bg-stone-800 text-white shadow-2xs' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            すべて
          </button>
          <button
            type="button"
            onClick={fetchTodos}
            disabled={loading}
            className="p-1.5 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 transition cursor-pointer"
            title="最新化"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 新規TODO追加フォーム */}
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          value={newTodoText}
          onChange={e => setNewTodoText(e.target.value)}
          placeholder="新しい業務・開発タスクを追加（例: Discord通知のアイコン色を調整）"
          className="flex-1 rounded-xl border border-stone-300/80 bg-stone-50/50 px-3.5 py-2 text-xs text-stone-900 placeholder-stone-400 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 transition font-medium"
        />
        <button
          type="submit"
          disabled={isAdding || !newTodoText.trim()}
          className="px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>追加</span>
        </button>
      </form>

      {/* タスク一覧 */}
      <div className="max-h-[360px] overflow-y-auto divide-y divide-stone-100 pr-1">
        {displayedTodos.length === 0 ? (
          <div className="py-8 text-center text-xs text-stone-400 font-medium">
            {filter === 'pending' ? '未完了のタスクはありません！素晴らしいです 🎉' : '該当するタスクはありません'}
          </div>
        ) : (
          displayedTodos.map(item => (
            <div
              key={item.id}
              className={`py-2.5 px-2 flex items-start gap-2.5 rounded-xl transition hover:bg-stone-50/80 ${
                item.completed ? 'opacity-60' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => handleToggle(item)}
                disabled={togglingId === item.id}
                className="mt-0.5 text-stone-400 hover:text-amber-700 transition cursor-pointer shrink-0"
              >
                {item.completed ? (
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Square className="w-4 h-4 text-stone-400" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <p className={`text-xs leading-relaxed ${item.completed ? 'line-through text-stone-400' : 'font-bold text-stone-800'}`}>
                  {item.text}
                </p>
                <span className="inline-block mt-0.5 text-[9px] font-bold text-stone-400 bg-stone-100 px-1.5 py-0.2 rounded">
                  {item.section}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
