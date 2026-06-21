"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../../lib/supabaseClient';
import { Cpu, Save, RefreshCw, CheckCircle, AlertTriangle, ArrowLeft, Terminal, Edit3, Settings } from 'lucide-react';
import Link from 'next/link';

interface AgentPrompt {
  prompt_id: string;
  system_prompt: string | null;
  user_prompt_template: string;
  default_model: string;
  fallback_model: string | null;
  temperature: number;
  description: string | null;
  updated_at: string;
}

export default function PromptsAdmin() {
  const [prompts, setPrompts] = useState<AgentPrompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<AgentPrompt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  // 編集用のローカルステート
  const [description, setDescription] = useState('');
  const [defaultModel, setDefaultModel] = useState('gemini-2.5-flash');
  const [fallbackModel, setFallbackModel] = useState('ollama/gemma');
  const [temperature, setTemperature] = useState(0.2);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userPromptTemplate, setUserPromptTemplate] = useState('');

  // プロンプト一覧の取得
  const fetchPrompts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('agent_prompts')
        .select('*')
        .order('prompt_id', { ascending: true });

      if (error) throw error;
      setPrompts(data || []);
      
      // 初期状態で最初のプロンプトを選択
      if (data && data.length > 0 && !selectedPrompt) {
        handleSelectPrompt(data[0]);
      } else if (selectedPrompt) {
        // すでに選択中ならデータを更新
        const updatedSelected = data.find(p => p.prompt_id === selectedPrompt.prompt_id);
        if (updatedSelected) handleSelectPrompt(updatedSelected);
      }
    } catch (err: any) {
      console.error('Failed to fetch prompts:', err);
      setSaveStatus({ type: 'error', message: `プロンプトの取得に失敗しました: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  const handleSelectPrompt = (prompt: AgentPrompt) => {
    setSelectedPrompt(prompt);
    setDescription(prompt.description || '');
    setDefaultModel(prompt.default_model);
    setFallbackModel(prompt.fallback_model || '');
    setTemperature(prompt.temperature);
    setSystemPrompt(prompt.system_prompt || '');
    setUserPromptTemplate(prompt.user_prompt_template);
    setSaveStatus({ type: null, message: '' });
  };

  // プロンプトの保存
  const handleSave = async () => {
    if (!selectedPrompt) return;
    setIsSaving(true);
    setSaveStatus({ type: null, message: '' });

    try {
      const updates = {
        description: description || null,
        default_model: defaultModel,
        fallback_model: fallbackModel || null,
        temperature: temperature,
        system_prompt: systemPrompt || null,
        user_prompt_template: userPromptTemplate,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('agent_prompts')
        .update(updates)
        .eq('prompt_id', selectedPrompt.prompt_id);

      if (error) throw error;

      setSaveStatus({ type: 'success', message: `プロンプト '${selectedPrompt.prompt_id}' を正常に更新しました。` });
      
      // リストのローカルデータを更新
      setPrompts(prev => prev.map(p => 
        p.prompt_id === selectedPrompt.prompt_id ? { ...p, ...updates } : p
      ));
    } catch (err: any) {
      console.error('Failed to save prompt:', err);
      setSaveStatus({ type: 'error', message: `更新に失敗しました: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      {/* ヘッダー部 */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link href="/admin/dashboard" className="inline-flex items-center text-sm text-cyan-400 hover:text-cyan-300 gap-1 mb-2 transition-colors">
            <ArrowLeft size={16} /> ダッシュボードへ戻る
          </Link>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
            <Settings className="animate-spin-slow" /> AI Agent Gateway 設定室
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Supabase に保存されている AI エージェントのプロンプトとルーティングモデルをノーコードで一元編集します。
          </p>
        </div>

        <button 
          onClick={() => fetchPrompts()} 
          className="flex items-center justify-center bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 px-4 py-2 rounded-lg gap-2 text-sm transition-all active:scale-95"
        >
          <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> 更新
        </button>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 左サイド: プロンプトID一覧 (4カラム) */}
        <div className="lg:col-span-4 bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 backdrop-blur-md">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Terminal size={14} className="text-cyan-500" /> プロンプト一覧
          </h2>

          {isLoading && prompts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500">
              <RefreshCw size={24} className="animate-spin text-cyan-500" />
              <span className="text-xs">ロード中...</span>
            </div>
          ) : (
            <div className="space-y-2">
              {prompts.map((p) => {
                const isSelected = selectedPrompt?.prompt_id === p.prompt_id;
                return (
                  <button
                    key={p.prompt_id}
                    onClick={() => handleSelectPrompt(p)}
                    className={`w-full text-left p-3 rounded-lg border transition-all duration-200 active:scale-[0.99] flex flex-col gap-1 ${
                      isSelected 
                        ? 'bg-gradient-to-r from-cyan-950/40 to-indigo-950/40 border-cyan-500/80 shadow-md shadow-cyan-950/20' 
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700/80'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`font-mono text-sm font-bold ${isSelected ? 'text-cyan-400' : 'text-slate-200'}`}>
                        {p.prompt_id}
                      </span>
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                        {p.default_model.replace('gemini-', 'G-').replace('ollama/', 'O-')}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 line-clamp-2">
                      {p.description || "説明なし"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 右サイド: エディタフォーム (8カラム) */}
        <div className="lg:col-span-8 bg-slate-900/50 border border-slate-800/80 rounded-xl p-6 backdrop-blur-md relative">
          
          <AnimatePresence mode="wait">
            {!selectedPrompt ? (
              <div className="flex flex-col items-center justify-center py-32 text-slate-500">
                <Cpu size={48} className="text-slate-700 animate-pulse mb-3" />
                <p className="text-sm">左側のリストからプロンプトを選択してください。</p>
              </div>
            ) : (
              <motion.div 
                key={selectedPrompt.prompt_id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
                className="space-y-5"
              >
                {/* 選択中の情報ヘッダー */}
                <div className="border-b border-slate-800/80 pb-4 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Edit3 size={18} className="text-cyan-400" />
                      <span className="text-xl font-mono font-bold text-slate-200">{selectedPrompt.prompt_id}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">最終更新: {new Date(selectedPrompt.updated_at).toLocaleString()}</p>
                  </div>

                  {/* 保存通知アラート */}
                  {saveStatus.type && (
                    <div className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
                      saveStatus.type === 'success' ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-400' : 'bg-rose-950/40 border border-rose-500/30 text-rose-400'
                    }`}>
                      {saveStatus.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                      <span>{saveStatus.message}</span>
                    </div>
                  )}
                </div>

                {/* メタ設定: 説明文、デフォルトモデル、フォールバックモデル */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">説明</label>
                    <input 
                      type="text" 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="プロンプトの用途を入力"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/80 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">メインモデル (Default Model)</label>
                    <select
                      value={defaultModel}
                      onChange={(e) => setDefaultModel(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/80 transition-colors"
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (クラウド)</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro (クラウド)</option>
                      <option value="ollama/gemma">Ollama: Gemma (ローカル)</option>
                      <option value="ollama/llama3">Ollama: Llama 3 (ローカル)</option>
                      <option value="ollama/phi3">Ollama: Phi 3 (ローカル)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">フォールバック先 (Fallback Model)</label>
                    <select
                      value={fallbackModel}
                      onChange={(e) => setFallbackModel(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/80 transition-colors"
                    >
                      <option value="">なし (エラー時にフォールバックしない)</option>
                      <option value="ollama/gemma">Ollama: Gemma (ローカル)</option>
                      <option value="ollama/llama3">Ollama: Llama 3 (ローカル)</option>
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (クラウド)</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">創造性度合い (Temperature): {temperature}</label>
                      <span className="text-[10px] text-slate-500">低いほど安定的・堅実、高いほど創造的</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.0" 
                      max="1.0" 
                      step="0.05"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>
                </div>

                {/* システムプロンプトエディタ */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">システム指示 / ペルソナ (System Prompt)</label>
                  <textarea
                    rows={4}
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="AIエージェントの性格、背景知識、制約条件などを指定"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 font-mono focus:outline-none focus:border-cyan-500/80 transition-colors leading-relaxed"
                  />
                </div>

                {/* ユーザープロンプトテンプレートエディタ */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">本文テンプレート (User Prompt Template)</label>
                    <span className="text-[10px] text-slate-500">※埋め込み変数 (例: {'{title}'}, {'{transcript}'}) は変更しないでください</span>
                  </div>
                  <textarea
                    rows={12}
                    value={userPromptTemplate}
                    onChange={(e) => setUserPromptTemplate(e.target.value)}
                    placeholder="変数を含んだユーザーメッセージの雛形"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 font-mono focus:outline-none focus:border-cyan-500/80 transition-colors leading-relaxed"
                  />
                </div>

                {/* 保存アクションエリア */}
                <div className="border-t border-slate-800/80 pt-4 flex justify-end gap-3">
                  <button
                    onClick={() => handleSelectPrompt(selectedPrompt)}
                    disabled={isSaving}
                    className="px-4 py-2 border border-slate-800 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors active:scale-95 disabled:opacity-50"
                  >
                    リセット
                  </button>
                  <button
                    onClick={() => handleSave()}
                    disabled={isSaving}
                    className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 shadow-lg shadow-cyan-950/20 active:scale-95 disabled:opacity-50 transition-all"
                  >
                    {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                    {isSaving ? "保存中..." : "設定を保存する"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
