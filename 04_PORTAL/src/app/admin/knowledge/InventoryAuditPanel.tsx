'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Check, ShieldAlert, Sparkles, Filter, Database, ArrowRight, ExternalLink, Trash2, Edit3, AlertCircle, FileText, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';
import { getChampIcon } from '../../../lib/ddragonClient';

interface DictFactItem {
  champion_name: string;
  display_name: string;
  has_strengths: boolean;
  has_weaknesses: boolean;
  has_power_spikes: boolean;
  has_build_runes: boolean;
  has_counter_champions: boolean;
  has_pick_recommendation: boolean;
  human_verified: boolean;
  verified_at: string | null;
  patch_meta_updated_at: string | null;
  patch_meta_patch: string | null;
}

interface PersonalKnowledgeItem {
  id: number;
  champion: string;
  enemy_champion: string | null;
  category: string;
  title: string;
  content: string;
  source: string;
  created_at: string;
}

export default function InventoryAuditPanel() {
  const [loading, setLoading] = useState(true);
  const [facts, setFacts] = useState<DictFactItem[]>([]);
  const [knowledgeItems, setKnowledgeItems] = useState<PersonalKnowledgeItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<'unverified' | 'outdated' | 'incomplete' | 'knowledge'>('unverified');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const loadAuditData = async () => {
    setLoading(true);
    try {
      // 1. チャンピオン辞典ファクトの全状況取得
      const resFact = await fetch('/api/admin/dict-health', { credentials: 'include' });
      if (resFact.ok) {
        const data = await resFact.json();
        setFacts(data.facts || []);
      }

      // 2. ナレッジDB (personal_knowledge) の全状況取得
      const resKb = await fetch('/api/admin/knowledge/list-personal', { credentials: 'include' }).catch(() => null);
      if (resKb && resKb.ok) {
        const dataKb = await resKb.json();
        setKnowledgeItems(dataKb.items || []);
      }
    } catch (e) {
      console.error('Audit load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditData();
  }, []);

  // 人間確認済みに設定
  const handleVerify = async (champion: string) => {
    setActionLoading(champion);
    try {
      const res = await fetch('/api/admin/dict-health/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ champion, action: 'verify' }),
      });
      if (res.ok) {
        showMsg(`✅ ${champion} を「人間確認済み」にマークしました`, 'success');
        setFacts((prev) =>
          prev.map((f) => (f.champion_name === champion ? { ...f, human_verified: true, verified_at: new Date().toISOString() } : f))
        );
      } else {
        showMsg('確認状態の更新に失敗しました。', 'error');
      }
    } catch {
      showMsg('通信エラーが発生しました。', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // ナレッジの削除
  const handleDeleteKb = async (id: number) => {
    if (!confirm('このナレッジアイテムを削除しますか？')) return;
    try {
      const res = await fetch(`/api/admin/knowledge/delete-personal?id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        showMsg('ナレッジアイテムを削除しました。', 'success');
        setKnowledgeItems((prev) => prev.filter((item) => item.id !== id));
      } else {
        showMsg('削除に失敗しました。', 'error');
      }
    } catch {
      showMsg('通信エラーが発生しました。', 'error');
    }
  };

  // 集計指標
  const totalCount = facts.length;
  const verifiedCount = facts.filter((f) => f.human_verified).length;
  const unverifiedCount = totalCount - verifiedCount;
  
  const nowSec = Date.now() / 1000;
  const outdatedCount = facts.filter((f) => {
    if (!f.patch_meta_updated_at) return true;
    const updatedSec = new Date(f.patch_meta_updated_at).getTime() / 1000;
    return nowSec - updatedSec > 259200; // 3日以上前
  }).length;

  const incompleteCount = facts.filter(
    (f) => !f.has_strengths || !f.has_weaknesses || !f.has_power_spikes || !f.has_build_runes
  ).length;

  const completionRate = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0;

  // フィルタリングデータ
  const unverifiedList = facts.filter((f) => !f.human_verified);
  const outdatedList = facts.filter((f) => {
    if (!f.patch_meta_updated_at) return true;
    const updatedSec = new Date(f.patch_meta_updated_at).getTime() / 1000;
    return nowSec - updatedSec > 259200;
  });
  const incompleteList = facts.filter(
    (f) => !f.has_strengths || !f.has_weaknesses || !f.has_power_spikes || !f.has_build_runes
  );

  return (
    <div className="bg-white border border-stone-200 rounded-3xl p-6 space-y-6 shadow-sm">
      {/* タイトル ＆ リフレッシュ */}
      <div className="flex items-center justify-between border-b border-stone-100 pb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-black text-stone-900 flex items-center gap-2">
            🧹 ナレッジ ＆ チャンピオン辞典 全自動棚卸しハブ
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            全168チャンピオンのデータ完全性・人間の確認状況・古いトレンド・ナレッジDBを一元で点検・整理します
          </p>
        </div>
        <button
          onClick={loadAuditData}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 再読み込み
        </button>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {message.type === 'success' ? '✅' : '❌'} {message.text}
        </div>
      )}

      {/* サマリー指標カード */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-1">
          <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider block">人間確認網羅率</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-900">{completionRate}%</span>
            <span className="text-xs text-indigo-600 font-bold">({verifiedCount}/{totalCount})</span>
          </div>
          <div className="w-full bg-indigo-200/50 rounded-full h-1.5 overflow-hidden">
            <div className="bg-indigo-600 h-full transition-all" style={{ width: `${completionRate}%` }}></div>
          </div>
        </div>

        <div
          onClick={() => setActiveFilter('unverified')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            activeFilter === 'unverified' ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/30' : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
          }`}
        >
          <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider block">人間未確認 (要棚卸し)</span>
          <span className="text-2xl font-black text-amber-900 block">{unverifiedCount} <span className="text-xs font-bold text-amber-700">体</span></span>
          <span className="text-[10px] text-amber-600 font-bold">要人間レビュー</span>
        </div>

        <div
          onClick={() => setActiveFilter('outdated')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            activeFilter === 'outdated' ? 'bg-cyan-50 border-cyan-300 ring-2 ring-cyan-400/30' : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
          }`}
        >
          <span className="text-[10px] font-extrabold text-cyan-700 uppercase tracking-wider block">古いトレンド (3日以上経過)</span>
          <span className="text-2xl font-black text-cyan-900 block">{outdatedCount} <span className="text-xs font-bold text-cyan-700">体</span></span>
          <span className="text-[10px] text-cyan-600 font-bold">AI自動更新推奨</span>
        </div>

        <div
          onClick={() => setActiveFilter('incomplete')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            activeFilter === 'incomplete' ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400/30' : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
          }`}
        >
          <span className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider block">空項目あり (欠損データ)</span>
          <span className="text-2xl font-black text-rose-900 block">{incompleteCount} <span className="text-xs font-bold text-rose-700">体</span></span>
          <span className="text-[10px] text-rose-600 font-bold">要補全</span>
        </div>
      </div>

      {/* タブ切り替えボタン */}
      <div className="flex gap-2 border-b border-stone-200 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveFilter('unverified')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
            activeFilter === 'unverified' ? 'bg-amber-600 text-white shadow-md' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          <AlertCircle size={14} /> 人間未確認リスト ({unverifiedList.length})
        </button>

        <button
          onClick={() => setActiveFilter('outdated')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
            activeFilter === 'outdated' ? 'bg-cyan-600 text-white shadow-md' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          <Clock size={14} /> 古いパッチ情報 ({outdatedList.length})
        </button>

        <button
          onClick={() => setActiveFilter('incomplete')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
            activeFilter === 'incomplete' ? 'bg-rose-600 text-white shadow-md' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          <ShieldAlert size={14} /> 欠損・空項目あり ({incompleteList.length})
        </button>

        <button
          onClick={() => setActiveFilter('knowledge')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
            activeFilter === 'knowledge' ? 'bg-indigo-600 text-white shadow-md' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          <Database size={14} /> ナレッジDB棚卸し ({knowledgeItems.length})
        </button>
      </div>

      {/* --- 各ビューの表示 --- */}
      {loading ? (
        <div className="p-12 text-center text-xs text-stone-400 font-bold flex flex-col items-center gap-2">
          <RefreshCw className="animate-spin text-stone-400" size={24} />
          棚卸しデータを全自動走査中...
        </div>
      ) : (
        <>
          {/* 1. 人間未確認リスト */}
          {activeFilter === 'unverified' && (
            <div className="space-y-3">
              <p className="text-xs text-stone-500 font-bold">
                以下のチャンピオンはAIによる自動補全後、まだ人間が「最終点検」を行っていません。「確認済みに設定」または「辞典へ遷移」して棚卸しを完了させてください。
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-1">
                {unverifiedList.map((f) => (
                  <div key={f.champion_name} className="p-3.5 rounded-2xl border border-stone-200 bg-stone-50/50 flex items-center justify-between gap-3 hover:bg-white hover:border-amber-300 transition">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img src={getChampIcon(f.champion_name)} alt={f.display_name} className="w-10 h-10 rounded-xl border border-stone-200 object-cover shrink-0" />
                      <div className="min-w-0">
                        <span className="font-extrabold text-stone-900 text-xs truncate block">{f.display_name}</span>
                        <span className="text-[10px] text-stone-400 block font-mono">{f.champion_name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleVerify(f.champion_name)}
                        disabled={actionLoading === f.champion_name}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition flex items-center gap-1"
                        title="人間確認済みにマーク"
                      >
                        <Check size={12} /> 確認
                      </button>
                      <Link
                        href={`/champions?champion=${f.champion_name}`}
                        className="p-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 transition text-[10px] font-bold"
                        title="辞典を開いて直接編集"
                      >
                        <ExternalLink size={12} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. 古いパッチトレンド */}
          {activeFilter === 'outdated' && (
            <div className="space-y-3">
              <p className="text-xs text-stone-500 font-bold">
                解析から3日以上経っているため、情報が最新パッチとズレている可能性があるチャンピオン一覧です。
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-1">
                {outdatedList.map((f) => (
                  <div key={f.champion_name} className="p-3.5 rounded-2xl border border-stone-200 bg-stone-50/50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <img src={getChampIcon(f.champion_name)} alt={f.display_name} className="w-10 h-10 rounded-xl border border-stone-200 object-cover shrink-0" />
                      <div>
                        <span className="font-extrabold text-stone-900 text-xs block">{f.display_name}</span>
                        <span className="text-[10px] text-cyan-700 font-bold bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200">
                          {f.patch_meta_patch ? `Patch ${f.patch_meta_patch}` : '未解析'}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/champions?champion=${f.champion_name}`}
                      className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-[10px] font-bold transition flex items-center gap-1 shadow-sm"
                    >
                      最新化する <ArrowRight size={12} />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. 欠損・空項目あり */}
          {activeFilter === 'incomplete' && (
            <div className="space-y-3">
              <p className="text-xs text-stone-500 font-bold">
                強み、弱み、パワースパイク、コアビルドなどの基本項目の一部がまだ入力されていないチャンピオン一覧です。
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-1">
                {incompleteList.map((f) => (
                  <div key={f.champion_name} className="p-3.5 rounded-2xl border border-stone-200 bg-stone-50/50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <img src={getChampIcon(f.champion_name)} alt={f.display_name} className="w-10 h-10 rounded-xl border border-stone-200 object-cover shrink-0" />
                      <div>
                        <span className="font-extrabold text-stone-900 text-xs block">{f.display_name}</span>
                        <div className="flex gap-1 text-[9px] font-bold text-rose-600 mt-0.5">
                          {!f.has_strengths && <span>[強み欠損]</span>}
                          {!f.has_weaknesses && <span>[弱み欠損]</span>}
                          {!f.has_power_spikes && <span>[スパイク欠損]</span>}
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/champions?champion=${f.champion_name}`}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold transition flex items-center gap-1 shadow-sm"
                    >
                      補全する <ArrowRight size={12} />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. ナレッジDB棚卸し */}
          {activeFilter === 'knowledge' && (
            <div className="space-y-3">
              <p className="text-xs text-stone-500 font-bold">
                Discordコピペや外部から取り込まれた知見データ一覧です。不要になった項目や過去データの棚卸し・削除を行えます。
              </p>
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {knowledgeItems.length === 0 ? (
                  <p className="text-xs text-stone-400 italic">取り込まれたナレッジデータはありません。</p>
                ) : (
                  knowledgeItems.map((item) => (
                    <div key={item.id} className="p-3.5 rounded-2xl border border-stone-200 bg-stone-50/60 flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-stone-900 text-xs">{item.champion}</span>
                          {item.enemy_champion && (
                            <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full border border-rose-200">
                              vs {item.enemy_champion}
                            </span>
                          )}
                          <span className="text-[10px] bg-stone-200 text-stone-700 font-bold px-2 py-0.5 rounded-full">
                            {item.category}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-stone-800 block">{item.title}</span>
                        <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">{item.content}</p>
                      </div>

                      <button
                        onClick={() => handleDeleteKb(item.id)}
                        className="p-1.5 rounded-lg bg-stone-200 hover:bg-rose-100 hover:text-rose-700 text-stone-600 transition shrink-0"
                        title="このナレッジを削除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
