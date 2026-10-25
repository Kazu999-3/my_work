"use client";

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Award,
  TrendingUp,
  Target,
  Shield,
  Clock,
  RefreshCw,
  Share2,
  Lock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { CustomCoachReport } from '../../lib/customCoach';

interface CoachReportCardProps {
  playerName: string;
  isMe: boolean;
  isAdmin: boolean;
}

export default function CoachReportCard({ playerName, isMe, isAdmin }: CoachReportCardProps) {
  const [report, setReport] = useState<CustomCoachReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 初回ロード: 保存済みカルテを取得
  useEffect(() => {
    let mounted = true;
    async function loadReport() {
      try {
        setLoading(true);
        setErrorMsg(null);
        const res = await fetch(`/api/coach/custom?playerName=${encodeURIComponent(playerName)}`);
        const data = await res.json();
        if (mounted && data.ok) {
          setReport(data.report);
          setIsPrivate(Boolean(data.isPrivate));
        }
      } catch (err) {
        console.warn('Failed to load coach report:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (playerName) {
      loadReport();
    }
    return () => {
      mounted = false;
    };
  }, [playerName]);

  // 手動オンデマンド診断を実行
  const handleRunAnalysis = async () => {
    if (analyzing) return;
    try {
      setAnalyzing(true);
      setErrorMsg(null);
      const res = await fetch('/api/coach/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || '診断に失敗しました');
      }
      setReport(data.report);
      setIsPrivate(false);
      try {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'],
        });
      } catch {}
    } catch (err: any) {
      setErrorMsg(err.message || '通信エラーが発生しました');
    } finally {
      setAnalyzing(false);
    }
  };

  // 自慢シェアボタン（強みと称号をクリップボードにコピー）
  const handleShare = () => {
    if (!report) return;
    const lines = [
      `🏅 **【KTM専属AIコーチカルテ】** プレイヤー: **${report.playerName}**`,
      `🎖️ **認定称号**: ${report.coachBadge.icon} **${report.coachBadge.title}** (${report.coachBadge.description})`,
      `🌟 **ストロングポイント**:`,
      ...report.strengths.map(s => `・${s.title}: ${s.detail}`),
      `\n💬 *「${report.coachCheerMessage}」*`,
      `\n🔗 ポータルでカルテ確認: ${window.location.href}`,
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  if (loading) {
    return (
      <div className="bg-surface/80 border border-border/80 rounded-3xl p-6 sm:p-8 animate-pulse space-y-4">
        <div className="h-6 w-48 bg-black/10 rounded-lg"></div>
        <div className="h-24 bg-black/5 rounded-2xl"></div>
      </div>
    );
  }

  // 他人のページで未診断または完全非公開の場合
  if (!isMe && !isAdmin && (!report || isPrivate)) {
    return (
      <div className="bg-surface/60 border border-border/80 rounded-3xl p-6 sm:p-8 text-center space-y-3">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-black/5 flex items-center justify-center text-muted text-xl">
          <Lock className="w-6 h-6 text-muted-strong" />
        </div>
        <h4 className="text-base font-black text-foreground">専属AIコーチカルテは非公開です</h4>
        <p className="text-xs text-muted max-w-md mx-auto">
          専属AIコーチによる弱点・白黒画面時間・改善カルテは、プライバシー保護のため本人のみ閲覧可能となっています。
        </p>
      </div>
    );
  }

  // 本人でまだ一度も診断していない場合
  if (!report) {
    return (
      <div className="bg-gradient-to-br from-primary-500/10 via-surface to-secondary-500/10 border border-primary-edge/60 rounded-3xl p-6 sm:p-8 shadow-md space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary-500/20 text-primary-900 border border-primary-edge flex items-center gap-1 w-fit">
              <Sparkles className="w-3 h-3 text-primary-600" />
              オンデマンド手動分析
            </span>
            <h3 className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2">
              <span>🤖</span>
              <span>専属AIコーチのカルテ診断を受ける</span>
            </h3>
            <p className="text-xs text-muted">
              直近のカスタム生データ（ダメージ量、白黒画面時間、孤立デス、アイテム選択）に基づき、あなたの強みと次戦の勝率アップ秘訣を診断します。
            </p>
          </div>

          <button
            type="button"
            onClick={handleRunAnalysis}
            disabled={analyzing}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-primary-500 via-primary-400 to-primary-500 hover:from-primary-400 hover:to-primary-300 text-stone-950 font-black text-sm shadow-md transition-all hover:scale-102 active:scale-98 cursor-pointer shrink-0 flex items-center gap-2 animate-pulse"
          >
            {analyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-stone-950" />
                <span>生スタッツを精密分析中...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-stone-950" />
                <span>無料カルテ診断を開始</span>
              </>
            )}
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-danger-500/10 border border-danger-edge-soft text-danger-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>
    );
  }

  // 診断カルテの表示
  const { coachBadge, keyStats, strengths, improvementFocus, itemAndBuildAdvice, soloqGapAnalysis, coachCheerMessage, analyzedMatchesCount, overallRating } = report;

  return (
    <div className="bg-surface/90 border border-border rounded-3xl p-5 sm:p-8 shadow-lg space-y-6 relative overflow-hidden">
      {/* 上部ヘッダー */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary-500/20 text-secondary-800 border border-secondary-edge-soft flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-secondary-600" />
              直近 {analyzedMatchesCount} 試合のカスタム生データ分析
            </span>
            <span className="text-xs font-mono text-faint">
              診断日: {new Date(report.createdAt).toLocaleDateString('ja-JP')}
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
            <span>🤖</span>
            <span>{playerName} 専属AIコーチカルテ</span>
          </h3>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          <button
            type="button"
            onClick={handleShare}
            className="px-3.5 py-2 rounded-xl bg-surface-subtle hover:bg-surface-hover border border-border text-foreground text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
            title="強みと認定バッジをコピーしてDiscordに共有"
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-success-600" />
                <span className="text-success-600">コピー完了！</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-muted-strong" />
                <span>自慢シェア</span>
              </>
            )}
          </button>

          {(isMe || isAdmin) && (
            <button
              type="button"
              onClick={handleRunAnalysis}
              disabled={analyzing}
              className="px-3.5 py-2 rounded-xl bg-primary-500/10 hover:bg-primary-500/20 border border-primary-edge text-primary-900 text-xs font-black flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              title="最新の試合スタッツでカルテを再生成"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
              <span>{analyzing ? '分析中...' : '再診断'}</span>
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-danger-500/10 border border-danger-edge-soft text-danger-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 🏅 コーチ認定バッジ ＆ 総合サマリー */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* バッジ枠 */}
        <div className="md:col-span-2 bg-gradient-to-r from-amber-500/15 via-primary-500/10 to-amber-500/5 border border-amber-500/30 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-stone-950 flex items-center justify-center text-3xl shadow-md shrink-0">
            {coachBadge?.icon || '🏅'}
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-900 border border-amber-500/30">
                専属コーチ認定称号
              </span>
              <span className="text-xs font-mono font-black text-amber-600 bg-black/10 px-2 py-0.5 rounded-md">
                総合評価: GRADE {overallRating}
              </span>
            </div>
            <h4 className="text-lg sm:text-xl font-black text-foreground truncate">
              {coachBadge?.title}
            </h4>
            <p className="text-xs text-muted leading-relaxed">
              {coachBadge?.description}
            </p>
          </div>
        </div>

        {/* スタッツ小窓 */}
        <div className="bg-surface-subtle/80 border border-border/80 rounded-2xl p-4 flex flex-col justify-around">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted font-bold">主ロール / チャンプ</span>
            <span className="font-black text-foreground">{keyStats.mainRole} ({keyStats.mostPlayedChamp})</span>
          </div>
          <div className="flex justify-between items-center text-xs mt-2">
            <span className="text-muted font-bold">平均KDA</span>
            <span className="font-mono font-black text-foreground">{keyStats.avgKda}</span>
          </div>
          <div className="flex justify-between items-center text-xs mt-2">
            <span className="text-muted font-bold">平均ダメージ</span>
            <span className="font-mono font-black text-primary-600">{keyStats.avgDamage.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-xs mt-2">
            <span className="text-muted font-bold">平均白黒時間</span>
            <span className="font-mono font-black text-danger-600">
              {Math.floor(keyStats.avgTimeDeadSec / 60)}分{keyStats.avgTimeDeadSec % 60}秒
            </span>
          </div>
        </div>
      </div>

      {/* 🌟 あなたのストロングポイント（強み） */}
      <div className="space-y-3">
        <h4 className="text-xs font-black uppercase tracking-wider text-muted-strong flex items-center gap-1.5">
          <Award className="w-4 h-4 text-primary-600" />
          <span>あなたのストロングポイント（武器）</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {strengths?.map((s, idx) => (
            <div key={idx} className="bg-surface-subtle p-4 rounded-2xl border border-border/70 space-y-1 hover:border-primary-edge transition">
              <div className="text-xs font-black text-primary-900 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-600 shrink-0"></span>
                <span>{s.title}</span>
              </div>
              <p className="text-xs text-muted leading-relaxed pl-3">
                {s.detail}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 🎯 次戦で勝率が上がる1つの具体的一手（改善ポイント・白黒時間分析） */}
      {improvementFocus && (
        <div className="bg-gradient-to-r from-danger-500/10 via-surface-subtle to-danger-500/5 border border-danger-edge-soft/60 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="text-xs font-black uppercase tracking-wider text-danger-700 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-danger-600" />
              <span>次戦で勝率が上がる1つの具体的一手（実践フォーカス）</span>
            </h4>
            <span className="text-[10px] font-mono text-faint flex items-center gap-1">
              <Clock className="w-3 h-3" />
              白黒時間・孤立デス分析
            </span>
          </div>

          <div className="text-sm font-black text-foreground">
            {improvementFocus.headline}
          </div>

          <p className="text-xs text-muted leading-relaxed">
            {improvementFocus.analysis}
          </p>

          <div className="p-3 bg-surface rounded-xl border border-border/80 text-xs font-bold text-foreground-subtle flex items-start gap-2">
            <span className="text-base shrink-0">💡</span>
            <div className="leading-relaxed">
              <span className="text-primary-700 font-black">【実践アクション】: </span>
              {improvementFocus.actionableAdvice}
            </div>
          </div>
        </div>
      )}

      {/* 🛡️ ビルド＆アイテム診断 */}
      {itemAndBuildAdvice && (
        <div className="bg-surface-subtle p-4 rounded-2xl border border-border/70 space-y-2">
          <h4 className="text-xs font-black uppercase tracking-wider text-muted-strong flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-secondary-600" />
            <span>ビルド＆アイテム選択ワンポイント</span>
          </h4>
          <div className="text-xs text-muted leading-relaxed">
            <strong className="text-foreground font-black">{itemAndBuildAdvice.summary}</strong>
            <p className="mt-1 text-faint">{itemAndBuildAdvice.recommendedTip}</p>
          </div>
        </div>
      )}

      {/* 🎮 ソロQ×カスタム 立ち回りギャップ分析 */}
      {soloqGapAnalysis && soloqGapAnalysis.hasSoloqData && (
        <div className="bg-gradient-to-r from-secondary-500/10 via-surface-subtle to-secondary-500/5 border border-secondary-edge-soft/60 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="text-xs font-black uppercase tracking-wider text-secondary-800 flex items-center gap-1.5">
              <span>🎮</span>
              <span>ソロキュー × KTMカスタム 立ち回りギャップ診断</span>
            </h4>
            <span className="text-[10px] font-mono text-faint bg-secondary-100 dark:bg-secondary-950/40 text-secondary-800 px-2 py-0.5 rounded border border-secondary-edge-soft">
              最高到達: {soloqGapAnalysis.soloqRank}
            </span>
          </div>

          <p className="text-xs text-muted leading-relaxed">
            {soloqGapAnalysis.tendencyDifference}
          </p>

          <div className="p-3 bg-surface rounded-xl border border-border/80 text-xs font-bold text-foreground-subtle flex items-start gap-2">
            <span className="text-base shrink-0">⚡</span>
            <div className="leading-relaxed">
              <span className="text-secondary-700 font-black">【カスタムでの武器活用法】: </span>
              {soloqGapAnalysis.synergyAdvice}
            </div>
          </div>
        </div>
      )}

      {/* 💬 コーチからの熱い激励 */}
      {coachCheerMessage && (
        <div className="p-4 bg-primary-500/10 border border-primary-edge rounded-2xl flex items-center gap-3">
          <span className="text-2xl shrink-0">📣</span>
          <div className="text-xs font-bold text-primary-950 leading-relaxed italic">
            「{coachCheerMessage}」
          </div>
        </div>
      )}
    </div>
  );
}
