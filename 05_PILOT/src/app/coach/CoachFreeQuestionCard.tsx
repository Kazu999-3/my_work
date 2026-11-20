'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, User, Loader2, BookOpen, HelpCircle, MessageSquare } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  timestamp: string;
}

export default function CoachFreeQuestionCard({
  myChampion,
  enemyChampion,
  lane,
}: {
  myChampion: string;
  enemyChampion: string;
  lane: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // チャンピオンやレーンが変わった時にウェルカムメッセージを更新
  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `こんにちは！この対面（${lane}: ${myChampion} vs ${enemyChampion}）の戦術コーチです。Lv1トレード、キルライン、スキルの避け方、集団戦の立ち回りなど、何でも自由に質問してください。`,
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  }, [myChampion, enemyChampion, lane]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 1) {
      scrollToBottom();
    }
  }, [messages, loading]);

  const handleSend = async (questionText?: string) => {
    const textToSend = (questionText || input).trim();
    if (!textToSend || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/coach/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          myChampion,
          enemyChampion,
          lane,
          question: textToSend,
          history: historyPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '回答の取得に失敗しました');

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.answer || '回答を生成できませんでした。',
        sources: data.sources || [],
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ エラー: ${err.message || 'コーチへの通信に失敗しました。もう一度お試しください。'}`,
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const quickQuestions = [
    `Lv1〜2で勝つためのトレードのコツは？`,
    `${enemyChampion} の主要スキルを避けるタイミングは？`,
    `敵JGにガンクされた時の生存・回避方法は？`,
    `Lv6オールインでキルを取る手順は？`,
  ];

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <span>🤖 AI戦術コーチへ自由質問（チャット相談）</span>
            </h3>
            <p className="text-[11px] text-zinc-400">
              定型手順書だけでなく、知りたい戦術や疑問を直接AIコーチに質問できます。
            </p>
          </div>
        </div>

        {/* 引き継がれた文脈バッジ */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto text-[11px] font-bold px-2.5 py-1 rounded-xl bg-zinc-950 border border-zinc-800 text-amber-300">
          <span>🎯 文脈:</span>
          <span className="text-white">{myChampion}</span>
          <span className="text-zinc-500">vs</span>
          <span className="text-rose-300">{enemyChampion}</span>
          <span className="text-zinc-500">({lane})</span>
        </div>
      </div>

      {/* チャット履歴表示エリア */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                m.role === 'user'
                  ? 'bg-amber-600 text-white'
                  : 'bg-zinc-800 border border-zinc-700 text-amber-400'
              }`}
            >
              {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div
              className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed space-y-1.5 ${
                m.role === 'user'
                  ? 'bg-amber-600/90 text-white shadow-sm'
                  : 'bg-zinc-950 border border-zinc-800 text-zinc-200 shadow-sm'
              }`}
            >
              <div className="whitespace-pre-wrap">{m.content}</div>

              {/* 参照根拠バッジ */}
              {m.sources && m.sources.length > 0 && (
                <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center gap-1 text-[10px] text-zinc-400">
                  <span className="flex items-center gap-1 font-bold text-amber-400">
                    <BookOpen className="w-3 h-3" /> 参照根拠:
                  </span>
                  {m.sources.map((s, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-750 text-zinc-300 font-mono"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}

              <div
                className={`text-[9px] font-mono text-right ${
                  m.role === 'user' ? 'text-amber-200/80' : 'text-zinc-500'
                }`}
              >
                {m.timestamp}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-2.5 animate-pulse">
            <div className="w-7 h-7 rounded-xl bg-zinc-800 border border-zinc-700 text-amber-400 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs text-amber-300 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{myChampion} vs {enemyChampion} の正本知見を照合し、戦術アドバイスを生成中...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* クイック質問候補チップ */}
      <div className="space-y-1.5 pt-1 border-t border-zinc-800/80">
        <span className="text-[10px] font-bold text-zinc-400 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>よくある質問（クリックですぐ質問）:</span>
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(q)}
              disabled={loading}
              className="px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/60 text-zinc-300 hover:text-white text-[11px] font-medium transition cursor-pointer disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* 質問入力フォーム */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 pt-1"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`${myChampion} vs ${enemyChampion} (${lane}) について質問を入力...`}
          disabled={loading}
          className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer shadow-md"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span className="hidden sm:inline">送信</span>
        </button>
      </form>
    </div>
  );
}
