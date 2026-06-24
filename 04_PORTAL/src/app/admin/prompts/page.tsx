"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../../lib/supabaseClient';
import { 
  Cpu, Save, RefreshCw, CheckCircle, AlertTriangle, 
  ArrowLeft, Terminal, Edit3, Settings, Play, Plus, 
  Award, Zap, Layers, Activity, Info, Copy
} from 'lucide-react';
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

interface ABTestVariation {
  id: string;
  task_type: string;
  dna: string;
  generation: number;
  fitness: number;
  status: string;
  created_at: string;
}

export default function PromptsAdmin() {
  // タブ管理: 'gateway' (プロンプト設定) | 'abtest' (A/Bテスト・GA最適化)
  const [activeTab, setActiveTab] = useState<'gateway' | 'abtest'>('gateway');

  // ==========================================
  // 1. AI Agent Gateway (既存機能) のステート & ロジック
  // ==========================================
  const [prompts, setPrompts] = useState<AgentPrompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<AgentPrompt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  const [description, setDescription] = useState('');
  const [defaultModel, setDefaultModel] = useState('gemini-2.5-flash');
  const [fallbackModel, setFallbackModel] = useState('ollama/gemma');
  const [temperature, setTemperature] = useState(0.2);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userPromptTemplate, setUserPromptTemplate] = useState('');

  const fetchPrompts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('agent_prompts')
        .select('*')
        .order('prompt_id', { ascending: true });

      if (error) throw error;
      setPrompts(data || []);
      
      if (data && data.length > 0 && !selectedPrompt) {
        handleSelectPrompt(data[0]);
      } else if (selectedPrompt) {
        const updatedSelected = data.find((p: any) => p.prompt_id === selectedPrompt.prompt_id);
        if (updatedSelected) handleSelectPrompt(updatedSelected);
      }
    } catch (err: any) {
      console.error('Failed to fetch prompts:', err);
      setSaveStatus({ type: 'error', message: `プロンプトの取得に失敗しました: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleSavePrompt = async () => {
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

  // ==========================================
  // 2. A/Bテスト・GA最適化 (新規機能) のステート & ロジック
  // ==========================================
  const [variations, setVariations] = useState<ABTestVariation[]>([]);
  const [selectedTaskType, setSelectedTaskType] = useState<'note_title' | 'x_hook'>('note_title');
  const [isLoadingAB, setIsLoadingAB] = useState(false);
  const [isSavingAB, setIsSavingAB] = useState(false);
  const [isEvolving, setIsEvolving] = useState(false);
  const [mutationRate, setMutationRate] = useState(0.20);
  const [abStatusMsg, setAbStatusMsg] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const [expandedDnaId, setExpandedDnaId] = useState<string | null>(null);

  // 手動DNA新規登録用のステート
  const [newDnaText, setNewDnaText] = useState('');
  const [newDnaGen, setNewDnaGen] = useState(1);
  const [newDnaFitness, setNewDnaFitness] = useState(1.0);
  const [newDnaStatus, setNewDnaStatus] = useState('pending');

  // DNAの適合度・ステータスを画面上で一時編集するためのステート
  const [editingVariations, setEditingVariations] = useState<{ [id: string]: { fitness: number, status: string } }>({});

  const fetchABVariations = async (taskType = selectedTaskType) => {
    setIsLoadingAB(true);
    setAbStatusMsg({ type: null, message: '' });
    try {
      const res = await fetch(`/api/admin/ab-test?task_type=${taskType}`);
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json();
      setVariations(data || []);
      
      // 編集ステートの初期化
      const editState: { [id: string]: { fitness: number, status: string } } = {};
      data.forEach((v: ABTestVariation) => {
        editState[v.id] = { fitness: v.fitness, status: v.status };
      });
      setEditingVariations(editState);

      // 新規登録の世代のデフォルト値設定 (最大世代+1)
      if (data.length > 0) {
        const maxGen = Math.max(...data.map((v: ABTestVariation) => v.generation));
        setNewDnaGen(maxGen);
      } else {
        setNewDnaGen(1);
      }
    } catch (err: any) {
      console.error('Failed to fetch AB variations:', err);
      setAbStatusMsg({ type: 'error', message: `DNAプールの取得に失敗しました: ${err.message}` });
    } finally {
      setIsLoadingAB(false);
    }
  };

  // タスクタイプ変更時
  useEffect(() => {
    if (activeTab === 'abtest') {
      fetchABVariations(selectedTaskType);
    }
  }, [selectedTaskType, activeTab]);

  // DNAの適合度・ステータスの変更ハンドラ
  const handleEditChange = (id: string, field: 'fitness' | 'status', value: any) => {
    setEditingVariations(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  // DNA個体の個別保存 (PATCH)
  const saveVariationChanges = async (id: string) => {
    const edits = editingVariations[id];
    if (!edits) return;

    setIsSavingAB(true);
    setAbStatusMsg({ type: null, message: '' });
    try {
      const res = await fetch(`/api/admin/ab-test?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fitness: edits.fitness,
          status: edits.status
        })
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      setAbStatusMsg({ type: 'success', message: '個体のステータスと適合度を更新しました。' });
      
      // ローカルデータを更新
      setVariations(prev => prev.map(v => 
        v.id === id ? { ...v, fitness: edits.fitness, status: edits.status } : v
      ));
    } catch (err: any) {
      console.error('Failed to update variation:', err);
      setAbStatusMsg({ type: 'error', message: `更新に失敗しました: ${err.message}` });
    } finally {
      setIsSavingAB(false);
    }
  };

  // 新規DNA登録 (POST)
  const handleCreateVariation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDnaText.trim()) return;

    setIsSavingAB(true);
    setAbStatusMsg({ type: null, message: '' });
    try {
      const res = await fetch('/api/admin/ab-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_type: selectedTaskType,
          dna: newDnaText,
          generation: newDnaGen,
          fitness: newDnaFitness,
          status: newDnaStatus
        })
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      setAbStatusMsg({ type: 'success', message: '新しいDNA個体をプールに追加しました。' });
      setNewDnaText('');
      fetchABVariations(); // 再取得
    } catch (err: any) {
      console.error('Failed to create variation:', err);
      setAbStatusMsg({ type: 'error', message: `新規登録に失敗しました: ${err.message}` });
    } finally {
      setIsSavingAB(false);
    }
  };

  // 世代交代の非同期実行 (Evolve POST)
  const handleEvolve = async () => {
    if (!confirm(`タスクタイプ [${selectedTaskType === 'note_title' ? 'note記事タイトル' : 'Xフック文'}] の世代交代(Evolve)を実行します。よろしいですか？\n(適合度の高い親が選択され、交叉・突然変異された新世代が生成されます)`)) {
      return;
    }

    setIsEvolving(true);
    setAbStatusMsg({ type: null, message: '' });
    try {
      const res = await fetch('/api/admin/ab-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'evolve',
          task_type: selectedTaskType,
          mutation_rate: mutationRate
        })
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      setAbStatusMsg({
        type: 'success',
        message: '世代交代プロセス（Evolve）をバックグラウンドで開始しました。数十秒後に「更新」を押して結果を確認してください。'
      });
    } catch (err: any) {
      console.error('Failed to trigger evolve:', err);
      setAbStatusMsg({ type: 'error', message: `世代交代の開始に失敗しました: ${err.message}` });
    } finally {
      setIsEvolving(false);
    }
  };

  // 初期ロード
  useEffect(() => {
    fetchPrompts();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      
      {/* ヘッダー部 */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link href="/admin/dashboard" className="inline-flex items-center text-sm text-cyan-400 hover:text-cyan-300 gap-1 mb-2 transition-colors">
            <ArrowLeft size={16} /> ダッシュボードへ戻る
          </Link>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
            <Settings className="animate-spin-slow" /> AI Agent Gateway & 最適化設定室
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            プロンプトルーティングおよび遺伝的アルゴリズム（GA）によるタイトル・フックの自動進化を管理・調整します。
          </p>
        </div>

        {/* タブ切り替えコントロール */}
        <div className="flex bg-slate-900/80 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('gateway')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'gateway'
                ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers size={14} /> Gateway 設定
          </button>
          <button
            onClick={() => setActiveTab('abtest')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'abtest'
                ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity size={14} /> A/Bテスト & GA最適化
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          
          {/* =======================================================
              TAB 1: AI Agent Gateway設定 (既存のプロンプトエディタ)
             ======================================================= */}
          {activeTab === 'gateway' && (
            <motion.div
              key="gateway-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              {/* 左サイド: プロンプトID一覧 */}
              <div className="lg:col-span-4 bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 backdrop-blur-md">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Terminal size={14} className="text-cyan-500" /> プロンプト一覧
                  </h2>
                  <button 
                    onClick={() => fetchPrompts()} 
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} /> 更新
                  </button>
                </div>

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

              {/* 右サイド: エディタフォーム */}
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

                        {saveStatus.type && (
                          <div className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
                            saveStatus.type === 'success' ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-400' : 'bg-rose-950/40 border border-rose-500/30 text-rose-400'
                          }`}>
                            {saveStatus.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                            <span>{saveStatus.message}</span>
                          </div>
                        )}
                      </div>

                      {/* メタ設定 */}
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

                      {/* システムプロンプト */}
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

                      {/* ユーザープロンプトテンプレート */}
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
                          onClick={() => handleSavePrompt()}
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
            </motion.div>
          )}

          {/* =======================================================
              TAB 2: A/Bテスト & 遺伝的アルゴリズム(GA)最適化
             ======================================================= */}
          {activeTab === 'abtest' && (
            <motion.div
              key="abtest-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              {/* 左サイド: コントロール＆新規登録 (4カラム) */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* タスクタイプ選択 */}
                <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 backdrop-blur-md">
                  <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Activity size={14} className="text-cyan-500" /> 対象タスクの選択
                  </h2>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSelectedTaskType('note_title')}
                      className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                        selectedTaskType === 'note_title'
                          ? 'bg-cyan-950/30 border-cyan-500/80 text-cyan-400 shadow-sm shadow-cyan-950/20'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700/80 text-slate-300'
                      }`}
                    >
                      note記事タイトル
                    </button>
                    <button
                      onClick={() => setSelectedTaskType('x_hook')}
                      className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                        selectedTaskType === 'x_hook'
                          ? 'bg-cyan-950/30 border-cyan-500/80 text-cyan-400 shadow-sm shadow-cyan-950/20'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700/80 text-slate-300'
                      }`}
                    >
                      X投稿フック文
                    </button>
                  </div>
                </div>

                {/* 世代交代 (Evolve) パネル */}
                <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 backdrop-blur-md relative overflow-hidden">
                  {/* 装飾グラデーション */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 blur-xl pointer-events-none rounded-full" />
                  
                  <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Zap size={14} className="text-amber-500" /> 世代交代（GA Evolve）
                  </h2>
                  <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                    現在のDNAプールから適合度(fitness)が高い個体を親に選び、交叉および突然変異を加えて新世代の個体を創出します。
                  </p>

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1 text-xs">
                        <span className="text-slate-300 font-medium">突然変異率 (Mutation Rate)</span>
                        <span className="text-cyan-400 font-mono font-bold">{(mutationRate * 100).toFixed(0)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.0" 
                        max="1.0" 
                        step="0.05"
                        value={mutationRate}
                        onChange={(e) => setMutationRate(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">値が高いほど、世代交代時に新しい表現が生まれやすくなります。</span>
                    </div>

                    <button
                      onClick={handleEvolve}
                      disabled={isEvolving || isLoadingAB}
                      className="w-full bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white text-xs font-semibold py-2.5 rounded-lg flex items-center justify-center gap-1.5 shadow-md shadow-amber-950/20 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {isEvolving ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          世代進化実行中...
                        </>
                      ) : (
                        <>
                          <Play size={14} />
                          世代交代 (Evolve) を実行
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* 新規DNAの手動登録 */}
                <form onSubmit={handleCreateVariation} className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 backdrop-blur-md">
                  <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Plus size={14} className="text-emerald-500" /> 手動DNA新規登録
                  </h2>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">DNA文字列 (テキスト)</label>
                      <textarea
                        rows={3}
                        value={newDnaText}
                        onChange={(e) => setNewDnaText(e.target.value)}
                        placeholder="例: 【再現性○】月5万稼ぐAI副業のロードマップ"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500/80 transition-colors"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">世代 (Gen)</label>
                        <input 
                          type="number" 
                          min={1}
                          value={newDnaGen}
                          onChange={(e) => setNewDnaGen(parseInt(e.target.value) || 1)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/80"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">初期適合度 (Fitness)</label>
                        <input 
                          type="number" 
                          step={0.1}
                          min={0}
                          value={newDnaFitness}
                          onChange={(e) => setNewDnaFitness(parseFloat(e.target.value) || 1.0)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/80"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">ステータス (Status)</label>
                      <select
                        value={newDnaStatus}
                        onChange={(e) => setNewDnaStatus(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/80"
                      >
                        <option value="pending">pending (待機)</option>
                        <option value="active">active (テスト中)</option>
                        <option value="dead">dead (淘汰済み)</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={isSavingAB || !newDnaText.trim()}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      <Plus size={14} />
                      DNAを新規登録する
                    </button>
                  </div>
                </form>

              </div>

              {/* 右サイド: DNAプールテーブル (8カラム) */}
              <div className="lg:col-span-8 bg-slate-900/50 border border-slate-800/80 rounded-xl p-6 backdrop-blur-md">
                
                {/* テーブルヘッダー操作 */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/80 pb-4 mb-4 gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-200 flex items-center gap-1.5">
                      <Award size={18} className="text-indigo-400" />
                      DNA プール一覧
                      <span className="text-xs bg-indigo-950 text-indigo-400 px-2 py-0.5 rounded-full font-mono font-normal">
                        {variations.length} 個体
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      対象: <span className="font-mono text-cyan-400 font-bold">{selectedTaskType}</span> の全世代レコード
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {abStatusMsg.type && (
                      <div className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 max-w-[280px] sm:max-w-xs ${
                        abStatusMsg.type === 'success' ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-400' : 'bg-rose-950/40 border border-rose-500/30 text-rose-400'
                      }`}>
                        {abStatusMsg.type === 'success' ? <CheckCircle size={14} className="shrink-0" /> : <AlertTriangle size={14} className="shrink-0" />}
                        <span className="truncate">{abStatusMsg.message}</span>
                      </div>
                    )}
                    
                    <button 
                      onClick={() => fetchABVariations()} 
                      disabled={isLoadingAB}
                      className="flex items-center bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-200 px-3 py-1.5 rounded-lg gap-1.5 text-xs transition-all active:scale-95 disabled:opacity-50"
                    >
                      <RefreshCw size={12} className={isLoadingAB ? "animate-spin" : ""} />
                      更新
                    </button>
                  </div>
                </div>

                {/* テーブル本体 */}
                {isLoadingAB && variations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
                    <RefreshCw size={36} className="animate-spin text-cyan-500" />
                    <p className="text-sm">DNAリストをロード中...</p>
                  </div>
                ) : variations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    <Info size={36} className="text-slate-700 mb-2" />
                    <p className="text-sm">プールに個体が登録されていません。</p>
                    <p className="text-xs text-slate-600 mt-1">左のフォームから手動登録するか、バックエンドバッチを実行してください。</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                          <th className="py-3 px-2 font-mono">ID</th>
                          <th className="py-3 px-2">世代 (Gen)</th>
                          <th className="py-3 px-2 w-28">適合度 (Fitness)</th>
                          <th className="py-3 px-2 w-28">状態 (Status)</th>
                          <th className="py-3 px-2">DNAテキスト</th>
                          <th className="py-3 px-2 text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-medium">
                        {variations.map((v) => {
                          const edits = editingVariations[v.id] || { fitness: v.fitness, status: v.status };
                          const hasChanged = edits.fitness !== v.fitness || edits.status !== v.status;
                          const isExpanded = expandedDnaId === v.id;

                          return (
                            <tr key={v.id} className="hover:bg-slate-900/30 transition-colors">
                              {/* 略称ID */}
                              <td className="py-3 px-2 font-mono text-slate-500 select-all" title={v.id}>
                                {v.id.substring(0, 6)}...
                              </td>
                              
                              {/* 世代 */}
                              <td className="py-3 px-2">
                                <span className="bg-slate-800/80 px-2 py-0.5 rounded text-slate-300 font-mono">
                                  G-{v.generation}
                                </span>
                              </td>
                              
                              {/* 適合度 (Fitness) 編集 */}
                              <td className="py-2 px-2">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleEditChange(v.id, 'fitness', Math.max(0, parseFloat((edits.fitness - 0.1).toFixed(1))))}
                                    className="p-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 rounded"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    step={0.1}
                                    min={0}
                                    value={edits.fitness}
                                    onChange={(e) => handleEditChange(v.id, 'fitness', parseFloat(e.target.value) || 0)}
                                    className="w-12 bg-slate-950 text-center font-mono border border-slate-800 rounded py-0.5 text-xs"
                                  />
                                  <button
                                    onClick={() => handleEditChange(v.id, 'fitness', parseFloat((edits.fitness + 0.1).toFixed(1)))}
                                    className="p-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 rounded"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              
                              {/* ステータス選択 */}
                              <td className="py-2 px-2">
                                <select
                                  value={edits.status}
                                  onChange={(e) => handleEditChange(v.id, 'status', e.target.value)}
                                  className={`bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-xs ${
                                    edits.status === 'active' 
                                      ? 'text-cyan-400 font-bold' 
                                      : edits.status === 'dead' 
                                      ? 'text-rose-500/80' 
                                      : 'text-slate-400'
                                  }`}
                                >
                                  <option value="pending">pending</option>
                                  <option value="active">active</option>
                                  <option value="dead">dead</option>
                                </select>
                              </td>
                              
                              {/* DNAテキスト */}
                              <td className="py-3 px-2 max-w-[240px] sm:max-w-xs md:max-w-sm lg:max-w-md">
                                <div className="flex flex-col gap-1">
                                  <div 
                                    onClick={() => setExpandedDnaId(isExpanded ? null : v.id)}
                                    className={`cursor-pointer break-all font-sans hover:text-cyan-300 transition-colors ${
                                      isExpanded ? '' : 'line-clamp-2 text-slate-300'
                                    }`}
                                  >
                                    {v.dna}
                                  </div>
                                  
                                  {isExpanded && (
                                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(v.dna);
                                          alert("DNAをコピーしました。");
                                        }}
                                        className="flex items-center gap-1 hover:text-slate-300 transition-colors"
                                      >
                                        <Copy size={10} /> コピー
                                      </button>
                                      <span>作成: {new Date(v.created_at).toLocaleString()}</span>
                                    </div>
                                  )}
                                </div>
                              </td>
                              
                              {/* 操作 (保存) */}
                              <td className="py-3 px-2 text-right">
                                <button
                                  onClick={() => saveVariationChanges(v.id)}
                                  disabled={!hasChanged || isSavingAB}
                                  className={`px-3 py-1 rounded font-semibold text-[11px] transition-all ${
                                    hasChanged 
                                      ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm' 
                                      : 'bg-slate-900 text-slate-500 border border-slate-800/40 cursor-not-allowed'
                                  }`}
                                >
                                  保存
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
