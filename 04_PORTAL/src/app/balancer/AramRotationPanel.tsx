"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Shuffle, Users, Swords, Eye, CheckCircle2, Copy, Play, ArrowRight, RotateCcw, Shield, Sparkles,
  Flame, Dices, RefreshCw, Trophy, Award, Gift, Settings, Plus, Trash2, Tag, AlertTriangle, X
} from "lucide-react";
import { 
  RotationPlayer, RotationResult, calculateNextRotation, advanceRotationState 
} from "@/lib/rotationEngine";
import { PartyChaosRule, DEFAULT_PARTY_RULES } from "@/lib/partyRules";

interface AramRotationPanelProps {
  availablePlayers: any[];
  isAdmin?: boolean;
}

const TAG_OPTIONS = [
  "アイテム縛り",
  "ビルド縛り",
  "ロール縛り",
  "サモスペ縛り",
  "キャラ縛り",
  "ドラフト縛り",
  "お遊びルール",
  "通常ARAM"
];

export default function AramRotationPanel({ availablePlayers, isAdmin = false }: AramRotationPanelProps) {
  // モード選択 ('aram' | 'party_chaos')
  const [customMode, setCustomMode] = useState<'party_chaos' | 'aram'>('party_chaos');

  // ルール一覧（APIから取得）
  const [partyRules, setPartyRules] = useState<PartyChaosRule[]>(DEFAULT_PARTY_RULES);
  const [loadingRules, setLoadingRules] = useState(false);

  // 管理者ルール管理モーダル / パネル
  const [showRuleManager, setShowRuleManager] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newTag, setNewTag] = useState("お遊びルール");
  const [submittingRule, setSubmittingRule] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 選択されたプレイヤーのID一覧
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // ローテーション中のプレイヤー状態
  const [rotationPool, setRotationPool] = useState<RotationPlayer[]>([]);
  
  // 現在のラウンド結果
  const [currentRound, setCurrentRound] = useState<RotationResult | null>(null);
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const [currentRule, setCurrentRule] = useState<PartyChaosRule | null>(null);
  const [copied, setCopied] = useState(false);

  // ルール一覧をAPIから取得
  const fetchRules = async () => {
    try {
      setLoadingRules(true);
      const res = await fetch("/api/admin/party-rules");
      const data = await res.json();
      if (res.ok && data.ok && Array.isArray(data.rules) && data.rules.length > 0) {
        setPartyRules(data.rules);
      }
    } catch (e) {
      console.warn("Failed to fetch party rules:", e);
    } finally {
      setLoadingRules(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  // 新規ルール追加
  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim()) {
      setActionMessage({ type: 'error', text: 'タイトルと説明を入力してください。' });
      return;
    }

    try {
      setSubmittingRule(true);
      setActionMessage(null);

      const res = await fetch("/api/admin/party-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: newTitle.trim(),
          desc: newDesc.trim(),
          tag: newTag.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setPartyRules(data.rules);
        setNewTitle("");
        setNewDesc("");
        setActionMessage({ type: 'success', text: '🎉 新しい縛りルールを追加しました！' });
      } else {
        setActionMessage({ type: 'error', text: data.error || 'ルールの追加に失敗しました。' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: '通信エラーが発生しました。' });
    } finally {
      setSubmittingRule(false);
    }
  };

  // ルール削除
  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm("この縛りルールを削除してもよろしいですか？")) return;

    try {
      setActionMessage(null);
      const res = await fetch(`/api/admin/party-rules?id=${encodeURIComponent(ruleId)}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setPartyRules(data.rules);
        setActionMessage({ type: 'success', text: '🗑️ ルールを削除しました。' });
      } else {
        setActionMessage({ type: 'error', text: data.error || 'ルールの削除に失敗しました。' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: '通信エラーが発生しました。' });
    }
  };

  // デフォルト初期化
  const handleResetRules = async () => {
    if (!confirm("ルール一覧をデフォルトの初期状態に戻しますか？（カスタムルールは消去されます）")) return;

    try {
      setActionMessage(null);
      const res = await fetch("/api/admin/party-rules", {
        method: "PUT",
        credentials: "include",
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setPartyRules(data.rules);
        setActionMessage({ type: 'success', text: '🔄 ルールを初期状態にリセットしました。' });
      } else {
        setActionMessage({ type: 'error', text: data.error || 'リセットに失敗しました。' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: '通信エラーが発生しました。' });
    }
  };

  // プレイヤー選択のトグル
  const togglePlayer = (p: any) => {
    if (selectedIds.includes(p.id)) {
      setSelectedIds(selectedIds.filter((id) => id !== p.id));
    } else {
      setSelectedIds([...selectedIds, p.id]);
    }
  };

  // 全選択 / 解除
  const selectAll = () => {
    if (selectedIds.length === availablePlayers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(availablePlayers.map((p) => p.id));
    }
  };

  // ランダムルールの抽選
  const pickRandomRule = () => {
    if (customMode === 'aram') {
      return partyRules.find((r) => r.id === 'standard_aram') || partyRules[0];
    }
    if (partyRules.length === 0) return DEFAULT_PARTY_RULES[0];
    const idx = Math.floor(Math.random() * partyRules.length);
    return partyRules[idx];
  };

  // ローテーションセッション開始（第1ラウンド選出）
  const startRotation = () => {
    const selected = availablePlayers.filter((p) => selectedIds.includes(p.id));
    if (selected.length < 10) return;

    const initialPool: RotationPlayer[] = selected.map((p) => ({
      id: p.id,
      name: p.name,
      ign: p.ign || "",
      highest_rank: p.highest_rank || "UNRANKED",
      mmr: p.mmr || 1200,
      gamesPlayed: 0,
      benchedCount: 0,
      consecutivePlayed: 0,
      wasBenchedLastGame: false,
    }));

    setRotationPool(initialPool);
    setRoundNumber(1);
    setCurrentRule(pickRandomRule());
    const result = calculateNextRotation(initialPool, 1);
    setCurrentRound(result);
  };

  // 試合終了 ➔ 次のラウンドへ進む
  const handleNextGame = () => {
    if (!currentRound) return;

    // 現在のスタメン10人を記録し、プールを更新
    const activeIds = currentRound.activePlayers.map((p) => p.id);
    const updatedPool = advanceRotationState(rotationPool, activeIds);
    setRotationPool(updatedPool);

    const nextRoundNum = roundNumber + 1;
    setRoundNumber(nextRoundNum);
    setCurrentRule(pickRandomRule());

    const nextResult = calculateNextRotation(updatedPool, nextRoundNum);
    setCurrentRound(nextResult);
  };

  // ルールの再抽選
  const rerollRule = () => {
    setCurrentRule(pickRandomRule());
  };

  // セッションリセット
  const handleReset = () => {
    setCurrentRound(null);
    setRotationPool([]);
    setRoundNumber(1);
    setCurrentRule(null);
  };

  // Discord共有テキスト作成
  const copyDiscordFormat = () => {
    if (!currentRound) return;

    const blueNames = currentRound.blueTeam.map((p) => p.name).join(", ");
    const redNames = currentRound.redTeam.map((p) => p.name).join(", ");
    const benchNames = currentRound.benchedPlayers.length > 0
      ? currentRound.benchedPlayers.map((p) => p.name).join(", ")
      : "なし";

    let ruleText = "";
    if (currentRule && customMode === 'party_chaos') {
      ruleText = `\n📜 **【今試合のスペシャル縛りルール】**\n👉 **${currentRule.title}**\n${currentRule.desc}\n`;
    }

    const text = `🎉 **【お祭り・ARAMカスタム 第${roundNumber}試合】**\n` +
      ruleText +
      `🔵 **BLUEチーム**: ${blueNames}\n` +
      `🔴 **REDチーム**: ${redNames}\n` +
      `👀 **観戦・待機枠 (次戦確定出場)**: ${benchNames}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="bg-[#2b2620]/90 border border-amber-500/20 rounded-2xl p-6 sm:p-8 shadow-xl space-y-8">
      
      {/* ヘッダー ＆ モード選択 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-800 pb-5">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Shuffle className="w-5 h-5 text-amber-400" />
            <span>🔄 10人以上 お祭り・ARAM公平ローテーション ＆ 観戦シャッフル</span>
          </h2>
          <p className="text-xs sm:text-sm text-stone-400 mt-1 leading-relaxed">
            大人数が集まった時に、毎試合自動で観戦者をスタメン交代させながら全員が均等にプレイできます。
            <strong className="text-amber-400"> 観戦したメンバーは次の試合で100%スタメン出場します。</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* 管理者限定ルール設定ボタン */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowRuleManager(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
              title="お祭りカスタムの縛りルールを追加・管理"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>🛠️ ルール設定 ({partyRules.length}種)</span>
            </button>
          )}

          {currentRound ? (
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>メンバーを選び直す</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-stone-900/80 border border-stone-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setCustomMode('party_chaos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  customMode === 'party_chaos'
                    ? 'bg-amber-500 text-stone-950 shadow'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                🎲 カオス縛りルーレット付き
              </button>
              <button
                type="button"
                onClick={() => setCustomMode('aram')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  customMode === 'aram'
                    ? 'bg-amber-500 text-stone-950 shadow'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                ❄️ 通常 ARAM
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 参加者選択フェーズ */}
      {!currentRound ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-stone-300 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              <span>参加者を選択 ({selectedIds.length}名 選択中)</span>
            </div>
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-amber-400 hover:text-amber-300 font-bold transition cursor-pointer"
            >
              {selectedIds.length === availablePlayers.length ? "選択解除" : "全員選択"}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 max-h-96 overflow-y-auto pr-1">
            {availablePlayers.map((p) => {
              const isSelected = selectedIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlayer(p)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? "bg-amber-500/15 border-amber-500/60 text-white shadow-md shadow-amber-500/10 scale-[1.02]"
                      : "bg-stone-900/60 border-stone-800/80 text-stone-400 hover:border-stone-700 hover:text-stone-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black truncate">{p.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-800 text-stone-400 font-mono">
                      {p.highest_rank || "UNR"}
                    </span>
                  </div>
                  {p.ign && <div className="text-[10px] text-stone-500 truncate mt-1">{p.ign}</div>}
                </button>
              );
            })}
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-stone-400">
              {selectedIds.length < 10 ? (
                <span className="text-rose-400 font-bold">⚠️ 10人以上選択してください（あと {10 - selectedIds.length}人）</span>
              ) : (
                <span className="text-emerald-400 font-bold">
                  ✨ {selectedIds.length}人選択中（スタメン10人 ＋ 観戦待機 {selectedIds.length - 10}人）
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={startRotation}
              disabled={selectedIds.length < 10}
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>第1試合を開始 ＆ ルール抽選</span>
            </button>
          </div>
        </div>
      ) : (
        /* ローテーション試合進行フェーズ */
        <div className="space-y-8 animate-fade-in">
          
          {/* スペシャル縛りルールバナー（お祭りカスタムモード時） */}
          {currentRule && customMode === 'party_chaos' && (
            <div className="bg-gradient-to-r from-amber-950/40 via-stone-900 to-amber-950/40 border border-amber-500/40 rounded-2xl p-5 shadow-xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500 text-stone-950 text-[10px] font-black uppercase">
                      {currentRule.tag}
                    </span>
                    <h3 className="text-lg font-black text-amber-300">
                      {currentRule.title}
                    </h3>
                  </div>
                  <p className="text-xs text-stone-300 leading-relaxed font-medium">
                    {currentRule.desc}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={rerollRule}
                  title="縛りルールを再抽選"
                  className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-400 text-xs font-bold flex items-center gap-1.5 transition self-start sm:self-center border border-amber-500/30 cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>ルール再抽選</span>
                </button>
              </div>
            </div>
          )}

          {/* ラウンド表示 ＆ アクション */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-900/60 border border-stone-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-black text-lg">
                #{roundNumber}
              </div>
              <div>
                <h3 className="text-base font-black text-white">第 {roundNumber} 試合</h3>
                <p className="text-xs text-stone-400">
                  総参加者: {rotationPool.length}名 (スタメン10名 / 観戦{currentRound.benchedPlayers.length}名)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copyDiscordFormat}
                className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? "コピー完了！" : "Discord用にコピー"}</span>
              </button>

              <button
                type="button"
                onClick={handleNextGame}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 text-xs font-black flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition cursor-pointer"
              >
                <span>試合終了 ➔ 次の試合へ</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* チーム分け表示 (BLUE vs RED) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* BLUE TEAM */}
            <div className="bg-blue-950/20 border border-blue-500/30 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-blue-500/20">
                <span className="text-xs font-black text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  BLUE TEAM (5人)
                </span>
              </div>
              <div className="space-y-2">
                {currentRound.blueTeam.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-xl bg-blue-900/20 border border-blue-500/20 flex items-center justify-between"
                  >
                    <span className="text-xs font-bold text-blue-200">{p.name}</span>
                    <span className="text-[10px] text-blue-400/80 font-mono">出場: {p.gamesPlayed}回</span>
                  </div>
                ))}
              </div>
            </div>

            {/* RED TEAM */}
            <div className="bg-rose-950/20 border border-rose-500/30 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-rose-500/20">
                <span className="text-xs font-black text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  RED TEAM (5人)
                </span>
              </div>
              <div className="space-y-2">
                {currentRound.redTeam.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-xl bg-rose-900/20 border border-rose-500/20 flex items-center justify-between"
                  >
                    <span className="text-xs font-bold text-rose-200">{p.name}</span>
                    <span className="text-[10px] text-rose-400/80 font-mono">出場: {p.gamesPlayed}回</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 観戦・待機枠 */}
          {currentRound.benchedPlayers.length > 0 && (
            <div className="bg-stone-900/80 border border-amber-500/30 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-400" />
                  <span>👀 観戦・待機枠 ({currentRound.benchedPlayers.length}名)</span>
                </span>
                <span className="text-[11px] text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  次戦 100% スタメン確定出場
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {currentRound.benchedPlayers.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-[#2b2620] border border-amber-500/30 flex flex-col justify-between"
                  >
                    <span className="text-xs font-black text-white">{p.name}</span>
                    <span className="text-[10px] text-stone-400 mt-1">待機: {p.benchedCount}回</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 全員の参加ステータス一覧 */}
          <div className="bg-stone-900/40 border border-stone-800 rounded-xl p-4">
            <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">
              📊 全員の出場バランス
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {rotationPool.map((p) => {
                const isPlaying = currentRound.activePlayers.some((a) => a.id === p.id);
                return (
                  <div
                    key={p.id}
                    className={`p-2 rounded-lg border text-xs ${
                      isPlaying
                        ? "bg-stone-800/80 border-stone-700 text-stone-200"
                        : "bg-amber-950/20 border-amber-500/30 text-amber-200"
                    }`}
                  >
                    <div className="font-bold truncate">{p.name}</div>
                    <div className="text-[10px] text-stone-400 mt-0.5">
                      {p.gamesPlayed}試合 / 待機{p.benchedCount}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* 🛠️ 管理者限定：縛りルール管理モーダル */}
      {showRuleManager && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setShowRuleManager(false); }}
        >
          <div className="bg-[#1c1917] border border-amber-500/40 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in my-6">
            {/* モーダルヘッダー */}
            <div className="p-4 sm:p-5 bg-[#2b2620] border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white">
                  お祭りカスタム 縛りルール管理 (管理者専用)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRuleManager(false)}
                className="p-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              
              {/* 通知メッセージ */}
              {actionMessage && (
                <div className={`p-3 rounded-xl border text-xs font-bold ${
                  actionMessage.type === 'success'
                    ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-500 text-rose-200'
                }`}>
                  {actionMessage.text}
                </div>
              )}

              {/* ➕ 新規ルール追加フォーム */}
              <form onSubmit={handleAddRule} className="bg-stone-900/80 border border-stone-800 rounded-xl p-4 space-y-3">
                <div className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                  <Plus className="w-4 h-4" />
                  <span>新しい縛りルールを追加</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-stone-400 mb-1">ルール名</label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="例: ⚡ 全員ゴースト＋イグナイト戦"
                      className="w-full bg-[#1c1917] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-400 mb-1">タグ</label>
                    <select
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      className="w-full bg-[#1c1917] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
                    >
                      {TAG_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-stone-400 mb-1">ルール説明・達成条件</label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    rows={2}
                    placeholder="例: フラッシュ禁止！全員サモナースペルをゴーストとイグナイトに統一して戦おう！"
                    className="w-full bg-[#1c1917] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-amber-500 resize-none"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={submittingRule}
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs flex items-center gap-1.5 shadow transition disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{submittingRule ? '追加中...' : 'ルールを追加する'}</span>
                  </button>
                </div>
              </form>

              {/* 📜 登録済みルール一覧 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                    登録済みルール一覧 ({partyRules.length}件)
                  </div>
                  <button
                    type="button"
                    onClick={handleResetRules}
                    className="text-[11px] text-stone-500 hover:text-stone-300 transition cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>デフォルト初期化</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {partyRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="p-3 rounded-xl bg-stone-900/60 border border-stone-800 flex items-start justify-between gap-3 group hover:border-stone-700 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.2 rounded bg-stone-800 border border-stone-700 text-amber-300 text-[10px] font-bold">
                            {rule.tag}
                          </span>
                          <span className="text-xs font-black text-white">{rule.title}</span>
                          {rule.isCustom && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-mono">
                              CUSTOM
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-400 leading-relaxed">{rule.desc}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-1.5 rounded-lg bg-stone-800 hover:bg-rose-900/40 text-stone-500 hover:text-rose-400 border border-transparent hover:border-rose-500/40 transition cursor-pointer shrink-0"
                        title="このルールを削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
